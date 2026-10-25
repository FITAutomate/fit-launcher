import React from "react";
import type { Discovery } from "../shared/schema";
import { Empty, type Common } from "./ui";
export default function Discovered({
  state,
  notify,
  add,
  query,
}: Common & { add: (item: Discovery) => void; query: string }) {
  const [items, setItems] = React.useState<Discovery[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [repos, setRepos] = React.useState(true);
  const [scanned, setScanned] = React.useState(false);
  async function scan() {
    setBusy(true);
    try {
      setItems(await window.launcher.scan());
      setScanned(true);
    } catch (e) {
      notify(String(e), true);
    } finally {
      setBusy(false);
    }
  }
  React.useEffect(() => {
    if (state.workspace.roots.length) void scan();
    return () => {
      void window.launcher.cancelScan();
    };
  }, [state.workspace.roots]);
  const shown = items.filter(
    (x) =>
      (!repos || x.isRepo) &&
      (x.name + " " + x.path + " " + x.hint)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="section-toolbar">
        <div>
          <h2>Find your next shortcut</h2>
          <p>
            Scans stop at each Git repository root. Uncheck Git repos only to
            include other project folders.
          </p>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={repos}
            onChange={(e) => setRepos(e.target.checked)}
          />
          Git repos only
        </label>
        <button disabled={busy || !state.workspace.roots.length} onClick={scan}>
          {busy ? "Scanning…" : "Rescan"}
        </button>
        {busy && (
          <button onClick={() => window.launcher.cancelScan()}>Cancel</button>
        )}
      </div>
      {!state.workspace.roots.length ? (
        <Empty title="Choose directories to scan">
          <p>Add a scan root in Settings to discover projects.</p>
        </Empty>
      ) : scanned && !shown.length ? (
        <Empty title="Everything is caught up">
          <p>No undiscovered projects match this filter.</p>
        </Empty>
      ) : (
        state.workspace.roots.map((root) => (
          <section className="group-section" key={root.id}>
            <h3>
              {root.path}
              <span className="badge">
                {shown.filter((x) => x.rootId === root.id).length}
              </span>
            </h3>
            <div className="card-grid">
              {shown
                .filter((x) => x.rootId === root.id)
                .map((item) => (
                  <article className="discovery-card" key={item.path}>
                    <div className="row">
                      <strong>{item.name}</strong>
                      {item.isRepo && <span className="badge green">Git</span>}
                    </div>
                    <p className="path">{item.path}</p>
                    <p className="muted">{item.hint || "Git repository"}</p>
                    <button className="primary" onClick={() => add(item)}>
                      Add shortcut
                    </button>
                  </article>
                ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
