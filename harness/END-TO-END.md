# Current FIT Launcher journeys

Existing preview behavior, described as a person's setup/configuration tasks.
Start every attempt with a fresh disposable profile and fixture directories.
Only journey 1 currently has a dedicated welcome wizard. New customer wizards,
including Git authentication, are future work in `docs/factory-experiment.md`.

## 1. Set up a workspace and open a project

1. Open with an empty profile and reach the welcome wizard.
2. Choose two fixture directories containing at least one fixture repository.
3. Discover the repository and add a named launch card.
4. Open Explorer or a terminal from that card and verify the selected folder.
5. Close the external tool; Launcher stays available. Restart Launcher and
   verify the chosen roots and named card remain.

A real discovered project must become a useful persistent shortcut. An empty
screen or directly seeded final card does not establish success.

## 2. Configure and repair a shortcut

1. Add a shortcut through the UI; give it a meaningful name and group.
2. Reorder it alongside another card. Restart and verify the saved order.
3. Move its fixture directory and repair its folder through the card controls.
4. Verify it keeps its identity and opens the repaired destination.
5. Remove the shortcut and verify the directory still exists.

Repair preserves configuration; removal deletes only the bookmark.

## 3. Transfer configuration deliberately

1. Configure an isolated profile with a root and named shortcut, then export it.
2. In a second profile, select the export and inspect the import preview.
3. Confirm replacement and verify the named card and layout came across.
4. Verify startup, shell integration, and connected registry remain disabled
   after import. Verify a selected read-only registry's bytes are unchanged.

Success requires the preview/confirmation transition and observable imported data.

## 4. Inspect a port before stopping a disposable process

1. Start a fixture-owned TCP listener and register its port/range through the UI.
2. Inspect the port and compare its process identity with the fixture receipt.
3. Cancel Stop and verify the listener remains alive.
4. Inspect again, explicitly confirm Stop, and verify that fixture process exits.
5. Reuse the port with another fixture process; verify stale ownership and expired
   confirmation cannot terminate it. Clean up only owned fixture processes.

Listening is not health. Missing process observations hold this journey; they do
not justify skipping identity checks or terminating another process.

Shared verification must bind observations to the delivered candidate. Existing
Playwright evidence alone does not establish shared calibration or holdouts.
