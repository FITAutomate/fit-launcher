import fs from "node:fs/promises";
import YAML from "yaml";
import {
  RegistrySchema,
  type Registry,
  type Listener,
  type PortSnapshot,
  type PortAssignment,
} from "../shared/schema";
const normalized = (value: string) =>
  value.replaceAll("/", "\\").replace(/\\$/, "").toLowerCase();
export function reconcile(
  listeners: Listener[],
  sources: { registry: Registry; origin: string; readOnly: boolean }[],
  selfPid: number,
): PortSnapshot {
  const ranges: PortSnapshot["ranges"] = {};
  const assignments: PortAssignment[] = [];
  for (const source of sources) {
    for (const [name, range] of Object.entries(source.registry.ranges))
      ranges[source.origin + " / " + name] = range;
    for (const row of source.registry.assignments) {
      const owners = listeners.filter((x) => x.port === row.default_port);
      assignments.push({
        ...row,
        origin: source.origin,
        readOnly: source.readOnly,
        listening: owners.length > 0,
        owners,
        pathExists: true,
        verified: owners.length ? "unknown" : "down",
        actualRepo: "",
        conflict: false,
      });
    }
  }
  const paths = assignments
    .filter((x) => x.path)
    .sort((a, b) => b.path.length - a.path.length);
  for (const item of assignments) {
    item.conflict =
      assignments.filter((x) => x.default_port === item.default_port).length >
      1;
    if (item.listening) {
      const identified = item.owners.map((owner) =>
        paths.find((p) => {
          const command = normalized(owner.command),
            folder = normalized(p.path);
          let offset = command.indexOf(folder);
          while (offset >= 0) {
            const after = command[offset + folder.length];
            if (!after || /[\\\s"']/.test(after)) return true;
            offset = command.indexOf(folder, offset + 1);
          }
          return false;
        }),
      );
      const wrong = identified.filter(
        (p) => p && normalized(p.path) !== normalized(item.path),
      );
      if (wrong.length) {
        item.verified = "mismatch";
        item.actualRepo = [...new Set(wrong.map((p) => p!.repo))].join(", ");
      } else if (
        identified.every(
          (p) => p && normalized(p.path) === normalized(item.path),
        )
      )
        item.verified = "match";
    }
  }
  const systems = listeners.filter((x) => x.protected || x.pid === selfPid);
  const other = listeners.filter(
    (x) =>
      !systems.includes(x) &&
      !assignments.some((a) => a.default_port === x.port),
  );
  const inRange = (p: number) =>
    Object.values(ranges).some((r) => p >= r.start && p <= r.end);
  return {
    at: new Date().toISOString(),
    listeners,
    assignments: assignments.sort(
      (a, b) =>
        Number(b.listening) - Number(a.listening) ||
        a.path.localeCompare(b.path) ||
        a.default_port - b.default_port,
    ),
    ranges,
    drift: other.filter((x) => inRange(x.port)),
    systems,
    observed: other.filter((x) => !inRange(x.port)),
    errors: [],
  };
}
export async function portModel(
  listeners: Listener[],
  local: Registry,
  external: string,
  selfPid: number,
) {
  const sources = [
    { registry: local, origin: "Local registry", readOnly: false },
  ];
  const errors: string[] = [];
  if (external)
    try {
      sources.push({
        registry: RegistrySchema.parse(
          YAML.parse(await fs.readFile(external, "utf8")),
        ),
        origin: external,
        readOnly: true,
      });
    } catch (e) {
      errors.push("Connected registry: " + String(e));
    }
  const model = reconcile(listeners, sources, selfPid);
  for (const a of model.assignments) {
    if (a.path)
      a.pathExists = await fs.stat(a.path).then(
        (x) => x.isDirectory(),
        () => false,
      );
  }
  model.errors = errors;
  return model;
}
export function governed(
  listener: Listener,
  model: PortSnapshot,
  selfPid: number,
) {
  return (
    !listener.protected &&
    listener.pid !== selfPid &&
    !!listener.created &&
    (model.assignments.some((a) => a.default_port === listener.port) ||
      Object.values(model.ranges).some(
        (r) => listener.port >= r.start && listener.port <= r.end,
      ))
  );
}
