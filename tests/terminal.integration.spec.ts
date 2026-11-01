import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { launchProcess } from "../src/main/process";
import { powershell } from "../src/main/windows";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import AdmZip from "adm-zip";

async function visibleTerminal(title: string) {
  const { stdout } = await promisify(execFile)(
    powershell(),
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.resolve("tests/fixtures/terminal-window.ps1"),
      "-TitleToken",
      title,
    ],
    { windowsHide: true },
  );
  return JSON.parse(stdout.replace(/^\uFEFF/, "")).visibleCount as number;
}
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
test("Terminal card action opens a visible interactive console from literal portable paths", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-terminal-action-"));
  const portable = path.join(dir, "FIT Launcher O'Brien é [app]");
  const folder = path.join(dir, "Project O'Brien é [x] & $(literal) ; data");
  const resources = path.join(portable, "resources", "windows");
  const data = path.join(dir, "data");
  const output = path.join(resources, "observed.json");
  const stop = path.join(resources, "close-fixture");
  const title = "FIT Terminal Test " + randomUUID();
  await fs.mkdir(resources, { recursive: true });
  await fs.mkdir(folder);
  await fs.mkdir(data);
  const packagedZip = process.env.FIT_TERMINAL_TEST_ZIP;
  if (packagedZip) {
    const zip = new AdmZip(packagedZip);
    const prefix = "FIT Launcher/app/";
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !entry.entryName.startsWith(prefix)) continue;
      const target = path.resolve(
        portable,
        entry.entryName.slice(prefix.length),
      );
      if (!target.startsWith(path.resolve(portable) + path.sep))
        throw Error("ZIP path escapes fixture");
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, entry.getData());
    }
  } else {
    await fs.cp(path.resolve("resources/windows"), resources, {
      recursive: true,
    });
  }
  const bootstrap = await fs.readFile(
    path.join(resources, "terminal.ps1"),
    "utf8",
  );
  await fs.writeFile(
    path.join(resources, "terminal.ps1"),
    "\uFEFF" +
      bootstrap.replace(/^\uFEFF/, "") +
      `\nAdd-Type @'
using System;
using System.IO;
using System.Threading;
public static class TerminalFixtureExit {
    public static void Watch(string stop) {
        var thread = new Thread(() => {
            while (!File.Exists(stop)) Thread.Sleep(100);
            Environment.Exit(0);
        });
        thread.IsBackground = true;
        thread.Start();
    }
}
'@
[TerminalFixtureExit]::Watch((Join-Path $PSScriptRoot 'close-fixture'))
$Host.UI.RawUI.WindowTitle = '${title}'
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'observed.json'), (@{folder=$Folder;cwd=(Get-Location).Path;pid=$PID} | ConvertTo-Json -Compress))
`,
    "utf8",
  );
  await fs.writeFile(
    path.join(data, "workspace.json"),
    JSON.stringify({
      schemaVersion: 1,
      setupComplete: true,
      launches: [
        { id: "terminal-probe", label: "Terminal probe", absolutePath: folder },
      ],
    }),
  );
  const app = await electron.launch({
    ...(packagedZip
      ? {
          executablePath: path.join(portable, "FIT Launcher.exe"),
          args: ["--data-dir", data],
        }
      : { args: [path.resolve("."), "--data-dir", data] }),
    cwd: portable,
  });
  let fixturePid: number | undefined;
  let appClosed = false;
  try {
    const page = await app.firstWindow();
    await page
      .locator(".repo-card")
      .getByRole("button", { name: "Terminal", exact: true })
      .click();
    await expect
      .poll(
        () =>
          fs
            .readFile(output, "utf8")
            .then(JSON.parse)
            .catch(() => null),
        {
          timeout: 10000,
          message:
            "Terminal button must execute the packaged helper, preserving the complete script and folder paths",
        },
      )
      .toMatchObject({ folder, cwd: await fs.realpath(folder) });
    fixturePid = JSON.parse(await fs.readFile(output, "utf8")).pid;
    await expect
      .poll(() => visibleTerminal(title), {
        timeout: 10000,
        message:
          "Terminal action must create a visible top-level console window",
      })
      .toBeGreaterThan(0);
    // The bootstrap is complete: NoExit must keep the real interactive shell alive.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(alive(fixturePid!)).toBe(true);
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
    ).toBe(true);
    await app.close();
    appClosed = true;
    expect(alive(fixturePid!)).toBe(true);
    expect(await visibleTerminal(title)).toBeGreaterThan(0);
  } finally {
    await fs.writeFile(stop, "close");
    if (fixturePid)
      await expect
        .poll(() => alive(fixturePid!), { timeout: 5000 })
        .toBe(false);
    if (!appClosed) await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("direct PowerShell bootstrap receives a literal cwd and closes while Launcher remains visible", async () => {
  const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "fit-terminal O'Brien é [x] & $(literal)-"),
    ),
    script = path.join(dir, "terminal.ps1"),
    output = path.join(dir, "cwd.txt");
  await fs.writeFile(
    script,
    "\uFEFFparam([string]$Result,[string]$Bootstrap,[string]$Folder)\n. $Bootstrap -Folder $Folder\nSet-Content -LiteralPath $Result -Value (Get-Location).Path -Encoding UTF8\nexit\n",
    "utf8",
  );
  const app = await electron.launch({
    args: [".", "--data-dir", path.join(dir, "data")],
  });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "FIT Launcher", exact: true }),
    ).toBeVisible();
    await launchProcess(
      powershell(),
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        "-Result",
        output,
        "-Bootstrap",
        path.resolve("resources/windows/terminal.ps1"),
        "-Folder",
        dir,
      ],
      dir,
    );
    await expect
      .poll(
        () =>
          fs.readFile(output, "utf8").then(
            (s) => s.replace(/^\uFEFF/, "").trim(),
            () => "",
          ),
        { timeout: 15000 },
      )
      .toBe(await fs.realpath(dir));
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
    ).toBe(true);
    console.log("Real terminal cwd verified; Launcher stayed visible.");
  } finally {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
