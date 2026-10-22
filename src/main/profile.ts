import path from "node:path";
import { z } from "zod";
import {
  WorkspaceSchema,
  LayoutSchema,
  RegistrySchema,
  type Workspace,
  type Registry,
} from "../shared/schema";
import { resolveLaunch } from "./paths";
export function validateWorkspace(input: unknown): Workspace {
  const value = WorkspaceSchema.parse(input);
  if (new Set(value.launches.map((x) => x.id)).size !== value.launches.length)
    throw Error("Duplicate shortcut IDs.");
  if (new Set(value.roots.map((x) => x.id)).size !== value.roots.length)
    throw Error("Duplicate root IDs.");
  for (const root of value.roots)
    if (!path.isAbsolute(root.path))
      throw Error("Scan roots must be absolute folders.");
  for (const launch of value.launches) resolveLaunch(value, launch);
  const aliases = value.launches.flatMap((x) =>
    x.shellName ? [x.shellName.toLowerCase()] : [],
  );
  if (new Set(aliases).size !== aliases.length)
    throw Error("PowerShell shortcut names must be unique.");
  return value;
}
export function validateRegistry(input: unknown): Registry {
  const value = RegistrySchema.parse(input);
  const ports = value.assignments.map((x) => x.default_port);
  if (new Set(ports).size !== ports.length)
    throw Error("Local assignments must use unique ports.");
  return value;
}
export function validateTransfer(input: unknown) {
  const value = z
    .object({
      schemaVersion: z.literal(1),
      workspace: WorkspaceSchema,
      layout: LayoutSchema,
      registry: RegistrySchema,
    })
    .parse(input);
  value.workspace = validateWorkspace(value.workspace);
  value.registry = validateRegistry(value.registry);
  for (const id of Object.keys(value.layout.positions))
    if (!value.workspace.launches.some((x) => x.id === id))
      throw Error("Imported layout references a missing shortcut.");
  return value;
}
