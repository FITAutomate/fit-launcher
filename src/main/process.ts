import { spawn } from "node:child_process";
import { powershell } from "./windows";
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
  const args = [
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    bootstrap,
    "-Folder",
    folder,
  ];
  try {
    await launchProcess(
      "wt.exe",
      ["-d", folder, powershell(), ...args],
      folder,
    );
  } catch {
    await launchProcess(powershell(), args, folder);
  }
}
