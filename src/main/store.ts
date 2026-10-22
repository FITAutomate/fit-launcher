import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import YAML from "yaml";
import {
  WorkspaceSchema,
  LayoutSchema,
  RegistrySchema,
  newWorkspace,
  newLayout,
  newRegistry,
  type Workspace,
  type Layout,
  type Registry,
} from "../shared/schema";
import { resolveLaunch } from "./paths";
import {
  validateWorkspace,
  validateRegistry,
  validateTransfer,
} from "./profile";
export class Store {
  workspace = newWorkspace();
  layout = newLayout();
  registry = newRegistry();
  warnings: string[] = [];
  private queue = Promise.resolve();
  private loadedRevision = "";
  constructor(public dir: string) {}
  async init() {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.access(this.dir, fs.constants.W_OK);
    for (const name of ["backups", "logs", "session"])
      await fs.mkdir(path.join(this.dir, name), { recursive: true });
    for (const [file, parser, key] of [
      ["workspace.json", WorkspaceSchema, "workspace"],
      ["layout.json", LayoutSchema, "layout"],
      ["registry.yaml", RegistrySchema, "registry"],
    ] as const) {
      try {
        const text = await fs.readFile(path.join(this.dir, file), "utf8");
        const data = parser.parse(
          file.endsWith("yaml") ? YAML.parse(text) : JSON.parse(text),
        );
        if (key === "workspace") this.workspace = validateWorkspace(data);
        if (key === "layout") this.layout = LayoutSchema.parse(data);
        if (key === "registry") this.registry = validateRegistry(data);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT")
          await this.write(file, this[key]);
        else {
          this.warnings.push(
            `${file}: ${String(e)}. Original retained; repair it or restore a backup.`,
          );
        }
      }
    }
    this.loadedRevision = await this.revision();
  }
  async refresh() {
    return this.serialize(async () => {
      const current = await this.revision();
      if (current === this.loadedRevision) return;
      try {
        const workspace = validateWorkspace(
          JSON.parse(
            await fs.readFile(path.join(this.dir, "workspace.json"), "utf8"),
          ),
        );
        const registry = validateRegistry(
          YAML.parse(
            await fs.readFile(path.join(this.dir, "registry.yaml"), "utf8"),
          ),
        );
        this.workspace = workspace;
        this.registry = registry;
        this.warnings = [];
      } catch (e) {
        this.warnings = [
          "Configuration changed outside the app but is invalid: " +
            String(e) +
            ". Original retained.",
        ];
      }
      this.loadedRevision = current;
    });
  }
  async revision() {
    const parts = await Promise.all(
      ["workspace.json", "registry.yaml"].map((f) =>
        fs.readFile(path.join(this.dir, f)).catch(() => Buffer.from("")),
      ),
    );
    return createHash("sha256").update(Buffer.concat(parts)).digest("hex");
  }
  private async write(file: string, data: unknown) {
    const location = path.join(this.dir, file),
      temp = location + "." + randomUUID() + ".tmp";
    const text = file.endsWith(".yaml")
      ? YAML.stringify(data)
      : JSON.stringify(data, null, 2) + "\n";
    await fs.writeFile(temp, text, "utf8");
    try {
      await fs.copyFile(
        location,
        path.join(
          this.dir,
          "backups",
          file + "." + Date.now() + "." + randomUUID() + ".bak",
        ),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    await fs.rename(temp, location);
    if (file !== "layout.json") this.loadedRevision = await this.revision();
  }
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.then(
      () => {},
      () => {},
    );
    return next;
  }
  async save(workspace: Workspace, revision: string) {
    return this.serialize(async () => {
      if (revision !== (await this.revision()))
        throw Error("Configuration changed. Reload before saving.");
      const value = WorkspaceSchema.parse(workspace);
      validateWorkspace(value);
      const ids = value.launches.map((x) => x.id);
      await this.write("workspace.json", value);
      this.workspace = value;
      for (const id of Object.keys(this.layout.positions))
        if (!ids.includes(id)) delete this.layout.positions[id];
      await this.write("layout.json", this.layout);
      await this.shellExport();
    });
  }
  async saveLayout(value: Layout) {
    return this.serialize(async () => {
      const next = LayoutSchema.parse(value);
      for (const id of Object.keys(next.positions))
        if (!this.workspace.launches.some((l) => l.id === id))
          delete next.positions[id];
      await this.write("layout.json", next);
      this.layout = next;
    });
  }
  async saveRegistry(registry: Registry, revision: string) {
    return this.serialize(async () => {
      if (revision !== (await this.revision()))
        throw Error("Configuration changed. Reload before saving.");
      const next = validateRegistry(registry);
      await this.write("registry.yaml", next);
      this.registry = next;
    });
  }
  async shellExport() {
    if (!this.workspace.shellIntegration) return;
    const folder = path.join(this.dir, "integrations");
    await fs.mkdir(folder, { recursive: true });
    const lines = this.workspace.launches
      .filter((x) => x.shellName)
      .map(
        (x) =>
          `if (-not (Get-Command '${x.shellName}' -ErrorAction SilentlyContinue)) { function global:${x.shellName} { Set-Location -LiteralPath '${resolveLaunch(this.workspace, x).replaceAll("'", "''")}' } } else { Write-Warning 'FIT Launcher: ${x.shellName} already exists; skipped.' }`,
      );
    await fs.writeFile(
      path.join(folder, "shortcuts.ps1"),
      "\uFEFF# Generated by FIT Launcher. Existing commands are never replaced.\r\n" +
        lines.join("\r\n") +
        "\r\n",
      "utf8",
    );
  }
  async transfer() {
    return {
      schemaVersion: 1,
      workspace: this.workspace,
      layout: this.layout,
      registry: this.registry,
    };
  }
  async replace(input: unknown) {
    const data = validateTransfer(input);
    data.workspace.shellIntegration = false;
    data.workspace.externalRegistry = "";
    return this.serialize(async () => {
      await this.write("workspace.json", data.workspace);
      await this.write("layout.json", data.layout);
      await this.write("registry.yaml", data.registry);
      this.workspace = data.workspace;
      this.layout = data.layout;
      this.registry = data.registry;
    });
  }
  async log(message: string) {
    await fs
      .appendFile(
        path.join(this.dir, "logs", "launcher.log"),
        new Date().toISOString() + " " + message + "\n",
      )
      .catch(() => {});
  }
}
