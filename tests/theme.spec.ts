import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const light = "rgb(244, 246, 251)";
const dark = "rgb(13, 19, 32)";

test("new profiles follow Windows by default and System responds to live color-scheme changes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-theme-system-"));
  const app = await electron.launch({
    args: [".", "--data-dir", dir],
    colorScheme: null,
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(
      page.getByRole("combobox", { name: "Appearance", exact: true }),
    ).toHaveValue("system");
    const native = await app.evaluate(({ nativeTheme }) => ({
      source: nativeTheme.themeSource,
      dark: nativeTheme.shouldUseDarkColors,
    }));
    expect(native.source).toBe("system");
    await expect(page.locator("html")).toHaveCSS(
      "background-color",
      native.dark ? dark : light,
    );
    // Emulate OS media changes without altering the user's Windows settings.
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveCSS("background-color", light);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveCSS("background-color", dark);
    await expect(
      page.getByRole("combobox", { name: "Appearance", exact: true }),
    ).toHaveValue("system");
    expect(
      await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
    ).toBe("system");
  } finally {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("Light and Dark apply throughout the app, persist on restart and can return to System", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fit-theme-choice-"));
  const project = path.join(dir, "Widget Studio");
  await fs.mkdir(path.join(project, ".git"), { recursive: true });
  const workspace = {
    schemaVersion: 1,
    setupComplete: true,
    roots: [{ id: "projects", path: dir, depth: 2 }],
    launches: [{ id: "widget", label: "Widget Studio", absolutePath: project }],
  };
  await fs.writeFile(
    path.join(dir, "workspace.json"),
    JSON.stringify(workspace),
  );
  let app = await electron.launch({
    args: [".", "--data-dir", dir],
    colorScheme: null,
  });
  try {
    let page = await app.firstWindow();
    let appearance = page.getByRole("combobox", {
      name: "Appearance",
      exact: true,
    });
    await expect(appearance).toHaveValue("system");
    for (const theme of ["light", "dark"] as const) {
      await appearance.selectOption(theme);
      await expect(appearance).toBeEnabled();
      await expect(appearance).toHaveValue(theme);
      expect(
        await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
      ).toBe(theme);
      await expect(page.locator("html")).toHaveCSS(
        "background-color",
        theme === "light" ? light : dark,
      );
      await expect(page.locator(".repo-card")).toBeVisible();
      await page.screenshot({ path: `test-results/theme-${theme}-launch.png` });
      await page
        .getByRole("button", { name: "Settings", exact: false })
        .click();
      await expect(page.getByRole("dialog")).toHaveCSS(
        "background-color",
        theme === "light" ? "rgb(255, 255, 255)" : "rgb(24, 36, 56)",
      );
      await page.screenshot({
        path: `test-results/theme-${theme}-settings.png`,
      });
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page
        .getByRole("button", { name: "Discovered", exact: true })
        .click();
      await expect(page.getByText("Scanning…", { exact: true })).toHaveCount(0);
      await page.screenshot({
        path: `test-results/theme-${theme}-discovered.png`,
      });
      await page.getByRole("button", { name: "Ports", exact: true }).click();
      await expect(page.locator(".panel").first()).toBeVisible();
      await page.screenshot({ path: `test-results/theme-${theme}-ports.png` });
      await page.getByRole("button", { name: "Launch", exact: true }).click();
    }
    const saved = JSON.parse(
      await fs.readFile(path.join(dir, "workspace.json"), "utf8"),
    );
    expect(saved.theme).toBe("dark");
    expect(saved.launches).toMatchObject(workspace.launches);
    await app.close();
    app = await electron.launch({
      args: [".", "--data-dir", dir],
      colorScheme: null,
    });
    page = await app.firstWindow();
    appearance = page.getByRole("combobox", {
      name: "Appearance",
      exact: true,
    });
    await expect(appearance).toHaveValue("dark");
    await expect(page.locator("html")).toHaveCSS("background-color", dark);
    await appearance.selectOption("system");
    await expect(appearance).toBeEnabled();
    expect(
      await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
    ).toBe("system");
    expect(
      JSON.parse(await fs.readFile(path.join(dir, "workspace.json"), "utf8"))
        .theme,
    ).toBe("system");
    // A concurrent profile edit must not be overwritten by a theme change.
    const concurrent = JSON.parse(
      await fs.readFile(path.join(dir, "workspace.json"), "utf8"),
    );
    concurrent.editor = "C:\\Tools\\Other Editor.exe";
    await fs.writeFile(
      path.join(dir, "workspace.json"),
      JSON.stringify(concurrent),
    );
    await appearance.selectOption("light");
    await expect(page.getByRole("alert")).toContainText(
      "Could not save appearance",
    );
    await expect(appearance).toBeEnabled();
    await expect(appearance).toHaveValue("system");
    expect(
      await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
    ).toBe("system");
    expect(
      JSON.parse(await fs.readFile(path.join(dir, "workspace.json"), "utf8")),
    ).toEqual(concurrent);
  } finally {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
