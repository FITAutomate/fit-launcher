import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("feedback UI uses the validated main bridge, preserves failed input and opens a reviewable GitHub issue", async () => {
  const { version } = JSON.parse(await fs.readFile("package.json", "utf8"));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-feedback-"));
  const app = await electron.launch({ args: [".", "--data-dir", dir] });
  try {
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await app.evaluate(({ shell }) => {
      Reflect.set(globalThis, "feedbackUrls", []);
      shell.openExternal = async (url) => {
        Reflect.get(globalThis, "feedbackUrls").push(url);
      };
    });
    await page.getByRole("button", { name: "Ports", exact: true }).click();
    await page
      .getByRole("button", { name: "Send feedback", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    await expect(
      modal.getByRole("heading", { name: "Send feedback" }),
    ).toBeVisible();
    await expect(modal.getByLabel("Where were you?")).toHaveValue("Ports");
    await modal.getByLabel("Type", { exact: true }).selectOption("Idea");
    await modal.getByLabel("Impact", { exact: true }).selectOption("minor");
    await modal.getByLabel("What happened?").fill("界".repeat(6000));
    await modal.getByRole("button", { name: "Open GitHub issue →" }).click();
    await expect(modal.getByRole("alert")).toContainText(
      "too long for a GitHub link",
    );
    await expect(modal.getByLabel("What happened?")).toHaveValue(
      "界".repeat(6000),
    );
    expect(
      await app.evaluate(() => Reflect.get(globalThis, "feedbackUrls")),
    ).toEqual([]);
    const details =
      "Keep the selected port after refresh & show its timestamp.";
    await modal.getByLabel("What happened?").fill(details);
    await page.screenshot({ path: "test-results/feedback.png" });
    await modal.getByRole("button", { name: "Open GitHub issue →" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const opened = await app.evaluate(() =>
      Reflect.get(globalThis, "feedbackUrls"),
    );
    expect(opened).toHaveLength(1);
    const url = new URL(opened[0]);
    expect(url.origin + url.pathname).toBe(
      "https://github.com/FITAutomate/fit-launcher/issues/new",
    );
    expect(url.searchParams.get("title")).toBe("[Idea] " + details);
    expect(url.searchParams.get("body")).toContain("**Where were you:** Ports");
    expect(url.searchParams.get("body")).toContain("**Impact:** minor");
    expect(url.searchParams.get("body")).toContain(`FIT Launcher: ${version}`);
    expect(url.searchParams.get("body")).not.toContain(dir);
    expect(url.searchParams.get("body")).not.toContain("workspace.json");
    await page
      .getByRole("button", { name: "Send feedback", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    expect(
      await app.evaluate(() => Reflect.get(globalThis, "feedbackUrls")),
    ).toHaveLength(1);
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
    ).toBe(true);
  } finally {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
