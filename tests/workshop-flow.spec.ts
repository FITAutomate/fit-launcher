import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
async function choose(app: ElectronApplication, selected: string) {
  await app.evaluate(({ dialog }, value) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [value],
    });
  }, selected);
}
test("wizard, discovery, card CRUD and snapped layout survive rename, refresh and restart", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fit-workshop-")),
    profile = path.join(temp, "data"),
    root = path.join(temp, "Projects é"),
    other = path.join(temp, "Other"),
    repo = path.join(root, "nested", "O'Brien [demo] & $(literal)");
  await fs.mkdir(path.join(repo, ".git"), { recursive: true });
  await fs.mkdir(other);
  await fs.writeFile(
    path.join(repo, ".git", "config"),
    '[remote "origin"]\n url = git@github.com:example/demo.git\n',
  );
  let app = await electron.launch({ args: [".", "--data-dir", profile] });
  try {
    let page = await app.firstWindow();
    page.on("dialog", (d) => d.accept());
    await expect(
      page.getByRole("heading", { name: "Welcome to FIT Launcher" }),
    ).toBeVisible();
    await choose(app, root);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add directory", exact: true })
      .click();
    await choose(app, other);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add directory", exact: true })
      .click();
    await page.getByRole("button", { name: "Open my workspace" }).click();
    expect(
      (await page.evaluate(() => window.launcher.state())).workspace.roots,
    ).toHaveLength(2);
    await page.getByRole("button", { name: /Discovered/ }).click();
    const card = page.locator(".discovery-card").filter({ hasText: "O'Brien" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Add shortcut" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Workshop project");
    await page.getByRole("button", { name: "Save shortcut" }).click();
    await page.getByRole("button", { name: "Launch", exact: true }).click();
    await expect(page.locator(".repo-card")).toHaveCount(1);
    const handle = page.locator(".drag-handle");
    const box = await handle.boundingBox();
    if (!box) throw Error("Missing drag handle");
    await page.mouse.move(box.x + 100, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 220, box.y + 120, { steps: 12 });
    await page.mouse.up();
    const id = (await page.evaluate(() => window.launcher.state())).workspace
      .launches[0].id;
    await expect
      .poll(
        async () =>
          Object.keys(
            (await page.evaluate(() => window.launcher.state())).layout
              .positions,
          ).length,
      )
      .toBe(1);
    const position = (await page.evaluate(() => window.launcher.state())).layout
      .positions[id];
    expect(position.x % 20).toBe(0);
    expect(position.y % 20).toBe(0);
    await page
      .locator(".repo-card")
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Renamed project");
    await page.getByLabel("Group", { exact: true }).fill("Workshop");
    await page.getByRole("button", { name: "Save shortcut" }).click();
    expect(
      (await page.evaluate(() => window.launcher.state())).layout.positions[id],
    ).toEqual(position);
    await page.getByRole("button", { name: /Ports/ }).click();
    await expect(
      page.getByRole("heading", { name: "Port dashboard" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Drift to review" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Launch", exact: true }).click();
    expect(
      (await page.evaluate(() => window.launcher.state())).layout.positions[id],
    ).toEqual(position);
    const boardBounds = await page.getByTestId("launch-board").boundingBox(),
      controlsBounds = await page
        .locator(".react-flow__controls")
        .boundingBox();
    expect(controlsBounds!.y + controlsBounds!.height).toBeLessThanOrEqual(
      boardBounds!.y + boardBounds!.height,
    );
    await page.screenshot({ path: "test-results/workshop-launch.png" });
    await app.close();
    app = await electron.launch({ args: [".", "--data-dir", profile] });
    page = await app.firstWindow();
    page.on("dialog", (d) => d.accept());
    await expect(
      page.getByText("Renamed project", { exact: true }).first(),
    ).toBeVisible();
    expect(
      (await page.evaluate(() => window.launcher.state())).layout.positions[id],
    ).toEqual(position);
    const moved = repo + " moved";
    await fs.rename(repo, moved);
    await page.reload();
    await page
      .locator(".repo-card")
      .getByRole("button", { name: "Repair" })
      .click();
    await page.getByLabel("Folder", { exact: true }).fill(moved);
    await page.getByRole("button", { name: "Save shortcut" }).click();
    await expect(page.locator(".repo-card.broken")).toHaveCount(0);
    expect(
      (await page.evaluate(() => window.launcher.state())).workspace.launches[0]
        .id,
    ).toBe(id);
    await page
      .locator(".repo-card")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your projects, one home" }),
    ).toBeVisible();
    expect(await fs.stat(moved).then((s) => s.isDirectory())).toBe(true);
    expect(
      (await page.evaluate(() => window.launcher.state())).layout.positions[id],
    ).toBeUndefined();
  } finally {
    await app.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test("registry UI preserves connected bytes and configuration transfer requires preview", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fit-registry-")),
    source = path.join(temp, "external.yaml"),
    exported = path.join(temp, "profile.json");
  await fs.writeFile(
    source,
    "assignments:\n  - repo: connected-example\n    default_port: 65101\n    status: reserved\n",
  );
  const before = await fs.readFile(source);
  const app = await electron.launch({
    args: [".", "--data-dir", path.join(temp, "data")],
  });
  try {
    const page = await app.firstWindow();
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.getByRole("button", { name: /Settings/ }).click();
    await page
      .getByText("Tools and registry connection", { exact: true })
      .click();
    await page.getByLabel("Connected registry").fill(source);
    await page.getByRole("button", { name: "Save settings" }).click();
    await page.getByRole("button", { name: /Ports/ }).click();
    await expect(
      page.getByText("connected-example", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Connected · read-only", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add assignment", exact: true })
      .click();
    await page.getByLabel("App name").fill("Local example");
    await page.getByLabel("Expected port").fill("65102");
    await page.getByRole("button", { name: "Save assignment" }).click();
    await expect(
      page.getByText("Local example", { exact: true }),
    ).toBeVisible();
    expect(await fs.readFile(source)).toEqual(before);
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, exported);
    await page.getByRole("button", { name: /Settings/ }).click();
    await page
      .getByText("Portable profile import / export", { exact: true })
      .click();
    await page.getByRole("button", { name: "Export profile…" }).click();
    await expect
      .poll(() =>
        fs.access(exported).then(
          () => true,
          () => false,
        ),
      )
      .toBe(true);
    const transfer = JSON.parse(await fs.readFile(exported, "utf8"));
    expect(transfer.registry.assignments[0].repo).toBe("Local example");
    await app.evaluate(({ dialog }) => {
      dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    });
    expect(
      await page.evaluate(() => window.launcher.importConfig()),
    ).toBeNull();
    expect(
      (await page.evaluate(() => window.launcher.state())).registry
        .assignments[0].repo,
    ).toBe("Local example");
    await choose(app, exported);
    await page.getByRole("button", { name: "Preview import…" }).click();
    await expect(
      page.getByRole("button", { name: "Confirm replacement" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm replacement" }).click();
    const state = await page.evaluate(() => window.launcher.state());
    expect(state.workspace.externalRegistry).toBe("");
    expect(state.workspace.shellIntegration).toBe(false);
    expect(state.startup).toBe(false);
    expect(
      (await fs.readdir(path.join(temp, "data", "backups"))).length,
    ).toBeGreaterThan(0);
  } finally {
    await app.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test("window Close hides, same-profile second launch restores and Quit preserves an independent process", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fit-life-"));
  const fixture = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    windowsHide: true,
    stdio: "ignore",
  });
  const app = await electron.launch({ args: [".", "--data-dir", temp] });
  const appProcess = app.process();
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "FIT Launcher", exact: true }),
    ).toBeVisible();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].close(),
    );
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
    ).toBe(false);
    const secondEnv = { ...process.env };
    delete secondEnv.ELECTRON_RUN_AS_NODE;
    const second = spawn(
      path.resolve("node_modules/electron/dist/electron.exe"),
      [".", "--data-dir", temp],
      {
        cwd: process.cwd(),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: secondEnv,
      },
    );
    second.stderr?.on("data", (data) =>
      console.log("Second instance:", String(data)),
    );
    await new Promise<void>((resolve, reject) => {
      second.once("exit", () => resolve());
      second.once("error", reject);
    });
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isVisible(),
        ),
      )
      .toBe(true);
    await page
      .evaluate(() => window.launcher.quit())
      .catch((error) => {
        expect(String(error)).toContain("closed");
      });
    await expect.poll(() => appProcess.exitCode).not.toBeNull();
    expect(fixture.exitCode).toBeNull();
  } finally {
    if (appProcess.exitCode === null) await app.close();
    fixture.kill();
    await new Promise<void>((resolve) =>
      fixture.exitCode !== null
        ? resolve()
        : fixture.once("exit", () => resolve()),
    );
    await fs.rm(temp, { recursive: true, force: true });
  }
});
