import { describe, expect, it } from "vitest";
import {
  PATH_CELLS,
  PATH_LENGTH_PX,
  isInBounds,
  isPathCell,
  findCreepDefinition,
  NATURAL_WAVES,
} from "../../src/shared/config/index.js";

describe("map", () => {
  it("measures the path as 24 tiles of 52px", () => {
    expect(PATH_LENGTH_PX).toBe(24 * 52);
  });

  it("marks the corridor cells as path", () => {
    expect(isPathCell(0, 1)).toBe(true);
    expect(isPathCell(7, 2)).toBe(true);
    expect(isPathCell(9, 6)).toBe(true);
    expect(isPathCell(0, 0)).toBe(false);
    expect(PATH_CELLS.size).toBe(25);
  });

  it("rejects out-of-bounds and non-integer cells", () => {
    expect(isInBounds(0, 0)).toBe(true);
    expect(isInBounds(9, 7)).toBe(true);
    expect(isInBounds(10, 0)).toBe(false);
    expect(isInBounds(-1, 0)).toBe(false);
    expect(isInBounds(1.5, 2)).toBe(false);
    expect(isInBounds("1", 2)).toBe(false);
  });
});

describe("creep lookup", () => {
  it("returns null for unknown ids, including prototype keys", () => {
    expect(findCreepDefinition("nope")).toBeNull();
    expect(findCreepDefinition("toString")).toBeNull();
    expect(findCreepDefinition("void_reaver").isBoss).toBe(true);
  });

  it("only uses known creep types in authored waves", () => {
    for (const wave of NATURAL_WAVES) {
      for (const entry of wave.creeps) {
        expect(findCreepDefinition(entry.type)).not.toBeNull();
      }
    }
  });
});
