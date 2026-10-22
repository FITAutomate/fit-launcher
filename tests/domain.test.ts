import { test, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { discover, gitRemote, githubUrl } from "../src/main/discovery";
import { dataLocation, resolveLaunch } from "../src/main/paths";
import { reconcile, portModel, governed } from "../src/main/ports";
import {
  newWorkspace,
  newRegistry,
  newLayout,
  type Listener,
} from "../src/shared/schema";
import { validateTransfer, validateWorkspace } from "../src/main/profile";
import { Store } from "../src/main/store";
import { windowsHelper, powershell } from "../src/main/windows";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const temporary = async (fn: (dir: string) => Promise<void>) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-contract-"));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};
const owner = (port: number, extra: Partial<Listener> = {}): Listener => ({
  port,
  address: "127.0.0.1",
  pid: 100,
  name: "node",
  command: "",
  created: "2026-10-22T01:00:00Z",
  service: "",
  protected: false,
  ...extra,
});
const assignment = (repo: string, port: number, folder = "") => ({
  repo,
  default_port: port,
  path: folder,
  framework: "test",
  status: "reserved",
  source: "fixture",
  note: "",
});
test("portable location follows executable, override and working-directory independence", () => {
  expect(dataLocation("C:\\Portable\\app\\FIT Launcher.exe", [], true)).toBe(
    "C:\\Portable\\data",
  );
  expect(
    dataLocation("C:\\app.exe", ["--data-dir", "C:\\Profiles\\one"], true),
  ).toBe("C:\\Profiles\\one");
});
test("roots can be remapped while IDs survive and traversal is refused", () => {
  const w = newWorkspace();
  w.roots = [{ id: "root", path: "C:\\Projects", depth: 4 }];
  const e = {
    id: "card",
    label: "repo",
    group: "demo",
    rootId: "root",
    relativePath: "nested\\repo",
  };
  expect(resolveLaunch(w, e)).toBe("C:\\Projects\\nested\\repo");
  w.roots[0].path = "E:\\Projects";
  expect(resolveLaunch(w, e)).toBe("E:\\Projects\\nested\\repo");
  expect(() => resolveLaunch(w, { ...e, relativePath: "..\\outside" })).toThrow(
    "escapes",
  );
  expect(() => resolveLaunch(w, { ...e, relativePath: "E:\\outside" })).toThrow(
    "escapes",
  );
});
test("GitHub links strip credentials and refuse non-repository schemes and paths", () => {
  for (const input of [
    "git@github.com:example/demo.git",
    "ssh://git@github.com/example/demo.git",
    "https://token@github.com/example/demo.git?token=private",
  ])
    expect(githubUrl(input)).toBe("https://github.com/example/demo");
  for (const input of [
    "file:///C:/secret",
    "javascript:alert(1)",
    "https://example.com/demo/repo",
    "https://github.com/a/b/issues",
  ])
    expect(githubUrl(input)).toBe("");
});
test("bounded recursive discovery handles worktrees, overlap and a junction loop without executing manifests", () =>
  temporary(async (dir) => {
    const repo = path.join(dir, "nested", "repo"),
      worktree = path.join(dir, "worktree"),
      hint = path.join(dir, "plain"),
      ignored = path.join(dir, "node_modules", "fake");
    for (const folder of [
      path.join(repo, ".git"),
      worktree,
      hint,
      path.join(ignored, ".git"),
    ])
      await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(
      path.join(repo, ".git", "config"),
      '[remote "origin"]\n url = git@github.com:example/demo.git\n',
    );
    const common = path.join(repo, ".git", "worktrees", "demo");
    await fs.mkdir(common, { recursive: true });
    await fs.writeFile(path.join(common, "commondir"), "../..");
    await fs.writeFile(path.join(worktree, ".git"), "gitdir: " + common);
    await fs.writeFile(
      path.join(hint, "package.json"),
      '{"scripts":{"postinstall":"must never execute"}}',
    );
    await fs.symlink(dir, path.join(hint, "loop"), "junction");
    const w = newWorkspace();
    w.roots = [
      { id: "one", path: dir, depth: 4 },
      { id: "overlap", path: repo, depth: 4 },
    ];
    const found = await discover(w, new AbortController().signal);
    expect(found.map((x) => x.path).sort()).toEqual(
      [repo, worktree, hint].sort(),
    );
    expect(await gitRemote(worktree)).toBe("https://github.com/example/demo");
    expect(found.find((x) => x.path === hint)?.isRepo).toBe(false);
    w.launches = [
      { id: "mapped", label: "repo", group: "demo", absolutePath: repo },
    ];
    expect(
      (await discover(w, new AbortController().signal)).some(
        (x) => x.path === repo,
      ),
    ).toBe(false);
    const abort = new AbortController();
    abort.abort();
    await expect(discover(w, abort.signal)).rejects.toThrow("canceled");
  }));
test("empty or missing roots return no discoveries", async () => {
  const w = newWorkspace();
  w.roots = [{ id: "gone", path: "Z:\\missing-fixture", depth: 1 }];
  expect(await discover(w, new AbortController().signal)).toEqual([]);
});
test("ports keep unknowns neutral, system services protected and range drift actionable", () => {
  const registry = newRegistry();
  registry.ranges = { apps: { start: 5100, end: 5110 } };
  const rows = [
    owner(5040, { protected: true, name: "svchost", service: "CDPSvc" }),
    owner(5101),
    owner(6000),
  ];
  const model = reconcile(
    rows,
    [{ registry, origin: "Local", readOnly: false }],
    999,
  );
  expect(model.systems.map((x) => x.port)).toEqual([5040]);
  expect(model.drift.map((x) => x.port)).toEqual([5101]);
  expect(model.observed.map((x) => x.port)).toEqual([6000]);
  expect(governed(rows[0], model, 999)).toBe(false);
  expect(governed(rows[1], model, 999)).toBe(true);
  expect(governed(rows[2], model, 999)).toBe(false);
  expect(governed({ ...rows[1], created: "" }, model, 999)).toBe(false);
});
test("reconciliation preserves status, all owners, conflicts, longest folder match and live-first order", () => {
  const registry = newRegistry();
  registry.assignments = [
    assignment("parent", 5100, "C:/apps/demo"),
    assignment("child", 5101, "C:/apps/demo/child"),
    assignment("down", 5102),
  ];
  const rows = [
    owner(5100, { command: "node C:/apps/demo/child/server.js" }),
    owner(5100, { address: "::1", pid: 101, command: "" }),
    owner(5101, { command: "node C:/apps/demo/child/server.js" }),
  ];
  const other = newRegistry();
  other.assignments = [assignment("conflict", 5100)];
  const model = reconcile(
    rows,
    [
      { registry, origin: "Local", readOnly: false },
      { registry: other, origin: "External", readOnly: true },
    ],
    999,
  );
  expect(model.assignments[0].listening).toBe(true);
  expect(model.assignments.at(-1)?.repo).toBe("down");
  const parent = model.assignments.find((x) => x.repo === "parent")!;
  expect(parent.status).toBe("reserved");
  expect(parent.owners).toHaveLength(2);
  expect(parent.conflict).toBe(true);
  expect(parent.verified).toBe("mismatch");
  expect(parent.actualRepo).toBe("child");
  expect(model.assignments.find((x) => x.repo === "child")?.verified).toBe(
    "match",
  );
  expect(model.assignments.find((x) => x.repo === "conflict")?.readOnly).toBe(
    true,
  );
});
test("a path prefix or unknown command never claims verified app identity", () => {
  const registry = newRegistry();
  registry.assignments = [assignment("demo", 5100, "C:/apps/demo")];
  const model = reconcile(
    [owner(5100, { command: "node C:/apps/demo-other/server.js" })],
    [{ registry, origin: "Local", readOnly: false }],
    999,
  );
  expect(model.assignments[0].verified).toBe("unknown");
});
test("missing or malformed connected registry keeps live/local facts and does not change its bytes", () =>
  temporary(async (dir) => {
    const file = path.join(dir, "registry.yaml");
    await fs.writeFile(file, "assignments: [broken");
    const before = await fs.readFile(file);
    const registry = newRegistry();
    registry.assignments = [assignment("local", 5100)];
    const result = await portModel([owner(5100)], registry, file, 999);
    expect(result.assignments).toHaveLength(1);
    expect(result.listeners).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(await fs.readFile(file)).toEqual(before);
  }));
test("profile validation rejects duplicate aliases, IDs, ports, references and versions", () => {
  const workspace = newWorkspace();
  workspace.launches = [
    {
      id: "one",
      label: "one",
      group: "demo",
      absolutePath: "C:\\Projects",
      shellName: "demo",
    },
    {
      id: "two",
      label: "two",
      group: "demo",
      absolutePath: "C:\\Other",
      shellName: "DEMO",
    },
  ];
  expect(() => validateWorkspace(workspace)).toThrow("unique");
  workspace.launches[1].shellName = "other";
  workspace.launches[1].id = "one";
  expect(() => validateWorkspace(workspace)).toThrow("IDs");
  const transfer = {
    schemaVersion: 1,
    workspace: newWorkspace(),
    layout: { ...newLayout(), positions: { missing: { x: 1, y: 1 } } },
    registry: newRegistry(),
  };
  expect(() => validateTransfer(transfer)).toThrow("missing");
  expect(() => validateTransfer({ ...transfer, schemaVersion: 99 })).toThrow();
});
test("transfer preserves layout, backs up prior state, disables integrations and supports root remapping", () =>
  temporary(async (dir) => {
    const store = new Store(dir);
    await store.init();
    const input = {
      schemaVersion: 1,
      workspace: {
        ...newWorkspace(),
        roots: [{ id: "root", path: dir, depth: 4 }],
        launches: [
          {
            id: "entry",
            label: "entry",
            group: "test",
            rootId: "root",
            relativePath: ".",
          },
        ],
        shellIntegration: true,
        externalRegistry: "C:\\private.yaml",
      },
      layout: { ...newLayout(), positions: { entry: { x: 120, y: 240 } } },
      registry: newRegistry(),
    };
    await store.replace(input);
    expect(store.workspace.externalRegistry).toBe("");
    expect(store.workspace.shellIntegration).toBe(false);
    expect(store.layout.positions.entry).toEqual({ x: 120, y: 240 });
    expect(
      (await fs.readdir(path.join(dir, "backups"))).length,
    ).toBeGreaterThanOrEqual(3);
    const next = {
      ...store.workspace,
      roots: [{ id: "root", path: path.join(dir, "moved"), depth: 4 }],
    };
    await store.save(next, await store.revision());
    expect(resolveLaunch(store.workspace, store.workspace.launches[0])).toBe(
      path.join(dir, "moved"),
    );
    expect(store.layout.positions.entry.x).toBe(120);
  }));
test("malformed originals survive initialization and external valid edits can reload", () =>
  temporary(async (dir) => {
    await fs.writeFile(path.join(dir, "workspace.json"), "not-json");
    const store = new Store(dir);
    await store.init();
    expect(store.warnings.length).toBe(1);
    expect(await fs.readFile(path.join(dir, "workspace.json"), "utf8")).toBe(
      "not-json",
    );
    const next = { ...newWorkspace(), setupComplete: true };
    await fs.writeFile(path.join(dir, "workspace.json"), JSON.stringify(next));
    await store.saveLayout(newLayout());
    await store.refresh();
    expect(store.workspace.setupComplete).toBe(true);
    expect(store.warnings).toEqual([]);
  }));
test(
  "legacy import reaches the Windows AST parser and never executes hostile source",
  () =>
    temporary(async (dir) => {
      const source = path.join(dir, "functions.ps1"),
        sentinel = path.join(dir, "must-not-exist");
      await fs.writeFile(
        source,
        `New-Item -ItemType File -Path '${sentinel}'\n# --- Demo ---\nfunction literal { Set-Location -LiteralPath '${dir.replaceAll("'", "''")}' }\nfunction unsafe { Set-Location "$env:HOME" }\nfunction wrapper { Write-Host 'hello' }\nfunction trapped { trap { exit }; Set-Location 'C:\\wrong' }\n`,
      );
      const before = await fs.readFile(source);
      const result = await windowsHelper<{
        rows: { group: string }[];
        skipped: string[];
      }>(path.resolve("resources"), "import-shortcuts.ps1", ["-Path", source]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].group).toBe("Demo");
      expect(result.skipped).toHaveLength(3);
      expect(
        await fs.access(sentinel).then(
          () => true,
          () => false,
        ),
      ).toBe(false);
      expect(await fs.readFile(source)).toEqual(before);
    }),
  15000,
);
test(
  "optional shell export navigates literal hostile-looking paths and preserves existing commands",
  () =>
    temporary(async (dir) => {
      const folder = path.join(dir, "O'Brien é [x] & $(never)");
      await fs.mkdir(folder);
      const store = new Store(path.join(dir, "data"));
      await store.init();
      const w = {
        ...store.workspace,
        shellIntegration: true,
        launches: [
          {
            id: "one",
            label: "one",
            group: "demo",
            absolutePath: folder,
            shellName: "fixturejump",
          },
          {
            id: "two",
            label: "two",
            group: "demo",
            absolutePath: folder,
            shellName: "Get-Item",
          },
        ],
      };
      await store.save(w, await store.revision());
      const file = path.join(store.dir, "integrations", "shortcuts.ps1"),
        bytes = await fs.readFile(file);
      expect(bytes.subarray(0, 3)).toEqual(Buffer.from([239, 187, 191]));
      const script = path.join(dir, "check.ps1");
      await fs.writeFile(
        script,
        `[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)\n. '${file.replaceAll("'", "''")}'\nfixturejump\n(Get-Location).Path\n(Get-Command Get-Item).CommandType.ToString()\n`,
        "utf8",
      );
      const result = await promisify(execFile)(powershell(), [
        "-NoProfile",
        "-NonInteractive",
        "-File",
        script,
      ]);
      expect(result.stdout).toContain(await fs.realpath(folder));
      expect(result.stdout).toContain("Cmdlet");
    }),
  15000,
);
