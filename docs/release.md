# Windows preview release

The runnable artifact is `out/FIT-Launcher-<version>-windows-x64.zip` plus its `.sha256` file. Forge's intermediate ZIP and GitHub's source archives are not the attendee download.

## Build and validate

1. Update the package version and lockfile intentionally. Keep direct dependency versions exact and action references pinned to commits.
2. On Windows x64 run `npm ci`, format check, typecheck, unit tests and Electron tests.
3. Run `npm run make`, `npm run test:portable` and `npm run audit:release`. The assembler only includes `app`, license and instructions, even if local `data` exists alongside the app.
4. Record the artifact hash, source commit and actual Windows environment. Exercise the quick-task demo with an isolated profile. Never insert personal data into the release.

The `Windows checks` workflow repeats the build on pull requests with read-only repository permissions. Pushing a `v<package version>` tag runs `Windows preview release` and creates a **draft prerelease** with ZIP and checksum. The release job alone has content-write permission. Workflow dispatch uses the same package version and refuses to overwrite an existing release.

## Validate the actual download

Download the draft assets with GitHub CLI. Verify:

```powershell
Get-FileHash .\FIT-Launcher-0.1.0-preview.2-windows-x64.zip -Algorithm SHA256
```

Compare with the attached `.sha256`. Run the portable smoke against that exact ZIP using `node scripts/smoke-portable.mjs "path\downloaded.zip"`. Inspect the release title, source tag/commit and attached assets. Record Windows downloaded-file behavior and signing status without promising a prompt-free launch. Publish only after these checks pass.

## Update, relocate or roll back

Quit Launcher from its tray first. Keep `data`, replace **only** `app` with the extracted version, then launch its executable. To roll back, restore the prior `app` folder; this preview uses schema version 1. Keep a profile export/backup before updates. Backups of individual configuration files are under `data/backups`.

Moving the complete folder preserves the data relationship. Repoint project roots if projects moved separately. Startup is an explicit opt-in registration containing the executable/data paths; repair or disable it in Settings after relocation. Multiple different data directories are independent profiles.
