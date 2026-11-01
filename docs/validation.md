# Validation and workshop route

The preview is tested on **Windows 11 x64**, Node 24.12.0 for development and Electron 45.0.0 for runtime. The packaged app bundles its runtime. Windows PowerShell 5.1 supplies TCP/CIM observations through hidden packaged helpers.

## Repeatable evidence

| Gate                     | Coverage                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`      | Main, preload, renderer and test types                                                                                                                                                                                                        |
| `npm test`               | Root traversal/remapping, nested discovery/worktrees/junction loop, GitHub normalization, process evidence, conflicts, source preservation, revision/backups, transfer schemas, hostile AST import, literal shell export and action arguments |
| `npm run test:electron`  | Clean wizard, two scan roots, discovery/add/edit/repair/remove, snapped card persistence/restart, conventional views, local/connected registry, previewed profile transfer, tray lifecycle and real-helper Stop                               |
| `npm run test:portable`  | Extracted ZIP, spaces/Unicode, no Node/npm/Git on PATH, sibling data, relocation and app-only replacement                                                                                                                                     |
| `npm run audit:release`  | Public source allowlist, private-path/token patterns, unpacked ZIP and ASAR contents, absent personal profile, checksum                                                                                                                       |
| GitHub Windows workflows | Lockfile install, checks, packaging, portable smoke and asset audit on the committed source                                                                                                                                                   |

Disposable-listener tests call the production Stop helper through the UI. They record created PIDs, verify termination, reuse the port with a new process, verify stale-owner refusal and clean up only fixture-owned processes. Tests do not kill existing local services or touch a user's shell profile.

The terminal integration test clicks the real card action with a portable app path containing spaces and a project path containing Unicode, apostrophes, brackets and shell punctuation. It verifies a visible, uniquely titled top-level console window and a live interactive shell after bootstrap completes and after Launcher exits. A fixture-only close signal exits that shell cleanly. The native ShellExecute helper creates the new console without inheriting Launcher's ignored standard handles; file/folder arguments remain literal. Set `FIT_TERMINAL_TEST_ZIP` to run the same card-action test against an isolated copy of the actual packaged ZIP. The test observes window visibility without sending terminal input or changing system settings.

Appearance coverage: `tests/theme.test.ts` checks System defaults for new and legacy profiles, invalid values and profile save/reload/transfer. `tests/theme.spec.ts` checks the initial Windows preference, emulated live system color-scheme changes, Light/Dark overrides, restart persistence and return to System. It captures both palettes across Launch, Discovered, Ports and Settings using an isolated fixture profile. System changes are emulated without modifying Windows settings.

Isolated app profiles are not a pristine OS test. Windows Sandbox was unavailable on the local test host; a clean Windows machine/VM run has **not** been performed. Host tools, drivers and policies may differ from an attendee's machine. The app is unsigned; downloaded-file reputation behavior depends on Windows and device policy.

## Five-minute demo

1. Open Launcher and show the movable board. Rename/reposition a card and switch views to demonstrate persistence.
2. Open Explorer from a card, check a file, close that Explorer window and return to the still-open Launcher.
3. Open a terminal in the same folder, run `Get-Location`, close that terminal and return to Launcher. Repeat with an installed editor and the GitHub repository page.
4. Inspect Ports: listening assignments first, system services separate, unknown identity labelled honestly. Only demonstrate Stop with a disposable test server.
5. Open an isolated `--data-dir` profile to show the neutral welcome screen, choose attendee directories and add a discovered project.
6. Point attendees to the runnable release ZIP. Installation is optional; the first useful outcome is a clear demonstration of quick tasks with less window clutter.

The demonstrator manually closes external tools. The app does not track or deduplicate their windows. Closing Launcher's own window hides it to the tray; use Quit to exit it.
