# Factory baseline

Source: `d1bc108d88d1437ab64c70627d4b2664de36c1f8` (working preview on main).
Local date: 2026-10-31. Node 24.12.0, npm 11.8.0, Windows x64.

Commands ran in a separate clean detached worktree without factory files or
personal app data. Original checkout/builds/releases remain unchanged. Raw logs
and a JSON receipt are retained outside Git because they include host details.

| Check                | Result                                                            |
| -------------------- | ----------------------------------------------------------------- |
| Lockfile install     | Passed; npm reported 13 moderate and 1 high dependency advisories |
| Formatting           | Passed                                                            |
| Type checking        | Passed                                                            |
| Unit tests           | 29 passed in 7 files                                              |
| Electron integration | 16 passed, 3 failed                                               |
| Packaging            | Passed                                                            |
| Portable smoke       | Passed                                                            |
| Release audit        | Passed                                                            |

Failures are in `tests/stop-port.integration.spec.ts`: the Stop control was
unavailable, owner-replacement confirmation was not reached, and the expiry case
received an undefined listener instead of a confirmation-expired result.

A direct probe created a live loopback listener and invoked unchanged production
`snapshot.ps1`; its rows omitted that listener. This supports an observation-path
problem on this host, but does not establish the root cause or prove another
machine works. No source, assertion, or protection was changed to hide failures.

Baseline is **not accepted**. Packaging success does not clear runtime failures.
The built ZIP is a local baseline artifact, not an approved release. Actual artifact
identity and command receipts are in the private baseline JSON, linked from chat.

Artifact: `FIT-Launcher-0.1.0-preview.5-windows-x64.zip`.
SHA256: `4c3bf3d3d631825ce6fb448e5d6e3a6435e16cdf308e5966b870c23615632ee3`.

This is local test/build evidence, not Archon provider readiness, independent
holdouts, a CT-to-Windows bridge, or runtime evaluator calibration. Those require
the pinned shared workflows after CT preparation.
