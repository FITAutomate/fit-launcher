import type { Layout } from "../shared/schema";

export const CARD_WIDTH = 320;
export const GAP = 20;
export const PADDING = 20;
export const MIN_ZOOM = 0.01;
export const HOME_VIEW = { x: PADDING, y: PADDING, zoom: 1 };

export function initialOrder(ids: string[], positions: Layout["positions"]) {
  return [...ids].sort((a, b) => {
    const p = positions[a],
      q = positions[b];
    if (!p) return q ? 1 : 0;
    if (!q) return -1;
    return p.y - q.y || p.x - q.x;
  });
}

export function reconcileOrder(order: string[], ids: string[]) {
  const valid = new Set(ids),
    existing = new Set(order);
  return [
    ...order.filter((id) => valid.has(id)),
    ...ids.filter((id) => !existing.has(id)),
  ];
}

export function gridGeometry(width: number, height: number) {
  return {
    columns: Math.max(
      1,
      Math.floor((width - PADDING * 2 + GAP) / (CARD_WIDTH + GAP)),
    ),
    rowStep: Math.ceil(height / GAP) * GAP + GAP,
  };
}
export type Grid = ReturnType<typeof gridGeometry>;

export function pack(order: string[], grid: Grid): Layout["positions"] {
  return Object.fromEntries(
    order.map((id, i) => [
      id,
      {
        x: (i % grid.columns) * (CARD_WIDTH + GAP),
        y: Math.floor(i / grid.columns) * grid.rowStep,
      },
    ]),
  );
}

export function insertAtPosition(
  order: string[],
  id: string,
  position: { x: number; y: number },
  grid: Grid,
) {
  if (!order.includes(id)) return order;
  const column = Math.max(
    0,
    Math.min(grid.columns - 1, Math.round(position.x / (CARD_WIDTH + GAP))),
  );
  const row = Math.max(0, Math.round(position.y / grid.rowStep));
  const index = Math.min(order.length - 1, row * grid.columns + column);
  const next = order.filter((item) => item !== id);
  next.splice(index, 0, id);
  return next;
}
