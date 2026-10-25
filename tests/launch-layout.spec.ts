import {
  test,
  expect,
  _electron as electron,
  type Page,
} from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function rendered(page: Page) {
  return page.locator(".react-flow__node").evaluateAll((elements) =>
    elements.map((element) => {
      const node = element as HTMLElement;
      const transform = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      const box = node.getBoundingClientRect();
      return {
        id: node.dataset.id!,
        x: transform.m41,
        y: transform.m42,
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    }),
  );
}
async function renderedOrder(page: Page) {
  return (await rendered(page))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((node) => node.id);
}
async function dragTo(page: Page, from: string, to: string) {
  const a = await page
    .locator(`[data-id="${from}"] .drag-handle`)
    .boundingBox();
  const b = await page.locator(`[data-id="${to}"] .drag-handle`).boundingBox();
  if (!a || !b) throw Error("Missing drag handle");
  await page.mouse.move(a.x + 80, a.y + 20);
  await page.mouse.down();
  await page.mouse.move(b.x + 80, b.y + 20, { steps: 15 });
  // The occupied card moves aside while the pointer is still held down.
  await expect
    .poll(
      async () => (await rendered(page)).find((node) => node.id === to)!.left,
    )
    .not.toBeCloseTo(b.x, 0);
  await page.mouse.up();
}
async function assertPacked(page: Page, count: number) {
  const nodes = await rendered(page);
  expect(nodes).toHaveLength(count);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i],
        b = nodes[j];
      expect(
        a.right <= b.left + 0.1 ||
          b.right <= a.left + 0.1 ||
          a.bottom <= b.top + 0.1 ||
          b.bottom <= a.top + 0.1,
        `${a.id} overlaps ${b.id}`,
      ).toBe(true);
    }
  }
}

for (const change of ["add", "remove-other", "remove-dragged"] as const) {
  test(`a pending ${change} save preserves grid membership during a drag`, async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fit-grid-pending-"));
    await fs.writeFile(
      path.join(temp, "workspace.json"),
      JSON.stringify({
        schemaVersion: 1,
        setupComplete: true,
        launches: ["a", "b", "c"].map((id) => ({
          id,
          label: id,
          absolutePath: temp,
        })),
      }),
    );
    const app = await electron.launch({ args: [".", "--data-dir", temp] });
    try {
      const page = await app.firstWindow();
      page.on("dialog", (dialog) => dialog.accept());
      await expect(page.locator(".repo-card")).toHaveCount(3);
      await page
        .getByRole("button", { name: "Auto arrange", exact: true })
        .click();
      await page.evaluate(() => window.launcher.state());
      // Gate just this fixture's next workspace write in the real main process.
      // This lets a normal UI save resolve while the mouse is held down.
      await app.evaluate((_electron, dir) => {
        const files = process.getBuiltinModule("fs/promises");
        const original = files.writeFile;
        files.writeFile = async (...args: Parameters<typeof original>) => {
          if (
            String(args[0]).startsWith(
              dir + process.getBuiltinModule("path").sep + "workspace.json.",
            )
          ) {
            files.writeFile = original;
            await new Promise<void>((resolve) => {
              Reflect.set(globalThis, "releaseWorkspaceWrite", resolve);
            });
          }
          return original(...args);
        };
      }, temp);
      if (change === "add") {
        await page
          .getByRole("button", { name: "+ Add shortcut", exact: true })
          .click();
        await page.getByLabel("Name", { exact: true }).fill("new");
        await page.getByLabel("Folder", { exact: true }).fill(temp);
        await page
          .getByRole("button", { name: "Save shortcut", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
      } else {
        await page
          .locator(`[data-id="${change === "remove-other" ? "c" : "a"}"]`)
          .getByRole("button", { name: "Remove", exact: true })
          .click();
      }
      await expect
        .poll(() =>
          app.evaluate(
            () => typeof Reflect.get(globalThis, "releaseWorkspaceWrite"),
          ),
        )
        .toBe("function");
      const from = await page
        .locator('[data-id="a"] .drag-handle')
        .boundingBox();
      const to = await page.locator('[data-id="b"] .drag-handle').boundingBox();
      await page.mouse.move(from!.x + 80, from!.y + 20);
      await page.mouse.down();
      await page.mouse.move(from!.x + 90, from!.y + 20, { steps: 3 });
      await app.evaluate(() =>
        Reflect.get(globalThis, "releaseWorkspaceWrite")(),
      );
      await expect(page.locator(".repo-card")).toHaveCount(
        change === "add" ? 4 : 2,
      );
      await page.mouse.move(to!.x + 80, to!.y + 20, { steps: 10 });
      await page.mouse.up();
      const state = await page.evaluate(() => window.launcher.state());
      const added = state.workspace.launches.find(
        (entry) => entry.label === "new",
      );
      const expected =
        change === "add"
          ? ["b", "a", "c", added!.id]
          : change === "remove-other"
            ? ["b", "a"]
            : ["b", "c"];
      await expect.poll(() => renderedOrder(page)).toEqual(expected);
      await assertPacked(page, expected.length);
      const saved = (await page.evaluate(() => window.launcher.state())).layout
        .positions;
      expect(Object.keys(saved).sort()).toEqual([...expected].sort());
      const coordinates = Object.values(saved).sort(
        (a, b) => a.y - b.y || a.x - b.x,
      );
      expect(coordinates[0]).toEqual({ x: 0, y: 0 });
      expect(coordinates[1].x).toBe(340);
      await page
        .getByRole("button", { name: "Discovered", exact: true })
        .click();
      await page.getByRole("button", { name: "Launch", exact: true }).click();
      await expect.poll(() => renderedOrder(page)).toEqual(expected);
    } finally {
      await app
        .evaluate(() => Reflect.get(globalThis, "releaseWorkspaceWrite")?.())
        .catch(() => {});
      await app.close();
      await fs.rm(temp, { recursive: true, force: true });
    }
  });
}

test("Auto arrange can retry the same layout after a disk write failure", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fit-grid-retry-"));
  await fs.writeFile(
    path.join(temp, "workspace.json"),
    JSON.stringify({
      schemaVersion: 1,
      setupComplete: true,
      launches: [{ id: "sample", label: "Sample", absolutePath: temp }],
    }),
  );
  await fs.writeFile(
    path.join(temp, "layout.json"),
    JSON.stringify({
      schemaVersion: 1,
      positions: { sample: { x: 0, y: 0 } },
      viewport: { x: 0, y: 0, zoom: 0.5 },
    }),
  );
  const app = await electron.launch({ args: [".", "--data-dir", temp] });
  try {
    const page = await app.firstWindow();
    await expect(page.locator(".repo-card")).toHaveCount(1);
    await page.evaluate(() => window.launcher.state());
    const file = path.join(temp, "layout.json"),
      previous = path.join(temp, "previous.json");
    // A directory at the file path produces a real Store write failure.
    await fs.rename(file, previous);
    await fs.mkdir(file);
    await page
      .getByRole("button", { name: "Auto arrange", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Could not save layout",
    );
    await page.evaluate(() => window.launcher.state());
    await fs.rmdir(file);
    await fs.rename(previous, file);
    await page
      .getByRole("button", { name: "Auto arrange", exact: true })
      .click();
    await expect
      .poll(
        async () => JSON.parse(await fs.readFile(file, "utf8")).viewport.zoom,
      )
      .toBe(1);
  } finally {
    await app.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test("80 cards fill the width, scroll, reorder and retain their order across tabs and restart", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fit-grid-"));
  const ids = Array.from({ length: 80 }, (_, i) => `sample-${i}`);
  await fs.writeFile(
    path.join(temp, "workspace.json"),
    JSON.stringify({
      schemaVersion: 1,
      setupComplete: true,
      roots: [],
      launches: ids.map((id, i) => ({
        id,
        label: `Project ${String(i).padStart(2, "0")}`,
        group: "Example projects",
        absolutePath: i === 3 ? path.join(temp, "missing") : temp,
      })),
    }),
  );
  // Old free-form coordinates may overlap; retain their row-major order.
  await fs.writeFile(
    path.join(temp, "layout.json"),
    JSON.stringify({
      schemaVersion: 1,
      positions: Object.fromEntries(
        ids.map((id, i) => [
          id,
          { x: (i % 3) * 20, y: Math.floor(i / 3) * 20 },
        ]),
      ),
      viewport: { x: 0, y: 0, zoom: 0.2 },
    }),
  );
  let app = await electron.launch({ args: [".", "--data-dir", temp] });
  try {
    let page = await app.firstWindow();
    page.on("dialog", (dialog) => dialog.accept());
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1800, 1000),
    );
    await expect(page.locator(".repo-card")).toHaveCount(80);
    await page
      .getByRole("button", { name: "Auto arrange", exact: true })
      .click();
    await expect.poll(async () => (await rendered(page))[0].width).toBe(320);
    const board = await page.locator(".react-flow").boundingBox();
    const columns = Math.floor((board!.width - 40 + 20) / 340);
    await expect
      .poll(async () => new Set((await rendered(page)).map((n) => n.x)).size)
      .toBe(columns);
    await assertPacked(page, 80);
    const before = (await page.evaluate(() => window.launcher.state())).layout;
    await page.mouse.move(board!.x + board!.width - 30, board!.y + 100);
    await page.mouse.wheel(0, 700);
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.launcher.state())).layout.viewport
            .y,
      )
      .toBeLessThan(before.viewport.y);
    expect(
      (await page.evaluate(() => window.launcher.state())).layout.viewport.zoom,
    ).toBe(1);
    await page.getByRole("button", { name: "Fit all", exact: true }).click();
    await expect
      .poll(async () => (await rendered(page))[0].width)
      .toBeLessThan(320);
    const fitted = (await page.evaluate(() => window.launcher.state())).layout;
    expect(fitted.positions).toEqual(before.positions);
    for (const node of await rendered(page)) {
      expect(node.top).toBeGreaterThanOrEqual(board!.y - 1);
      expect(node.bottom).toBeLessThanOrEqual(board!.y + board!.height + 1);
      expect(node.left).toBeGreaterThanOrEqual(board!.x - 1);
      expect(node.right).toBeLessThanOrEqual(board!.x + board!.width + 1);
    }
    await page
      .getByRole("button", { name: "Auto arrange", exact: true })
      .click();
    await dragTo(page, "sample-0", "sample-2");
    const reordered = ["sample-1", "sample-2", "sample-0", ...ids.slice(3)];
    await expect.poll(() => renderedOrder(page)).toEqual(reordered);
    await assertPacked(page, 80);
    // Keyboard navigation on the card actions cannot move a node off its slot.
    await page.locator('[data-id="sample-0"] button').first().focus();
    await page.keyboard.press("ArrowRight");
    expect(await renderedOrder(page)).toEqual(reordered);
    await page.getByRole("button", { name: "Discovered", exact: true }).click();
    await page.getByRole("button", { name: "Launch", exact: true }).click();
    await expect.poll(() => renderedOrder(page)).toEqual(reordered);
    await page
      .locator('[data-id="sample-0"]')
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Renamed project");
    await page.getByRole("button", { name: "Save shortcut" }).click();
    await expect.poll(() => renderedOrder(page)).toEqual(reordered);
    await page.getByLabel("Search", { exact: true }).fill("Renamed");
    await expect(
      page.getByRole("button", { name: "Auto arrange", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".repo-card")).toHaveCount(1);
    await page.getByLabel("Search", { exact: true }).fill("");
    await expect.poll(() => renderedOrder(page)).toEqual(reordered);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1000, 750),
    );
    await expect
      .poll(async () => new Set((await rendered(page)).map((n) => n.x)).size)
      .toBe(2);
    expect(await renderedOrder(page)).toEqual(reordered);
    await assertPacked(page, 80);
    await page.getByRole("button", { name: "Fit all", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.launcher.state())).layout.viewport
            .zoom,
      )
      .toBeLessThan(0.1);
    const narrow = await page.locator(".react-flow").boundingBox();
    for (const node of await rendered(page)) {
      expect(node.top).toBeGreaterThanOrEqual(narrow!.y - 1);
      expect(node.bottom).toBeLessThanOrEqual(narrow!.y + narrow!.height + 1);
    }
    await page
      .getByRole("button", { name: "Auto arrange", exact: true })
      .click();
    await page.screenshot({ path: "test-results/ordered-grid.png" });
    await page.reload();
    await expect.poll(() => renderedOrder(page)).toEqual(reordered);
    await app.close();
    app = await electron.launch({ args: [".", "--data-dir", temp] });
    page = await app.firstWindow();
    page.on("dialog", (dialog) => dialog.accept());
    await expect.poll(() => renderedOrder(page)).toEqual(reordered);
    await assertPacked(page, 80);
    // Removing one card closes its slot without resetting the remaining order.
    await page
      .locator('[data-id="sample-1"]')
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await expect
      .poll(() => renderedOrder(page))
      .toEqual(reordered.filter((id) => id !== "sample-1"));
    await page
      .getByRole("button", { name: "+ Add shortcut", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Added project");
    await page.getByLabel("Folder", { exact: true }).fill(temp);
    await page.getByRole("button", { name: "Save shortcut" }).click();
    await expect(page.locator(".repo-card")).toHaveCount(80);
    const added = (
      await page.evaluate(() => window.launcher.state())
    ).workspace.launches.find((entry) => entry.label === "Added project")!;
    await expect
      .poll(() => renderedOrder(page))
      .toEqual([...reordered.filter((id) => id !== "sample-1"), added.id]);
  } finally {
    await app.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test("importing a profile replaces the mounted grid order even when IDs are reused", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fit-grid-import-"));
  const workspace = {
    schemaVersion: 1,
    setupComplete: true,
    roots: [],
    launches: ["a", "b", "c"].map((id) => ({
      id,
      label: id,
      absolutePath: temp,
    })),
  };
  await fs.writeFile(
    path.join(temp, "workspace.json"),
    JSON.stringify(workspace),
  );
  const transfer = path.join(temp, "transfer.json");
  await fs.writeFile(
    transfer,
    JSON.stringify({
      schemaVersion: 1,
      workspace,
      registry: { schemaVersion: 1 },
      layout: {
        schemaVersion: 1,
        positions: {
          c: { x: 0, y: 0 },
          b: { x: 340, y: 0 },
          a: { x: 680, y: 0 },
        },
        viewport: { x: 20, y: 20, zoom: 1 },
      },
    }),
  );
  const app = await electron.launch({ args: [".", "--data-dir", temp] });
  try {
    const page = await app.firstWindow();
    page.on("dialog", (dialog) => dialog.accept());
    await expect.poll(() => renderedOrder(page)).toEqual(["a", "b", "c"]);
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, transfer);
    await page.getByRole("button", { name: /Settings/ }).click();
    await page
      .getByText("Portable profile import / export", { exact: true })
      .click();
    await page
      .getByRole("button", { name: "Preview import…", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm replacement", exact: true })
      .click();
    await expect.poll(() => renderedOrder(page)).toEqual(["c", "b", "a"]);
    await page.getByRole("button", { name: "Discovered", exact: true }).click();
    await page.getByRole("button", { name: "Launch", exact: true }).click();
    await expect.poll(() => renderedOrder(page)).toEqual(["c", "b", "a"]);
  } finally {
    await app.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
});
