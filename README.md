# Claude Clubhouse

A Claude Code mod: one plugin that adds a home button and a Clawd usage meter above the prompt, plus rooms for agents, commands and colors, all reached from one screen.

## Using it

| You do | What happens |
| --- | --- |
| Click the house on the bar, or type `/clubhouse` | Opens the home screen: rooms, your top commands, what is on the bar, usage |
| `/clubhouse off` | Hides everything the Clubhouse adds |
| `/clubhouse on` | Brings it back |
| `/clubhouse agents` | Agent HQ: agents at work, plus your own saved agents |
| `/clubhouse summary` | The last reply cut down to a few bullet points |
| `/clubhouse opinion` | Second opinion: ask Claude here, or an outside model, about the session without adding to it |
| `/clubhouse tools` | Tool rules: make Claude ask first, or block it, per tool; one-click money safeguard |
| `/clubhouse commands` | Every slash command, led by your most used and most recent |
| `/clubhouse bar` | Bar layout: add, remove and move bar items, add bars, make your own buttons |
| `/clubhouse usage` | Both limits, context and the cache timer, full size |
| `/clubhouse colors` | The color picker |
| `/clubhouse reset` | Puts colors, conversation tint and gap fill back to their defaults |

The Clubhouse loads in every session through `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`, which points at the `clubhouse/` folder here. To unload it completely, remove that entry.

## What is in it

- **Home button**: a house with a C behind it, in the middle of the bar.
- **Bar layout**: add or remove each bar item, move it left, center or right, and use up to three bars. Make your own buttons that type a prompt or command into the prompt box.
- **Summary**: a Summarize button on the bar shortens the last reply with a small model; Auto does it for every long reply.
- **Usage meter**: Clawd rides a bar that drains as the 5-hour or weekly limit is used. Green and happy when full, red and wiped out near empty. Shows time to reset and a one-hour cache countdown from the last reply.
- **Agent HQ**: each subagent drawn as Clawd in a suit and sunglasses, with Stand down and Dismiss. Create your own agents from a form, save them, pick their model (or let Auto pick the cheapest that fits), and send one out with a task; Claude is told what was dispatched.
- **Commands**: every slash command in collapsible groups (your own, built in, one per plugin) with a filter; clicking one puts it in the prompt box. Hide a skill, or a whole group, and it leaves the slash menu, Claude is no longer told about it, and Claude cannot use it. Hidden items can be shown again.
- **Tool rules**: every tool Claude has, grouped by connector, each set to Allowed, Ask first or Blocked. Ask first shows what Claude is about to send and runs nothing unless you allow it. The money safeguard turns Ask first on for every tool that places, changes or cancels an order or moves money.
- **Design**: follows `DESIGN.md` (Anthropic's style): serif headings, hairline borders, warm neutrals and one clay accent. The Anthropic palette and three ready-made looks are in Colors.
- **Tidy**: a bar button that fixes spelling and trims the draft in the prompt box with a small model; press it again to get your original back.
- **Readable controls**: buttons and text boxes get a contrasting backing when your background would hide them.
- **Conversation tint**: paints your background behind every conversation row by wrapping the app's own drawing, so nothing is lost. Fill the gaps (experimental, soft or full) stretches the color between rows and inside the rooms.
- **Whole-window tint**: the text box, footer, tab strip and sidebar belong to the Claude app. Colors copies a one-line style rule you paste into the app's own DevTools console (Help, Troubleshooting, Enable Developer Mode) to tint the entire window until it reloads.
- **Second opinion**: ask Claude in this session, or a different model that sees only an excerpt, without the question or answer entering the conversation.
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
