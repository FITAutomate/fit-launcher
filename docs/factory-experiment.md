# Supervised factory experiment

John's decisions, 2026-10-31: experiment on `dev`, preserve the working preview,
reuse Archon on Tailscale CT109, and learn here before a separate FIT Docs MVP
rollout in December 2026. A separate factory CT is no longer planned.

## Agent and model options

Selected roles: Claude Code delivers; Codex performs independent review. John
reports an existing $100 Claude subscription and $20 ChatGPT Plus subscription.
Use subscription sign-in where supported. Exact model choices below remain
proposals until account access and actual workflow attribution are tested.

| Role                           | Proposed initial model                              | Usage approach                                                        |
| ------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------- |
| Routine delivery and repairs   | Claude Sonnet                                       | Existing Claude subscription                                          |
| Difficult planning/delivery    | Claude Opus                                         | Escalate when warranted, within existing subscription                 |
| Independent substantive review | GPT-6.1 Sol through Codex                           | Existing ChatGPT Plus sign-in; begin with high reasoning if supported |
| Future experiments             | Other role/model combinations; OpenRouter if needed | Explicitly selected later; no automatic paid fallback                 |

Plus currently lists Sol and Luna; Astra is not assumed available on this plan.
Keep early substantive reviews on Sol rather than selecting a smaller model only
to save usage. Monitor actual limits and pause work when a provider is exhausted.
API/OpenRouter billing is separate from subscription access; adding that route or
extra credits needs a deliberate owner decision.

Role separation is not established by small/medium/large tiers. The pinned
delivery composition includes review steps; review itself uses medium and large.
Verify native role/node binding before claiming those embedded reviews use Codex.
If the installed engine cannot bind them by role, use separately invoked shared
delivery/review workflows at human checkpoints, or resolve support upstream.
Preserve required internal reviews and do not make factory-local workflow copies.

The following alternatives remain available for later experiments:

| Option                 | Small tasks                       | Normal delivery                | Difficult work                    | Tradeoff                                                 |
| ---------------------- | --------------------------------- | ------------------------------ | --------------------------------- | -------------------------------------------------------- |
| Codex only             | GPT-6 Luna                        | GPT-6.1 Sol                    | GPT-6.1 Sol at greater effort     | Fits the stated Plus plan; verify account support        |
| Claude Code            | Sonnet 5.5                        | Sonnet 5.5                     | Opus 5.5                          | Supplied holdout hooks; Anthropic authentication         |
| Mixed (selected roles) | Claude Sonnet                     | Claude Sonnet                  | Claude Opus; Codex Sol reviews    | Separate delivery/review providers; prove actual routing |
| Pi                     | Account-supported efficient model | Account-supported coding model | Account-supported reasoning model | Flexible choice; more configuration to validate          |

Initial Codex review ID: `gpt-6.1-sol`; optional future lightweight ID: `gpt-6-luna`.
Begin with capable reviews and observe usage before optimizing cost. Different
model names do not establish reviewer independence. Tiers describe work size,
not roles; a mixed profile requires verified role/tier routing.

References checked for this proposal:
[official OpenAI models](https://learn.chatgpt.com/docs/models),
[subscription authentication](https://learn.chatgpt.com/docs/auth),
[Plus availability and billing](https://learn.chatgpt.com/docs/pricing?codex-pricing-plans=individual),
[official Claude models](https://platform.claude.com/docs/en/models/overview), and
[factory provider guidance](https://github.com/coleam00/ai-software-factory#the-three-files-that-are-yours).
Account and installed-provider availability still need testing.

## CT109 integration requirements

Reuse CT109's existing Archon service. Read-only inspection confirmed Archon
v0.12.1, binary revision `5f2b4841`, and an active `archon.service`. This differs
from the factory's exact source pin in `factory/pack.json`; version numbers alone
do not prove compatible workflows or runtime contracts. Do not replace or restart
the working service as part of this experiment.

The source checkout on CT109 is `/home/archon/dev/github/archon` at
`4ddbbecae82ad691ce5e2700a6ce5c363bc01196`; it also differs from the running binary.
A native workflow listing scoped to that checkout succeeds and includes shared
triage, plan, deliver, review, and validation. It does not list the factory's
`archon-loop`, `archon-holdouts`, `archon-verify-runtime`, or
`archon-verify-runtime-suite`. Check the complete required manifest before claiming
factory readiness. No service, checkout, provider settings, or schedule was changed
by this read-only inspection. Effective default tiers currently all use Claude;
the selected Claude-delivery/Codex-review split is not configured yet.

| Area       | Requirement or starting proposal                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Isolation  | Existing CT109; independent dev clone and experiment state; preserve other projects and live service   |
| OS         | Preserve CT109's existing OS and service configuration                                                 |
| Capacity   | Measure CT109 headroom for one issue before considering resource changes or another CT                 |
| Network    | Existing Tailscale access; preserve current exposure and credentials                                   |
| Tools      | Verify tools in the service's real execution environment; do not infer availability from the desktop   |
| Source     | App clone on published dev; verify existing shared workflows against the factory pin before installing |
| Secrets    | Existing Claude and ChatGPT subscription sign-ins where supported; preserve logins; no secrets in Git  |
| Holdouts   | External private storage for Codex/Pi/mixed; validate actual access separation                         |
| Recovery   | Retain configuration/receipts, snapshot before runtime upgrades, verify cleanup and disk use           |
| Scheduling | No timer or unattended loop; one manual issue at a time                                                |

The factory consumer currently invokes an exact pinned Archon source CLI, not an
arbitrary server URL or ambient binary. Reusing CT109 as a host does not establish
that the stock consumer can use its running server. Resolve that integration using
supported Archon capabilities; do not silently launch a second engine, bypass the
pin, or patch factory scripts to invoke providers directly.

Installation follow-through: the exact source CLI is staged on CT109 with its own
Archon state, and the full factory installer succeeds. No additional server or CT
was started. CT109's installed binary structurally validates all 12 required pack
workflows; the pinned source CLI discovers them without errors. This establishes
installation compatibility, not a live factory lap. See
[CT109 setup evidence](factory-ct109.md) for the exact runtime/state distinction.

CT109 handles orchestration/coding. Windows Electron verification needs
the existing GitHub Windows job and a real Windows desktop worker. Decide that
worker's identity, transport, and cleanup before runtime activation. The current
runtime host does not own remote machines: a CT-to-Windows bridge is an integration
to prove, not a configured feature.

## Customer wizard direction

Current journeys live in `harness/END-TO-END.md`. Future tasks become wizards with
prerequisites, understandable steps, verified completion, cancellation, and recovery.
Proposals for John to scope into issues:

1. Guided workspace/tool setup for a customer's projects.
2. Guided Git authentication for a stated operation; a PAT only where needed.
   Credential storage and permissions require an owner decision.
3. Guided shortcut/tool-location configuration and repair.
4. Guided profile transfer with preview and validation before replacement.

John selects the first feature after baseline review. Add each new journey with
its implemented feature. Community issues may supply suggestions later; John
retains product and execution decisions.

## Stages and exit criteria

| Stage             | Exit criterion                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Baseline          | Preserve clean-source receipts; explain and resolve failing checks                                      |
| Repo setup        | Reviewed scaffolding/mission on dev; working preview preserved                                          |
| CT109 integration | Existing runtime, shared workflows, source pin, and isolated state reconcile without disturbing service |
| Runtime readiness | Doctor/list and live Claude delivery/Codex review attribution through shared workflows                  |
| Branch isolation  | Native start point and PR base are dev, including children                                              |
| Windows adapter   | Exact candidate, fresh profile, observed assertions, owned cleanup                                      |
| Calibration       | Shared baseline verified, fault failed, wrong identity inconclusive                                     |
| First feature     | One selected issue passes scope, plan, runtime, and dev-merge checkpoints                               |
| Later scheduling  | John reviews actual costs/failures and explicitly enables it                                            |

`merge=approve` holds the final merge, not planning/implementation. For early
issues, use separate shared planning/delivery invocations or verified native gates.
Workflow changes belong upstream in the shared pack.

## Integration limits

- The clean-source baseline has three Stop-port test failures; see its report.
- The public-source audit rejects new factory paths outside its existing allowlist.
  Keep it intact; resolve the dev integration through an owner-reviewed issue.
- CT109 integration, model binding, independent holdouts, approval behavior, and shared
  runtime calibration remain pending. Placeholders are not acceptance evidence.
- Linked worktrees share consumer settings through the Git common directory.
  Use CT109's independent experiment clone; keep runtime controls out of the desktop checkout.
