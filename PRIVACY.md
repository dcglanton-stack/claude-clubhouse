# Claude Clubhouse privacy policy

Last updated: October 3, 2026

Claude Clubhouse is a plugin that runs inside Claude Code on your own computer. This page says what data it handles and where that data goes.

## What the author collects

Nothing. The Clubhouse has no server, no account, no analytics and no telemetry. Its author, Davis Glanton, receives no data from your use of it.

## What stays on your computer

- Your Clubhouse settings: toolbar layout, colors, tool rules, recipes, saved agents, notes, favorite symbols and teams. They are kept in the plugin's own store inside your Claude Code folder.
- Files the Clubhouse writes under `~/.claude/clubhouse-helper/`: your colors for the window helper, downloaded team logos, and sketches. A sketch is deleted after the prompt that used it has been answered.

To remove all of it, uninstall the plugin and delete `~/.claude/clubhouse-helper`.

## What is sent to other services

The Clubhouse only contacts these services while you have the matching feature switched on. Each request is a plain web request, so the service also sees your internet address, as any website does.

| Service | Feature | What is sent |
| --- | --- | --- |
| Open-Meteo (`api.open-meteo.com`, `geocoding-api.open-meteo.com`) | Weather | The place name you typed, or a latitude and longitude |
| ipwho.is | Weather, only when you press the button that finds your place | Your internet address, which the service turns into a rough location |
| Yahoo Finance (`query1.finance.yahoo.com`, `query2.finance.yahoo.com`) | Ticker | The stock or coin symbols you chose or searched for |
| ESPN (`site.api.espn.com`, `a.espncdn.com`) | Live sports | The league and date, and requests for team logo pictures |

Your conversation, your files and your credentials are never sent to these services. Each service handles the requests it receives under its own privacy policy.

## What is sent to Claude

Some features ask a Claude model for help: Summarize, Tidy, Second opinion, the Safeguard warning, picking a font or a color from a description, choosing a model for an agent you save, and drafting release notes for `/ship`. They send the text involved (the last reply, your draft prompt, an excerpt of the conversation, what you typed in the room, or a design file you chose) to Anthropic through your own Claude plan, the same service your session already uses. Anthropic's privacy policy covers that data.

## Retention

The author retains nothing, because nothing is received. Data on your computer stays until you delete it.

## Children

The Clubhouse is a developer tool and is not directed at children.

## Changes

Changes to this policy are made in this file, and the date above is updated.

## Contact

Questions or security concerns: open an issue at https://github.com/dcglanton-stack/claude-clubhouse/issues
