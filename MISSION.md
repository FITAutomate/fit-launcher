# FIT Launcher mission

Owner: John. Reconciled on 2026-10-31 with the existing README, CONTRIBUTING,
and John's direction.

## Product and audience

FIT Launcher is a portable Windows home for quick tasks across local projects.
It helps non-developer customers find their projects, open the right tools, and
complete setup and configuration with clear steps and observable results.
John can configure those steps for a customer's particular task.

The current preview provides discovery, launch cards, port inspection, profile
transfer, and an initial directory-selection wizard. Guided customer setup is the
next product direction. Git authentication/PAT setup is an example of future work,
not a capability the app has already delivered.

## In scope

- Preserve the useful local workflows of the portable Windows preview.
- Turn setup and configuration tasks into understandable, repeatable wizards.
- Let John configure a customer's intended task and explain what success means.
- Show prerequisites, progress, failures, cancellation, and next steps plainly.
- Verify the real result of a step before describing it as successful.
- Improve discovery, launch cards, port inspection, accessibility, and profile repair.

## Out of scope

1. Embedding the development factory or an autonomous coding agent in the customer app.
2. Becoming a background service supervisor or automatically restarting projects.
3. Tracking, deduplicating, or controlling every external application's windows.
4. Requiring FIT infrastructure, an organization registry, or a cloud account for local use.
5. Running arbitrary scripts found in projects, imported profiles, or downloaded guides.
6. Silently editing shell profiles, elevating privileges, or changing authentication.
7. Collecting, sharing, or committing customers' credentials, profiles, or workspace logs.

Cross-platform packages are deferred during this Windows preview, rather than
permanently forbidden. Credential handling and configurable wizard execution need
explicit designs before implementation.

## Invariants

- The runnable app and personal data remain separate; updates preserve user data.
- Wizard steps explain meaningful changes and require explicit user action for
  authentication, permissions, system configuration, or deletion.
- A PAT is a credential, not a prerequisite to every Git task. Establish the actual
  authentication requirement before designing that example wizard.
- Test with fictional fixtures and isolated profiles. Stop tests terminate only
  fixture-owned processes; external registry bytes remain unchanged.
- Existing validation journeys describe current behavior. Add future wizard
  journeys with the feature that implements them, not before it exists.
- Governance, the judge, and release policy remain owner-controlled.

## Development and acceptance

The Archon SDLC pack builds on `dev`: branches start from `dev` and PRs target
`dev`. John decides when `dev` is promoted to `main`. Existing releases and
personal profiles are not experimentation targets.

John drives features and approves scope. Community issues may become an input
later; an issue alone does not authorize implementation or publication. Until
John changes this rule, he tries each feature on Windows and accepts it before
it merges.

Done means the "Windows checks" CI passes, the pack's review is Ready, and John
accepts the customer experience. Ordinary test success alone is insufficient.

## Human-owned decisions

John owns feature selection, customer suitability, credential/identity design,
stored-data changes, promotion to `main`, and release publication. Scheduling stays
off until he has watched a complete issue and explicitly chooses to enable it.
FIT Docs is a separate intended December 2026 rollout; Launcher is the testing ground.
