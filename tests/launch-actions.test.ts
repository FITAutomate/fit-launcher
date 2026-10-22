import { test, expect, vi, afterEach } from "vitest";
import * as childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawn: vi.fn(),
}));
vi.mock("electron", () => ({
  shell: {
    openPath: vi.fn(async () => ""),
    openExternal: vi.fn(async () => {}),
  },
}));
import { shell } from "electron";
import { launchAction } from "../src/main/launch-actions";
import { newWorkspace } from "../src/shared/schema";
afterEach(() => vi.restoreAllMocks());
test("all actions resolve the saved ID and keep literal folder data out of command text", async () => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "fit O'Brien é [x] & $(never)-"),
  );
  try {
    const w = newWorkspace();
    w.editor = "C:\\Tools\\Editor.exe";
    w.launches = [
      {
        id: "one",
        label: "one",
        group: "demo",
        absolutePath: dir,
        githubUrl: "git@github.com:example/demo.git",
      },
    ];
    const spawn = vi.mocked(childProcess.spawn).mockImplementation(() => {
      const child = new childProcess.ChildProcess();
      queueMicrotask(() => child.emit("spawn"));
      return child;
    });
    await launchAction(w, "one", "explorer");
    expect(shell.openPath).toHaveBeenCalledWith(dir);
    await launchAction(w, "one", "github");
    expect(shell.openExternal).toHaveBeenCalledWith(
      "https://github.com/example/demo",
    );
    await launchAction(w, "one", "editor");
    expect(spawn).toHaveBeenCalledWith(
      w.editor,
      [dir],
      expect.objectContaining({ cwd: dir, shell: false }),
    );
    await launchAction(w, "one", "terminal");
    expect(spawn).toHaveBeenCalledWith(
      "wt.exe",
      expect.arrayContaining([
        "-d",
        dir,
        "-File",
        path.resolve("resources/windows/terminal.ps1"),
        "-Folder",
        dir,
      ]),
      expect.objectContaining({ cwd: dir, shell: false }),
    );
    await expect(launchAction(w, "unknown", "editor")).rejects.toThrow(
      "not found",
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("missing Windows Terminal falls back to an independent PowerShell with cwd as data", async () => {
  const w = newWorkspace();
  w.launches = [
    { id: "one", label: "one", group: "demo", absolutePath: os.tmpdir() },
  ];
  const spawn = vi
    .mocked(childProcess.spawn)
    .mockImplementation((exe: string) => {
      const child = new childProcess.ChildProcess();
      queueMicrotask(() =>
        exe === "wt.exe"
          ? child.emit("error", new Error("not installed"))
          : child.emit("spawn"),
      );
      return child;
    });
  await launchAction(w, "one", "terminal");
  expect(spawn.mock.calls[1][1]).toEqual([
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.resolve("resources/windows/terminal.ps1"),
    "-Folder",
    os.tmpdir(),
  ]);
  expect(spawn.mock.calls[1][2]?.cwd).toBe(path.resolve(os.tmpdir()));
});
