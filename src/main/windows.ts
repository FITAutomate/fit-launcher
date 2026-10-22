import { execFile } from "node:child_process";
import path from "node:path";
export const powershell = () =>
  path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
export function windowsHelper<T>(
  resources: string,
  name: string,
  args: string[] = [],
): Promise<T> {
  return new Promise((resolve, reject) => {
    execFile(
      powershell(),
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(resources, "windows", name),
        ...args,
      ],
      {
        windowsHide: true,
        timeout: 30000,
        maxBuffer: 12 * 1024 * 1024,
        encoding: "utf8",
      },
      (error, out, err) => {
        if (error) {
          reject(Error(err || error.message));
          return;
        }
        try {
          resolve(JSON.parse(out.replace(/^\uFEFF/, "")));
        } catch {
          reject(
            Error("Windows helper returned invalid data: " + out.slice(0, 250)),
          );
        }
      },
    );
  });
}
