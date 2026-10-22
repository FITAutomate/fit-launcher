import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
test("desktop window uses portable data and packaged Windows helper", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-desktop-"));
  const app = await electron.launch({
    args: [".", "--data-dir", dir],
    cwd: process.cwd(),
  });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "FIT Launcher", exact: true }),
    ).toBeVisible();
    const state = await page.evaluate(() => window.launcher.state());
    expect(state.dataDir).toBe(dir);
    const ports = await page.evaluate(() => window.launcher.ports());
    expect(ports.listeners.length).toBeGreaterThan(0);
    expect(await fs.readdir(dir)).toContain("workspace.json");
  } finally {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
