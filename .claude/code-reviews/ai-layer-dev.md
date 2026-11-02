# AI layer review: dev factory setup

Date: 2026-10-31. Scope: new operating guidance, mission, installer hooks, and
their references. This setup review is not an independent review of a delivered
feature and does not authorize a merge.

## AGENT FIXES

None outstanding in the authored instruction wiring. AGENTS.md has 18 lines;
engineering.md has 11. Local Markdown links resolve, JSON configuration parses,
and the installer-supplied hook/consumer/runtime sources match upstream bytes.
The product's future wizard direction is separated from current validation.

## HUMAN DECIDES

- `docs/factory-experiment.md`: Claude delivery/Codex review is now selected.
  Native role binding, account support, and source compatibility on CT109 remain
  unverified. Keep runtime bindings inactive until those checks pass.
- `docs/factory-experiment.md`: new factory paths fail the existing public-source
  allowlist. Resolve its intended dev/release treatment in an owner-reviewed issue;
  keep delivery held and the audit intact in the meantime.

## HUMAN READS

- `engineering.md:3`, `MISSION.md`, and `FACTORY.md`: guidance records John's dev-only
  experiment, customer wizard direction, and supervised checkpoints. Read these as
  the concrete setup proposal before promoting this local work.
- `.claude/settings.json:9`: pre/post commands invoke the unchanged upstream
  `.factory/hooks/holdout_fence.py`. Both commands and the complete 263-line script
  were read. Blocking pre-hook paths exit 2; post-hook logging is not enforcement.
  These hooks support Claude Code only, not Codex/Pi.

## HUMAN TESTS

- `FACTORY.md`: on existing CT109, verify branch propagation, native approval
  stops, provider/tier attribution, holdout isolation, and Windows runtime
  calibration before enabling delivery. Local representative hook probes returned
  0 for source access and 2 for holdout access and fence modification. They do not
  establish a live Claude hook integration or Codex/Pi protection.

## FYI

- The clean main-source baseline has 29 unit passes and 16/19 Electron passes;
  packaging, portable smoke, and the release audit pass. Three Stop-port failures
  keep that baseline unaccepted. No assertions were removed or loosened.
- The dev ordinary harness and formatting pass; its public-source audit fails on
  new installer files. No production source, CI, release workflow, dependency
  manifest, or version changed.
- CT109 source integration, model binding, independent holdouts, and schedule
  activation remain pending verified manual runs; provider roles are selected.
  The installed holdout and mutation files remain upstream scaffolding.
- Follow-through: the pinned consumer is installed in CT109's independent dev
  clone with separate Archon state. Doctor/list pass; native Claude Max sign-in
  is verified. Same-source model dry runs pass for Claude implementation and
  Codex review; cross-source packaged-command lookup still needs validation.
  Both native sign-ins are verified as of 2026-11-01. No live feature run was launched.
- No new GitHub branch protection was configured; written dev-only constraints
  must be verified against the actual runtime before any workflow can write.
