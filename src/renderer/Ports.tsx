import React from "react";
import type {
  Assignment,
  Listener,
  PortAssignment,
  PortSnapshot,
} from "../shared/schema";
import { Modal, type Common } from "./ui";

export default function Ports({
  state,
  refresh,
  notify,
  query,
}: Common & { query: string }) {
  const [snapshot, setSnapshot] = React.useState<PortSnapshot | null>(null),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [lookup, setLookup] = React.useState(""),
    [selected, setSelected] = React.useState<number | null>(null),
    [editing, setEditing] = React.useState<Assignment | undefined>(),
    [adding, setAdding] = React.useState(false);
  const mounted = React.useRef(true),
    running = React.useRef(false);
  const load = React.useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const data = await window.launcher.ports();
      if (mounted.current) {
        setSnapshot(data);
        setError("");
      }
    } catch (e) {
      if (mounted.current) setError(String(e));
    } finally {
      running.current = false;
    }
  }, []);
  React.useEffect(() => {
    mounted.current = true;
    void load();
    const timer = setInterval(() => void load(), 6000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load, state.registry, state.workspace.externalRegistry]);
  async function stop(owner: Listener) {
    setBusy(true);
    try {
      const stopped = await window.launcher.stop(owner);
      notify(stopped ? "Process stopped." : "Stop canceled.");
      await load();
    } catch (e) {
      notify(String(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: PortAssignment) {
    if (!confirm(`Remove the local assignment for ${row.repo}?`)) return;
    try {
      await window.launcher.registry(
        {
          ...state.registry,
          assignments: state.registry.assignments.filter(
            (x) => x.default_port !== row.default_port,
          ),
        },
        state.revision,
      );
      await refresh();
      await load();
    } catch (e) {
      notify(String(e), true);
    }
  }
  const matches = (text: string) =>
    !query || text.toLowerCase().includes(query.toLowerCase());
  const canStop = (owner: Listener) =>
    !!snapshot &&
    !owner.protected &&
    !!owner.created &&
    (snapshot.assignments.some((x) => x.default_port === owner.port) ||
      Object.values(snapshot.ranges).some(
        (x) => owner.port >= x.start && owner.port <= x.end,
      ));
  const ownerRow = (owner: Listener) => (
    <div className="owner" key={`${owner.port}/${owner.address}/${owner.pid}`}>
      <div>
        <strong>
          {owner.name || "Unknown process"}{" "}
          <span className="muted">PID {owner.pid}</span>
        </strong>
        <small>
          {owner.address}:{owner.port}
          {owner.service ? " · " + owner.service : ""}
        </small>
      </div>
      <button
        onClick={() => {
          setSelected(owner.port);
          setLookup(String(owner.port));
        }}
      >
        Inspect
      </button>
      {canStop(owner) && (
        <button className="danger" disabled={busy} onClick={() => stop(owner)}>
          Stop…
        </button>
      )}
    </div>
  );
  const drift =
    snapshot?.assignments.filter(
      (x) => x.conflict || x.verified === "mismatch",
    ) || [];
  const selectedOwners =
    snapshot?.listeners.filter((x) => x.port === selected) || [];
  return (
    <div className="ports-page">
      <div className="page-intro">
        <div>
          <h2>Ports</h2>
          <p>Expected assignments alongside what Windows is listening on.</p>
        </div>
        <span className="muted">
          {snapshot
            ? "Updated " + new Date(snapshot.at).toLocaleTimeString()
            : "Reading Windows…"}
        </span>
        <button onClick={() => void load()}>Refresh</button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {snapshot?.errors.map((x) => (
        <p className="warning" key={x}>
          {x}
        </p>
      ))}
      <div className="ports-columns">
        <section className="panel">
          <div className="section-title">
            <h3>Port dashboard</h3>
            <span className="badge">
              {snapshot?.listeners.length ?? "…"} listeners
            </span>
          </div>
          <form
            className="field-row"
            onSubmit={(e) => {
              e.preventDefault();
              const port = Number(lookup);
              if (Number.isInteger(port) && port > 0 && port < 65536)
                setSelected(port);
            }}
          >
            <input
              aria-label="Port number"
              type="number"
              min="1"
              max="65535"
              placeholder="Look up a port"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
            />
            <button>Inspect port</button>
          </form>
          {selected !== null && (
            <div className="port-detail">
              <div className="section-title">
                <h3>Port {selected}</h3>
                <button
                  onClick={() => {
                    setAdding(true);
                    setEditing({
                      repo: "",
                      path: "",
                      framework: "",
                      default_port: selected,
                      status: "active",
                      source: "",
                      note: "",
                    });
                  }}
                >
                  Assign port
                </button>
              </div>
              {selectedOwners.length ? (
                selectedOwners.map((owner) => (
                  <div key={owner.address + owner.pid}>
                    {ownerRow(owner)}
                    <pre className="command">
                      {owner.command || "Command line unavailable"}
                    </pre>
                    <small className="muted">
                      {owner.protected
                        ? "Windows/system process — protected"
                        : owner.created
                          ? "Started " + owner.created
                          : "Process identity unavailable — stop disabled"}
                    </small>
                  </div>
                ))
              ) : (
                <p className="muted">No listener in the latest snapshot.</p>
              )}
            </div>
          )}
          {Object.entries(snapshot?.ranges || {}).map(([name, range]) => (
            <div className="range" key={name}>
              <div className="section-title">
                <h4>{name}</h4>
                <small>
                  {range.start}–{range.end}
                </small>
              </div>
              <p className="muted">{range.note}</p>
              <div className="port-cells">
                {Array.from(
                  { length: Math.min(range.end - range.start + 1, 120) },
                  (_, i) => range.start + i,
                ).map((port) => (
                  <button
                    title={"Inspect " + port}
                    className={
                      snapshot?.listeners.some((x) => x.port === port)
                        ? "occupied"
                        : ""
                    }
                    key={port}
                    onClick={() => {
                      setSelected(port);
                      setLookup(String(port));
                    }}
                  >
                    {port}
                  </button>
                ))}
              </div>
              {range.end - range.start >= 120 && (
                <small className="muted">
                  First 120 ports shown. Use lookup for the rest.
                </small>
              )}
            </div>
          ))}
          <details className="listener-section">
            <summary>
              Windows and system listeners ({snapshot?.systems.length || 0})
            </summary>
            {snapshot?.systems
              .filter((x) => matches(x.name + " " + x.port + " " + x.service))
              .map(ownerRow)}
          </details>
          <details
            className="listener-section"
            open={!snapshot?.assignments.length}
          >
            <summary>
              Other detected listeners ({snapshot?.observed.length || 0})
            </summary>
            <p className="muted">
              Unassigned ports outside your ranges. Inspect a listener to add an
              assignment.
            </p>
            {snapshot?.observed
              .filter((x) => matches(x.name + " " + x.port))
              .map(ownerRow)}
          </details>
        </section>
        <section className="apps-column">
          {(drift.length > 0 || !!snapshot?.drift.length) && (
            <div className="panel drift-panel">
              <div className="section-title">
                <h3>Drift to review</h3>
                <span className="badge warning">
                  {drift.length + (snapshot?.drift.length || 0)}
                </span>
              </div>
              {drift.map((x) => (
                <div
                  className="drift-row"
                  key={x.origin + x.default_port + x.repo}
                >
                  <strong>
                    {x.repo} · {x.default_port}
                  </strong>
                  <p>
                    {x.conflict
                      ? "More than one assignment claims this port. "
                      : ""}
                    {x.verified === "mismatch"
                      ? `Process command points to ${x.actualRepo}.`
                      : ""}
                  </p>
                </div>
              ))}
              {snapshot?.drift.map(ownerRow)}
            </div>
          )}
          <div className="panel">
            <div className="section-title">
              <h3>App assignments</h3>
              <button
                onClick={() => {
                  setEditing(undefined);
                  setAdding(true);
                }}
              >
                Add assignment
              </button>
            </div>
            <p className="muted">
              Listening apps first. Registry expectations are kept separate from
              process evidence.
            </p>
            {!snapshot?.assignments.length && (
              <div className="inline-empty">
                No assignments yet. Add one here or connect your own registry in
                Settings.
              </div>
            )}
            {snapshot?.assignments
              .filter((x) =>
                matches(x.repo + " " + x.path + " " + x.default_port),
              )
              .map((row) => (
                <article
                  className="assignment"
                  key={row.origin + row.default_port + row.repo}
                >
                  <div className="section-title">
                    <div>
                      <strong>{row.repo}</strong>
                      <small>
                        {row.framework || "Application"} · {row.default_port}
                      </small>
                    </div>
                    <span className={"badge " + (row.listening ? "live" : "")}>
                      {row.listening ? "Listening" : "Stopped"}
                    </span>
                  </div>
                  <div className="assignment-meta">
                    <span>
                      {row.readOnly
                        ? "Connected · read-only"
                        : "Local registry"}
                    </span>
                    <span>
                      {
                        {
                          match: "Path verified",
                          mismatch: "Wrong app detected",
                          unknown: "Identity unverified",
                          down: "No listener",
                        }[row.verified]
                      }
                    </span>
                  </div>
                  {row.path && (
                    <p className={"path " + (!row.pathExists ? "warning" : "")}>
                      {row.path}
                      {!row.pathExists ? " · folder missing" : ""}
                    </p>
                  )}
                  {row.note && <p>{row.note}</p>}
                  {row.owners.map(ownerRow)}
                  <div className="card-foot">
                    <button
                      onClick={() => {
                        setSelected(row.default_port);
                        setLookup(String(row.default_port));
                      }}
                    >
                      Inspect
                    </button>
                    {!row.readOnly && (
                      <>
                        <button
                          onClick={() => {
                            setEditing(row);
                            setAdding(true);
                          }}
                        >
                          Edit
                        </button>
                        <button onClick={() => remove(row)}>Remove</button>
                      </>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </section>
      </div>
      {adding && (
        <AssignmentEditor
          initial={editing}
          onClose={() => setAdding(false)}
          onSave={async (value) => {
            const rows = state.registry.assignments.filter(
              (x) =>
                x.default_port !==
                (editing?.repo ? editing.default_port : undefined),
            );
            if (rows.some((x) => x.default_port === value.default_port))
              throw Error(
                "That local port already has an assignment. Edit it instead.",
              );
            await window.launcher.registry(
              { ...state.registry, assignments: [...rows, value] },
              state.revision,
            );
            await refresh();
            await load();
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}
function AssignmentEditor({
  initial,
  onClose,
  onSave,
}: {
  initial?: Assignment;
  onClose: () => void;
  onSave: (value: Assignment) => Promise<void>;
}) {
  const [value, setValue] = React.useState<Assignment>(
    initial || {
      repo: "",
      path: "",
      framework: "",
      default_port: 3000,
      status: "active",
      source: "",
      note: "",
    },
  );
  const [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false);
  return (
    <Modal
      title={initial?.repo ? "Edit assignment" : "Add assignment"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave(value);
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          App name
          <input
            required
            value={value.repo}
            onChange={(e) => setValue({ ...value, repo: e.target.value })}
          />
        </label>
        <label>
          Expected port
          <input
            required
            type="number"
            min="1"
            max="65535"
            value={value.default_port}
            onChange={(e) =>
              setValue({ ...value, default_port: Number(e.target.value) })
            }
          />
        </label>
        <label>
          App folder <small>optional; used to verify the process command</small>
          <div className="field-row">
            <input
              value={value.path}
              onChange={(e) => setValue({ ...value, path: e.target.value })}
            />
            <button
              type="button"
              onClick={() =>
                window.launcher
                  .pick("folder")
                  .then((p) => p && setValue({ ...value, path: p }))
              }
            >
              Browse…
            </button>
          </div>
        </label>
        <label>
          Framework
          <input
            value={value.framework}
            onChange={(e) => setValue({ ...value, framework: e.target.value })}
          />
        </label>
        <label>
          Note
          <input
            value={value.note}
            onChange={(e) => setValue({ ...value, note: e.target.value })}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy} className="primary">
            Save assignment
          </button>
        </div>
      </form>
    </Modal>
  );
}
