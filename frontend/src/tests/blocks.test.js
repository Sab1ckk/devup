import { describe, it, expect } from "vitest";
import {
  canAddBlock,
  createBlock,
  moveBlock,
  placeBlock,
  normalizeProjectType,
  kinds,
} from "../lib/blocks";
import shared from "../../../shared/block-kinds.json";
describe("builder", () => {
  it("uses shared catalog", () => {
    expect(kinds).toEqual(shared);
    expect(kinds).toHaveLength(26);
  });
  it("prevents unique duplicates and unknown blocks", () => {
    expect(canAddBlock([createBlock("hero")], "hero")).toBe(false);
    expect(canAddBlock([], "alien")).toBe(false);
    expect(canAddBlock([createBlock("chat")], "chat")).toBe(true);
  });
  it("moves without changing original", () => {
    const a = createBlock("hero"),
      b = createBlock("about"),
      list = [a, b];
    expect(moveBlock(list, a.id, 1)).toEqual([b, a]);
    expect(list).toEqual([a, b]);
    expect(moveBlock(list, a.id, -1)).toEqual(list);
  });
  it("places before another block or at end", () => {
    const a = createBlock("hero"),
      b = createBlock("about"),
      c = createBlock("contacts");
    expect(placeBlock([a, b, c], c.id, a.id)).toEqual([c, a, b]);
    expect(placeBlock([a, b], a.id, null)).toEqual([b, a]);
  });
  it("normalizes type and limits list", () => {
    expect(normalizeProjectType("unknown")).toBe("site");
    expect(normalizeProjectType("study")).toBe("study");
    expect(canAddBlock(Array(30).fill(createBlock("chat")), "custom")).toBe(
      false,
    );
  });
});
