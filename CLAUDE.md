# The Hub

A Claude Code function-hooks plugin (a "mod"). The plugin is the `hub/` folder; the repo root holds docs only. Load the `plugin-authoring` skill before editing: it names this build's API declarations.

## Commands

- `claude plugin validate hub` after every edit. It must pass.
- `claude plugin test hub` before every commit. It draws the band and both panes on desktop and terminal.

## Rules the validator enforces

- `$` may only be passed to a function declared at the top of the same file. Never import a function that takes `$`.
- State atoms are declared in the file that uses them: `atom({ plugin: 'hub', key: '...' } as const, initial)`. Shared defaults live in `hooks/lib/defaults.ts`.
- Every state key is declared in `types/index.d.ts`, which exports types only.
- One `session.start` hook for the whole plugin. It lives in `hooks/register.tsx`; startup work for a new feature goes there.
- Matchers use string literals (`requestId: 'hub'`), not imported constants.

## Adding a feature

1. Create `hooks/features/<name>.tsx` exporting `<name>(on: On)`.
2. Add one line to `hooks/register.tsx`.
3. Declare any new state in `types/index.d.ts`.
4. Give it an on/off switch and a one-line description on the Home pane (`hooks/features/home.tsx`), and remove it from `PLANNED` there.
5. A feature with its own screen opens its own pane (`$.ui.open({ id: 'hub-<name>' })`); panes show as tabs.
6. Add a test in `tests/`.

## Conventions

- `hooks/lib/` is pure: no `$`, no hooks. `clawd.ts` and `color.ts` import nothing, so `node` can run them directly for previews.
- Desktop draws with `Svg`; the terminal has none, so every `Svg` needs a text fallback (`'Svg' in elements`).
- Text on a user-chosen background takes `inkOn(background)` so it stays readable.
- Everything the Hub shows respects `prefs.isEnabled`.
- No unnecessary comments.

## Release

Feature branches; every merge to `main` gets a version tag and a GitHub Release with notes. Bump `version` in `hub/.claude-plugin/plugin.json` to match.

## This repo while a session is developing it

Sessions load the Hub from `hub/` via `CLAUDE_CODE_PLUGIN_DIRS`. A session that created the mod under `~/.claude/dev-mods/<session>/hub` keeps its own copy; sync it with `rsync -a --delete hub/ <that folder>/` after edits.
