# Claude Clubhouse

A Claude Code function-hooks plugin (a "mod"). The plugin is the `clubhouse/` folder; the repo root holds docs only. Load the `plugin-authoring` skill before editing: it names this build's API declarations.

## Commands

- `claude plugin validate clubhouse` after every edit. It must pass.
- `claude plugin test clubhouse` before every commit. It draws the band and every room on desktop and terminal.
- `helper/build.sh` after changing `helper/WindowTint.swift`. `window-tint --list` prints the on-screen windows for checking geometry.

## Rules the validator enforces

- `$` may only be passed to a function declared at the top of the same file. Never import a function that takes `$`.
- State atoms are declared in the file that uses them: `atom({ plugin: 'clubhouse', key: '...' } as const, initial)`. Shared defaults live in `hooks/lib/defaults.ts`.
- Every state key is declared in `types/index.d.ts`, which exports types only. `prefs` is `Shaped<Prefs>`: bump `PREFS_SHAPE` in `lib/defaults.ts` when `Prefs` changes in a way the old shape cannot be read as, so a live session that reloads never reads it. A new field that every reader takes with `??` (like `palette.text`) needs no bump, and not bumping keeps the live session's settings.
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
- Text the Clubhouse colors itself takes `look.ink` (the `ink` from `makeParts`): the user's Text color, or dark or light by `inkOn(background)` when that is automatic. `inkOn` is the one rule for the flip (`DARK_INK_FROM` in `lib/color.ts`); the helper's own fallback only serves hand-written configs.
- Everything the Clubhouse shows respects `prefs.isEnabled`.
- Keep the bar quiet: new bar items default to hidden.
- Form fields live in module variables (`draft` in `agents.tsx`), not state, so typing does not redraw the pane.
- Sections in a pane are bordered cards. `makeParts(elements, prefs, surface)` in `hooks/lib/parts.tsx` gives `card`, `note`, `plain`, `meter`, `ink`, `frame`, `picture`, `swatch` and `look`; use it in every new room.
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
- The session area is colored by `helper/WindowTint.swift`, a small AppKit program installed as `~/.claude/clubhouse-helper/window-tint` by `helper/build.sh`. It puts a click-through window over each Claude window holding three stacked backdrop layers, one color-matrix filter each (layers clamp between stages, chained filters in one layer do not). For a dark app: stage 1 lifts luminance toward white along a concave curve (`boost`, sent in `tint.json`), so the app's dim grey text lands near its body text; stage 2 moves every pixel onto the line from the Background to the Text color by its luminance, keeping its chroma; stage 3 paints the exact Background over everything as dark as the app's surfaces (up to 34.5/255, fading out over 10 levels). So every panel is exactly the picked color, flat, text is exactly the Text color, and borders, chips and dim text sit in between. A light app mirrors it (surfaces from 226/255 up; untested until the app is actually switched to light). The layers and filters are private Core Animation classes (`CABackdropLayer`, `CAFilter`); if they are missing the helper falls back to a plain translucent layer. A plain translucent layer, one affine remap, and a `curves` filter were all tried and rejected.
- The helper leaves the app's sidebar alone and follows the app's mode: from the Claude app's `config.json` it reads `bootFrameLayout` (sidebar width, collapsed) and `userThemeMode`, nothing else (that file also holds sign-in caches: never read or print any other key), cuts the sidebar strip and any window in front out of the layers' mask, and resolves `system` against the macOS appearance. It reads `~/.claude/clubhouse-helper/tint.json`, which every `keep` in Colors rewrites (`helperConfig` in `lib/appColor.ts`), and exits when disabled or when Claude quits. The mod reads the same mode with one `sh -c` (`READ_APP_MODE`: `plutil -extract userThemeMode` plus `defaults read`) at session start, on every `keep` and on the 30-second tick; there is no dark/light button, because a wrong answer there broke every color.
- While the helper covers the session (`lookOf(prefs, surface).tone` is set), the Clubhouse paints no backgrounds and draws its own edges instead: a frame around the bar and each room, card hairlines, and a border around the user's own prompts (`frameRow`), each at a set contrast against the Background. Everything the Clubhouse draws with its own colors sits under the helper too, so it draws the color that comes out as the wanted one: `lib/tone.ts` is the helper's maths in TypeScript (`shownFrom`) and its inverse (`pixelFor`), in Display P3 like the screen. Pictures go through `picture(...)` from `makeParts`, which rewrites every `fill`, `stroke` and `stop-color` (`recolor`) to that color as a `color(display-p3 ...)` style with a hex fallback; `Box` colors take `look.edge` and `look.hairline`. Never hand an `Svg` or a color straight to the app from a room. Change the helper's constants and `lib/tone.ts` together; the test measures both against screen readings.
- What the helper cannot show: anything on the far side of the Background from the Text color (darker than a dark background, lighter than a light one, either on a mid-bright one). `clearOn` moves such a color toward the Text color until it shows (and until headings reach 3:1, Clawd 1.5:1), which is why Clawd and the meter turn paler on a mid-bright background with light text.
- To see Clubhouse drawings under the helper without waiting for the turn to end: write a page of them to the scratchpad, open it in the built-in Browser pane (it sits inside the Claude window, under the overlay), then `screencapture -x -R` the window and sample pixels.
- The exact repaint of the app itself is the user's own Developer Mode route under Advanced in Colors (`lib/windowTint.ts`); keep that snippet to one style rule.
- No unnecessary comments.

## Release

Feature branches; every merge to `main` gets a version tag and a GitHub Release with notes. Bump `version` in `clubhouse/.claude-plugin/plugin.json` to match.

## This repo while a session is developing it

Sessions load the Clubhouse from `clubhouse/` via `CLAUDE_CODE_PLUGIN_DIRS`. A session that created the mod under `~/.claude/dev-mods/<session>/clubhouse` keeps its own copy; sync it with `rsync -a --delete clubhouse/ <that folder>/` after edits.
