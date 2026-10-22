import { contextBridge, ipcRenderer } from "electron";
import type { Bridge } from "../shared/bridge";
const request = (op: string, ...args: unknown[]) =>
  ipcRenderer.invoke("launcher", op, ...args);
const bridge: Bridge = {
  state: () => request("state"),
  save: (...a) => request("save", ...a),
  layout: (...a) => request("layout", ...a),
  registry: (...a) => request("registry", ...a),
  pick: (...a) => request("pick", ...a),
  scan: () => request("scan"),
  cancelScan: () => request("cancelScan"),
  launch: (...a) => request("launch", ...a),
  ports: () => request("ports"),
  stop: (...a) => request("stop", ...a),
  importShortcuts: (...a) => request("importShortcuts", ...a),
  exportConfig: () => request("exportConfig"),
  importConfig: () => request("importConfig"),
  applyImport: () => request("applyImport"),
  startup: (...a) => request("startup", ...a),
  quit: () => request("quit"),
};
contextBridge.exposeInMainWorld("launcher", bridge);
