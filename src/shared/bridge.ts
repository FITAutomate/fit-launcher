import type {
  AppState,
  Workspace,
  Layout,
  Registry,
  Discovery,
  PortSnapshot,
  ImportPreview,
  Action,
  Listener,
} from "./schema";
import type { FeedbackInput } from "./feedback";
export interface Bridge {
  state(): Promise<AppState>;
  save(workspace: Workspace, revision: string): Promise<AppState>;
  layout(layout: Layout): Promise<void>;
  registry(registry: Registry, revision: string): Promise<AppState>;
  pick(
    kind: "folder" | "editor" | "registry" | "shortcuts",
  ): Promise<string | null>;
  scan(): Promise<Discovery[]>;
  cancelScan(): Promise<void>;
  launch(id: string, action: Action): Promise<void>;
  ports(): Promise<PortSnapshot>;
  stop(listener: Listener): Promise<boolean>;
  importShortcuts(path: string): Promise<ImportPreview>;
  exportConfig(): Promise<boolean>;
  importConfig(): Promise<{ summary: string } | null>;
  applyImport(): Promise<AppState>;
  startup(enabled: boolean): Promise<AppState>;
  feedback(input: FeedbackInput): Promise<void>;
  quit(): Promise<void>;
}
declare global {
  interface Window {
    launcher: Bridge;
  }
}
