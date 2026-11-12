import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { execFileSync } from "node:child_process";
// Lists the IDs of processes whose executable or command line contains `token`
// (the unique temp folder name), so short and long path forms both match.
const appPids = (token) =>
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like ('*' + $env:HOLD_TOKEN + '*') -or $_.CommandLine -like ('*' + $env:HOLD_TOKEN + '*') } | ForEach-Object { '{0} {1}' -f $_.ProcessId, $_.Name }",
    ],
    { encoding: "utf8", env: { ...process.env, HOLD_TOKEN: token } },
  )
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [pid, name] = line.split(" ");
      return { pid: Number(pid), name };
    });
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
const source = path.resolve(
  process.argv[2] ||
    path.join("out", `FIT-Launcher-${pkg.version}-windows-x64.zip`),
);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fit-portable-"));
const extracted = path.join(temp, "Extracted folder é");
new AdmZip(source).extractAllTo(extracted);
const first = path.join(extracted, "FIT Launcher");
const check = async (root, initial = false) => {
  const app = await electron.launch({
    executablePath: path.join(root, "app", "FIT Launcher.exe"),
    cwd: os.tmpdir(),
    env: {
      ...process.env,
      PATH: path.join(process.env.SystemRoot, "System32"),
    },
  });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "FIT Launcher", exact: true }),
    ).toBeVisible();
    const data = await page.evaluate(() => window.launcher.state());
    if (data.dataDir !== path.join(root, "data"))
      throw Error("Data is tied to the working directory");
    if (initial) {
      await expect(
        page.getByRole("heading", { name: "Welcome to FIT Launcher" }),
      ).toBeVisible();
      if (
        data.workspace.roots.length ||
        data.workspace.launches.length ||
        data.workspace.externalRegistry ||
        data.startup
      )
        throw Error("Release contains personal/integrated defaults");
    } else {
      await expect(
        page.locator('.react-flow__node[data-id="portable-proof"]'),
      ).toBeVisible();
      // Existing coordinates establish order; the ordered grid then packs them.
      await expect
        .poll(
          async () =>
            (await page.evaluate(() => window.launcher.state())).layout
              .positions["portable-proof"],
        )
        .toEqual({ x: 0, y: 0 });
    }
    const ports = await page.evaluate(() => window.launcher.ports());
    if (!ports.listeners.length) throw Error("Packaged helper failed");
    return await page.evaluate(() => window.launcher.state());
  } finally {
    // Positive control: the query must find the running app before Quit.
    const token = path.basename(temp);
    const pids = appPids(token);
    if (!pids.some((p) => p.pid === app.process().pid))
      throw Error(
        "Process query did not find the running app: " + JSON.stringify(pids),
      );
    await app.close();
    // Quit must end every app process. Users move or replace the folder after Quit.
    const deadline = Date.now() + 10000;
    while (pids.some((p) => alive(p.pid)) && Date.now() < deadline)
      await new Promise((r) => setTimeout(r, 100));
    const left = pids.filter((p) => alive(p.pid));
    if (left.length)
      throw Error(
        "App processes still running 10 s after Quit: " +
          left.map((p) => `${p.pid} ${p.name}`).join(", "),
      );
  }
};
// After Quit, with no app process left, Windows runners can still deny a folder
// rename for a few seconds (issue #21: about 5-6 s, no app process alive). An
// outside process, such as a file scanner, holds the folder then, not the app.
// Retry only that error, for a bounded time, and report the wait.
async function moveFolder(from, to) {
  const start = Date.now();
  for (let tries = 0; ; tries++) {
    try {
      await fs.rename(from, to);
      if (tries)
        console.log(`Folder move waited ${Date.now() - start} ms (EPERM)`);
      return;
    } catch (e) {
      if (e.code !== "EPERM" || Date.now() - start > 15000) throw e;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}
try {
  await check(first, true);
  const workspacePath = path.join(first, "data", "workspace.json"),
    layoutPath = path.join(first, "data", "layout.json");
  const workspace = JSON.parse(await fs.readFile(workspacePath, "utf8"));
  workspace.setupComplete = true;
  workspace.launches = [
    {
      id: "portable-proof",
      label: "Relocation fixture",
      group: "Demo",
      absolutePath: os.tmpdir(),
    },
  ];
  await fs.writeFile(workspacePath, JSON.stringify(workspace));
  await fs.writeFile(
    layoutPath,
    JSON.stringify({
      schemaVersion: 1,
      positions: { "portable-proof": { x: 140, y: 220 } },
      viewport: { x: 10, y: 15, zoom: 0.8 },
    }),
  );
  const moved = path.join(temp, "Moved folder é");
  await moveFolder(first, moved);
  const state = await check(moved);
  if (
    !state.workspace.setupComplete ||
    state.workspace.launches[0].id !== "portable-proof" ||
    state.layout.viewport.zoom !== 0.8
  )
    throw Error("Settings/layout lost on relocation");
  const before = await fs.readFile(path.join(moved, "data", "workspace.json"));
  const update = path.join(temp, "Update");
  new AdmZip(source).extractAllTo(update);
  await fs.cp(
    path.join(update, "FIT Launcher", "app"),
    path.join(moved, "app"),
    { recursive: true, force: true },
  );
  await check(moved);
  if (
    !before.equals(
      await fs.readFile(path.join(moved, "data", "workspace.json")),
    )
  )
    throw Error("App-only replacement changed workspace");
  const hash = createHash("sha256")
    .update(await fs.readFile(source))
    .digest("hex");
  console.log(
    "PASS: ZIP extraction, clean wizard, hidden Windows helper, restricted PATH, sibling data, moved layout and app-only update\nSHA256 " +
      hash,
  );
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
