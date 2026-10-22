import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { windowsHelper } from "../src/main/windows";
async function listener(port = 0) {
  const child = spawn(
    process.execPath,
    [
      "-e",
      `const net=require('net');Promise.all([${port},0].map(port=>new Promise(resolve=>{const server=net.createServer();server.listen(port,'127.0.0.1',()=>resolve(server.address().port));}))).then(ports=>process.stdout.write(JSON.stringify(ports)));setInterval(()=>{},1000);`,
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  const actual = await new Promise<number[]>((resolve, reject) => {
    child.stdout!.once("data", (data) => resolve(JSON.parse(String(data))));
    child.once("error", reject);
    child.once("exit", (code) => reject(Error("Listener exited " + code)));
  });
  return { child, port: actual[0], extra: actual[1] };
}
async function end(child: ChildProcess) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  }
}
test("UI Stop reaches production helper; stale/reused owner and protected identities are refused", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-stop-"));
  const original = await listener();
  const app = await electron.launch({ args: [".", "--data-dir", dir] });
  let replacement: Awaited<ReturnType<typeof listener>> | undefined;
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Welcome to FIT Launcher" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.evaluate(async (port) => {
      const s = await window.launcher.state();
      await window.launcher.registry(
        { ...s.registry, ranges: { fixtures: { start: port, end: port } } },
        s.revision,
      );
    }, original.port);
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async (
        first:
          import("electron").BaseWindow | import("electron").MessageBoxOptions,
        second?: import("electron").MessageBoxOptions,
      ) => {
        Reflect.set(
          globalThis,
          "confirmationDetail",
          second?.detail ||
            ("detail" in first && typeof first.detail === "string"
              ? first.detail
              : ""),
        );
        return {
          response: 1,
          checkboxChecked: false,
        };
      };
    });
    await page.getByRole("button", { name: /Ports/ }).click();
    await page.getByLabel("Port number").fill(String(original.port));
    await page
      .getByRole("button", { name: "Inspect port", exact: true })
      .click();
    await expect(
      page.locator(".port-detail").getByRole("button", { name: "Stop…" }),
    ).toBeVisible();
    const observed = await page.evaluate(
      async (port) =>
        (await window.launcher.ports()).listeners.find((x) => x.port === port)!,
      original.port,
    );
    expect(observed.pid).toBe(original.child.pid);
    await expect(
      windowsHelper(path.resolve("resources"), "stop-port.ps1", [
        "-Port",
        String(observed.port),
        "-Address",
        observed.address,
        "-Owner",
        String(observed.pid),
        "-Created",
        observed.created,
        "-LauncherPid",
        String(observed.pid),
      ]),
    ).rejects.toThrow("Protected");
    expect(original.child.exitCode).toBeNull();
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({
        response: 0,
        checkboxChecked: false,
      });
    });
    expect(
      await page.evaluate((row) => window.launcher.stop(row), observed),
    ).toBe(false);
    expect(original.child.exitCode).toBeNull();
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async (
        first:
          import("electron").BaseWindow | import("electron").MessageBoxOptions,
        second?: import("electron").MessageBoxOptions,
      ) => {
        Reflect.set(
          globalThis,
          "confirmationDetail",
          second?.detail ||
            ("detail" in first && typeof first.detail === "string"
              ? first.detail
              : ""),
        );
        return { response: 1, checkboxChecked: false };
      };
    });
    await page
      .locator(".port-detail")
      .getByRole("button", { name: "Stop…" })
      .click();
    await expect.poll(() => original.child.exitCode).not.toBeNull();
    expect(
      await app.evaluate(() => Reflect.get(globalThis, "confirmationDetail")),
    ).toContain(String(original.extra));
    console.log(
      "Stopped disposable listener PID",
      original.child.pid,
      "port",
      original.port,
    );
    replacement = await listener(original.port);
    const refused = await page.evaluate(async (old) => {
      try {
        await window.launcher.stop(old);
        return "";
      } catch (e) {
        return String(e);
      }
    }, observed);
    expect(refused).toContain("Owner changed");
    expect(replacement.child.exitCode).toBeNull();
    const missing = await page.evaluate(async (old) => {
      try {
        await window.launcher.stop({ ...old, created: "" });
        return "";
      } catch (e) {
        return String(e);
      }
    }, observed);
    expect(missing).not.toBe("");
    const system = await page.evaluate(async () => {
      const s = await window.launcher.ports();
      return s.systems.find((x) => x.created) || null;
    });
    if (system) {
      const blocked = await page.evaluate(async (row) => {
        try {
          await window.launcher.stop(row);
          return "";
        } catch (e) {
          return String(e);
        }
      }, system);
      expect(blocked).toContain("not governed");
    }
    console.log("Reused port owner survived:", replacement.child.pid);
  } finally {
    await end(original.child);
    if (replacement) await end(replacement.child);
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("owner replacement during confirmation is refused by the production helper", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-confirm-"));
  const original = await listener();
  let replacement: Awaited<ReturnType<typeof listener>> | undefined;
  const app = await electron.launch({ args: [".", "--data-dir", dir] });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Welcome to FIT Launcher" }),
    ).toBeVisible();
    await page.evaluate(async (port) => {
      const state = await window.launcher.state();
      await window.launcher.registry(
        { ...state.registry, ranges: { fixture: { start: port, end: port } } },
        state.revision,
      );
    }, original.port);
    const observed = await page.evaluate(
      async (port) =>
        (await window.launcher.ports()).listeners.find((x) => x.port === port)!,
      original.port,
    );
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = () =>
        new Promise((resolve) => {
          Reflect.set(globalThis, "confirmPending", true);
          Reflect.set(globalThis, "finishConfirm", () =>
            resolve({ response: 1, checkboxChecked: false }),
          );
        });
    });
    const stopped = page.evaluate(async (row) => {
      try {
        await window.launcher.stop(row);
        return "";
      } catch (e) {
        return String(e);
      }
    }, observed);
    await expect
      .poll(() => app.evaluate(() => Reflect.get(globalThis, "confirmPending")))
      .toBe(true);
    await end(original.child);
    replacement = await listener(original.port);
    await app.evaluate(() => Reflect.get(globalThis, "finishConfirm")());
    expect(await stopped).toContain("Port owner changed");
    expect(replacement.child.exitCode).toBeNull();
    console.log("Confirmation race protected new PID", replacement.child.pid);
  } finally {
    await end(original.child);
    if (replacement) await end(replacement.child);
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("expired Stop confirmation leaves the fixture process alive", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-expired-"));
  const fixture = await listener();
  const app = await electron.launch({ args: [".", "--data-dir", dir] });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Welcome to FIT Launcher" }),
    ).toBeVisible();
    await page.evaluate(async (port) => {
      const state = await window.launcher.state();
      await window.launcher.registry(
        { ...state.registry, ranges: { fixture: { start: port, end: port } } },
        state.revision,
      );
    }, fixture.port);
    const row = await page.evaluate(
      async (port) =>
        (await window.launcher.ports()).listeners.find((x) => x.port === port)!,
      fixture.port,
    );
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => {
        await new Promise((resolve) => setTimeout(resolve, 16000));
        return { response: 1, checkboxChecked: false };
      };
    });
    const error = await page.evaluate(async (row) => {
      try {
        await window.launcher.stop(row);
        return "";
      } catch (e) {
        return String(e);
      }
    }, row);
    expect(error).toContain("Confirmation expired");
    expect(fixture.child.exitCode).toBeNull();
  } finally {
    await end(fixture.child);
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
