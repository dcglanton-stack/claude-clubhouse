# Claude Clubhouse

A Claude Code mod: one plugin that adds a home button and a Clawd usage meter above the prompt, plus rooms for agents, commands and colors, all reached from one screen.

## Using it

| You do | What happens |
| --- | --- |
| Click the house on the bar, or type `/clubhouse` | Opens the home screen: rooms, your top commands, what is on the bar, usage |
| `/clubhouse off` | Hides everything the Clubhouse adds |
| `/clubhouse on` | Brings it back |
| `/clubhouse agents` | Agent HQ: every agent working in the session, with a stop button |
| `/clubhouse commands` | Every slash command, led by your most used and most recent |
| `/clubhouse colors` | The color picker |

The Clubhouse loads in every session through `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`, which points at the `clubhouse/` folder here. To unload it completely, remove that entry.

## What is in it

- **Home button**: a house with a C behind it, in the middle of the bar.
- **Bar layout**: show or hide each bar item, move it left, center or right, and stack items on a second bar.
- **Usage meter**: Clawd rides a bar that drains as the 5-hour or weekly limit is used. Green and happy when full, red and wiped out near empty. Shows time to reset and a one-hour cache countdown from the last reply.
- **Agent HQ**: each subagent drawn as Clawd in a suit and sunglasses, with Stand down and Dismiss. Create your own agents from a form, save them, pick their model (or let Auto pick the cheapest that fits), and send one out with a task; Claude is told what was dispatched.
- **Commands**: the full slash-command list with a filter; clicking one puts it in the prompt box.
- **Colors**: accent, Clawd and background colors for everything the Clubhouse draws, by preset, hex code, nudges or a described look. Can also write a Claude Code custom theme.
- **Context gauge** and **turn receipt**: optional extras on the bar, off by default.

## Changing it

Tell Claude in any session: "in the clubhouse, ..." and it edits this repo. `CLAUDE.md` holds the rules it needs.

```bash
claude plugin validate clubhouse
```

```bash
claude plugin test clubhouse
```

## Layout

```
clubhouse/
  .claude-plugin/plugin.json   manifest
  hooks/register.tsx           startup, then one line per feature
  hooks/features/              one file per feature
  hooks/lib/                   pure helpers: colors, drawings, formatting, defaults
  types/index.d.ts             the shape of everything the Clubhouse remembers
  tests/                       tests run by `claude plugin test`
```
