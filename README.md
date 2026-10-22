# FIT Launcher

A portable Windows home for quick repository tasks. Keep Launcher open, jump into Explorer, your editor, a terminal or GitHub from a project card, finish the task, then close that external window yourself.

## Run the preview

1. Open [Releases](https://github.com/FITAutomate/fit-launcher/releases) and download **FIT-Launcher-0.1.0-preview.2-windows-x64.zip**. GitHub's automatic “Source code” ZIP is for developers and does not contain the runnable app.
2. Extract the **whole** `FIT Launcher` folder to a writable location.
3. Open **`FIT Launcher/app/FIT Launcher.exe`**.
4. Choose directories in the welcome screen. Open **Discovered**, then add projects to **Launch**. Ordinary folders can be bookmarked with **Add shortcut**.

Windows x64 only. Node, npm, Git, an app installer and administrator installation are not required to run the ZIP. The preview is **unsigned**. Windows may show a reputation warning, and managed devices may block it; follow your organization's policy. Test evidence is from Windows 11 x64 and Windows CI, not a pristine Windows VM. See [validation](docs/validation.md).

## Three views

- **Launch:** drag card headers on a dotted snap grid; pan, zoom, group cards, Fit all, Auto arrange or Reset layout. Card actions open Explorer, an editor, a terminal or the repository page in your default browser. Edit/Repair changes the target; Remove only removes the shortcut.
- **Discovered:** a searchable grid grouped by scan directory, with a Git-only filter and Rescan. Nested repositories, worktrees and project hints are found without running project scripts or requiring Git.
- **Ports:** live Windows TCP listeners alongside your expected assignments. The left panel has lookup, ranges and system listeners; the right has drift when present and assignments with listening apps first. “Listening” does not mean healthy or HTTP.

Launcher stays open after actions. Closing its window hides it to the tray; click the tray icon to restore it. **Quit** in the tray exits Launcher and leaves your projects running. Start with Windows is optional and off by default.

## Your data

```text
FIT Launcher/
  app/                    # replace this folder when updating
    FIT Launcher.exe
  data/                   # created on first run; keep this folder
    workspace.json
    layout.json
    registry.yaml
    backups/
    logs/
    session/
```

Move the complete portable folder to retain your workspace. Project locations are explicit: edit a scan root in Settings to repoint its relative shortcuts, or Repair an individual card. Removing a root keeps its cards as ordinary folder bookmarks. For a separate data location, launch `"path\app\FIT Launcher.exe" --data-dir "path\my-data"`. Use a writable location; the app reports storage errors rather than silently switching profiles.

Settings provides versioned profile export/import with preview and backups. Exports contain personal paths: share them deliberately. Imports replace the profile, retain card IDs/layout, and disable startup, shell integration and connected registry. Review the imported roots before scanning.

## Tools and discovery

VS Code is detected in its normal user/system installation locations. Configure another editor `.exe` in Settings. Windows Terminal is preferred; Windows PowerShell is the fallback. Missing tools or remotes produce an error on the card action. GitHub HTTPS and SSH remotes are normalized to the repository page; no account or API token is needed.

Directory scan depth defaults to 4 (editable up to 12); scans are cancellable and capped at 50,000 visited directories. Dependency/build folders and hidden subdirectories are skipped, and real paths prevent junction loops. Hints use `package.json`, `pyproject.toml`, `.csproj`, `compose.yaml` and `docker-compose.yml`. Manifests are never executed.

## Port registry

The local registry starts empty and is editable in Ports and Settings. [This fictional example](resources/examples/registry.yaml) shows the schema. An optional selected external YAML file is **read-only**; disconnect it anytime. Source `status`, listening state and process verification are separate facts. Unknown identities remain unverified, and conflicting assignments are visible. An unavailable registry does not prevent live listener inspection.

Stop is available only for a registered port or configured range, with a known current process identity. It explicitly confirms **forceful process termination** and all observed affected ports, then rechecks ownership/creation time. System and Launcher processes are protected. There is no automatic elevation, graceful service shutdown or process-tree supervision.

## Optional PowerShell shortcuts

Settings can preview/import literal folder functions from a selected `.ps1` file. It parses the AST without executing or rewriting that source. Command wrappers stay in the original file, and missing folders can be repaired in Launch.

Opting into PowerShell integration generates `data/integrations/shortcuts.ps1`. Settings shows the line you can add to your own profile. The app never edits the profile. Existing command names are skipped with a warning; remove an old generated function before reloading a changed definition in an existing session. New sessions read the current generated file.

## Build and contribute

See [CONTRIBUTING](CONTRIBUTING.md), [release procedure](docs/release.md) and [validation/demo route](docs/validation.md). The source is [MIT licensed](LICENSE).
A portable Windows home for quick repository tasks.
