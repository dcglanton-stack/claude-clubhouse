# Claude Clubhouse

A Claude Code function-hooks plugin (a "mod"). The plugin is the `clubhouse/` folder; the repo root holds docs only. Load the `plugin-authoring` skill before editing: it names this build's API declarations.

## Commands

- `claude plugin validate clubhouse` after every edit. It must pass.
- `claude plugin test clubhouse` before every commit. It draws the band and every room on desktop and terminal.

## Rules the validator enforces

- `$` may only be passed to a function declared at the top of the same file. Never import a function that takes `$`.
- State atoms are declared in the file that uses them: `atom({ plugin: 'clubhouse', key: '...' } as const, initial)`. Shared defaults live in `hooks/lib/defaults.ts`.
- Every state key is declared in `types/index.d.ts`, which exports types only.
- One hook per event without a matcher: one `session.start` (in `hooks/register.tsx`; startup work for a new feature goes there), one `turn.complete` (`usage.tsx`), one `command.run` (`commands.tsx`, which counts every command and answers `/clubhouse`), one `tool.call` (`tools.tsx`).
- Matchers use string literals (`requestId: 'clubhouse'`), not imported constants.

## Adding a feature

1. Create `hooks/features/<name>.tsx` exporting `<name>(on: On)`.
2. Add one line to `hooks/register.tsx`.
3. Declare any new state in `types/index.d.ts`.
4. A feature with its own screen is a room: add it to `ROOMS` in `hooks/lib/defaults.ts` and render pane `clubhouse-<name>`; the home screen and `/clubhouse <word>` pick it up.
5. A feature on the bar is a bar item: add it to `BAR_ITEMS`, `DEFAULT_BAR` and `BarLayout`, and draw it in `piece()` in `hooks/features/band.tsx`. The Bar layout tab picks it up.
6. Remove it from `PLANNED` in `home.tsx` and add a test in `tests/`.

## Conventions

- `hooks/lib/` is pure: no `$`, no hooks. `clawd.ts`, `icon.ts` and `color.ts` import nothing, so `node` can run them directly for previews.
- Only `Button` is clickable; an `Svg` is a picture, so pair an icon with a `Button`.
- A pane that shows engine lists (`$.ui.panes()`, `$.agent.list()`) reads the `pulse` atom, and whatever changes those lists bumps it, so the pane redraws.
- Text on a user-chosen background takes `inkOn(background)` so it stays readable.
- Everything the Clubhouse shows respects `prefs.isEnabled`.
- Keep the bar quiet: new bar items default to hidden.
- Form fields live in module variables (`draft` in `agents.tsx`), not state, so typing does not redraw the pane.
- Sections in a pane are bordered cards. `makeParts(elements, palette)` in `hooks/lib/parts.tsx` gives `card`, `note`, `plain`, `meter`, `ink` and `frame`; use it in every new room.
- Panes are narrow and a cell is not a fixed pixel width on desktop: never use fixed-width columns. Put a button on one line and its description, wrapped, on the next, with `gap={1}` between entries.
- Every feature with a screen is a room that opens as its own tab, including features that also sit on the bar.
- A `$` helper needed in several files is copied into each (see `summarize`); keep its logic in a pure `lib/` function so the copies stay a few lines.
- Hidden skills are enforced in three places in `commands.tsx`: `command.describe` (slash menu), `prompt.attachment` for `skill_listing` (what Claude is told) and `tool.call` for `Skill` (what Claude can run). Keep all three in step.
- Design follows `DESIGN.md` at the repo root. Mods cannot set a font on `Text` (the app's own font is used), so headings are serif SVGs from `makeParts` (`title`, `heading`, `card`); never hand-roll a heading. Borders are hairlines in Cloud Dark; clay is for headings and the primary action only.
- Every surface accepts `Svg`, and the terminal draws only its alt text. Decide with `e.surface !== 'terminal'` (`canDraw`), not with `'Svg' in elements` alone.
- Tool rules are enforced by the one unmatched `tool.call` hook in `tools.tsx`; it fails closed (no answer means deny) and ignores `prefs.isEnabled` on purpose.
- Button keys must be unique within a pane: give a second listing of the same items its own key prefix.
- No unnecessary comments.

## Release

Feature branches; every merge to `main` gets a version tag and a GitHub Release with notes. Bump `version` in `clubhouse/.claude-plugin/plugin.json` to match.

## This repo while a session is developing it

Sessions load the Clubhouse from `clubhouse/` via `CLAUDE_CODE_PLUGIN_DIRS`. A session that created the mod under `~/.claude/dev-mods/<session>/clubhouse` keeps its own copy; sync it with `rsync -a --delete clubhouse/ <that folder>/` after edits.
