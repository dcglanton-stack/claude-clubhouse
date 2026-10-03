# The Hub

A Claude Code mod: one plugin that adds a usage meter (with Clawd) above the prompt, a color picker, and a `/hub` pane that lists and toggles every feature.

## Using it

| You type | What happens |
| --- | --- |
| `/hub` | Opens the Hub pane: meters, on/off switches, a description of every feature |
| `/hub off` | Hides everything the Hub adds |
| `/hub on` | Brings it back |
| `/hub colors` | Opens the color picker |

The Hub loads in every session through `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`, which points at the `hub/` folder here. To unload it completely, remove that entry.

## What is in it

- **Usage meter**: Clawd rides a bar that drains as the 5-hour or weekly limit is used. Green and happy when full, red and wiped out near empty. Shows time to reset and a one-hour cache countdown from the last reply.
- **Context gauge** and **turn receipt**: optional extras above the prompt, off by default.
- **Colors**: accent, Clawd and background colors for everything the Hub draws, by preset, hex code, nudges or a described look. Can also write a Claude Code custom theme.

## Changing it

Tell Claude in any session: "in the Hub, ..." and it edits this repo. `CLAUDE.md` holds the rules it needs.

```bash
claude plugin validate hub
```

```bash
claude plugin test hub
```

## Layout

```
hub/
  .claude-plugin/plugin.json   manifest
  hooks/register.tsx           startup, then one line per feature
  hooks/features/              one file per feature
  hooks/lib/                   pure helpers: colors, Clawd drawing, formatting, defaults
  types/index.d.ts             the shape of everything the Hub remembers
  tests/                       tests run by `claude plugin test`
```
