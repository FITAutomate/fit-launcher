import type { Listener, PortAssignment, PortSnapshot } from "../shared/schema";

// Listed in first-match order: the earliest state that applies wins.
export const portStates = {
  "dead-path": { mark: "×", label: "Dead path" },
  "wrong-process": { mark: "≠", label: "Wrong process" },
  listening: { mark: "✓", label: "Listening" },
  "reserved-down": { mark: "○", label: "Reserved, down" },
  "assigned-down": { mark: "○", label: "Assigned, down" },
  unregistered: { mark: "!", label: "In use, unregistered" },
  service: { mark: "S", label: "Windows service" },
  free: { mark: "", label: "Free" },
} as const;
export type PortState = keyof typeof portStates;
const order = Object.keys(portStates) as PortState[];

export function portState(
  assignment:
    Pick<PortAssignment, "pathExists" | "verified" | "status"> | undefined,
  listener: Listener | undefined,
  system: Listener | undefined,
): PortState {
  const listening = !!(listener || system);
  if (assignment) {
    if (!assignment.pathExists) return "dead-path";
    if (listening)
      return assignment.verified === "mismatch" ? "wrong-process" : "listening";
    return assignment.status === "active" ? "assigned-down" : "reserved-down";
  }
  if (listener) return "unregistered";
  if (system) return "service";
  return "free";
}

export interface PortCell {
  port: number;
  state: PortState;
  label: string;
}

export function portCells(snapshot: PortSnapshot) {
  const systemPids = new Set(snapshot.systems.map((x) => x.pid));
  return (port: number): PortCell => {
    const assigned = snapshot.assignments.filter(
        (x) => x.default_port === port,
      ),
      owners = snapshot.listeners.filter((x) => x.port === port),
      listener = owners.find((x) => !systemPids.has(x.pid)),
      system = owners.find((x) => systemPids.has(x.pid));
    // A port claimed by several registries shows its most urgent state.
    const state = assigned.length
      ? order[
          Math.min(
            ...assigned.map((a) =>
              order.indexOf(portState(a, listener, system)),
            ),
          )
        ]
      : portState(undefined, listener, system);
    const parts = [
      "Port " + port,
      assigned.length
        ? [...new Set(assigned.map((x) => x.repo))].join(", ")
        : "Unassigned",
      portStates[state].label,
    ];
    if (state === "listening" || state === "wrong-process")
      parts.push(
        ...new Set(
          owners.map((x) => `${x.name || "Unknown process"} PID ${x.pid}`),
        ),
      );
    return { port, state, label: parts.join(" · ") };
  };
}

export function rangeCounts(
  range: { start: number; end: number },
  snapshot: PortSnapshot,
) {
  const within = (port: number) => port >= range.start && port <= range.end;
  const known = new Set(
      snapshot.assignments.map((x) => x.default_port).filter(within),
    ),
    live = new Set(
      snapshot.listeners.map((x) => x.port).filter((p) => known.has(p)),
    ),
    unassigned = new Set(
      snapshot.listeners
        .map((x) => x.port)
        .filter((p) => within(p) && !known.has(p)),
    );
  return {
    known: known.size,
    live: live.size,
    free: range.end - range.start + 1 - known.size - unassigned.size,
  };
}

export function outsideRanges(snapshot: PortSnapshot) {
  const ranges = Object.values(snapshot.ranges);
  return [...new Set(snapshot.assignments.map((x) => x.default_port))]
    .filter((p) => !ranges.some((r) => p >= r.start && p <= r.end))
    .sort((a, b) => a - b);
}
