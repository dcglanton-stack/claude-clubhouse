# Claude Clubhouse

A mod for Claude Code in the Claude desktop app that turns the space around your prompt into a place of your own.

- **A toolbar above the prompt** that you lay out yourself: a usage meter where Clawd rides a bar that drains as you use your limit, the context gauge and cache timer, Summarize and Tidy buttons, a stock or coin price, a live score with team logos, the weather, a sketch pad, and buttons you make yourself.
- **Your colors, for real.** Pick a Background and the whole window becomes that color: the conversation, text box, toolbar and sidebar take shades of it the way a designed theme would, and things with their own color (window buttons, icons, logos) keep it. It works with the app in dark or light mode, and each project can have its own colors. This part needs macOS.
- **Rooms**, one screen each, opened from the house on the toolbar or with `/clubhouse`: your subagents and saved agents, every slash command, rules for what Claude may do with each tool, terminal commands saved as tools Claude can call, a timer that checks on things while you are away, notes left for a later session, usage, fonts and more.
- **It is yours to change.** Say "in the clubhouse, add a button that..." in any session and Claude edits your copy. Nothing you change leaves your computer.

It is one plugin, written with Claude Code's function hooks. Tested with Claude Code 2.1.286 in the Claude desktop app on macOS; the rooms and toolbar also draw in the terminal, the whole-window color does not.

Not made by or affiliated with Anthropic. Clawd is Anthropic's mascot, drawn here by a fan. Prices come from Yahoo's unofficial feed and scores from ESPN's; neither is guaranteed to keep working.

## Install

1. Get your own copy. If you plan to change it and keep your changes on GitHub, press **Fork** on the repository page first and clone your fork; otherwise clone this one.

```bash
git clone https://github.com/dcglanton-stack/claude-clubhouse.git ~/claude-clubhouse
```

2. Tell Claude Code to load it. In `~/.claude/settings.json`, add these two lines inside `"env"` (create `"env": { }` if it is not there), with the path to where you cloned it:

```json
"CLAUDE_CODE_PLUGIN_DIRS": "/Users/you/claude-clubhouse/clubhouse",
"CLAUDE_CODE_PLUGIN_DIR_WATCH": "1"
```

3. For the whole-window color and the sketch pad (macOS only), build the two small helper programs. This needs Apple's command line tools (`xcode-select --install`).

```bash
~/claude-clubhouse/helper/build.sh
```

4. Start a new session and type `/clubhouse`. Sessions that were already open pick it up after you quit and reopen the app.

To remove it, delete the two lines from `settings.json` and the folder `~/.claude/clubhouse-helper`.

## Your copy is yours

Cloning gives you a complete copy on your own computer. Changing it, by hand or by telling Claude "in the clubhouse, ...", changes that copy and nothing else: nobody but the owner can write to this repository, so your changes cannot reach it or anyone else's copy.

- **Keep your changes to yourself**: do nothing more. They live in your folder.
- **Keep them on GitHub**: fork the repository and push to your fork.
- **Get later updates**: `git pull` in your folder. If you changed the same lines, git asks you to settle the difference; Claude can do that for you.
- **Offer a change back**: open a pull request from your fork. It only becomes part of this repository if the owner accepts it.

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
| `/clubhouse recipes` | Recipes: turn a terminal command into a tool Claude can call |
| `/clubhouse watch` | Night watch: check on things on a timer while you are away |
| `/clubhouse notes` | Session notes: leave a note for a later session |
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

The Clubhouse loads in every session through `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`, which points at the `clubhouse/` folder of your copy.

## What is in it

- **Home button**: a house with a C behind it, in the middle of the bar.
- **Toolbar**: the strip above the prompt. Add or remove each item, move it left, center or right, and use up to three rows. Items include the Clubhouse button, usage meter, Summarize, Tidy, cache timer, context gauge and turn receipt. Make your own buttons that type a prompt or command into the prompt box. Every item has a size and a row has a capacity, so items never overlap: a full row sends the next item to another row (up to four). Layouts can be saved and switched.
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

## Changing it

Tell Claude in any session: "in the clubhouse, ..." and it edits your copy: the Clubhouse tells Claude where the folder is and to keep the change on your computer. `CLAUDE.md` holds the rules Claude needs, and these two commands check the result:

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
helper/
  WindowTint.swift             the whole-app color helper (macOS)
  build.sh                     builds it into ~/.claude/clubhouse-helper/
```
