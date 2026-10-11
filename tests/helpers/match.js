import { createMatch, createPlayer } from "../../src/shared/rules/state.js";
import { startMatch } from "../../src/shared/rules/reducer.js";

// A running two-player match for rules tests.
export function playingMatch({ seed = 42, gold } = {}) {
  const match = createMatch({ roomId: "TEST", seed });
  const a = createPlayer({ id: "pA", name: "Alpha", slot: "p1", isHost: true });
  const b = createPlayer({ id: "pB", name: "Bravo", slot: "p2" });
  a.connected = b.connected = true;
  match.players.push(a, b);
  match.hostId = a.id;
  startMatch(match);
  if (gold !== undefined) a.gold = b.gold = gold;
  return { match, a, b };
}
