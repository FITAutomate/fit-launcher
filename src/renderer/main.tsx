import React from "react";
import { createRoot } from "react-dom/client";
import "../shared/bridge";
import type { AppState, Launch, Discovery, Workspace } from "../shared/schema";
import LaunchBoard from "./Launch";
import Discovered from "./Discovered";
import Ports from "./Ports";
import Settings from "./Settings";
import Feedback from "./Feedback";
import { ShortcutEditor } from "./ui";
import "./styles.css";
function App() {
  const [state, setState] = React.useState<AppState | null>(null),
    [tab, setTab] = React.useState<"Launch" | "Discovered" | "Ports">("Launch"),
    [feedback, setFeedback] = React.useState(false),
    [query, setQuery] = React.useState(""),
    [settings, setSettings] = React.useState(false),
    [wizard, setWizard] = React.useState(false),
    [editing, setEditing] = React.useState<{
      entry?: Launch;
      discovery?: Discovery;
    } | null>(null),
    [message, setMessage] = React.useState<{
      text: string;
      error: boolean;
    } | null>(null),
    [failure, setFailure] = React.useState("");
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notify = React.useCallback((text: string, error = false) => {
    setMessage({ text, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setMessage(null),
      error ? 15000 : 5000,
    );
  }, []);
  const refresh = React.useCallback(async () => {
    setState(await window.launcher.state());
  }, []);
  React.useEffect(() => {
    window.launcher
      .state()
      .then((s) => {
        setState(s);
        if (!s.workspace.setupComplete) {
          setWizard(true);
          setSettings(true);
        }
      })
      .catch((e) => setFailure(String(e)));
  }, []);
  async function save(workspace: Workspace) {
    if (!state) return;
    setState(await window.launcher.save(workspace, state.revision));
  }
  if (!state)
    return (
      <main className="loading">
        <h1>FIT Launcher</h1>
        <p>{failure || "Opening your workspace…"}</p>
      </main>
    );
  const common = { state, save, refresh, notify };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">⌘</span>
          <div>
            <h1>FIT Launcher</h1>
            <small>YOUR WORKSPACE, WITHIN REACH</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {(["Launch", "Discovered", "Ports"] as const).map((name, i) => (
            <button
              key={name}
              aria-label={name}
              className={tab === name ? "active" : ""}
              onClick={() => {
                setTab(name);
                setQuery("");
              }}
            >
              <span>{["▦", "⌕", "◉"][i]}</span>
              {name}
              {name === "Launch" && (
                <small>{state.workspace.launches.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            Open what you need.
            <br />
            Close it when you’re done.
            <br />
            Your launcher stays here.
          </p>
          <button
            onClick={() => {
              setWizard(false);
              setSettings(true);
            }}
          >
            ⚙ Settings
          </button>
          <button onClick={() => setFeedback(true)}>Send feedback</button>
          <small>WINDOWS · {state.version}</small>
        </div>
      </aside>
      <main className="workspace">
        <header className="toolbar">
          <div>
            <h2>
              {tab === "Launch"
                ? "Your launchpad"
                : tab === "Discovered"
                  ? "Find your projects"
                  : "Local apps & ports"}
            </h2>
            <small>
              {tab === "Launch"
                ? "A quick jump into the tools you need"
                : tab === "Discovered"
                  ? "Repositories and project folders from your scan roots"
                  : "Live Windows listeners and expected assignments"}
            </small>
          </div>
          <input
            className="search"
            aria-label="Search"
            placeholder={"Search " + tab.toLowerCase() + "…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={() => {
              setWizard(false);
              setSettings(true);
            }}
          >
            Add directory
          </button>
          <button className="primary" onClick={() => setEditing({})}>
            + Add shortcut
          </button>
        </header>
        {state.warnings.map((x) => (
          <div className="warning banner" role="alert" key={x}>
            {x}
          </div>
        ))}
        <div
          className={"content " + (tab === "Launch" ? "canvas-content" : "")}
        >
          {tab === "Launch" ? (
            <LaunchBoard
              {...common}
              query={query}
              edit={(entry) => setEditing({ entry })}
            />
          ) : tab === "Discovered" ? (
            <Discovered
              {...common}
              query={query}
              add={(discovery) => setEditing({ discovery })}
            />
          ) : (
            <Ports {...common} query={query} />
          )}
        </div>
        <footer className="app-footer">
          <span>
            <i className="status-dot good" />
            Workspace saved locally
          </span>
          <span>Closing this window keeps Launcher in the tray</span>
        </footer>
      </main>
      {settings && (
        <Settings
          {...common}
          wizard={wizard}
          onClose={() => setSettings(false)}
        />
      )}
      {feedback && (
        <Feedback
          where={tab}
          version={state.version}
          onClose={() => setFeedback(false)}
        />
      )}
      {editing && (
        <ShortcutEditor
          state={state}
          save={save}
          {...editing}
          onClose={() => setEditing(null)}
        />
      )}
      {message && (
        <div
          className={"toast " + (message.error ? "error" : "")}
          role={message.error ? "alert" : "status"}
        >
          <span>{message.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setMessage(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
