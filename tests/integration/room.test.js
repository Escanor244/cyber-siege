import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRoom } from "../../src/net/memoryRoom.js";
import { publicView } from "../../src/shared/rules/state.js";
import { STARTING_GOLD } from "../../src/shared/index.js";
import { useFakeClock, advance, until, joinAs, view, me, timers, now } from "../helpers/clients.js";

let room;
let lastSnapshot;

function newRoom(opts = {}) {
  room = createMemoryRoom({
    roomId: "ROOM1",
    seed: 1234,
    timers,
    now,
    onPersist: (s) => (lastSnapshot = s ? structuredClone(s) : null),
    ...opts,
  });
  return room;
}

beforeEach(() => {
  useFakeClock();
  lastSnapshot = null;
});

afterEach(() => {
  room?.stop();
  vi.useRealTimers();
});

const names = (client) => (view(client)?.players || []).map((p) => `${p.slot}:${p.name}:${p.connected ? "on" : "off"}`);

describe("lobby (the 'join after waiting' bug)", () => {
  it.each([1_000, 30_000, 120_000])("guest joining after %ims is seen by both players", async (waitMs) => {
    newRoom();
    const host = joinAs(room, { intent: "create", name: "Host" });
    await advance(waitMs);
    const guest = joinAs(room, { intent: "join", name: "Guest" });
    await advance(500);
    expect(names(host)).toEqual(["p1:Host:on", "p2:Guest:on"]);
    expect(names(guest)).toEqual(["p1:Host:on", "p2:Guest:on"]);
  });

  it("works when the room hibernates (restarts from storage) between create and join", async () => {
    newRoom();
    const host = joinAs(room, { intent: "create", name: "Host" });
    await advance(15_000);
    room.restart(lastSnapshot); // Durable Object evicted and woken by the guest
    const guest = joinAs(room, { intent: "join", name: "Guest" });
    await advance(500);
    expect(names(guest)).toEqual(["p1:Host:on", "p2:Guest:on"]);
    expect(names(host)).toEqual(["p1:Host:on", "p2:Guest:on"]);
    // and the host can still start the match
    host.store.start();
    await advance(500);
    expect(view(host).phase).toBe("playing");
    expect(view(guest).phase).toBe("playing");
  });

  it("works when the host's connection dropped while waiting, and the host resumes its seat", async () => {
    newRoom();
    const tokenBox = { token: null };
    const host = joinAs(room, { intent: "create", name: "Host", tokenBox });
    await advance(500);
    const hostId = host.store.getState().playerId;
    host.disconnect(); // phone switched apps to share the code
    await advance(10_000);
    const guest = joinAs(room, { intent: "join", name: "Guest" });
    await advance(500);
    expect(names(guest)).toEqual(["p1:Host:off", "p2:Guest:on"]);

    const back = joinAs(room, { intent: "create", name: "Host", tokenBox });
    await advance(500);
    expect(back.store.getState().playerId).toBe(hostId);
    expect(names(back)).toEqual(["p1:Host:on", "p2:Guest:on"]);
    expect(names(guest)).toEqual(["p1:Host:on", "p2:Guest:on"]);
  });

  it("rejects stealing the host seat, a third player and a non-host start", async () => {
    newRoom();
    const host = joinAs(room, { intent: "create", name: "Host" });
    await advance(200);
    const thief = joinAs(room, { intent: "create", name: "Thief" });
    const guest = joinAs(room, { intent: "join", name: "Guest" });
    await advance(200);
    const third = joinAs(room, { intent: "join", name: "Third" });
    await advance(200);
    expect(thief.store.getState().reject.code).toBe("room_exists");
    expect(third.store.getState().reject.code).toBe("room_full");
    guest.store.start();
    await advance(200);
    expect(view(host).phase).toBe("lobby");
    expect(names(host)).toEqual(["p1:Host:on", "p2:Guest:on"]);
  });

  it("never sends resume tokens to other players", async () => {
    newRoom();
    const host = joinAs(room, { intent: "create", name: "Host" });
    const guest = joinAs(room, { intent: "join", name: "Guest" });
    await advance(500);
    const guestView = JSON.stringify(view(guest));
    expect(guestView).not.toContain(host.tokenBox.token);
  });

  it("joining a code nobody created is rejected", async () => {
    newRoom();
    const guest = joinAs(room, { intent: "join", name: "Guest" });
    await advance(200);
    expect(guest.store.getState().reject.code).toBe("not_found");
  });
});

async function startedMatch(opts) {
  newRoom(opts);
  const host = joinAs(room, { intent: "create", name: "Host" });
  await until(() => host.store.getState().status === "online");
  const guest = joinAs(room, { intent: "join", name: "Guest" });
  await until(() => view(host)?.players.length === 2 && view(guest)?.players.length === 2);
  host.store.start();
  await until(() => view(host)?.phase === "playing" && view(guest)?.phase === "playing");
  return { host, guest };
}

function buildDefense(client, cells) {
  for (const [type, gx, gy] of cells) client.store.build(type, gx, gy);
}

describe("full match", () => {
  it("plays a jittery 8-minute match where every creep resolves once and gold adds up", async () => {
    const { host, guest } = await startedMatch({ latencyMs: () => 20 + Math.floor(Math.random() * 280) });
    buildDefense(host, [["gatling", 1, 0], ["gatling", 3, 2]]);
    buildDefense(guest, [["gatling", 1, 0], ["gatling", 4, 4]]); // $250 start: two $100 turrets
    await until(() => room.core.match.players.every((p) => p.towers.length === 2));

    for (let minute = 0; minute < 8 && view(host).phase === "playing"; minute++) {
      host.store.sendRaid("scout_rush");
      guest.store.sendRaid("armored_squad");
      if (minute === 2) host.store.cast("frenzy_rush");
      await advance(60_000);
    }
    await advance(5_000);

    const server = room.core.match;
    // Every creep the server issued was resolved exactly once (or the match ended)
    const issuedIds = host.seen.issued.flatMap((m) => m.entries.map((e) => e.id));
    const resolvedIds = host.seen.resolved.flatMap((m) => m.items.map(([id]) => id));
    // ...and the match really was played: lots of creeps, real kills by the towers
    expect(issuedIds.length).toBeGreaterThan(40);
    expect(server.players.every((p) => p.stats.kills > 0)).toBe(true);
    expect(server.players.every((p) => p.towers.length === 2)).toBe(true);
    expect(new Set(resolvedIds).size).toBe(resolvedIds.length);
    for (const id of resolvedIds) expect(issuedIds).toContain(id);
    if (server.phase === "playing") {
      const open = Object.keys(server.ledger.open).length;
      expect(issuedIds.length).toBe(resolvedIds.length + open);
    }

    // Gold conservation (no sells in this script)
    for (const p of server.players) {
      expect(p.gold).toBe(STARTING_GOLD + p.stats.goldEarned - p.stats.goldSpent);
      expect(p.gold).toBeGreaterThanOrEqual(0);
    }

    // Both clients agree with the server after things settle
    const truth = publicView(server, now());
    for (const c of [host, guest]) {
      for (const p of truth.players) {
        const mine = view(c).players.find((x) => x.id === p.id);
        expect({ gold: mine.gold, hp: mine.hp, towers: mine.towers.length }).toEqual({ gold: p.gold, hp: p.hp, towers: p.towers.length });
      }
    }
    expect(host.seen.snaps + guest.seen.snaps).toBeGreaterThan(0);
  }, 60_000);

  it("a player who stops simulating (background tab) still takes leak damage", async () => {
    const { host, guest } = await startedMatch();
    guest.running = false; // tab frozen: never reports kills or leaks
    await advance(22_000 + 60_000);
    const g = room.core.match.players.find((p) => p.id === guest.store.getState().playerId);
    expect(g.hp).toBeLessThan(100);
    // and the opponent's screen shows the same hp the server has
    expect(view(host).players.find((p) => p.id === g.id).hp).toBe(g.hp);
  });

  it("game over is final, stats reach both clients, and rematch returns to the lobby", async () => {
    const { host, guest } = await startedMatch();
    const hostP = room.core.match.players[0];
    hostP.hp = 1; // next leak ends it
    await advance(22_000 + 25_000);
    expect(view(host).phase).toBe("game_over");
    expect(view(guest).phase).toBe("game_over");
    expect(view(guest).winnerId).toBe(guest.store.getState().playerId);
    expect(me(guest).stats).toBeDefined();
    guest.store.restart(); // only the host may restart
    await advance(300);
    expect(view(host).phase).toBe("game_over");
    host.store.restart();
    await advance(300);
    expect(view(host).phase).toBe("lobby");
    expect(view(guest).phase).toBe("lobby");
  });
});

describe("disconnects during a match", () => {
  it("pauses, then resumes when the player returns with the same seat", async () => {
    const tokenBox = { token: null };
    newRoom();
    const host = joinAs(room, { intent: "create", name: "Host" });
    await advance(300);
    let guest = joinAs(room, { intent: "join", name: "Guest", tokenBox });
    await advance(300);
    host.store.start();
    await advance(5_000);
    const guestId = guest.store.getState().playerId;
    guest.disconnect();
    await advance(1_000);
    expect(view(host).pause?.byPlayerId).toBe(guestId);
    const frozen = view(host).matchMs;
    await advance(10_000);
    expect(room.core.match.matchMs).toBe(frozen);

    guest = joinAs(room, { intent: "join", name: "Guest", tokenBox });
    await advance(1_000);
    expect(guest.store.getState().playerId).toBe(guestId);
    expect(view(host).pause).toBeNull();
    await advance(2_000);
    expect(room.core.match.matchMs).toBeGreaterThan(frozen);
  });

  it("forfeits a player who stays away for 30s", async () => {
    const { host, guest } = await startedMatch();
    guest.disconnect();
    await advance(31_000);
    expect(view(host).phase).toBe("game_over");
    expect(view(host).winnerId).toBe(host.store.getState().playerId);
  });

  it("ends in a timeout (no winner) when both players vanish, instead of staying paused forever", async () => {
    const { host, guest } = await startedMatch();
    guest.disconnect();
    await advance(1_000);
    host.disconnect();
    await advance(31_000);
    expect(room.core.match.phase).toBe("game_over");
    expect(room.core.match.endReason).toBe("timeout");
  });

  it("survives a full room restart mid-match: clients resync and keep playing", async () => {
    const { host, guest } = await startedMatch();
    await advance(30_000);
    room.restart(room.core.snapshot());
    await advance(2_000);
    host.store.build("gatling", 0, 0);
    await advance(1_000);
    expect(me(host).towers.length).toBe(1);
    expect(view(guest).players.find((p) => p.id === host.store.getState().playerId).towers.length).toBe(1);
    expect(view(host).phase).toBe("playing");
  });
});

describe("actions", () => {
  it("rejected actions come back as a toast, accepted ones update gold for both", async () => {
    const { host, guest } = await startedMatch();
    host.store.build("gatling", 3, 1); // on the path
    host.store.build("gatling", 0, 0);
    await advance(300);
    expect(host.seen.toasts).toContain("Can't build on the path");
    expect(me(host).gold).toBe(STARTING_GOLD - 100);
    expect(view(guest).players.find((p) => p.slot === "p1").gold).toBe(STARTING_GOLD - 100);
  });
});
