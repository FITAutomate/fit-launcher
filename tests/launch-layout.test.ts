import { test, expect } from "vitest";
import {
  gridGeometry,
  initialOrder,
  reconcileOrder,
  pack,
  insertAtPosition,
} from "../src/renderer/launch-layout";
import { LayoutSchema } from "../src/shared/schema";

test("legacy coordinates establish stable row order and new shortcuts append", () => {
  const ids = ["new", "a", "b", "c", "d"];
  const order = initialOrder(ids, {
    a: { x: 340, y: 20 },
    b: { x: 0, y: 20 },
    c: { x: 0, y: 20 },
    d: { x: -20, y: 300 },
  });
  expect(order).toEqual(["b", "c", "a", "d", "new"]);
  expect(reconcileOrder(order, ["new", "a", "c", "d", "added"])).toEqual([
    "c",
    "a",
    "d",
    "new",
    "added",
  ]);
});

test("full size columns respect padding and rows clear the tallest card", () => {
  expect(gridGeometry(1039, 287).columns).toBe(2);
  const grid = gridGeometry(1040, 287);
  expect(grid.columns).toBe(3);
  const positions = pack(["a", "b", "c", "d"], grid);
  expect(positions.c.x + 320 + 40).toBe(1040);
  expect(positions.d.y).toBeGreaterThanOrEqual(287 + 20);
  expect(gridGeometry(200, 200).columns).toBe(1);
});

test("occupied slots shift intervening cards and clamp drops outside the grid", () => {
  const order = ["a", "b", "c", "d", "e"];
  const grid = gridGeometry(1060, 200);
  const moved = insertAtPosition(order, "a", { x: 680, y: 0 }, grid);
  expect(moved).toEqual(["b", "c", "a", "d", "e"]);
  expect(insertAtPosition(moved, "e", { x: -100, y: -100 }, grid)).toEqual([
    "e",
    "b",
    "c",
    "a",
    "d",
  ]);
  expect(insertAtPosition(order, "a", { x: 99999, y: 99999 }, grid)).toEqual([
    "b",
    "c",
    "d",
    "e",
    "a",
  ]);
  expect(
    new Set(Object.values(pack(moved, grid)).map((p) => `${p.x},${p.y}`)).size,
  ).toBe(order.length);
  expect(order).toEqual(["a", "b", "c", "d", "e"]);
});

test("large-grid overview zoom round trips through the profile contract", () => {
  expect(
    LayoutSchema.parse({
      schemaVersion: 1,
      positions: {},
      viewport: { x: 20, y: 20, zoom: 0.04 },
    }).viewport.zoom,
  ).toBe(0.04);
  expect(
    LayoutSchema.safeParse({
      schemaVersion: 1,
      viewport: { x: 0, y: 0, zoom: 0 },
    }).success,
  ).toBe(false);
});
