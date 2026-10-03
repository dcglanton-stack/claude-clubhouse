# Claude Clubhouse

A Claude Code function-hooks plugin (a "mod"). The plugin is the `clubhouse/` folder; the repo root holds docs only. Load the `plugin-authoring` skill before editing: it names this build's API declarations.

## Commands

- `claude plugin validate clubhouse` after every edit. It must pass.
- `claude plugin test clubhouse` before every commit. It draws the band and every room on desktop and terminal.

## Rules the validator enforces

- `$` may only be passed to a function declared at the top of the same file. Never import a function that takes `$`.
- State atoms are declared in the file that uses them: `atom({ plugin: 'clubhouse', key: '...' } as const, initial)`. Shared defaults live in `hooks/lib/defaults.ts`.
- Every state key is declared in `types/index.d.ts`, which exports types only.
- One hook per event without a matcher: one `session.start` (in `hooks/register.tsx`; startup work for a new feature goes there), one `turn.complete` (`usage.tsx`), one `command.run` (`commands.tsx`, which counts every command and answers `/clubhouse`).
- Matchers use string literals (`requestId: 'clubhouse'`), not imported constants.

## Adding a feature

1. Create `hooks/features/<name>.tsx` exporting `<name>(on: On)`.
2. Add one line to `hooks/register.tsx`.
3. Declare any new state in `types/index.d.ts`.
4. A feature with its own screen is a room: add it to `ROOMS` in `hooks/lib/defaults.ts` and render pane `clubhouse-<name>`; the home screen and `/clubhouse <word>` pick it up.
5. A feature on the bar gets an on/off switch with a one-line description in `BAND_TOGGLES` (`hooks/features/home.tsx`).
6. Remove it from `PLANNED` in `home.tsx` and add a test in `tests/`.

## Conventions

- `hooks/lib/` is pure: no `$`, no hooks. `clawd.ts`, `icon.ts` and `color.ts` import nothing, so `node` can run them directly for previews.
- Only `Button` is clickable; an `Svg` is a picture, so pair an icon with a `Button`.
- A pane that shows engine lists (`$.ui.panes()`, `$.agent.list()`) reads the `pulse` atom, and whatever changes those lists bumps it, so the pane redraws.
- Desktop draws with `Svg`; the terminal has none, so every `Svg` needs a text fallback (`'Svg' in elements`).
- Text on a user-chosen background takes `inkOn(background)` so it stays readable.
- Everything the Clubhouse shows respects `prefs.isEnabled`.
- Keep the bar quiet: new bar items default to off.
- No unnecessary comments.

## Release

Feature branches; every merge to `main` gets a version tag and a GitHub Release with notes. Bump `version` in `clubhouse/.claude-plugin/plugin.json` to match.

## This repo while a session is developing it

Sessions load the Clubhouse from `clubhouse/` via `CLAUDE_CODE_PLUGIN_DIRS`. A session that created the mod under `~/.claude/dev-mods/<session>/clubhouse` keeps its own copy; sync it with `rsync -a --delete clubhouse/ <that folder>/` after edits.
