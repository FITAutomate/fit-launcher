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
vi.mock("../src/main/windows", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/main/windows")>()),
  windowsHelper: vi.fn(),
}));
import { shell } from "electron";
import { launchAction } from "../src/main/launch-actions";
import { newWorkspace } from "../src/shared/schema";
import { windowsHelper } from "../src/main/windows";
afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(windowsHelper).mockReset();
});
test("all actions resolve the saved ID and keep literal folder data out of command text", async () => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "fit O'Brien é [x] & $(never)-"),
  );
  try {
    vi.mocked(windowsHelper).mockResolvedValue({ pid: 123 });
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
    expect(windowsHelper).toHaveBeenCalledWith(
      path.resolve("resources"),
      "open-terminal.ps1",
      [
        "-Folder",
        dir,
        "-Bootstrap",
        path.resolve("resources/windows/terminal.ps1"),
      ],
    );
    await expect(launchAction(w, "unknown", "editor")).rejects.toThrow(
      "not found",
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("Terminal requests a new interactive console with paths passed as data", async () => {
  const w = newWorkspace();
  w.launches = [
    { id: "one", label: "one", group: "demo", absolutePath: os.tmpdir() },
  ];
  const spawn = vi.mocked(childProcess.spawn).mockImplementation(() => {
    const child = new childProcess.ChildProcess();
    queueMicrotask(() => child.emit("spawn"));
    return child;
  });
  vi.mocked(windowsHelper).mockResolvedValue({ pid: 123 });
  await launchAction(w, "one", "terminal");
  expect(spawn).not.toHaveBeenCalled();
  expect(windowsHelper).toHaveBeenCalledExactlyOnceWith(
    path.resolve("resources"),
    "open-terminal.ps1",
    [
      "-Folder",
      os.tmpdir(),
      "-Bootstrap",
      path.resolve("resources/windows/terminal.ps1"),
    ],
  );
});
test("a shell launch error reaches the caller", async () => {
  const w = newWorkspace();
  w.launches = [
    { id: "one", label: "one", group: "demo", absolutePath: os.tmpdir() },
  ];
  vi.mocked(windowsHelper).mockRejectedValue(new Error("Shell unavailable"));
  await expect(launchAction(w, "one", "terminal")).rejects.toThrow(
    "Shell unavailable",
  );
});
