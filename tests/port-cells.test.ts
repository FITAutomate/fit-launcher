import { test, expect } from "vitest";
import {
  outsideRanges,
  portCells,
  portState,
  rangeCounts,
} from "../src/renderer/port-cells";
import type {
  Listener,
  PortAssignment,
  PortSnapshot,
} from "../src/shared/schema";

const listener = (port: number, extra: Partial<Listener> = {}): Listener => ({
  port,
  address: "127.0.0.1",
  pid: 100,
  name: "node",
  command: "",
  created: "2026-01-01T00:00:00Z",
  service: "",
  protected: false,
  ...extra,
});
const assignment = (
  port: number,
  extra: Partial<PortAssignment> = {},
): PortAssignment => ({
  repo: "demo-" + port,
  path: "C:/fixtures/demo-" + port,
  framework: "",
  default_port: port,
  status: "active",
  source: "",
  note: "",
  origin: "Local registry",
  readOnly: false,
  listening: false,
  owners: [],
  pathExists: true,
  verified: "down",
  actualRepo: "",
  conflict: false,
  ...extra,
});

test("each table row maps to its state, first match winning", () => {
  const live = listener(5100),
    system = listener(5100, { pid: 4, protected: true, name: "System" });
  const dead = assignment(5100, { pathExists: false, verified: "mismatch" });
  expect(portState(dead, live, undefined)).toBe("dead-path");
  expect(portState(dead, undefined, undefined)).toBe("dead-path");
  expect(
    portState(assignment(5100, { verified: "mismatch" }), live, undefined),
  ).toBe("wrong-process");
  expect(
    portState(assignment(5100, { verified: "unknown" }), live, undefined),
  ).toBe("listening");
  expect(
    portState(assignment(5100, { verified: "match" }), undefined, system),
  ).toBe("listening");
  expect(
    portState(assignment(5100, { status: "reserved" }), undefined, undefined),
  ).toBe("reserved-down");
  expect(portState(assignment(5100), undefined, undefined)).toBe(
    "assigned-down",
  );
  expect(portState(undefined, live, system)).toBe("unregistered");
  expect(portState(undefined, undefined, system)).toBe("service");
  expect(portState(undefined, undefined, undefined)).toBe("free");
});

const snapshot = (extra: Partial<PortSnapshot>): PortSnapshot => ({
  at: "",
  listeners: [],
  assignments: [],
  ranges: {},
  drift: [],
  systems: [],
  observed: [],
  errors: [],
  ...extra,
});

test("cells name the app and owner, and a port in several registries shows its most urgent state", () => {
  const owner = listener(5100, { pid: 321, name: "node" }),
    system = listener(5105, { pid: 4, protected: true, name: "System" });
  const model = snapshot({
    listeners: [owner, listener(5104, { pid: 500 }), system],
    systems: [system],
    assignments: [
      assignment(5100, { repo: "local-app", verified: "unknown" }),
      assignment(5100, {
        repo: "connected-app",
        verified: "mismatch",
        readOnly: true,
      }),
      assignment(5101, { status: "reserved" }),
    ],
  });
  const cell = portCells(model);
  expect(cell(5100)).toEqual({
    port: 5100,
    state: "wrong-process",
    label:
      "Port 5100 · local-app, connected-app · Wrong process · node PID 321",
  });
  expect(cell(5101).label).toBe("Port 5101 · demo-5101 · Reserved, down");
  expect(cell(5104).state).toBe("unregistered");
  expect(cell(5105)).toEqual({
    port: 5105,
    state: "service",
    label: "Port 5105 · Unassigned · Windows service",
  });
  expect(cell(5106).state).toBe("free");
});

test("range counts cover the whole range and outside assignments get their own strip", () => {
  const system = listener(5300, { pid: 4, protected: true });
  const model = snapshot({
    ranges: { apps: { start: 5100, end: 5299, note: "" } },
    listeners: [
      listener(5100),
      listener(5100, { address: "::1" }),
      listener(5250),
      system,
      listener(5280, { pid: 4, protected: true }),
    ],
    systems: [system],
    assignments: [
      assignment(5100),
      assignment(5100, { origin: "connected.yaml" }),
      assignment(5200),
      assignment(6000),
      assignment(4000),
    ],
  });
  expect(rangeCounts(model.ranges.apps, model)).toEqual({
    known: 2,
    live: 1,
    free: 200 - 2 - 2,
  });
  expect(outsideRanges(model)).toEqual([4000, 6000]);
});
