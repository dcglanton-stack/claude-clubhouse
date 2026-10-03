import type { Limit, Receipt, WindowKind } from '../../types'

export const CACHE_MINUTES = 60
export const LOW_PERCENT = 10

export const WINDOW_LABEL: Record<WindowKind, string> = { five_hour: '5h', seven_day: '7d' }
export const WINDOW_NAME: Record<WindowKind, string> = {
  five_hour: '5-hour window',
  seven_day: 'Weekly window',
}

export function formatSpan(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`

  return `${minutes}m`
}

export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`

  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : `${count}`
}

export function resetIn(limit: Limit, at: number): number | null {
  return limit.resetsAt === null ? null : Date.parse(limit.resetsAt) - at
}

export function percentLeft(limit: Limit, at: number): number {
  const untilReset = resetIn(limit, at)
  const hasReset = untilReset !== null && untilReset <= 0 && at > 0

  return hasReset ? 100 : Math.max(0, Math.round(100 - limit.percentUsed))
}

export function usedOf(list: readonly Limit[], kind: WindowKind): number | null {
  return list.find(one => one.kind === kind)?.percentUsed ?? null
}

export function textBar(left: number, cells: number): { filled: string; empty: string } {
  const filled = Math.round((left / 100) * cells)

  return { filled: '█'.repeat(filled), empty: '░'.repeat(cells - filled) }
}

export function formatSize(count: number): string {
  if (count >= 1_000_000) return `${Number((count / 1_000_000).toFixed(1))}M`
  if (count >= 1000) return `${Math.round(count / 1000)}k`

  return String(Math.round(count))
}

export function contextNote(size: { tokens: number; window: number } | null, percent: number | null): string {
  if (size !== null && size.window > 0) return `context ${formatSize(size.tokens)}/${formatSize(size.window)} full`

  return percent === null ? 'context: no reading yet' : `context ${percent}% full`
}

export function cacheNote(lastReplyAt: number | null, at: number): string {
  if (lastReplyAt === null) return 'cache —'
  const remaining = lastReplyAt + CACHE_MINUTES * 60_000 - at

  return remaining > 0 ? `cache ${formatSpan(remaining)}` : 'cache cold'
}

export function receiptNote(made: Receipt): string {
  const usage = made.usageDelta === null ? '' : ` · ${made.usageDelta.toFixed(1)}% of 5h`

  return `last turn ${made.seconds}s · ${formatTokens(made.inputTokens)} in / ${formatTokens(made.outputTokens)} out${usage}`
}
