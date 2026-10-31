import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { launchProcess } from "../src/main/process";
import { powershell } from "../src/main/windows";
test("Terminal card action runs its helper from a portable path with spaces and literal project characters", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-terminal-action-"));
  const portable = path.join(dir, "FIT Launcher O'Brien é [app]");
  const folder = path.join(dir, "Project O'Brien é [x] & $(literal) ; data");
  const resources = path.join(portable, "resources", "windows");
  const data = path.join(dir, "data");
  const output = path.join(resources, "observed.json");
  await fs.mkdir(resources, { recursive: true });
  await fs.mkdir(folder);
  await fs.mkdir(data);
  const bootstrap = await fs.readFile(
    path.resolve("resources/windows/terminal.ps1"),
    "utf8",
  );
  await fs.writeFile(
    path.join(resources, "terminal.ps1"),
    "\uFEFF" +
      bootstrap.replace(/^\uFEFF/, "") +
      "\n[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'observed.json'), (@{folder=$Folder;cwd=(Get-Location).Path} | ConvertTo-Json -Compress))\nexit\n",
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
    args: [path.resolve("."), "--data-dir", data],
    cwd: portable,
  });
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
      .toEqual({ folder, cwd: await fs.realpath(folder) });
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
    ).toBe(true);
  } finally {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("real independent PowerShell terminal receives a literal cwd and closes while Launcher remains visible", async () => {
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
