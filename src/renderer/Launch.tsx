import React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  PanOnScrollMode,
  type Node,
  type NodeProps,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Common } from "./ui";
import { Actions, Empty } from "./ui";
import type { Launch, Layout } from "../shared/schema";
import {
  HOME_VIEW,
  MIN_ZOOM,
  gridGeometry,
  initialOrder,
  reconcileOrder,
  pack,
  insertAtPosition,
  type Grid,
} from "./launch-layout";
type BoardProps = Common & {
  query: string;
  edit: (entry?: Launch) => void;
  commitLayout: (layout: Layout) => void;
};
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
function Board(props: BoardProps) {
  const { state, notify, edit, query, commitLayout } = props;
  const [nodes, setNodes, onNodesChange] = useNodesState<CardNode>([]);
  const flow = useReactFlow<CardNode>();
  const layout = React.useRef(state.layout);
  const order = React.useRef(
    initialOrder(
      state.workspace.launches.map((e) => e.id),
      state.layout.positions,
    ),
  );
  const container = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const drag = React.useRef<{ id: string; order: string[]; grid: Grid } | null>(
    null,
  );
  const height =
    Math.max(0, ...nodes.map((node) => node.measured?.height || 0)) || 260;
  const { columns, rowStep } = gridGeometry(width, height);
  const grid = { columns, rowStep };

  React.useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [state.workspace.launches.length > 0]);

  function persist(
    positions = layout.current.positions,
    viewport = flow.getViewport(),
  ) {
    const next = { schemaVersion: 1 as const, positions, viewport };
    layout.current = next;
    commitLayout(next);
  }

  React.useEffect(() => {
    const ids = state.workspace.launches.map((entry) => entry.id);
    order.current = reconcileOrder(order.current, ids);
    if (drag.current && !ids.includes(drag.current.id)) {
      drag.current = null;
      setDragging(false);
    }
    const positions = pack(order.current, grid);
    setNodes((previous) =>
      state.workspace.launches.map((entry) => ({
        ...previous.find((node) => node.id === entry.id),
        id: entry.id,
        type: "repo",
        dragHandle: ".drag-handle",
        position: positions[entry.id],
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

  // Width/measurement changes only project the order; moving nodes never define it.
  React.useEffect(() => {
    if (!width || dragging) return;
    const positions = pack(order.current, grid);
    setNodes((current) =>
      current.map((node) => ({ ...node, position: positions[node.id] })),
    );
    persist(positions);
  }, [columns, rowStep, width > 0, dragging, state.workspace]);

  function arrange(reset = false) {
    if (reset) {
      order.current = [...state.workspace.launches]
        .sort(
          (a, b) =>
            a.group.localeCompare(b.group) || a.label.localeCompare(b.label),
        )
        .map((entry) => entry.id);
    }
    const positions = pack(order.current, grid);
    setNodes((current) =>
      current.map((node) => ({ ...node, position: positions[node.id] })),
    );
    persist(positions, HOME_VIEW);
    void flow.setViewport(HOME_VIEW);
  }
  function reorder(node: CardNode, finish: boolean) {
    const starting = drag.current;
    if (!starting) return;
    const nextOrder = insertAtPosition(
      reconcileOrder(
        starting.order,
        state.workspace.launches.map((entry) => entry.id),
      ),
      node.id,
      node.position,
      starting.grid,
    );
    const positions = pack(nextOrder, starting.grid);
    setNodes((current) =>
      current.map((item) => ({
        ...item,
        position:
          !finish && item.id === node.id ? node.position : positions[item.id],
      })),
    );
    if (finish) {
      order.current = nextOrder;
      drag.current = null;
      setDragging(false);
      persist(positions);
    }
  }
  const fitOptions = { padding: 0.15, minZoom: MIN_ZOOM, maxZoom: 1 };
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
    <div className="board" data-testid="launch-board" ref={container}>
      <div className="board-tools">
        <span>
          {query
            ? "Clear search to rearrange cards"
            : "Drag a card header to reorder · Scroll to browse"}
        </span>
        <button onClick={() => flow.fitView(fitOptions)}>Fit all</button>
        <button disabled={!!query || dragging} onClick={() => arrange()}>
          Auto arrange
        </button>
        <button
          disabled={!!query || dragging}
          onClick={() => {
            if (confirm("Reset card order to group and name?")) arrange(true);
          }}
        >
          Reset layout
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        minZoom={MIN_ZOOM}
        maxZoom={2}
        defaultViewport={state.layout.viewport}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Vertical}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        nodesDraggable={!query}
        nodesFocusable={false}
        elementsSelectable={false}
        onNodeDragStart={(_e, node) => {
          drag.current = { id: node.id, order: [...order.current], grid };
          setDragging(true);
        }}
        onNodeDrag={(_e, node) => reorder(node, false)}
        onNodeDragStop={(_e, node) => reorder(node, true)}
        onMoveEnd={(_e, viewport: Viewport) => persist(undefined, viewport)}
        nodesConnectable={false}
        deleteKeyCode={null}
      >
        <Background gap={22} size={1.5} color="#2a3548" />
        <Controls showInteractive={false} fitViewOptions={fitOptions} />
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
export default function LaunchBoard(props: BoardProps) {
  return (
    <ReactFlowProvider>
      <Board {...props} />
    </ReactFlowProvider>
  );
}
