import { z } from "zod";
export const RootSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  depth: z.number().int().min(1).max(12).default(4),
});
export const LaunchSchema = z
  .object({
    id: z.string(),
    label: z.string().trim().min(1).max(100),
    group: z.string().max(80).default("My projects"),
    rootId: z.string().optional(),
    relativePath: z.string().optional(),
    absolutePath: z.string().optional(),
    shellName: z
      .string()
      .regex(/^[A-Za-z][A-Za-z0-9-]{0,63}$/)
      .optional(),
    githubUrl: z.string().optional(),
  })
  .refine((x) => !!x.absolutePath || !!x.rootId, "A folder is required");
export const WorkspaceSchema = z.object({
  schemaVersion: z.literal(1),
  setupComplete: z.boolean().default(false),
  roots: z.array(RootSchema).default([]),
  launches: z.array(LaunchSchema).default([]),
  editor: z.string().default(""),
  externalRegistry: z.string().default(""),
  shellIntegration: z.boolean().default(false),
});
export const LayoutSchema = z.object({
  schemaVersion: z.literal(1),
  positions: z
    .record(
      z.string(),
      z.object({ x: z.number().finite(), y: z.number().finite() }),
    )
    .default({}),
  viewport: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      zoom: z.number().min(0.1).max(4),
    })
    .default({ x: 0, y: 0, zoom: 1 }),
});
export const RangeSchema = z
  .object({
    start: z.number().int().min(1).max(65535),
    end: z.number().int().min(1).max(65535),
    note: z.string().optional(),
  })
  .refine((x) => x.start <= x.end, "Range end must follow start");
export const AssignmentSchema = z.object({
  repo: z.string().min(1),
  path: z.string().default(""),
  framework: z.string().default(""),
  default_port: z.number().int().min(1).max(65535),
  status: z.string().default("active"),
  source: z.string().default(""),
  note: z.string().default(""),
  surface: z.string().optional(),
});
export const RegistrySchema = z.object({
  schemaVersion: z.literal(1).optional(),
  last_updated: z.string().optional(),
  ranges: z.record(z.string(), RangeSchema).default({}),
  assignments: z.array(AssignmentSchema).default([]),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Launch = z.infer<typeof LaunchSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
export type Assignment = z.infer<typeof AssignmentSchema>;
export const newWorkspace = (): Workspace =>
  WorkspaceSchema.parse({ schemaVersion: 1 });
export const newLayout = (): Layout => LayoutSchema.parse({ schemaVersion: 1 });
export const newRegistry = (): Registry =>
  RegistrySchema.parse({ schemaVersion: 1 });
export interface AppState {
  version: string;
  workspace: Workspace;
  layout: Layout;
  registry: Registry;
  revision: string;
  dataDir: string;
  startup: boolean;
  startupPath: string;
  warnings: string[];
  editorDetected: string;
  resolved: Record<
    string,
    { path: string; exists: boolean; githubUrl: string }
  >;
}
export interface Discovery {
  path: string;
  name: string;
  rootId: string;
  relativePath: string;
  isRepo: boolean;
  hint: string;
  githubUrl: string;
  modified: string;
}
export interface Listener {
  port: number;
  address: string;
  pid: number;
  name: string;
  command: string;
  created: string;
  service: string;
  protected: boolean;
}
export interface PortAssignment extends Assignment {
  origin: string;
  readOnly: boolean;
  listening: boolean;
  owners: Listener[];
  pathExists: boolean;
  verified: "match" | "mismatch" | "unknown" | "down";
  actualRepo: string;
  conflict: boolean;
}
export interface PortSnapshot {
  at: string;
  listeners: Listener[];
  assignments: PortAssignment[];
  ranges: Record<string, z.infer<typeof RangeSchema>>;
  drift: Listener[];
  systems: Listener[];
  observed: Listener[];
  errors: string[];
}
export interface ImportRow {
  label: string;
  path: string;
  group: string;
  shellName: string;
}
export interface ImportPreview {
  rows: ImportRow[];
  skipped: string[];
}
export const ActionSchema = z.enum([
  "explorer",
  "editor",
  "terminal",
  "github",
]);
export type Action = z.infer<typeof ActionSchema>;
