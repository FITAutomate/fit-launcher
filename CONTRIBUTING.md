# Contributing

FIT Launcher is a small Windows utility for quick tasks across local projects. Keep the app useful without an organization's registry, credentials or directory layout.

## Develop on Windows x64

Use Node **24.12.0** and npm (the version committed by the lockfile was generated with npm 11.8.0). Git is needed for contributing, not for running the packaged app.

```powershell
npm ci
npm start
```

Development data defaults to `.local-data/`, ignored by Git. After `npm run build`, use `npx electron . --data-dir "C:\LauncherProfiles\development"` for an isolated profile.

```powershell
npm run typecheck
npm test
npm run test:electron
npm run make
npm run test:portable
npm run audit:release
npm run format:check
```

Electron integration tests create isolated data directories and disposable listeners. Stop tests terminate only processes they created. Packaged tests use the runnable ZIP with a restricted PATH. A Windows desktop session and inbox Windows PowerShell/CIM/TCP cmdlets are required. No Playwright browser installation is needed for Electron tests.

## Code boundaries

- `src/main` owns filesystem state, tool launches and Windows adapters. Saves are serialized, schema checked, backed up and revision checked.
- `src/preload` exposes specific typed operations. The sandboxed local renderer has no Node, arbitrary IPC, filesystem or command API.
- `src/renderer` has the Launch canvas, conventional Discovered grid, split Ports view and Settings.
- `resources/windows` contains bounded, hidden helpers for observations, AST import and guarded Stop. Do not execute imported project code.
- `resources/examples` and tests use fictional data. Never commit a real profile, registry, log, task XML, backup, token or screenshot of a personal workspace.

Open an [issue](https://github.com/FITAutomate/fit-launcher/issues) with the observed behavior, Windows version, expected result and a sanitized reproduction. Refer to that issue in your PR. Include focused runtime evidence for behavior changes, and run `npm run format` before submitting. Keep app and user data separate; preserve stable card IDs and external registry bytes.

Workflow dispatch, agents, service supervision, universal window reuse and cross-platform packages are outside this preview. Discuss changes to that scope before implementing them.
