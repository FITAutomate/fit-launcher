Portable Windows x64 preview of FIT Launcher.

New in preview.6:

- **Appearance:** Choose System, Light or Dark in the sidebar. System follows Windows while Launcher is open. Your choice is saved with the portable profile.
- **Terminal from any folder:** Terminal opens folders whose paths contain spaces.
- **Visible terminals:** Terminal opens an independent, visible Windows PowerShell session that stays open after you quit Launcher.

Send feedback opens a pre-filled GitHub issue for you to review and submit in your browser. No workspace, paths or logs are attached automatically.

Download **FIT-Launcher-0.1.0-preview.6-windows-x64.zip**, extract the whole folder, then open **FIT Launcher/app/FIT Launcher.exe**. The automatic source-code archives are not runnable packages.

Choose your project directories in the welcome screen. Discover repositories, add shortcuts to the movable Launch board, and jump into Explorer, your editor, a terminal or the GitHub repo page. Launcher stays available while you close the external tools yourself. Ports shows live Windows listeners and optional local/connected assignments.

The ZIP contains generic app files; your sibling `data` folder is created locally. Update by replacing `app` and preserving `data`. No Node/npm/Git or administrator installer is required for runtime. Editor software is optional and separately installed.

This preview is unsigned. Windows reputation or organizational policies may warn or block execution; follow your device policy. Validation covers Windows 11 x64 isolated profiles and Windows CI, not a pristine OS installation. See the repository's `docs/validation.md` for evidence and limits.

This preview is built from `main` after PRs #11, #13 and #15.
