import React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeProps,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Common } from "./ui";
import { Actions, Empty } from "./ui";
import type { Launch } from "../shared/schema";
type CardData = {
  entry: Launch;
  target: string;
  exists: boolean;
  edit: () => void;
  remove: () => void;
  notify: Common["notify"];
};
type CardNode = Node<CardData, "repo">;
function RepoCard({ data }: NodeProps<CardNode>) {
  return (
    <article className={"repo-card " + (!data.exists ? "broken" : "")}>
      <div className="drag-handle">
        <span className="repo-symbol">⌘</span>
        <span className="grow">
          <strong>{data.entry.label}</strong>
          <small>{data.entry.group}</small>
        </span>
        <span
          className={"status-dot " + (data.exists ? "good" : "bad")}
          title={data.exists ? "Folder available" : "Folder missing"}
        />
      </div>
      <div className="card-path nodrag" title={data.target}>
        {data.target}
      </div>
      {!data.exists && (
        <div className="warning nodrag">
          Folder missing. Repair its location.
        </div>
      )}
      <Actions entry={data.entry} notify={data.notify} />
      <div className="card-foot nodrag nopan">
        <span>{data.entry.shellName || "Folder shortcut"}</span>
        <button onClick={data.edit}>{data.exists ? "Edit" : "Repair"}</button>
        <button onClick={data.remove}>Remove</button>
      </div>
    </article>
  );
}
const nodeTypes = { repo: RepoCard };
function Board(
  props: Common & { query: string; edit: (entry?: Launch) => void },
) {
  const { state, notify, edit, query } = props;
  const [nodes, setNodes, onNodesChange] = useNodesState<CardNode>([]);
  const flow = useReactFlow<CardNode>();
  const layout = React.useRef(state.layout);
  const ready = React.useRef(false);
  React.useEffect(() => {
    layout.current = state.layout;
  }, [state.layout]);
  React.useEffect(() => {
    setNodes(
      state.workspace.launches.map((entry, i) => ({
        id: entry.id,
        type: "repo",
        dragHandle: ".drag-handle",
        position: layout.current.positions[entry.id] || {
          x: (i % 3) * 350,
          y: Math.floor(i / 3) * 245,
        },
        hidden:
          !!query &&
          !(
            entry.label +
            " " +
            entry.group +
            " " +
            state.resolved[entry.id]?.path
          )
            .toLowerCase()
            .includes(query.toLowerCase()),
        data: {
          entry,
          target: state.resolved[entry.id]?.path || "",
          exists: state.resolved[entry.id]?.exists || false,
          notify,
          edit: () => edit(entry),
          remove: async () => {
            if (
              !confirm(
                `Remove ${entry.label} from Launch? Its folder stays on disk.`,
              )
            )
              return;
            try {
              await props.save({
                ...state.workspace,
                launches: state.workspace.launches.filter(
                  (x) => x.id !== entry.id,
                ),
              });
            } catch (e) {
              notify(String(e), true);
            }
          },
        },
      })),
    );
  }, [state.workspace, state.resolved, query]);
  async function persist(current: CardNode[], viewport = flow.getViewport()) {
    const positions = { ...layout.current.positions };
    for (const node of current) positions[node.id] = node.position;
    try {
      await window.launcher.layout({ schemaVersion: 1, positions, viewport });
      layout.current = { schemaVersion: 1, positions, viewport };
    } catch (e) {
      notify(String(e), true);
    }
  }
  function arrange(reset = false) {
    const sorted = [...nodes].sort(
      (a, b) =>
        a.data.entry.group.localeCompare(b.data.entry.group) ||
        a.data.entry.label.localeCompare(b.data.entry.label),
    );
    const arranged = sorted.map((node, i) => ({
      ...node,
      position: { x: (i % 3) * 350, y: Math.floor(i / 3) * 245 },
    }));
    setNodes(arranged);
    void persist(
      arranged,
      reset ? { x: 20, y: 20, zoom: 1 } : flow.getViewport(),
    );
    if (reset) void flow.setViewport({ x: 20, y: 20, zoom: 1 });
    else setTimeout(() => flow.fitView({ padding: 0.15 }), 20);
  }
  if (!state.workspace.launches.length)
    return (
      <Empty title="Your projects, one home">
        <p>Add a shortcut or discover repositories in your scan roots.</p>
        <button className="primary" onClick={() => edit()}>
          Add your first shortcut
        </button>
      </Empty>
    );
  return (
    <div className="board" data-testid="launch-board">
      <div className="board-tools">
        <span>Drag a card header to arrange your workspace</span>
        <button onClick={() => flow.fitView({ padding: 0.15 })}>Fit all</button>
        <button onClick={() => arrange()}>Auto arrange</button>
        <button
          onClick={() => {
            if (confirm("Reset saved card positions?")) arrange(true);
          }}
        >
          Reset layout
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.2}
        maxZoom={2}
        defaultViewport={state.layout.viewport}
        onInit={() => {
          ready.current = true;
        }}
        onNodeDragStop={(_e, _n, current) => {
          void persist(current);
        }}
        onMoveEnd={(_e, viewport: Viewport) => {
          if (ready.current) void persist(flow.getNodes(), viewport);
        }}
        nodesConnectable={false}
        deleteKeyCode={null}
      >
        <Background gap={22} size={1.5} color="#2a3548" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <details className="accessible-list">
        <summary>Project list</summary>
        {state.workspace.launches.map((e) => (
          <div key={e.id}>
            <strong>{e.label}</strong>
            <Actions entry={e} notify={notify} />
          </div>
        ))}
      </details>
    </div>
  );
}
export default function LaunchBoard(
  props: Common & { query: string; edit: (entry?: Launch) => void },
) {
  return (
    <ReactFlowProvider>
      <Board {...props} />
    </ReactFlowProvider>
  );
}
