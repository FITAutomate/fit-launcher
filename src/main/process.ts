import { spawn } from "node:child_process";
import path from "node:path";
import { windowsHelper } from "./windows";
export function launchProcess(
  exe: string,
  args: string[],
  cwd: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd,
      shell: false,
      // Windows children outlive the parent; unref avoids holding Launcher open.
      // DETACHED_PROCESS prevents ConsoleHost from running scripts on some hosts.
      detached: false,
      stdio: "ignore",
      windowsHide: false,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
export async function openTerminal(folder: string, bootstrap: string) {
  await windowsHelper(
    path.dirname(path.dirname(bootstrap)),
    "open-terminal.ps1",
    ["-Folder", folder, "-Bootstrap", bootstrap],
  );
}
