import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import fs from "node:fs/promises";
import { z } from "zod";
import path from "node:path";
import { Store } from "./store";
import { dataLocation, resolveLaunch } from "./paths";
import { windowsHelper } from "./windows";
import {
  WorkspaceSchema,
  LayoutSchema,
  RegistrySchema,
  ActionSchema,
  type Listener,
  type AppState,
  type ImportPreview,
} from "../shared/schema";
import { discover, gitRemote } from "./discovery";
import { detectEditor, launchAction } from "./launch-actions";
import { portModel, governed } from "./ports";
import { validateTransfer } from "./profile";
const dataDir = dataLocation(process.execPath, process.argv, app.isPackaged);
app.setPath("userData", path.join(dataDir, "session"));
app.setAppLogsPath(path.join(dataDir, "logs"));
let win: BrowserWindow;
let tray: Tray;
let quitting = false;
const store = new Store(dataDir);
const resources = () =>
  app.isPackaged
    ? process.resourcesPath
    : path.join(process.cwd(), "resources");
let scanController: AbortController | undefined;
let pendingImport: unknown;
let pendingImportRevision = "";
const pickedSources = new Set<string>();
let cachedListeners: Listener[] = [];
let snapshotAt = 0;
let activeSnapshot: Promise<Listener[]> | undefined;
async function listeners(fresh = false) {
  if (!fresh && Date.now() - snapshotAt < 5000) return cachedListeners;
  if (activeSnapshot && !fresh) return activeSnapshot;
  const operation = windowsHelper<Listener[]>(resources(), "snapshot.ps1")
    .then((rows) => {
      cachedListeners = rows.map((x) => ({
        ...x,
        protected: x.protected || x.pid === process.pid,
      }));
      snapshotAt = Date.now();
      return cachedListeners;
    })
    .finally(() => {
      activeSnapshot = undefined;
    });
  activeSnapshot = operation;
  return operation;
}
async function state(): Promise<AppState> {
  await store.refresh();
  const resolved: AppState["resolved"] = {};
  await Promise.all(
    store.workspace.launches.map(async (entry) => {
      try {
        const target = resolveLaunch(store.workspace, entry);
        resolved[entry.id] = {
          path: target,
          exists: await fs.stat(target).then(
            (x) => x.isDirectory(),
            () => false,
          ),
          githubUrl: entry.githubUrl || (await gitRemote(target)),
        };
      } catch {
        resolved[entry.id] = {
          path: entry.absolutePath || entry.relativePath || "",
          exists: false,
          githubUrl: "",
        };
      }
    }),
  );
  const login = app.getLoginItemSettings({
    path: process.execPath,
    args: ["--data-dir", dataDir],
  });
  return {
    workspace: store.workspace,
    layout: store.layout,
    registry: store.registry,
    revision: await store.revision(),
    dataDir,
    startup: login.openAtLogin,
    startupPath: process.execPath,
    warnings: store.warnings,
    editorDetected: await detectEditor(),
    resolved,
  };
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    win?.show();
    win?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      try {
        await store.init();
      } catch (e) {
        dialog.showErrorBox(
          "Choose a writable data location",
          String(e) +
            "\nMove the portable folder or launch with --data-dir <folder>.",
        );
        app.exit(1);
        return;
      }
      win = new BrowserWindow({
        width: 1350,
        height: 930,
        minWidth: 850,
        minHeight: 600,
        title: "FIT Launcher",
        backgroundColor: "#101722",
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (e) => e.preventDefault());
      win.on("close", (e) => {
        if (!quitting) {
          e.preventDefault();
          win.hide();
        }
      });
      const size = 32,
        buffer = Buffer.alloc(size * size * 4);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const mark =
            (x > 7 && x < 13 && y > 7 && y < 25) ||
            (y > 7 && y < 12 && x > 7 && x < 25) ||
            (y > 15 && y < 19 && x > 7 && x < 21);
          buffer[i] = mark ? 205 : 32;
          buffer[i + 1] = mark ? 186 : 23;
          buffer[i + 2] = mark ? 111 : 16;
          buffer[i + 3] = 255;
        }
      const icon = nativeImage.createFromBitmap(buffer, {
        width: size,
        height: size,
      });
      win.setIcon(icon);
      tray = new Tray(icon);
      tray.setToolTip("FIT Launcher");
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: "Open FIT Launcher", click: () => win.show() },
          { label: "Quit", click: () => app.quit() },
        ]),
      );
      tray.on("click", () => {
        win.show();
        win.focus();
      });
      ipcMain.handle(
        "launcher",
        async (event, op: string, ...args: unknown[]) => {
          if (
            event.sender !== win.webContents ||
            event.senderFrame !== win.webContents.mainFrame
          )
            throw Error("Untrusted caller.");
          try {
            if (op === "state") return await state();
            if (op === "save") {
              await store.save(
                WorkspaceSchema.parse(args[0]),
                z.string().parse(args[1]),
              );
              return await state();
            }
            if (op === "registry") {
              await store.saveRegistry(
                RegistrySchema.parse(args[0]),
                z.string().parse(args[1]),
              );
              return await state();
            }
            if (op === "layout") {
              await store.saveLayout(LayoutSchema.parse(args[0]));
              return;
            }
            if (op === "pick") {
              const kind = z
                .enum(["folder", "editor", "registry", "shortcuts"])
                .parse(args[0]);
              const result = await dialog.showOpenDialog(win, {
                properties: [kind === "folder" ? "openDirectory" : "openFile"],
                filters:
                  kind === "editor"
                    ? [{ name: "Windows application", extensions: ["exe"] }]
                    : kind === "folder"
                      ? []
                      : [
                          {
                            name:
                              kind === "shortcuts"
                                ? "PowerShell functions"
                                : "YAML registry",
                            extensions:
                              kind === "shortcuts" ? ["ps1"] : ["yaml", "yml"],
                          },
                        ],
              });
              const selected = result.canceled ? null : result.filePaths[0];
              if (selected) pickedSources.add(selected);
              return selected;
            }
            if (op === "scan") {
              scanController?.abort();
              const controller = (scanController = new AbortController());
              return await discover(store.workspace, controller.signal);
            }
            if (op === "cancelScan") {
              scanController?.abort();
              return;
            }
            if (op === "launch") {
              await launchAction(
                store.workspace,
                z.string().parse(args[0]),
                ActionSchema.parse(args[1]),
                resources(),
              );
              return;
            }
            if (op === "ports")
              return await portModel(
                await listeners(),
                store.registry,
                store.workspace.externalRegistry,
                process.pid,
              );
            if (op === "stop") {
              const target = z
                .object({
                  port: z.number().int().min(1).max(65535),
                  address: z.string().max(100),
                  pid: z.number().int().positive(),
                  created: z.string().min(1),
                })
                .parse(args[0]);
              const observed = await listeners(true);
              const current = observed.find(
                (x) =>
                  x.port === target.port &&
                  x.address === target.address &&
                  x.pid === target.pid &&
                  x.created === target.created,
              );
              const model = await portModel(
                observed,
                store.registry,
                store.workspace.externalRegistry,
                process.pid,
              );
              if (!current || !governed(current, model, process.pid))
                throw Error(
                  "Owner changed, identity unavailable, or this process is not governed. Inspect again.",
                );
              const began = Date.now();
              const answer = await dialog.showMessageBox(win, {
                type: "warning",
                buttons: ["Cancel", "Force stop"],
                defaultId: 0,
                cancelId: 0,
                title: "Stop this process?",
                message: `Force stop ${current.name} (PID ${current.pid})?`,
                detail:
                  "This terminates the process, including these listening ports: " +
                  observed
                    .filter((x) => x.pid === current.pid)
                    .map((x) => x.port)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .join(", "),
              });
              if (answer.response !== 1) return false;
              if (Date.now() - began > 15000)
                throw Error("Confirmation expired. Inspect and try again.");
              await windowsHelper(resources(), "stop-port.ps1", [
                "-Port",
                String(current.port),
                "-Address",
                current.address,
                "-Owner",
                String(current.pid),
                "-Created",
                current.created,
                "-LauncherPid",
                String(process.pid),
              ]);
              snapshotAt = 0;
              await store.log(
                `Stopped PID ${current.pid} on port ${current.port}`,
              );
              return true;
            }
            if (op === "importShortcuts") {
              const source = z.string().parse(args[0]);
              if (!pickedSources.has(source))
                throw Error("Choose the source file first.");
              return await windowsHelper<ImportPreview>(
                resources(),
                "import-shortcuts.ps1",
                ["-Path", source],
              );
            }
            if (op === "exportConfig") {
              const chosen = await dialog.showSaveDialog(win, {
                defaultPath: "fit-launcher-profile.json",
                filters: [
                  { name: "FIT Launcher profile", extensions: ["json"] },
                ],
              });
              if (chosen.canceled || !chosen.filePath) return false;
              await fs.writeFile(
                chosen.filePath,
                JSON.stringify(await store.transfer(), null, 2),
                "utf8",
              );
              return true;
            }
            if (op === "importConfig") {
              pendingImport = undefined;
              const chosen = await dialog.showOpenDialog(win, {
                properties: ["openFile"],
                filters: [
                  { name: "FIT Launcher profile", extensions: ["json"] },
                ],
              });
              if (chosen.canceled) return null;
              const input = JSON.parse(
                await fs.readFile(chosen.filePaths[0], "utf8"),
              );
              const profile = validateTransfer(input);
              pendingImport = profile;
              pendingImportRevision = await store.revision();
              return {
                summary: `Replace this profile with ${profile.workspace.launches.length} shortcuts, ${profile.workspace.roots.length} scan roots and ${profile.registry.assignments.length} local assignments.\nRoots: ${profile.workspace.roots.map((r) => r.path).join("; ") || "none"}.\nConnected source: ${profile.workspace.externalRegistry || "none"} (disabled after import).\nExisting entries are replaced, not merged. Current data will be backed up. Startup and shell integration start disabled. Review/edit scan roots in Settings after import.`,
              };
            }
            if (op === "applyImport") {
              if (!pendingImport)
                throw Error("Choose and preview a profile first.");
              if (pendingImportRevision !== (await store.revision()))
                throw Error("Profile changed. Preview the import again.");
              const input = pendingImport;
              pendingImport = undefined;
              await store.replace(input);
              app.setLoginItemSettings({
                openAtLogin: false,
                path: process.execPath,
                args: ["--data-dir", dataDir],
              });
              return await state();
            }
            if (op === "startup") {
              const enabled = z.boolean().parse(args[0]);
              if (!app.isPackaged && enabled)
                throw Error(
                  "Enable startup from the packaged app, not the development executable.",
                );
              app.setLoginItemSettings({
                openAtLogin: enabled,
                path: process.execPath,
                args: ["--data-dir", dataDir],
              });
              return await state();
            }
            if (op === "quit") {
              app.quit();
              return;
            }
            throw Error("Unknown operation.");
          } catch (e) {
            await store.log(`${op}: ${String(e)}`);
            throw e;
          }
        },
      );
      await win.loadFile(path.join(__dirname, "renderer", "index.html"));
    })
    .catch((e) => {
      dialog.showErrorBox("FIT Launcher", String(e));
      app.exit(1);
    });
  app.on("before-quit", () => {
    quitting = true;
  });
  app.on("window-all-closed", () => {});
}
