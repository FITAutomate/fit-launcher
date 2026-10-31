import { test, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WorkspaceSchema, newWorkspace } from "../src/shared/schema";
import { Store } from "../src/main/store";

test("new and legacy profiles default to the system appearance; invalid choices are rejected", () => {
  expect(newWorkspace().theme).toBe("system");
  expect(WorkspaceSchema.parse({ schemaVersion: 1 }).theme).toBe("system");
  expect(
    WorkspaceSchema.safeParse({ schemaVersion: 1, theme: "sepia" }).success,
  ).toBe(false);
});

test("appearance survives profile saves, reloads and transfer without replacing shortcuts", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-theme-store-"));
  try {
    const store = new Store(dir);
    await store.init();
    const launches = [
      {
        id: "widget",
        label: "Widget Studio",
        absolutePath: dir,
        group: "Demo",
      },
    ];
    await store.save(
      { ...store.workspace, launches, theme: "dark" },
      await store.revision(),
    );
    const reloaded = new Store(dir);
    await reloaded.init();
    expect(reloaded.workspace.theme).toBe("dark");
    expect(reloaded.workspace.launches).toEqual(launches);
    const transfer = await reloaded.transfer();
    await reloaded.save(
      { ...reloaded.workspace, theme: "light" },
      await reloaded.revision(),
    );
    await reloaded.replace(transfer);
    expect(reloaded.workspace.theme).toBe("dark");
    expect(reloaded.workspace.launches).toEqual(launches);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
