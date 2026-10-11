import { describe, expect, it } from "vitest";
import { parseClientMessage, sanitizeName, PROTOCOL_VERSION } from "../../src/shared/protocol.js";

const ok = (m) => expect(parseClientMessage(JSON.stringify(m))).not.toBeNull();
const bad = (m) => expect(parseClientMessage(typeof m === "string" ? m : JSON.stringify(m))).toBeNull();

describe("client message parsing", () => {
  it("accepts well-formed messages", () => {
    ok({ type: "hello", v: PROTOCOL_VERSION, intent: "create", name: "Viper" });
    ok({ type: "hello", v: PROTOCOL_VERSION, intent: "join", name: "", token: "abc" });
    ok({ type: "build", reqId: 1, towerType: "gatling", gx: 0, gy: 0 });
    ok({ type: "lane-report", killed: [1, 2], leaked: [] });
    ok({ type: "lane-snap", t: 100, c: [1, 10, 20, 100, 0] });
    ok({ type: "sync" });
  });

  it("rejects malformed and hostile input", () => {
    bad("not json");
    bad("[1,2]");
    bad({ type: "build", towerType: "gatling", gx: "1", gy: 0 });
    bad({ type: "build", towerType: "gatling", gx: 1.5, gy: 0 });
    bad({ type: "teleport" });
    bad({ type: "__proto__" });
    bad({ type: "hello", v: 2, intent: "admin", name: "x" });
    bad({ type: "lane-report", killed: [-1] });
    bad({ type: "lane-report", killed: Array.from({ length: 65 }, (_, i) => i + 1) });
    bad({ type: "lane-snap", t: 1, c: [1, 2, 3] });
    bad("x".repeat(7000));
  });

  it("sanitizes player names", () => {
    expect(sanitizeName("  <b>Ghost</b>  ", "X")).toBe("bGhost/b");
    expect(sanitizeName("", "Commander")).toBe("Commander");
    expect(sanitizeName("a".repeat(40), "X")).toHaveLength(16);
  });
});
