import { expect, test } from "vitest";
import { folderTitle, shortcutTitle } from "../src/shared/shortcut-title";

test("imported alias titles fall back to the folder while descriptive names remain", () => {
  const entry = {
    id: "sample",
    label: "jump",
    shellName: "jump",
    group: "Examples",
    absolutePath: "C:\\Projects\\Actual Repo",
  };
  expect(shortcutTitle(entry, entry.absolutePath)).toBe("Actual Repo");
  expect(
    shortcutTitle({ ...entry, label: "Workshop demo" }, entry.absolutePath),
  ).toBe("Workshop demo");
  expect(shortcutTitle(entry, "")).toBe("jump");
  expect(
    shortcutTitle({ ...entry, shellName: undefined }, entry.absolutePath),
  ).toBe("jump");
  expect(folderTitle("C:\\Projects\\Actual Repo\\")).toBe("Actual Repo");
});
