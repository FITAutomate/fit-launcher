import { test, expect, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../src/main/store";
test("portable stores reject stale writes and retain a recoverable backup", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-store-"));
  try {
    const store = new Store(dir);
    await store.init();
    const revision = await store.revision();
    const workspace = { ...store.workspace, setupComplete: true };
    await store.save(workspace, revision);
    await expect(store.save(workspace, revision)).rejects.toThrow("changed");
    expect(
      (await fs.readdir(path.join(dir, "backups"))).length,
    ).toBeGreaterThan(0);
    const again = new Store(dir);
    await again.init();
    expect(again.workspace.setupComplete).toBe(true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("failed atomic replacement leaves the original file and in-memory profile intact", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-interrupted-"));
  try {
    const store = new Store(dir);
    await store.init();
    const file = path.join(dir, "workspace.json"),
      before = await fs.readFile(file),
      revision = await store.revision();
    const replacement = vi
      .spyOn(fs, "rename")
      .mockRejectedValueOnce(
        Object.assign(Error("fixture access denied"), { code: "EACCES" }),
      );
    try {
      await expect(
        store.save({ ...store.workspace, setupComplete: true }, revision),
      ).rejects.toThrow("access denied");
    } finally {
      replacement.mockRestore();
    }
    expect(await fs.readFile(file)).toEqual(before);
    expect(store.workspace.setupComplete).toBe(false);
    await store.save({ ...store.workspace, setupComplete: true }, revision);
    expect(store.workspace.setupComplete).toBe(true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
