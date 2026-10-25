import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("project title and jump command are separate; discovery stops inside repositories", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fit-project-cards-"));
  const repo = path.join(temp, "Projects", "Actual Repo");
  const plain = path.join(temp, "Projects", "Other Project");
  await fs.mkdir(path.join(repo, ".git"), { recursive: true });
  await fs.mkdir(path.join(repo, "app"));
  await fs.writeFile(path.join(repo, "app", "package.json"), "{}");
  await fs.mkdir(plain);
  await fs.writeFile(path.join(plain, "pyproject.toml"), "");
  const data = path.join(temp, "data");
  await fs.mkdir(data);
  await fs.writeFile(
    path.join(data, "workspace.json"),
    JSON.stringify({
      schemaVersion: 1,
      setupComplete: true,
      roots: [{ id: "projects", path: path.dirname(repo), depth: 4 }],
      launches: [
        { id: "sample", label: "go", shellName: "go", absolutePath: repo },
      ],
    }),
  );
  const app = await electron.launch({ args: [".", "--data-dir", data] });
  try {
    const page = await app.firstWindow();
    const card = page.locator(".repo-card");
    await expect(card.locator("strong")).toHaveText("Actual Repo");
    await expect(card.locator(".jump-command")).toHaveText("go");
    expect(
      await card
        .locator(".jump-command")
        .evaluate((node) =>
          node.nextElementSibling?.classList.contains("status-dot"),
        ),
    ).toBe(true);
    await card.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Actual Repo",
    );
    await expect(page.getByText(/Jump commands are off/)).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill("Workshop purpose");
    await page
      .getByRole("button", { name: "Save shortcut", exact: true })
      .click();
    await expect(card.locator("strong")).toHaveText("Workshop purpose");
    await expect(card.locator(".jump-command")).toHaveText("go");
    await page.getByLabel("Search", { exact: true }).fill("go");
    await expect(card).toHaveCount(1);
    await page.getByLabel("Search", { exact: true }).fill("");
    await page.getByRole("button", { name: "Discovered", exact: true }).click();
    await expect(page.getByLabel("Git repos only")).toBeChecked();
    await expect(page.getByText("Scanning…", { exact: true })).toHaveCount(0);
    await page.getByLabel("Git repos only").uncheck();
    await expect(page.locator(".discovery-card strong")).toHaveText([
      "Other Project",
    ]);
    await page
      .getByRole("button", { name: "+ Add shortcut", exact: true })
      .click();
    await page.getByLabel("Folder", { exact: true }).fill(plain);
    await page.getByLabel("Group", { exact: true }).focus();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Other Project",
    );
  } finally {
    await app.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
});
