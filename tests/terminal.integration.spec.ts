import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { launchProcess } from "../src/main/process";
import { powershell } from "../src/main/windows";
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
