import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
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
    await app.close();
  }
};
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
  await fs.rename(first, moved);
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
