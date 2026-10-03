import type { Game, SportsPlan, Team } from '../../types'

export type League = { id: string; path: string; label: string; clock: 'quarter' | 'period' | 'inning' | 'minute'; isWeekly: boolean }

export const SPORTS_KEY = 'sports'
export const SPORTS_POLL_MS = 10_000
export const LOGO_FOLDER = '.claude/clubhouse-helper/logos'
export const LOGO_SIZE = 64
export const LEAGUES: readonly League[] = [
  { id: 'nfl', path: 'football/nfl', label: 'NFL', clock: 'quarter', isWeekly: true },
  { id: 'ncaaf', path: 'football/college-football', label: 'College football', clock: 'quarter', isWeekly: true },
  { id: 'nba', path: 'basketball/nba', label: 'NBA', clock: 'quarter', isWeekly: false },
  { id: 'mlb', path: 'baseball/mlb', label: 'MLB', clock: 'inning', isWeekly: false },
  { id: 'nhl', path: 'hockey/nhl', label: 'NHL', clock: 'period', isWeekly: false },
  { id: 'mls', path: 'soccer/usa.1', label: 'MLS', clock: 'minute', isWeekly: false },
  { id: 'epl', path: 'soccer/eng.1', label: 'Premier League', clock: 'minute', isWeekly: false },
]
export const DEFAULT_SPORTS: SportsPlan = { league: 'nfl', gameId: null, gameLeague: null, gameDay: null }

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS
const RECENT_MS = 12 * 3_600_000
const SOON_MS = 15 * 60_000
const SLOW_POLL_MS = 5 * 60_000
const FEED = 'https://site.api.espn.com/apis/site/v2/sports'

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

export function leagueOf(id: string | null): League {
  return LEAGUES.find(one => one.id === id) ?? LEAGUES[0]!
}

export function dayOf(at: number): string {
  return new Date(at).toISOString().slice(0, 10).replace(/-/g, '')
}

export function scoreboardUrl(league: League, day?: string): string {
  return `${FEED}/${league.path}/scoreboard${day === undefined ? '' : `?dates=${day}`}`
}

export function daysToFetch(league: League, at: number): (string | undefined)[] {
  return league.isWeekly
    ? [undefined]
    : [undefined, ...Array.from({ length: 7 }, (_, ahead) => dayOf(at + (ahead + 1) * DAY_MS))]
}

export function logoUrl(logo: string): string {
  const path = logo.replace(/^https?:\/\/a\.espncdn\.com/, '')

  return `https://a.espncdn.com/combiner/i?img=${path}&h=${LOGO_SIZE}&w=${LOGO_SIZE}`
}

export function logoKey(league: string, team: Team): string {
  return `${league}-${team.abbr.toLowerCase().replace(/[^a-z0-9]/g, '')}`
}

function clockOf(league: League, status: Record<string, unknown>, state: string): string {
  const type = record(status.type)
  const detail = typeof type?.shortDetail === 'string' ? type.shortDetail : ''

  if (state === 'post') return 'Final'
  if (state !== 'in') return ''
  const clock = typeof status.displayClock === 'string' ? status.displayClock : ''
  const period = typeof status.period === 'number' ? status.period : 0

  if (league.clock === 'inning' || clock === '') return detail
  if (league.clock === 'minute') return clock
  if (/half/i.test(detail)) return 'Half'
  const regular = league.clock === 'quarter' ? 4 : 3
  const mark = league.clock === 'quarter' ? 'Q' : 'P'

  return `${clock} ${period > regular ? 'OT' : `${period}${mark}`}`
}

function teamOf(value: unknown): Team | null {
  const side = record(value)
  const team = record(side?.team)

  if (side === null || team === null || typeof team.abbreviation !== 'string') return null

  return {
    abbr: team.abbreviation,
    score: typeof side.score === 'string' ? side.score : '',
    logo: typeof team.logo === 'string' ? team.logo : null,
    color: typeof team.color === 'string' && /^[0-9a-f]{6}$/i.test(team.color) ? `#${team.color.toLowerCase()}` : '#6b6b6b',
  }
}

export function gamesFrom(text: string, league: League): Game[] {
  try {
    const events = record(JSON.parse(text))?.events

    return (Array.isArray(events) ? events : []).flatMap(one => {
      const event = record(one)
      const contest = record((event?.competitions as unknown[] | undefined)?.[0])
      const sides = Array.isArray(contest?.competitors) ? contest.competitors : []
      const home = teamOf(sides.find(side => record(side)?.homeAway === 'home'))
      const away = teamOf(sides.find(side => record(side)?.homeAway === 'away'))
      const status = record(event?.status)
      const state = record(status?.type)?.state

      if (event === null || status === null || home === null || away === null || typeof event.id !== 'string') return []
      const startsAt = Date.parse(String(event.date))

      return [
        {
          id: event.id,
          league: league.id,
          startsAt: Number.isFinite(startsAt) ? startsAt : 0,
          state: state === 'in' || state === 'post' ? state : ('pre' as const),
          clock: clockOf(league, status, String(state)),
          home,
          away,
        },
      ]
    })
  } catch {
    return []
  }
}

export function startText(game: Game): string {
  return new Date(game.startsAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

export function clockText(game: Game): string {
  return game.state === 'pre' ? startText(game) : game.clock
}

export function gameLine(game: Game): string {
  const teams = `${game.away.abbr} at ${game.home.abbr}`

  return game.state === 'pre'
    ? `${teams} · ${startText(game)}`
    : `${teams} · ${game.away.score}–${game.home.score} · ${game.clock}`
}

export function listed(games: readonly Game[], at: number): Game[] {
  const rank = (game: Game) => (game.state === 'in' ? 0 : game.state === 'pre' ? 1 : 2)
  const unique = [...new Map(games.map(game => [game.id, game])).values()]

  return unique
    .filter(game =>
      game.state === 'in' ||
      (game.state === 'pre' && game.startsAt <= at + WEEK_MS) ||
      (game.state === 'post' && game.startsAt >= at - RECENT_MS),
    )
    .sort((one, other) => rank(one) - rank(other) || one.startsAt - other.startsAt)
}

export function isWorthChecking(game: Game | null, at: number, lastAt: number): boolean {
  if (game === null) return true
  if (game.state === 'post') return at - lastAt >= SLOW_POLL_MS && at - game.startsAt < RECENT_MS

  return game.state === 'in' || game.startsAt - at <= SOON_MS || at - lastAt >= SLOW_POLL_MS
}

export function asSportsPlan(stored: unknown): SportsPlan {
  const plan = record(stored)

  if (plan === null) return DEFAULT_SPORTS

  return {
    league: leagueOf(typeof plan.league === 'string' ? plan.league : null).id,
    gameId: typeof plan.gameId === 'string' ? plan.gameId : null,
    gameLeague: typeof plan.gameLeague === 'string' ? leagueOf(plan.gameLeague).id : null,
    gameDay: typeof plan.gameDay === 'string' && /^\d{8}$/.test(plan.gameDay) ? plan.gameDay : null,
  }
}

export type ScoreSpec = {
  game: Game
  ink: string
  homeLogo: string | null
  awayLogo: string | null
  width: number
  height: number
}

function side(team: Team, logo: string | null, x: number, size: number, ink: string): string {
  const middle = x + size / 2
  const mark =
    logo === null
      ? `<circle cx="${middle}" cy="${size / 2}" r="${size / 2}" fill="${team.color}"/>` +
        `<text x="${middle}" y="${size / 2 + 3}" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="${team.abbr.length > 3 ? 7 : 9}" font-weight="700" fill="#ffffff">${team.abbr}</text>`
      : `<image x="${x}" y="0" width="${size}" height="${size}" href="data:image/png;base64,${logo}"/>`

  return (
    mark +
    `<text x="${middle}" y="${size + 12}" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="12" font-weight="700" fill="${ink}">${team.score === '' ? team.abbr : team.score}</text>`
  )
}

export function scoreSvg({ game, ink, homeLogo, awayLogo, width, height }: ScoreSpec): string {
  const size = height - 14
  const words = clockText(game).split(' ')
  const lines = words.length > 2 ? [words.slice(0, 1).join(' '), words.slice(1).join(' ')] : words.length === 2 ? words : [words[0] ?? '', '']
  const middle = width / 2

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    side(game.home, homeLogo, 2, size, ink) +
    `<text x="${middle}" y="${lines[1] === '' ? height / 2 + 4 : height / 2 - 2}" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="12" font-weight="600" fill="${ink}">${lines[0]}</text>` +
    (lines[1] === ''
      ? ''
      : `<text x="${middle}" y="${height / 2 + 12}" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="11" fill="${ink}">${lines[1]}</text>`) +
    side(game.away, awayLogo, width - size - 2, size, ink) +
    '</svg>'
  )
}
