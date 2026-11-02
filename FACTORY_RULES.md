# Factory rules

Follow `MISSION.md` for intent and `FACTORY.md` for checkpoints. All factory AI
steps use pinned shared Archon SDLC workflows. Ordinary scripts prepare apps, run
deterministic checks, and capture evidence; they do not invoke agents, choose
stages, or authorize merges.

Develop from `dev` and target PRs to `dev`. Hold promotion to `main`, release
tags, publication, deployment, and scheduling for John's separate decision.
Early issues require scope, plan, runtime/demo, and merge checkpoints.

Keep existing tests and release checks. Report missing, failed, stale, or
unavailable evidence explicitly. Changes to governance, CI, the harness, or the
public-source audit require owner review. Do not weaken them to conceal an
integration failure.

Authentication/authorization changes and stored-data migration or deletion need
a human decision before execution. A wizard can explain an approved flow; secrets
stay out of profiles, logs, screenshots, issues, commits, and factory evidence.

Builders do not read independent holdouts. The shared holdout writer/verifier
owns them. Validate isolation for the chosen provider; Claude hooks do not protect
Codex or Pi sessions.
