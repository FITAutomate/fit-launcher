# Working on FIT Launcher

Read `CONTRIBUTING.md` for product scope, code boundaries and the check commands.
Read `engineering.md` before you change code. `MISSION.md` holds the product
direction and what is out of scope.

## Branches

- `dev` is the default branch. Start every branch from `dev` and target every PR
  to `dev`.
- John promotes `dev` to `main` and publishes releases. Do not open PRs to `main`
  and do not push tags.

## Validation

FIT Launcher is a Windows Electron app. The "Windows checks" CI workflow is the
only place the Electron and packaged-app tests run. A change is not done until
that workflow passes on the PR.

- Run `npm run format:check`, `npm run typecheck` and `npm test` before you push.
- When you add or change an Electron test (`tests/*.spec.ts`), make each selector
  match markup that the code renders. Read the component and the test together.
- Do not weaken, skip or retry a failing test to make CI pass. Fix the cause.

## Data

Test with fictional data, isolated profiles and processes that the test starts.
Never commit a real profile, registry, log, token or screenshot of a personal
workspace.
