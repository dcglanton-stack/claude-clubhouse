import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Game, SportsPlan } from '../../types'
import { DEFAULT_PREFS, PREFS_KEY, PREFS_SHAPE } from '../lib/defaults'
import { makeParts } from '../lib/parts'
import {
  DEFAULT_SPORTS,
  LEAGUES,
  SPORTS_KEY,
  dayOf,
  daysToFetch,
  gameLine,
  gamesFrom,
  leagueOf,
  listed,
  scoreboardUrl,
} from '../lib/sports'
import { FEED_HEADERS } from '../lib/ticker'
import { arranged } from '../lib/toolbar'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const sports = atom({ plugin: 'clubhouse', key: 'sports' } as const, DEFAULT_SPORTS)
const games = atom({ plugin: 'clubhouse', key: 'games' } as const, [])
const liveGame = atom({ plugin: 'clubhouse', key: 'liveGame' } as const, null)
const sportsView = atom({ plugin: 'clubhouse', key: 'sportsView' } as const, { note: null, isLoading: false })
const sportsCheckedAt = atom({ plugin: 'clubhouse', key: 'sportsCheckedAt' } as const, 0)

const GAMES_SHOWN = 24

async function keep($: EngineInterface, change: (held: SportsPlan) => SportsPlan): Promise<void> {
  await update($, sports, change)
  await $.store.set(SPORTS_KEY, await read($, sports))
}

async function loadGames($: EngineInterface, leagueId: string): Promise<void> {
  const league = leagueOf(leagueId)
  const at = await $.clock.now()
  await update($, sportsView, () => ({ note: `Getting ${league.label} games…`, isLoading: true }))
  const found: Game[] = []
  let hasAnswered = false

  for (const day of daysToFetch(league, at)) {
    const page = await $.http.fetch(scoreboardUrl(league, day), { headers: FEED_HEADERS }).catch(() => null)

    if (page !== null && page.ok) {
      hasAnswered = true
      found.push(...gamesFrom(page.text, league))
    }
  }

  const shown = listed(found, at)
  await update($, games, () => shown)
  await update($, sportsView, () => ({
    isLoading: false,
    note: !hasAnswered
      ? 'The score feed could not be reached. Try Refresh in a moment.'
      : shown.length === 0
        ? `No ${league.label} games on now or in the next 7 days.`
        : null,
  }))
}

async function pickLeague($: EngineInterface, leagueId: string): Promise<void> {
  await keep($, held => ({ ...held, league: leagueId }))
  await loadGames($, leagueId)
}

async function showGame($: EngineInterface, game: Game): Promise<void> {
  await keep($, held => ({ ...held, gameId: game.id, gameLeague: game.league, gameDay: dayOf(game.startsAt) }))
  await update($, liveGame, () => game)
  await update($, sportsCheckedAt, () => 0)
  const chosen = await read($, prefs)
  const outcome =
    chosen.bar.sports?.isShown === true
      ? { prefs: chosen, note: null }
      : arranged(chosen, { kind: 'item', id: 'sports' }, 'toggle')
  await update($, prefs, () => outcome.prefs)
  await $.store.set(PREFS_KEY, outcome.prefs)
  await update($, sportsView, view => ({
    ...view,
    note: outcome.note ?? `${game.away.abbr} at ${game.home.abbr} is on the toolbar. Team logos arrive within half a minute.`,
  }))
}

export function sportsRoom(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-sports' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const plan = await read($, sports)
    const list: Game[] = await read($, games)
    const live: Game | null = await read($, liveGame)
    const view = await read($, sportsView)
    const { frame, rim, note, plain, title, card, Button } = makeParts(elements, chosen, e.surface)
    const league = leagueOf(plan.league)

    return (
      <Box flexDirection="column" {...rim}>
        <Box flexDirection="column" gap={1} {...frame}>
          {title('Live sports')}
          {note(
            'Put one game on the toolbar: both teams, the score and the clock, home team on the left. Pick a sport, then a game. /clubhouse sports opens this.',
          )}
          {card('On the toolbar', [
            plain(live === null || live.id !== plan.gameId ? 'No game chosen yet.' : gameLine(live)),
            plan.gameId === null ? null : (
              <Box>
                <Button
                  key="sports-clear"
                  label="Take it off"
                  onPress={() => void keep($, held => ({ ...held, gameId: null, gameLeague: null, gameDay: null }))}
                />
              </Box>
            ),
          ])}
          {card('Sport', [
            <Box gap={1} flexWrap="wrap">
              {LEAGUES.map(one => (
                <Button
                  key={`league-${one.id}`}
                  label={one.label}
                  variant={one.id === league.id ? 'primary' : 'secondary'}
                  onPress={() => void pickLeague($, one.id)}
                />
              ))}
            </Box>,
            <Box>
              <Button key="sports-refresh" label={`Get ${league.label} games`} onPress={() => void loadGames($, league.id)} />
            </Box>,
          ])}
          {view.note !== null && plain(view.note)}
          {list.length > 0 &&
            card(
              `${league.label}: on now and this week`,
              list
                .filter(game => game.league === league.id)
                .slice(0, GAMES_SHOWN)
                .map(game => (
                  <Box flexDirection="column">
                    {plain(gameLine(game))}
                    <Box>
                      <Button
                        key={`game-${game.id}`}
                        label={plan.gameId === game.id ? 'On the toolbar' : 'Show on toolbar'}
                        variant={plan.gameId === game.id ? 'primary' : 'secondary'}
                        onPress={() => void showGame($, game)}
                      />
                    </Box>
                  </Box>
                )),
            )}
          {note(
            'Scores come from ESPN\'s free feed and refresh every half minute while a game is live. The feed is unofficial, so it can lag or stop.',
          )}
        </Box>
      </Box>
    )
  })
}
