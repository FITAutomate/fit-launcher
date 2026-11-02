# Factory setup on CT109

Recorded 2026-10-31. CT109 is the existing Tailscale Archon host. No additional CT,
server, scheduler, release, or feature run was created by this setup.

## Runtime boundary

| Component                     | Location or identity                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| Existing server               | `archon.service`, binary v0.12.1 at revision `5f2b4841`; remains active                                  |
| Existing source checkout      | `/home/archon/dev/github/archon`, revision `4ddbbecae82ad691ce5e2700a6ce5c363bc01196`; remains clean     |
| Factory application clone     | `/home/archon/dev/github/fit-launcher`, local branch `dev`                                               |
| Factory source                | `/home/archon/.cache/fit-launcher-factory/factory`, revision `f6d8f69e452607ceedc6d42f2ed0398db543ba71`  |
| Pinned CLI source             | `/home/archon/.cache/fit-launcher-factory/sources/1cfb8fc541580fe5edf15e9a504b572bc9bb45bb`, CLI v0.11.1 |
| Factory Archon state          | `/home/archon/.local/state/fit-launcher-factory`                                                         |
| Private installation receipts | `/home/archon/.cache/fit-launcher-factory/receipts`                                                      |

The stock consumer launches the pinned CLI, not an HTTP request to the running
server. The CLI's state directory is separate from the server's state. This keeps
the older factory pin out of the server's database and configuration. Factory runs
in that separate state are not automatically runs in the existing server's UI.
Native Claude/Codex user homes are preserved; provider credentials are not copied.

## Completed checks

- CT109 has 8 GiB RAM and about 52 GiB free disk at inspection.
- The factory's exact source pin is present, dependencies install with the frozen
  lockfile, and the reference checkout remains clean.
- CT109's installed binary validates each of the 12 required workflows individually.
  Warnings are retained in receipts; structural validation is not runtime proof.
- The pinned source CLI reports its expected revision and discovers the shared pack
  without errors under the dedicated Archon state.
- The full factory installer exits successfully and writes consumer settings in
  the independent application clone on `dev`.
- Consumer `doctor` and `list` pass and discover 20 shared SDLC workflows. Doctor
  reports that the local Claude holdout fence passes but is not committed/pushed;
  the installed holdout remains a placeholder rather than project verification.
- uv 0.13.6 is installed in the factory's private bin directory from the official
  Linux release archive, with its published SHA256 checked. The private directory
  also provides a `python` alias for the installed hooks. Shell profiles and the
  running service's PATH are unchanged.

## Operator commands

The private bin directory contains two thin entrypoints: `factory` sets this
experiment's state/PATH and invokes the installed consumer; `archon-factory` does
the same for the pinned native CLI. They do not invoke providers or select stages.

```bash
/home/archon/.local/state/fit-launcher-factory/bin/factory doctor
/home/archon/.local/state/fit-launcher-factory/bin/factory list
```

Delivery uses `factory/profiles/delivery.yaml`; a separate independent final review
uses `factory/profiles/review.yaml`, via the native `--config` flag. Required
embedded delivery reviews are retained and may use Claude. They are not presented
as the independently attributed Codex review.

Model preflight inside the pinned source succeeds with native dry runs: the
shared implementation step resolves to Claude Opus, and six selected review nodes
resolve to Codex GPT-6.1 Sol at high effort. The shared implementation requests the
large tier, so this profile selects Opus there; Sonnet applies to small/medium
nodes. These are resolution checks, not live provider calls.

Two dry-run limitations were retained in the receipts. Using the separate
application as cwd with `--workflow-source` caused packaged command lookup to use
the application path. Automatic review stubs also failed on a nullable object
schema. A same-source dry run using the shared review fixture's node data passes.
That does not clear the cross-source path issue; verify the actual delivery path
before any live feature run. No source or workflow was patched to hide the failure.

## Authentication and remaining gates

Verified 2026-11-01: native Claude sign-in reports `loggedIn: true`,
`authMethod: claude.ai`, and `subscriptionType: max`. Native Codex `login status`
exits 0 and reports `Logged in using ChatGPT`. Both user sign-ins are complete.
The existing service's separate OpenAI credential is preserved; no token values
were copied between credential stores. Native sign-in status does not replace a
live workflow call proving provider/model attribution.

```bash
/home/archon/.archon/vendor/codex/codex login --device-auth
```

That command is retained for future reauthentication only. Sign in with the
existing Plus account and verify with the same binary's `login status`.

Keep live delivery held until live provider/model attribution is proven,
`dev` branch propagation is verified, the Stop-port baseline failures and factory
public-source audit integration are resolved, and shared runtime calibration and
independent holdouts pass. All existing human checkpoints remain in `FACTORY.md`.
No scheduling is enabled.
The independent clone also has the consumer's local STOP brake set. Clear it only
when the remaining gates are resolved; it does not affect the running server.
