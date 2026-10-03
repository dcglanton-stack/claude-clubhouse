# Claude Clubhouse

A Claude Code function-hooks plugin (a "mod"). The plugin is the `clubhouse/` folder; the repo root holds docs only. Load the `plugin-authoring` skill before editing: it names this build's API declarations.

## Commands

- `claude plugin validate clubhouse` after every edit. It must pass.
- `claude plugin test clubhouse` before every commit. It draws the band and every room on desktop and terminal.
- `helper/build.sh` after changing `helper/WindowTint.swift`. `window-tint --list` prints the on-screen windows for checking geometry.

## Rules the validator enforces

- `$` may only be passed to a function declared at the top of the same file. Never import a function that takes `$`.
- State atoms are declared in the file that uses them: `atom({ plugin: 'clubhouse', key: '...' } as const, initial)`. Shared defaults live in `hooks/lib/defaults.ts`.
- Every state key is declared in `types/index.d.ts`, which exports types only. `prefs` is `Shaped<Prefs>`: bump `PREFS_SHAPE` in `lib/defaults.ts` whenever `Prefs` changes, so a live session that reloads never reads the old shape.
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
- `Button`, `Input`, `Select` and `Markdown` come from `makeParts`, never straight from `elements`: the wrapped versions add a backing chip when the user's background is in the opposite light/dark family to `prefs.appMode`, which keeps the app-drawn controls readable.
- What a mod can color: the bar, the rooms, and every conversation row. Rows are tinted by wrapping `await next(e)` in `tintRow` (`lib/parts.tsx`), never by redrawing them, so the app's own row features survive. The desktop app clips each row and panel to its own box: negative margins and absolute slabs do nothing there (tried 2026-10-03), so a mod cannot fill the gaps between rows.
- What a mod cannot color: the gaps between rows, the composer, the footer controls, the pane tab strip, the title bar and the sidebar. They are app chrome, not render sites. The app paints from two built-in sets of CSS variables and rejects the remote-debugging switch. Never patch the app, write its `developer_settings.json`, or script its window.
- The session area is colored by `helper/WindowTint.swift`, a small AppKit program installed as `~/.claude/clubhouse-helper/window-tint` by `helper/build.sh`. It puts a click-through window over each Claude window holding a backdrop layer with one color-matrix filter: output color is the picked Background, output alpha is 1 for pixels as dark as the app's surfaces (up to 34.5/255, fading out over 22 levels) and 0 for anything brighter. So every panel becomes exactly the picked color, flat, while text, icons, chips and borders show through untouched. Light mode keys on bright pixels instead (untested). The backdrop layer and filter are private Core Animation classes (`CABackdropLayer`, `CAFilter`); if they are missing the helper falls back to a plain translucent layer. A plain translucent layer, an affine color remap and chained matrices were all tried and rejected: they tint, keep the app's shade steps, or do not clamp.
- The helper leaves the app's sidebar alone: it reads `bootFrameLayout` (sidebar width, collapsed) from the Claude app's `config.json` and cuts that strip, and any window in front, out of the layer's mask. It reads `~/.claude/clubhouse-helper/tint.json`, which every `keep` that can change the answer rewrites (`lib/appColor.ts` builds it), and exits when disabled or when Claude quits. While it covers the session (`coversApp(prefs)`), the Clubhouse paints no backgrounds of its own (`paintOf`) and instead draws a border around the bar and each room (`edgeOf`), because the flat color removes the app's own panel edges. A Background from the other family than the app's mode is never sent to the helper (`fitsApp`): the app's text would be unreadable on it.
- The exact repaint of the app itself is the user's own Developer Mode route under Advanced in Colors (`lib/windowTint.ts`); keep that snippet to one style rule.
- No unnecessary comments.

## Release

Feature branches; every merge to `main` gets a version tag and a GitHub Release with notes. Bump `version` in `clubhouse/.claude-plugin/plugin.json` to match.

## This repo while a session is developing it

Sessions load the Clubhouse from `clubhouse/` via `CLAUDE_CODE_PLUGIN_DIRS`. A session that created the mod under `~/.claude/dev-mods/<session>/clubhouse` keeps its own copy; sync it with `rsync -a --delete clubhouse/ <that folder>/` after edits.
