import fs from "node:fs/promises";
import path from "node:path";
import type { Workspace, Discovery } from "../shared/schema";
import { resolveLaunch } from "./paths";
export function githubUrl(remote: string): string {
  const value = remote.trim();
  let url: URL;
  try {
    url = new URL(
      value.startsWith("git@github.com:")
        ? "https://github.com/" + value.slice(15)
        : value,
    );
  } catch {
    return "";
  }
  if (
    url.hostname.toLowerCase() !== "github.com" ||
    !["https:", "ssh:"].includes(url.protocol)
  )
    return "";
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts.length !== 2 || parts.some((x) => !/^[-\w.]+$/.test(x))) return "";
  return (
    "https://github.com/" + parts[0] + "/" + parts[1].replace(/\.git$/, "")
  );
}
export async function gitRemote(folder: string): Promise<string> {
  try {
    const marker = path.join(folder, ".git");
    const info = await fs.stat(marker);
    let gitDir = marker;
    if (!info.isDirectory()) {
      const text = await fs.readFile(marker, "utf8");
      const match = /^gitdir:\s*(.+)$/im.exec(text);
      if (!match) return "";
      gitDir = path.resolve(folder, match[1].trim());
    }
    try {
      const common = (
        await fs.readFile(path.join(gitDir, "commondir"), "utf8")
      ).trim();
      gitDir = path.resolve(gitDir, common);
    } catch {}
    const config = await fs.readFile(path.join(gitDir, "config"), "utf8");
    const remotes = [...config.matchAll(/\[remote\s+"([^"]+)"\]([^\[]*)/g)];
    remotes.sort(
      (a, b) => Number(b[1] === "origin") - Number(a[1] === "origin"),
    );
    for (const remote of remotes) {
      const url = /^\s*url\s*=\s*(.+)$/m.exec(remote[2]);
      if (url) {
        const result = githubUrl(url[1].trim().replace(/^"|"$/g, ""));
        if (result) return result;
      }
    }
  } catch {}
  return "";
}
const ignored = new Set([
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "dist",
  "build",
  ".next",
  ".astro",
  "out",
  "target",
  "vendor",
  ".cache",
  "$recycle.bin",
  "system volume information",
]);
export async function discover(
  workspace: Workspace,
  signal: AbortSignal,
): Promise<Discovery[]> {
  const found: Discovery[] = [];
  const seen = new Set<string>();
  const mapped = new Set(
    workspace.launches.map((x) => {
      try {
        return resolveLaunch(workspace, x).toLowerCase();
      } catch {
        return "";
      }
    }),
  );
  let visited = 0;
  for (const root of workspace.roots) {
    async function walk(folder: string, depth: number): Promise<void> {
      if (signal.aborted) throw Error("Scan canceled.");
      if (++visited > 50000)
        throw Error(
          "Scan limit reached. Choose narrower roots or a smaller depth.",
        );
      let real: string;
      let entries: import("node:fs").Dirent[];
      try {
        real = (await fs.realpath(folder)).toLowerCase();
        if (seen.has(real)) return;
        seen.add(real);
        entries = await fs.readdir(folder, { withFileTypes: true });
      } catch {
        return;
      }
      const names = new Set(entries.map((x) => x.name));
      const isRepo = names.has(".git");
      const hint = names.has("package.json")
        ? "Node / JavaScript"
        : names.has("pyproject.toml")
          ? "Python"
          : entries.some((x) => x.name.endsWith(".csproj"))
            ? ".NET"
            : names.has("compose.yaml") || names.has("docker-compose.yml")
              ? "Compose"
              : "";
      if ((isRepo || hint) && !mapped.has(path.resolve(folder).toLowerCase())) {
        const stat = await fs.stat(folder);
        found.push({
          path: folder,
          name: path.basename(folder),
          rootId: root.id,
          relativePath: path.relative(root.path, folder) || ".",
          isRepo,
          hint,
          githubUrl: isRepo ? await gitRemote(folder) : "",
          modified: stat.mtime.toISOString(),
        });
      }
      if (isRepo || depth >= root.depth) return;
      for (const entry of entries) {
        if (ignored.has(entry.name.toLowerCase()) || entry.name.startsWith("."))
          continue;
        if (entry.isDirectory() || entry.isSymbolicLink())
          await walk(path.join(folder, entry.name), depth + 1);
      }
    }
    await walk(root.path, 0);
  }
  return found.sort((a, b) => b.modified.localeCompare(a.modified));
}
