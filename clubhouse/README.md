# Claude Clubhouse

A plugin for Claude Code that turns the space around your prompt into a place of your own. It adds a toolbar above the prompt and a set of rooms you open from it or with `/clubhouse`. On a Mac it can also color the whole Claude window.

It is a mod: code that runs inside Claude Code on your own computer. It is not an MCP connector and has no server.

Source and updates: https://github.com/dcglanton-stack/claude-clubhouse

## Contents

- [What you get](#what-you-get)
- [Where it works](#where-it-works)
- [Install](#install)
- [Use it](#use-it)
- [What it does on your computer](#what-it-does-on-your-computer)
- [Troubleshooting](#troubleshooting)
- [Every feature](#every-feature)
- [Change it yourself](#change-it-yourself)
- [License and credits](#license-and-credits)

## What you get

- **A toolbar above the prompt** that you lay out yourself: a usage meter where Clawd rides a bar that drains as you use your limit, the context gauge and cache timer, Summarize and Tidy buttons, a stock or coin price, a live score with team logos, the weather, a sketch pad, and buttons you make yourself.
- **Your colors, for real.** Pick a Background and the whole window becomes that color: the conversation, text box, toolbar and sidebar take shades of it, and things with their own color (window buttons, icons, logos) keep it. It works with the app in dark or light mode, and each project can have its own colors. This part needs macOS.
- **Rooms**, one screen each: your subagents and saved agents, every slash command, rules for what Claude may do with each tool, terminal commands saved as tools Claude can call, a timer that checks on things while you are away, notes left for a later session, a to-do list for the session you are in, usage, fonts and more.
- **It is yours to change.** Say "in the clubhouse, add a button that..." in any session and Claude edits your copy. Nothing you change leaves your computer.

## Where it works

| Where | Works |
| --- | --- |
| Claude desktop app, Code tab, **Local** session | Yes |
| Claude Code in the terminal | Yes, without the whole-window color |
| Cloud sessions (claude.ai/code, the phone app, Cloud in the desktop app) | No |
| claude.ai chat and Cowork | No |

Claude Code only draws a mod's toolbar and panes in sessions on your own computer, and a cloud session does not install plugins ([What carries over from your setup](https://code.claude.com/docs/en/cloud-environments#what-carries-over-from-your-setup), [Where mods run](https://code.claude.com/docs/en/plugins/mods/overview#where-mods-run)). Tested with Claude Code 2.1.286 on macOS.

## Install

Pick one way. With two, the Clubhouse loads twice, and settings do not carry over between them.

### From the Claude directory

1. Open the directory (**Customize** in the Claude app, or [claude.ai/directory](https://claude.ai/directory)), find Claude Clubhouse and add it.
2. Start a new Claude Code session on your computer, signed in to the same account.
3. Type `/clubhouse`.

The directory listing is under review; until it is live, use the next way.

### From the plugin marketplace on GitHub

1. In any Claude Code session, add the marketplace:

```
/plugin marketplace add dcglanton-stack/claude-clubhouse
```

2. Install the plugin:

```
/plugin install clubhouse@claude-clubhouse
```

3. Start a new session (in the desktop app, quit and reopen it first) and type `/clubhouse`.

**Update:** `/plugin marketplace update claude-clubhouse`

**Remove:** `/plugin uninstall clubhouse@claude-clubhouse`, then delete `~/.claude/clubhouse-helper`.

### Optional: the Mac helper

The whole-window color and the sketch pad need two small Mac programs, built once on your Mac. Everything else works without them.

- **Installed from GitHub:** type `/clubhouse build`. It takes under a minute.
- **Installed from the directory:** the build files are not part of a directory install. Clone this repository and run `helper/build.sh` in it.

If the build says Apple's command line tools are missing, run `xcode-select --install` and try again.

### For one project only

In a terminal in the project's folder, run these two commands, then start a new session there. They write to the project's `.claude/settings.json`.

```bash
claude plugin marketplace add dcglanton-stack/claude-clubhouse --scope project
```

```bash
claude plugin install clubhouse@claude-clubhouse --scope project
```

## Use it

| You do | What happens |
| --- | --- |
| Click the house on the bar, or type `/clubhouse` | Opens the home screen: rooms, your top commands, what is on the bar, usage |
| `/clubhouse off` | Hides everything the Clubhouse adds |
| `/clubhouse on` | Brings it back |
| `/clubhouse agents` | Agent HQ: agents at work, plus your own saved agents |
| `/clubhouse summary` | The last reply cut down to a few bullet points |
| `/clubhouse opinion` | Second opinion: ask Claude here, or an outside model, about the session without adding to it |
| `/clubhouse tools` | Tool rules: make Claude ask first, or block it, per tool; one-click money safeguard |
| `/clubhouse recipes` | Recipes: turn a terminal command into a tool Claude can call |
| `/clubhouse watch` | Night watch: check on things on a timer while you are away |
| `/clubhouse notes` | Session notes: leave a note for a later session |
| `/clubhouse to-do` | To-do: a scratchpad list for this session; `/clubhouse to-do call the bank` adds a task |
| `/clubhouse ticker` | Ticker: a stock or coin price on the toolbar, search and favorites |
| `/clubhouse sports` | Live sports: games on now and this week; one score on the toolbar |
| `/clubhouse weather` | Weather: the next 7 days where you are, and the weather on the toolbar |
| `/clubhouse fonts` | Fonts: the font of the Clubhouse headings |
| `/ship` | Release what is on main: next version tag, push, GitHub release with notes (asks first) |
| `/clubhouse commands` | Every slash command, led by your most used and most recent |
| `/clubhouse toolbar` | Toolbar: add, remove and move toolbar items, add rows, make your own buttons |
| `/clubhouse usage` | Both limits, context and the cache timer, full size |
| `/clubhouse colors` | The color picker |
| `/clubhouse color reset` | Puts the colors back to their defaults |
| `/clubhouse build` | Builds the helper for whole-window color (same as the Build the helper button in Colors) |

## What it does on your computer

This is the full list of what the mod runs, fetches, writes, reads and sends. The Clubhouse has no server of its own and sends nothing to its author.

### Tool calls and permissions

| Hook | What it does |
| --- | --- |
| `tool.call`, every tool | Applies the rule you set for that tool in the Tools room: refuses the call (Blocked) or asks you first (Ask first). Otherwise the call goes on unchanged to Claude Code's own permission check. It never approves a call for you and never changes a call's arguments. |
| `tool.call`, the `Skill` tool | Refuses a skill you hid in the Commands room. Other calls pass through unchanged. |
| `tool.call`, tools named `mcp__clubhouse__...` | Stands in for the tool. These are your recipes: terminal commands you typed and saved in the Recipes room. The hook asks Claude Code's permission system first, refuses on deny, asks you on ask, then runs your command and returns its output as the tool's result. It answers no other tool. |
| `agent.spawn` | Asks you before Claude starts a helper agent when your limit is under the spend cap you set. It changes nothing about the agent. |
| `agent.offer` | Hides agents you deleted. |

- **The one tool the mod calls itself:** `TaskStop`, when you press Stand down on an agent in Agent HQ.
- **Agents it starts:** only when you press Send in Agent HQ. The agent is given the task you typed and the instructions you saved for it, and nothing else. No file or conversation text is added. Saved agents are registered with `permissionMode: 'default'` and no hooks, so they ask for permission as usual.

### Programs it starts

| Program | When and why |
| --- | --- |
| `~/.claude/clubhouse-helper/window-tint` | The window color helper, if you built it. Started through `/bin/sh -c` when colors are on. Also run with `--pixels <file>` to read a logo's colors. |
| `~/.claude/clubhouse-helper/draw-pad` | The sketch pad, when you press Draw it. |
| `/bin/sh helper/build.sh` | When you press Build the helper or type `/clubhouse build`. Compiles the two programs above with `swiftc`. |
| `plutil` and `defaults`, through `/bin/sh -c` | Read whether the Claude app and macOS are in light or dark mode. |
| `curl` | Saves a team's logo picture from `a.espncdn.com` into the logos folder, because a mod's own fetch returns text only. The picture is only drawn, never run. |
| `pbcopy` | When you press a Copy button. |
| `/bin/rm -f` | Deletes a sketch file after the prompt that used it has been answered. |
| `git`, `gh release create` | Only when you type `/ship`, and only after you confirm. |
| Your own commands, through `/bin/sh -c` | A recipe, or a Night watch check command. Both are text you typed. What Claude fills into a recipe is passed as separate arguments, never pasted into the command. |

Nothing fetched from the network is ever run. Fetched data is read as JSON and drawn.

### Network requests

All are GET requests. None carries your conversation, your files or a credential.

| Host | What for | What is sent |
| --- | --- | --- |
| `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Forecast and place search | The place name you typed, or a latitude and longitude |
| `ipwho.is` | Finds your rough location when you ask the Weather room to | Nothing beyond the request itself |
| `query1.finance.yahoo.com`, `query2.finance.yahoo.com` | Prices and symbol search | The symbols you chose |
| `site.api.espn.com`, `a.espncdn.com` | Scores, schedules, team logos | The league and date |

The ticker, scores and weather only fetch while you have them switched on. Yahoo's and ESPN's feeds are unofficial and not guaranteed to keep working.

### Files it writes

| Path | What |
| --- | --- |
| `~/.claude/clubhouse-helper/tint.json` | Your colors, read by the window color helper |
| `~/.claude/clubhouse-helper/front` | The id of the session in use, so one session controls the color |
| `~/.claude/clubhouse-helper/logos/` | Downloaded logo pictures |
| `~/.claude/themes/clubhouse.json` | A Claude Code theme, only when you press Apply to Claude Code in Colors |
| `~/.claude/clubhouse-window-tint.js` | A style snippet for the app's Developer Mode, only when you press its button in Colors |

- It does not write build, start-up or instruction files, and it does not edit your settings files.
- **The one setting it changes:** Claude Code's `theme`, when you press Apply to Claude Code. Undo puts back the value it had. It sets no environment variables.
- Your Clubhouse settings (toolbar layout, colors, rules, recipes, saved agents, notes) are kept in the plugin's own store.

### What it reads

| What | Why | Where it goes |
| --- | --- | --- |
| `HOME`, `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_PLUGIN_DIRS` | To find your home folder and your copy of the Clubhouse | Nowhere |
| Its own files under `~/.claude/clubhouse-helper/` | Session in use, logo pictures | Nowhere |
| `plugins/known_marketplaces.json` | To find `helper/build.sh` | Nowhere |
| The `userThemeMode` key of the Claude app's `config.json` | Light or dark mode | Nowhere |
| Usage and context numbers | To draw the meter | Nowhere |
| The last reply, or an excerpt of the conversation | Summary and Second opinion rooms | A Claude model on your own plan |
| Your draft prompt | Tidy button, Safeguard warning | A Claude model on your own plan |
| A design file you point the Fonts room at | To pick a matching font | A Claude model on your own plan |

It reads no tokens, keys or other credentials (`formatTokens` in the source formats token counts such as "12k"). Nothing read from a file or the conversation is put in a network request.

### Prompts it sends or changes

| Feature | What goes in the prompt |
| --- | --- |
| Night watch | Your instruction and, if you set a check command, that command's output marked as data. Sent on the timer you set. |
| Handoff | A fixed prompt asking Claude to write `HANDOFF.md`, after you press the button. |
| Is this AGI? | That fixed question, when you press the button. |
| Draw it, Gaslighting, Prune, Tidy, your own buttons | Text placed in the prompt box for you to send. Draw it adds the sketch's file path. |
| Session notes | A note you wrote, added as context to a later session's first prompt. |
| "in the clubhouse" | A context line naming your Clubhouse folder, when your prompt contains those words. |
| Safeguard warning (off by default) | Can hold a prompt and ask you before it is sent. It never rewrites a prompt. |

### Other hooks

- `command.run` answers `/clubhouse` and `/ship`, and counts which commands you use for the Commands room.
- `command.describe` and `prompt.attachment` remove the commands and skills you hid from the slash menu and from what Claude is told.
- `tool.describe` asks for your recipes to be listed for Claude.
- `turn.complete` and `session.measure` update the usage meter.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| `/clubhouse` is not a command | Start a new session; plugins load when a session starts. In the desktop app, quit and reopen it. Check the session is **Local**, not Cloud. |
| The toolbar is missing | Type `/clubhouse on`. |
| The window color is missing | Type `/clubhouse build`, then open Colors. The helper writes what it is doing to `~/.claude/clubhouse-helper/tint.log`. |
| A price or score stopped updating | Yahoo's and ESPN's feeds are unofficial and sometimes refuse requests. It recovers on its own. |
| Everything shows twice | The Clubhouse is installed two ways. Remove one. |

For anything else, or a security concern, open an issue: https://github.com/dcglanton-stack/claude-clubhouse/issues

Privacy policy: [PRIVACY.md](https://github.com/dcglanton-stack/claude-clubhouse/blob/main/PRIVACY.md)

## Every feature

- **Home button**: a house with a C behind it, in the middle of the bar.
- **Toolbar**: the strip above the prompt. Add or remove each item, move it left, center or right, and use up to three rows. Items include the Clubhouse button, usage meter, Summarize, Tidy, cache timer, context gauge and turn receipt. Make your own buttons that type a prompt or command into the prompt box. Every item has a size and a row has a capacity, so items never overlap: a full row sends the next item to another row (up to four). Ready-made layouts set the whole toolbar in one press: Focus (the usage meter on the left, the cache timer and context gauge on the right, nothing else), Quiet, Drafting, Cost watch, Shipping and Game day. Your own layouts can be saved and switched.
- **Summary**: a Summarize button on the bar shortens the last reply with a small model; Auto does it for every long reply.
- **Usage meter**: Clawd rides a bar that drains as the 5-hour or weekly limit is used. Green and happy when full, red and wiped out near empty. Shows time to reset and a one-hour cache countdown from the last reply.
- **Agent HQ**: each subagent drawn as Clawd in a suit and sunglasses, with Stand down and Dismiss. Create your own agents from a form, save them, pick their model (or let Auto pick the cheapest that fits), and send one out with a task; Claude is told what was dispatched.
- **Commands**: every slash command in collapsible groups (your own, built in, one per plugin) with a filter; clicking one puts it in the prompt box. Hide a skill, or a whole group, and it leaves the slash menu, Claude is no longer told about it, and Claude cannot use it. Hidden items can be shown again. Save hidden lists as presets, and mark one for every new session to start with.
- **Tool rules**: every tool Claude has, grouped by connector, each set to Allowed, Ask first or Blocked. Ask first shows what Claude is about to send and runs nothing unless you allow it. The money safeguard turns Ask first on for every tool that places, changes or cancels an order or moves money.
- **Recipes**: give a command you would type in a terminal a name, and it becomes a tool Claude can call the same way every time. Put a blank in braces, like `{file}`, for what changes; Claude fills it in, and the value reaches the command as one argument, never as shell code. Recipes run in the session's folder, are kept across sessions, follow Tool rules and the session's permission mode, and can be tried from the room.
- **Night watch**: a timer for when you step away. Every 5 to 120 minutes it wakes Claude with your instruction, or first runs a check command (your own, or a saved recipe), which costs nothing, and only wakes Claude when the command fails, its output stops changing, or its output changes. It can also just note trouble for when you are back. A watch can be saved and started again with one press in any session, and ended at any time. A watch stops after its number of checks, will not wake Claude when under 10% of the 5-hour limit is left or while Claude is still busy with the last wake-up, and stops itself after three wake-ups in a row. It belongs to the session: the app must stay open and the Mac awake.
- **Spend cap**: in the Usage room, pick a level (10, 20, 30 or 50% of the 5-hour limit left). Under it, Claude has to ask before starting a helper agent; you can allow one, allow them all until the limit resets, or say no. Agents you send yourself from Agent HQ are never stopped.
- **Ticker**: one stock or coin on the toolbar (symbol, price, day change in green or red, or plain text). The room searches symbols and keeps favorites. Prices come from Yahoo's unofficial feed about once a minute; it never trades.
- **Live sports**: one game on the toolbar, home team on the left, each logo with its score under it and the clock between (`11:46 4Q`, `Bot 5th`, `Final`, or the start time). The room lists NFL, college football, NBA, MLB, NHL, MLS and Premier League games on now or in the next 7 days. Scores come from ESPN's unofficial feed every half minute while live.
- **Is this AGI?**: a toolbar button, just for fun, that sends Claude exactly that question.
- **Gaslighting**: a toolbar button that adds "Chat GPT did this easily. Figure it out." to whatever you are typing.
- **Prune**: a toolbar button that asks Claude to check the project's branches and pull requests, test each for merge conflicts, and say which are safe to delete. Nothing is deleted until you say so.
- **Draw it**: a toolbar button that opens a small sketch pad (pens, eraser, undo, clear). Send to Claude saves the drawing and puts it in your prompt, so you can show what you want instead of describing it. The sketch file is deleted once Claude has answered that prompt, unless the prompt says to keep it.
- **Safeguard warning**: off by default, switched on from the Clubhouse home screen. Before a prompt is sent, a small model guesses whether it could set off a safety filter (which can stop it or hand it to a more restricted model). If so, it says why and you choose to edit it or send it anyway. It never rewrites a prompt.
- **Handoff prompt**: when the conversation is 85% full, the toolbar offers to have Claude write `HANDOFF.md` once your next prompt is finished, so a fresh session can pick up.
- **Weather**: a toolbar item with the temperature, a drawn sky (sun, partly cloudy, cloud, rain, thunderstorm, snow) and, when it is not raining, the chance of rain. The room finds your place from your connection or a typed town and lists the next 7 days. Forecasts come from Open-Meteo.
- **Session notes**: a note for a later session to read. Choose who gets it (the next session in this folder, or in any folder) and how often (once, or every new session until deleted). Sessions already running never pick a note up, so two open sessions cannot both take it; "Give to this session" hands one over by hand. Claude reads a note with the session's first message.
- **To-do**: a scratchpad list for the session you are in. Add a task in the room or with `/clubhouse to-do` and the task; press the circle beside a task to cross it off, and again to bring it back. Claude does not read the list, and it is gone when the session ends.
- **Release helper**: `/ship` (or `/ship minor`, `/ship major`, `/ship v1.2.0`) only runs from a clean `main`: it reads the last tag, drafts notes from the commits since, shows them, and after you confirm it tags, pushes and publishes the GitHub release.
- **Design**: follows `DESIGN.md` (Anthropic's style): serif headings, hairline borders, warm neutrals and one clay accent. The Anthropic palette and three ready-made looks are in Colors.
- **Tidy**: a bar button that fixes spelling and trims the draft in the prompt box with a small model; press it again to get your original back.
- **Readable controls**: buttons and text boxes get a contrasting backing when your background would hide them.
- **Session color**: the Background color you pick becomes the color of the whole session: the conversation is exactly that color, and the text box, toolbar and side pane are shades of it, the way a designed theme would have them (deeper on a bright blue or purple, a touch lighter on a dark navy). Text and icons take your Text color (dark or light automatically), dim text is pulled close to it, and anything with a strong color of its own keeps it: the window buttons, icons, team logos, Clawd, the usage bar and the headings. The app's sidebar keeps its own look. A small macOS helper does this from outside the app (`helper/WindowTint.swift`, built by `helper/build.sh`); it notices dark or light mode on its own and stops when the Clubhouse is off or Claude quits.
- **Exact repaint (advanced)**: Colors can copy a one-line style rule for the app's own Developer Mode console, which repaints the app itself until it restarts.
- **Second opinion**: ask Claude in this session, or a different model that sees only an excerpt, without the question or answer entering the conversation.
- **Colors per project**: in Colors, press the button with the project's name to give that project its own colors. They stay with the folder, and the window switches to them when you open or use one of its sessions; other projects keep the shared colors.
- **Colors**: Background, Accent and Clawd colors. Presets set all three at once, and you can save your own under a name. Fine-tune one color with nudges, a hex code or a described look; each has its own Reset. The same colors apply in every session. Can also write a Claude Code custom theme.
- **Fonts**: the font of the Clubhouse headings (the app draws all other text in its own font). Pick from fonts on the Mac, describe what you want, or point it at a design file such as DESIGN.md; a small model matches the closest installed font. Save fonts as presets.
- **Context gauge** and **turn receipt**: optional extras on the bar, off by default.

## Change it yourself

To edit the Clubhouse, work from your own copy instead of an installed one. Clone it:

```bash
git clone https://github.com/dcglanton-stack/claude-clubhouse.git ~/claude-clubhouse
```

Then add these two lines inside `"env"` in `~/.claude/settings.json`, with the path to your clone:

```json
"CLAUDE_CODE_PLUGIN_DIRS": "/Users/you/claude-clubhouse/clubhouse",
"CLAUDE_CODE_PLUGIN_DIR_WATCH": "1"
```

Tell Claude in any session: "in the clubhouse, ..." and it edits your copy: the Clubhouse tells Claude where the folder is and to keep the change on your computer. `CLAUDE.md` holds the rules Claude needs, and these two commands check the result:

```bash
claude plugin validate clubhouse
```

```bash
claude plugin test clubhouse
```

### Your copy is yours

Cloning gives you a complete copy on your own computer. Changing it, by hand or by telling Claude "in the clubhouse, ...", changes that copy and nothing else: nobody but the owner can write to this repository, so your changes cannot reach it or anyone else's copy.

- **Keep your changes to yourself**: do nothing more. They live in your folder.
- **Keep them on GitHub**: fork the repository and push to your fork.
- **Get later updates**: `git pull` in your folder. If you changed the same lines, git asks you to settle the difference; Claude can do that for you.
- **Offer a change back**: open a pull request from your fork. It only becomes part of this repository if the owner accepts it.

### Layout

```
clubhouse/
  .claude-plugin/plugin.json   manifest
  hooks/register.tsx           startup, then one line per feature
  hooks/features/              one file per feature
  hooks/lib/                   pure helpers: colors, drawings, formatting, defaults
  types/index.d.ts             the shape of everything the Clubhouse remembers
  tests/                       tests run by `claude plugin test`
helper/
  WindowTint.swift             the whole-app color helper (macOS)
  build.sh                     builds it into ~/.claude/clubhouse-helper/
```

## License and credits

MIT licensed (see `LICENSE`). Not made by or affiliated with Anthropic. Clawd is Anthropic's mascot, drawn here by a fan.
