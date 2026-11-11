import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

const base = 47210;
async function listener(port: number) {
  const child = spawn(
    process.execPath,
    [
      "-e",
      `require('net').createServer().listen(${port},'127.0.0.1',()=>process.stdout.write('ready'));setInterval(()=>{},1000);`,
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise<void>((resolve, reject) => {
    child.stdout!.once("data", () => resolve());
    child.once("error", reject);
    child.once("exit", (code) => reject(Error("Listener exited " + code)));
  });
  return child;
}
async function end(child: ChildProcess) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  }
}

test("a range strip shows each port's state with header counts", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-cells-")),
    folder = path.join(dir, "fixture-app");
  await fs.mkdir(folder);
  const children: ChildProcess[] = [];
  const app = await electron.launch({
    args: [".", "--data-dir", path.join(dir, "data")],
  });
  try {
    children.push(await listener(base), await listener(base + 4));
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.evaluate(
      async ({ base, folder, missing }) => {
        const row = (
          repo: string,
          default_port: number,
          path: string,
          status = "active",
        ) => ({
          repo,
          path,
          framework: "",
          default_port,
          status,
          source: "",
          note: "",
        });
        const s = await window.launcher.state();
        await window.launcher.registry(
          {
            ...s.registry,
            ranges: { fixture: { start: base, end: base + 9 } },
            assignments: [
              row("fixture-listening", base, folder),
              row("fixture-down", base + 1, folder),
              row("fixture-reserved", base + 2, "", "reserved"),
              row("fixture-dead", base + 3, missing),
              row("fixture-outside", base + 20, ""),
            ],
          },
          s.revision,
        );
      },
      { base, folder, missing: path.join(dir, "missing-app") },
    );
    await page.getByRole("button", { name: "Ports", exact: true }).click();
    const legend = page.getByRole("list", { name: "Port states" });
    for (const label of [
      "Dead path",
      "Wrong process",
      "Listening",
      "Reserved, down",
      "Assigned, down",
      "In use, unregistered",
      "Windows service",
      "Free",
    ])
      await expect(legend.getByText(label, { exact: true })).toBeVisible();
    const range = page.locator(".range", {
      has: page.getByRole("heading", { name: "Local registry / fixture" }),
    });
    await expect(range.locator(".range-counts")).toHaveText(
      "4 known · 1 live · 5 free",
      { timeout: 30000 },
    );
    const cell = (port: number) =>
      range.getByRole("button", { name: new RegExp(`^Port ${port} · `) });
    await expect(cell(base)).toHaveClass("listening");
    await expect(cell(base)).toHaveAccessibleName(
      new RegExp(
        `^Port ${base} · fixture-listening · Listening · .* PID ${children[0].pid}$`,
      ),
    );
    await expect(cell(base + 1)).toHaveClass("assigned-down");
    await expect(cell(base + 2)).toHaveClass("reserved-down");
    await expect(cell(base + 3)).toHaveAccessibleName(
      `Port ${base + 3} · fixture-dead · Dead path`,
    );
    await expect(cell(base + 4)).toHaveAccessibleName(
      `Port ${base + 4} · Unassigned · In use, unregistered`,
    );
    for (let port = base + 5; port <= base + 9; port++)
      await expect(cell(port)).toHaveClass("free");
    const outside = page.locator(".range", {
      has: page.getByRole("heading", { name: "Outside declared ranges" }),
    });
    await expect(outside.getByRole("button")).toHaveText([
      new RegExp(`${base + 20}$`),
    ]);
    await expect(outside.getByRole("button")).toHaveClass("assigned-down");
    await cell(base).click();
    await expect(
      page.getByRole("heading", { name: `Port ${base}`, exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/port-cells.png" });
  } finally {
    for (const child of children) await end(child);
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
