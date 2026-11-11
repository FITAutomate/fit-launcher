Preserve the boundaries in [CONTRIBUTING.md](CONTRIBUTING.md). Product direction
and out-of-scope items are in [MISSION.md](MISSION.md).

Keep main-process, preload and renderer responsibilities separate. The renderer
gets typed preload operations only. Windows work runs through the bounded helpers
in `resources/windows`.

A behavior change comes with a focused unit test, an Electron test when it
changes what the user sees, and passing "Windows checks" CI on the PR.
