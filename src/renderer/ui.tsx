import React from "react";
import type { AppState, Workspace, Launch, Discovery } from "../shared/schema";
import { folderTitle, shortcutTitle } from "../shared/shortcut-title";
export interface Common {
  state: AppState;
  save: (workspace: Workspace) => Promise<void>;
  refresh: (replaceLayout?: boolean) => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose}>
      <header className="modal-head">
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">⌘</div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Actions({
  entry,
  notify,
}: {
  entry: Launch;
  notify: Common["notify"];
}) {
  return (
    <div className="actions nodrag nopan">
      {(["explorer", "editor", "terminal", "github"] as const).map((action) => (
        <button
          key={action}
          onClick={() =>
            window.launcher
              .launch(entry.id, action)
              .then(() =>
                notify(
                  "Opened " +
                    {
                      explorer: "Explorer",
                      editor: "editor",
                      terminal: "terminal",
                      github: "GitHub",
                    }[action],
                ),
              )
              .catch((e) => notify(String(e), true))
          }
        >
          {
            {
              explorer: "Explorer",
              editor: "Editor",
              terminal: "Terminal",
              github: "GitHub",
            }[action]
          }
        </button>
      ))}
    </div>
  );
}
export function ShortcutEditor({
  state,
  save,
  entry,
  discovery,
  onClose,
}: {
  state: AppState;
  save: Common["save"];
  entry?: Launch;
  discovery?: Discovery;
  onClose: () => void;
}) {
  const [label, setLabel] = React.useState(
    entry
      ? shortcutTitle(entry, state.resolved[entry.id]?.path || "")
      : discovery?.name || "",
  );
  const [folder, setFolder] = React.useState(
    entry ? state.resolved[entry.id]?.path || "" : discovery?.path || "",
  );
  const [group, setGroup] = React.useState(entry?.group || "My projects");
  const [alias, setAlias] = React.useState(entry?.shellName || "");
  const [github, setGithub] = React.useState(
    entry?.githubUrl || discovery?.githubUrl || "",
  );
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const root = state.workspace.roots.find(
        (r) =>
          folder.toLowerCase() === r.path.toLowerCase() ||
          folder
            .toLowerCase()
            .startsWith(r.path.replace(/[\\/]$/, "").toLowerCase() + "\\"),
      );
      const item: Launch = {
        id: entry?.id || crypto.randomUUID(),
        label: label.trim(),
        group: group.trim() || "My projects",
        ...(root
          ? {
              rootId: root.id,
              relativePath:
                folder
                  .slice(root.path.replace(/[\\/]$/, "").length)
                  .replace(/^[\\/]/, "") || ".",
            }
          : { absolutePath: folder }),
        ...(alias ? { shellName: alias } : {}),
        ...(github ? { githubUrl: github } : {}),
      };
      await save({
        ...state.workspace,
        launches: entry
          ? state.workspace.launches.map((x) => (x.id === entry.id ? item : x))
          : [...state.workspace.launches, item],
      });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={entry ? "Edit shortcut" : "Add shortcut"} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Name
          <input
            autoFocus
            value={label}
            required
            maxLength={100}
            placeholder="Project name or purpose"
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label>
          Folder
          <div className="field-row">
            <input
              aria-label="Folder"
              value={folder}
              required
              onChange={(e) => setFolder(e.target.value)}
              onBlur={() => {
                if (!label.trim() && folder.trim())
                  setLabel(folderTitle(folder.trim()));
              }}
            />
            <button
              type="button"
              onClick={() =>
                window.launcher.pick("folder").then((p) => {
                  if (p) {
                    setFolder(p);
                    if (!label.trim()) setLabel(folderTitle(p));
                  }
                })
              }
            >
              Browse…
            </button>
          </div>
        </label>
        <label>
          Group
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            list="groups"
          />
        </label>
        <datalist id="groups">
          {[...new Set(state.workspace.launches.map((x) => x.group))].map(
            (g) => (
              <option key={g}>{g}</option>
            ),
          )}
        </datalist>
        <label>
          GitHub repository URL{" "}
          <small>optional; otherwise read from the remote</small>
          <input
            value={github}
            onChange={(e) => setGithub(e.target.value)}
            placeholder="https://github.com/owner/repository"
          />
        </label>
        <label>
          PowerShell shortcut name <small>optional</small>
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="my-project"
          />
        </label>
        <p className="muted">
          {state.workspace.shellIntegration
            ? "New shells must load the generated shortcuts file from your PowerShell profile. Setup is in Settings → PowerShell integration."
            : "Jump commands are off. Enable PowerShell integration in Settings and add its setup line to your PowerShell profile. Card buttons work without it."}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Save shortcut
          </button>
        </div>
      </form>
    </Modal>
  );
}
