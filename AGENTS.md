# Working on FIT Launcher

Read `CONTRIBUTING.md` for product and code boundaries.
For factory setup, feature work, reviews, or merges, read `engineering.md`,
`MISSION.md`, and `FACTORY.md` before acting.

The factory is a supervised experiment on `dev`. Start feature branches from
`dev` and target PRs to `dev`. John owns promotion to `main` and releases.
Use pinned shared Archon SDLC workflows for factory AI steps. Local scripts
provide ordinary runtime resources and deterministic validation only.

Keep the preview and personal profiles separate from experiments. Test with
fictional data, isolated profiles, and fixture-owned processes. Builders must not
read `.factory/holdout/` or external holdout scenarios.

Diagnostics, provider availability, branch propagation, holdout isolation, and
Windows runtime calibration are prerequisites, not established facts. Keep
scheduling off and follow the initial human checkpoints in `FACTORY.md`.
