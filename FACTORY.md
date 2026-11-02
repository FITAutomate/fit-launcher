# FIT Launcher factory operations

Status: full pinned consumer installed on CT109 in an independent `dev` clone;
Claude delivery and Codex review profiles are prepared; both native sign-ins are
verified. Live provider attribution, runtime calibration, and baseline repairs
remain pending. No scheduler is installed.
See [CT109 setup evidence and commands](docs/factory-ct109.md).

## Isolation and source

The working `main` checkout and released app stay separate from the `dev` checkout.
Reuse Archon on Tailscale CT109 with an independent experiment clone and state.
John confirmed that a separate factory CT is unnecessary.
Consumer settings and STOP/PAUSE files resolve through Git's common directory:
linked worktrees do not isolate these machine-local controls. Do not initialize
the full runtime in the linked local experiment worktree.

Factory templates came from `coleam00/ai-software-factory` at
`f6d8f69e452607ceedc6d42f2ed0398db543ba71`. Archon's pin is in `factory/pack.json`.
Desktop setup used `factory.py init --scaffold-only`; CT109 subsequently ran the
full installer successfully. The consumer uses its exact pinned source CLI with
isolated Archon state on the existing CT, without starting another server or
changing the running service. Provider-native homes stay unchanged. The consumer
does not attach to the existing server's API. Installed Claude hooks do not
protect Codex review sessions.

## Before the first issue

1. Investigate the failures in `docs/factory-baseline.md` without weakening tests.
2. Publish the reviewed setup on `dev` when John requests the setup commit/push.
3. Check CT109 runtime compatibility and capacity using `docs/factory-experiment.md`.
4. Prepare isolated dev checkout/state and native Claude-delivery/Codex-review
   bindings on CT109, preserving existing service settings and subscription logins.
5. Run consumer `doctor` and `list`, then a live provider probe through a shared
   workflow. Diagnostics alone do not establish provider readiness.
6. Verify worktree start point, run base, child workflows, and resulting PR base
   are all `dev` before enabling any delivery workflow.
7. Generate independent holdouts through `archon-holdouts`; calibrate shared
   runtime verification against the delivered Windows candidate.
8. Prove native approval boundaries. If a workflow crosses a requested checkpoint
   without stopping, keep it disabled and resolve that behavior upstream.

The pinned CLI declares `--from dev` and `--base dev`. Verify their behavior with
CT109 before delivery. `archon-loop` picks across the whole board and has
no declared single-issue target input. Begin with issue-targeted shared workflows
and explicit human checkpoints; evaluate a supervised loop later.
`merge=approve` holds only the final merge, not implementation or planning.
The loop defaults to automatic merge if that input is omitted.

## Initial checkpoints

| Checkpoint      | John reviews                                   | Required evidence                         |
| --------------- | ---------------------------------------------- | ----------------------------------------- |
| Scope           | Selected issue, customer outcome               | Explicit bounded work order               |
| Plan            | Steps, permissions, recovery, proposed changes | Approval before implementation            |
| Runtime/demo    | Windows behavior and negative controls         | Current candidate and actual observations |
| Merge to dev    | Current-head independent review and CI         | John's explicit merge instruction         |
| Promote/release | Separate comparison with main                  | Separate promotion/release instruction    |

Use native gates or separate shared invocations between checkpoints; do not make
private workflow copies. Setup does not authorize a feature run, merge, or release.

Provider preference is role-based: Claude delivers, Codex independently reviews.
Follow the selected profile in `docs/factory-experiment.md`. Delivery includes
review nodes, so ordinary size tiers alone do not guarantee that split. Verify
the provider/model recorded for each review before accepting its evidence.
OpenRouter is a later option; it is not an automatic fallback or enabled billing path.

Prepared native per-run layers are `factory/profiles/delivery.yaml` and
`factory/profiles/review.yaml`. Pass one using the native `--config` flag to the
appropriate shared workflow; they do not change install-wide tiers.
The first supervised route retains the delivery workflow's required internal
reviews and then requests a separate Codex review of the current head. Internal
delivery reviews may still use Claude; only the separately attributed Codex
review satisfies the cross-provider acceptance checkpoint. Exact role overrides
inside a composition are not exposed by the inspected run-config schema.

## Validation and holdouts

Current journeys: `harness/END-TO-END.md`. Ordinary checks: `python harness/ci.py`.
The full Windows CI job stays required. The Electron runtime adapter is not yet
implemented or calibrated.

The installed holdout is an upstream placeholder, not project acceptance evidence.
A shared `archon-holdouts` run must write the real independent scenarios.
For Codex, Pi, or mixed providers, keep them outside builder checkouts and pass
`holdout=<private absolute path>` to every applicable workflow, including the
writer. Override the consumer's default repository holdout path explicitly.
External placement is not equivalent to Claude's hook enforcement; validate the
chosen isolation design before claiming builders cannot access those scenarios.

Require native shared results of baseline `verified`, substantive fault `failed`,
and wrong candidate `inconclusive`. Local test/build receipts do not establish
this calibration. Hold automatic operation until both baseline and calibration pass.

## Scheduling and release

No schedule configuration, trigger, timer, or factory service has been installed.
If John later enables scheduling, begin with base `dev`, parallelism 1,
`merge=approve`, and explicit holdout inputs. Inspect the binding before activation.

Factory work does not create release tags, dispatch releases, deploy, or promote
to `main`. The existing manual/tag release workflow is unchanged. These are
operating restrictions, not newly installed GitHub branch protections.
