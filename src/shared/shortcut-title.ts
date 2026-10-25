import type { Launch } from "./schema";

export function folderTitle(target: string) {
  return (
    target
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || "Project"
  );
}

export function shortcutTitle(entry: Launch, target: string) {
  return entry.label !== entry.shellName || !target
    ? entry.label
    : folderTitle(target);
}
