import path from "node:path";
export function dataLocation(
  executable: string,
  args: string[],
  packaged: boolean,
) {
  const i = args.indexOf("--data-dir");
  const inline = args.find((a) => a.startsWith("--data-dir="));
  const override = inline?.slice(11) || (i >= 0 ? args[i + 1] : undefined);
  return path.resolve(
    override ||
      (packaged
        ? path.join(path.dirname(executable), "..", "data")
        : path.join(process.cwd(), ".local-data")),
  );
}
export function resolveLaunch(
  workspace: import("../shared/schema").Workspace,
  entry: import("../shared/schema").Launch,
) {
  if (entry.rootId) {
    const root = workspace.roots.find((r) => r.id === entry.rootId);
    if (!root) throw Error("The scan root is missing. Repair this shortcut.");
    const target = path.resolve(root.path, entry.relativePath || ".");
    const relative = path.relative(path.resolve(root.path), target);
    if (
      relative.startsWith(".." + path.sep) ||
      relative === ".." ||
      path.isAbsolute(relative)
    )
      throw Error("Folder escapes its scan root.");
    return target;
  }
  if (!entry.absolutePath || !path.isAbsolute(entry.absolutePath))
    throw Error("Choose an absolute folder.");
  return path.resolve(entry.absolutePath);
}
