import type { Quote, TickerHit, TickerPlan } from '../../types'

export const TICKER_KEY = 'ticker'
export const TICKER_POLL_MS = 60_000
export const MAX_FAVORITES = 8
export const DEFAULT_TICKER: TickerPlan = { symbol: null, favorites: [], isColored: true }
export const UP_COLOR = '#2e9e5b'
export const DOWN_COLOR = '#d63031'
export const FEED_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh) ClaudeClubhouse' } as const

const KINDS: Record<string, string> = {
  EQUITY: 'Stock',
  ETF: 'Fund',
  CRYPTOCURRENCY: 'Coin',
  INDEX: 'Index',
  MUTUALFUND: 'Fund',
  CURRENCY: 'Currency',
  FUTURE: 'Future',
}
const SYMBOL = /^[A-Za-z0-9.^=-]{1,15}$/
const HITS_SHOWN = 6

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

export function cleanSymbol(typed: string): string | null {
  const symbol = typed.trim().toUpperCase()

  return SYMBOL.test(symbol) ? symbol : null
}

export function quoteUrl(symbol: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
}

export function searchUrl(asked: string): string {
  return `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(asked.trim())}&quotesCount=${HITS_SHOWN}&newsCount=0`
}

export function quoteFrom(text: string, at: number): Quote | null {
  try {
    const chart = record(record(JSON.parse(text))?.chart)
    const meta = record(record((chart?.result as unknown[] | undefined)?.[0])?.meta)
    const price = meta?.regularMarketPrice
    const before = meta?.chartPreviousClose ?? meta?.previousClose

    if (meta === null || typeof meta.symbol !== 'string' || typeof price !== 'number') return null

    return {
      symbol: meta.symbol,
      name: typeof meta.shortName === 'string' ? meta.shortName : meta.symbol,
      price,
      changePercent: typeof before === 'number' && before > 0 ? ((price - before) / before) * 100 : null,
      at,
    }
  } catch {
    return null
  }
}

export function hitsFrom(text: string): TickerHit[] {
  try {
    const quotes = record(JSON.parse(text))?.quotes

    return (Array.isArray(quotes) ? quotes : [])
      .flatMap(one => {
        const hit = record(one)
        const symbol = typeof hit?.symbol === 'string' ? cleanSymbol(hit.symbol) : null

        return hit === null || symbol === null
          ? []
          : [
              {
                symbol,
                name: typeof hit.shortname === 'string' ? hit.shortname : symbol,
                kind: KINDS[String(hit.quoteType)] ?? 'Other',
              },
            ]
      })
      .slice(0, HITS_SHOWN)
  } catch {
    return []
  }
}

export function priceText(price: number): string {
  const digits = price >= 1000 ? 0 : price >= 1 ? 2 : 4

  return price.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function changeText(percent: number | null): string {
  return percent === null ? '' : `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`
}

export function watched(plan: TickerPlan): string[] {
  return [...new Set([...(plan.symbol === null ? [] : [plan.symbol]), ...plan.favorites])]
}

export function withFavorite(plan: TickerPlan, symbol: string): TickerPlan {
  return plan.favorites.includes(symbol)
    ? { ...plan, favorites: plan.favorites.filter(one => one !== symbol) }
    : { ...plan, favorites: [...plan.favorites, symbol].slice(-MAX_FAVORITES) }
}

export function asTickerPlan(stored: unknown): TickerPlan {
  const plan = record(stored)

  if (plan === null) return DEFAULT_TICKER
  const symbol = typeof plan.symbol === 'string' ? cleanSymbol(plan.symbol) : null
  const favorites = (Array.isArray(plan.favorites) ? plan.favorites : [])
    .flatMap(one => (typeof one === 'string' && cleanSymbol(one) !== null ? [one.toUpperCase()] : []))
    .slice(0, MAX_FAVORITES)

  return { symbol, favorites, isColored: plan.isColored !== false }
}
