import React from "react";
import YAML from "yaml";
import { RegistrySchema, type Workspace, type Launch } from "../shared/schema";
import { Modal, type Common } from "./ui";
export default function Settings({
  state,
  save,
  refresh,
  notify,
  onClose,
  wizard = false,
}: Common & { onClose: () => void; wizard?: boolean }) {
  const [draft, setDraft] = React.useState<Workspace>(
    structuredClone(state.workspace),
  );
  const [registry, setRegistry] = React.useState(
    YAML.stringify(state.registry),
  );
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<Awaited<
    ReturnType<typeof window.launcher.importShortcuts>
  > | null>(null);
  const [transfer, setTransfer] = React.useState("");
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function addRoot() {
    const folder = await window.launcher.pick("folder");
    if (
      folder &&
      !draft.roots.some((r) => r.path.toLowerCase() === folder.toLowerCase())
    )
      setDraft({
        ...draft,
        roots: [
          ...draft.roots,
          { id: crypto.randomUUID(), path: folder, depth: 4 },
        ],
      });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await save({ ...draft, setupComplete: true });
      onClose();
    });
  }
  return (
    <Modal
      title={wizard ? "Welcome to FIT Launcher" : "Settings"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <p className="muted">
          {wizard
            ? "Choose where your projects live. You can change these settings anytime."
            : "App files and your personal workspace data stay separate."}
        </p>
        <h3>Directories to scan</h3>
        {draft.roots.map((root) => (
          <div className="root-row" key={root.id}>
            <input
              aria-label="Scan root"
              value={root.path}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  roots: draft.roots.map((r) =>
                    r.id === root.id ? { ...r, path: e.target.value } : r,
                  ),
                })
              }
            />
            <label>
              Depth
              <input
                type="number"
                min="1"
                max="12"
                value={root.depth}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    roots: draft.roots.map((r) =>
                      r.id === root.id
                        ? { ...r, depth: Number(e.target.value) }
                        : r,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  roots: draft.roots.filter((r) => r.id !== root.id),
                  launches: draft.launches.map((e) => {
                    if (e.rootId !== root.id) return e;
                    const { rootId, relativePath, ...rest } = e;
                    return {
                      ...rest,
                      absolutePath:
                        root.path.replace(/[\\/]$/, "") +
                        "\\" +
                        (relativePath || "."),
                    };
                  }),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addRoot}>
          Add directory
        </button>
        <details>
          <summary>Tools and registry connection</summary>
          <label>
            Editor executable <small>VS Code is detected when available</small>
            <div className="field-row">
              <input
                value={draft.editor}
                placeholder={state.editorDetected || "Choose an editor .exe"}
                onChange={(e) => setDraft({ ...draft, editor: e.target.value })}
              />
              <button
                type="button"
                onClick={() =>
                  window.launcher
                    .pick("editor")
                    .then((p) => p && setDraft({ ...draft, editor: p }))
                }
              >
                Browse…
              </button>
            </div>
          </label>
          <label>
            Connected registry <small>optional, read-only</small>
            <div className="field-row">
              <input
                value={draft.externalRegistry}
                onChange={(e) =>
                  setDraft({ ...draft, externalRegistry: e.target.value })
                }
                placeholder="Choose your own YAML registry"
              />
              <button
                type="button"
                onClick={() =>
                  window.launcher
                    .pick("registry")
                    .then(
                      (p) => p && setDraft({ ...draft, externalRegistry: p }),
                    )
                }
              >
                Connect…
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, externalRegistry: "" })}
              >
                Disconnect
              </button>
            </div>
          </label>
        </details>
        {!wizard && (
          <>
            <details>
              <summary>Local registry</summary>
              <p className="muted">
                Your editable expected ports and ranges. Connected files remain
                read-only.
              </p>
              <textarea
                aria-label="Local registry YAML"
                className="code-input"
                rows={12}
                value={registry}
                onChange={(e) => setRegistry(e.target.value)}
              />
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    await window.launcher.registry(
                      RegistrySchema.parse(YAML.parse(registry)),
                      state.revision,
                    );
                    await refresh();
                    notify("Local registry saved.");
                  })
                }
              >
                Save registry
              </button>
            </details>
            <details>
              <summary>Import PowerShell folder shortcuts</summary>
              <p className="muted">
                Parse literal folder functions. Command functions and the
                original file stay unchanged.
              </p>
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    const source = await window.launcher.pick("shortcuts");
                    if (source)
                      setPreview(await window.launcher.importShortcuts(source));
                  })
                }
              >
                Choose functions file…
              </button>
              {preview && (
                <>
                  <p>
                    {preview.rows.length} folder shortcuts ·{" "}
                    {preview.skipped.length} skipped commands
                  </p>
                  <div className="import-list">
                    {preview.rows.map((r) => (
                      <div key={r.shellName}>
                        <strong>{r.label}</strong>
                        <small>{r.path}</small>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const labels = new Set(
                        draft.launches.map((x) => x.shellName?.toLowerCase()),
                      );
                      const additions: Launch[] = preview.rows
                        .filter((x) => !labels.has(x.shellName.toLowerCase()))
                        .map((x) => ({
                          id: crypto.randomUUID(),
                          label: x.label,
                          shellName: /^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(
                            x.shellName,
                          )
                            ? x.shellName
                            : undefined,
                          group: x.group,
                          absolutePath: x.path,
                        }));
                      setDraft({
                        ...draft,
                        launches: [...draft.launches, ...additions],
                      });
                      setPreview(null);
                      notify(
                        `Added ${additions.length} shortcuts to the form. Save settings to apply.`,
                      );
                    }}
                  >
                    Use these shortcuts
                  </button>
                  <details>
                    <summary>Skipped commands</summary>
                    {preview.skipped.map((x) => (
                      <p key={x}>{x}</p>
                    ))}
                  </details>
                </>
              )}
            </details>
            <details>
              <summary>Portable profile import / export</summary>
              <p className="muted">
                Export includes your roots, shortcuts, layout and local
                registry. Keep personal exports private.
              </p>
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    if (await window.launcher.exportConfig())
                      notify("Profile exported.");
                  })
                }
              >
                Export profile…
              </button>
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    const value = await window.launcher.importConfig();
                    setTransfer(value?.summary || "");
                  })
                }
              >
                Preview import…
              </button>
              {transfer && (
                <div className="warning">
                  <p>{transfer}</p>
                  <button
                    type="button"
                    onClick={() =>
                      run(async () => {
                        if (!confirm(transfer)) return;
                        await window.launcher.applyImport();
                        await refresh();
                        onClose();
                      })
                    }
                  >
                    Confirm replacement
                  </button>
                </div>
              )}
            </details>
            <details>
              <summary>PowerShell integration</summary>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.shellIntegration}
                  onChange={(e) =>
                    setDraft({ ...draft, shellIntegration: e.target.checked })
                  }
                />
                Generate optional PowerShell shortcuts
              </label>
              <p className="muted">
                After saving, explicitly add this line to your own profile:
              </p>
              <code>
                . '{state.dataDir.replaceAll("'", "''")}
                \integrations\shortcuts.ps1'
              </code>
              <p className="muted">
                Existing command names are skipped. To update a loaded shortcut,
                remove its old function and reload. Your profile is never
                modified automatically.
              </p>
            </details>
            <details>
              <summary>Startup and storage</summary>
              <p data-testid="data-dir" className="path">
                {state.dataDir}
              </p>
              <p className="muted">
                Portable updates replace app, preserving its sibling data
                folder. Repoint scan roots here after moving projects.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={state.startup}
                  onChange={(e) =>
                    run(async () => {
                      await window.launcher.startup(e.target.checked);
                      await refresh();
                    })
                  }
                />
                Start with Windows
              </label>
              <p className="path">Startup target: {state.startupPath}</p>
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    await window.launcher.startup(true);
                    await refresh();
                  })
                }
              >
                Repair startup target
              </button>
            </details>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            {wizard ? "Skip for now" : "Cancel"}
          </button>
          <button className="primary" disabled={busy}>
            {wizard ? "Open my workspace" : "Save settings"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
