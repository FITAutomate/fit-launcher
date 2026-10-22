import fs from "node:fs/promises";
import path from "node:path";
import { launchProcess, openTerminal } from "./process";
import { shell } from "electron";
import { resolveLaunch } from "./paths";
import { githubUrl, gitRemote } from "./discovery";
import type { Workspace, Action } from "../shared/schema";
export async function detectEditor() {
  for (const exe of [
    path.join(
      process.env.LOCALAPPDATA || "",
      "Programs",
      "Microsoft VS Code",
      "Code.exe",
    ),
    path.join(process.env.ProgramFiles || "", "Microsoft VS Code", "Code.exe"),
  ]) {
    if (
      await fs.access(exe).then(
        () => true,
        () => false,
      )
    )
      return exe;
  }
  return "";
}
export async function launchAction(
  workspace: Workspace,
  id: string,
  action: Action,
  resources = path.join(process.cwd(), "resources"),
) {
  const entry = workspace.launches.find((x) => x.id === id);
  if (!entry) throw Error("Shortcut not found.");
  const folder = resolveLaunch(workspace, entry);
  if (!(await fs.stat(folder)).isDirectory())
    throw Error("Repair this shortcut: its folder is missing.");
  if (action === "explorer") {
    const error = await shell.openPath(folder);
    if (error) throw Error(error);
    return;
  }
  if (action === "github") {
    const url = githubUrl(entry.githubUrl || (await gitRemote(folder)));
    if (!url)
      throw Error(
        "No supported GitHub remote. Edit the shortcut to set its repository URL.",
      );
    await shell.openExternal(url);
    return;
  }
  if (action === "editor") {
    const exe = workspace.editor || (await detectEditor());
    if (!exe) throw Error("Choose an editor executable in Settings.");
    if (!exe.toLowerCase().endsWith(".exe"))
      throw Error("Choose an editor .exe, not a command script.");
    if (!path.isAbsolute(exe))
      throw Error("Choose an editor by its full executable path in Settings.");
    await launchProcess(exe, [folder], folder);
    return;
  }
  await openTerminal(folder, path.join(resources, "windows", "terminal.ps1"));
}
