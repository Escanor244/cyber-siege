import { describe, expect, it } from "vitest";
import { pickTarget } from "../../src/shared/sim/targeting.js";

const creep = (id, x, progress, hp) => ({ id, x, y: 0, progress, hp, spawned: true, dead: false });

describe("tower targeting", () => {
  const creeps = [creep(1, 10, 300, 50), creep(2, 60, 100, 500), creep(3, 30, 200, 80), creep(4, 5, 999, 1)];
  creeps[3].dead = true;

  it.each([
    ["first", 1],
    ["last", 2],
    ["strongest", 2],
    ["closest", 3],
  ])("%s picks creep %i", (mode, id) => {
    expect(pickTarget(creeps, 30, 0, 100, mode).id).toBe(id);
  });

  it("ignores creeps out of range or dead and breaks ties by id", () => {
    expect(pickTarget(creeps, 1000, 0, 50, "first")).toBeNull();
    const tied = [creep(7, 0, 50, 10), creep(5, 0, 50, 10)];
    expect(pickTarget(tied, 0, 0, 10, "first").id).toBe(5);
  });
});
