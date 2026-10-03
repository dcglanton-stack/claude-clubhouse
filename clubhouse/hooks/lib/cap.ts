import type { Limit } from '../../types'
import { percentLeft } from './format'

export type CapFacts = { cap: number; left: number | null; liftedUntil: number | null; at: number }

export const CAP_LEVELS: readonly number[] = [0, 10, 20, 30, 50]
export const START_ONE = 'Start this one'
export const START_ALL = 'Start them until the limit resets'
export const DO_NOT_START = 'Do not start it'

const FIVE_HOURS_MS = 5 * 3_600_000
const ABOUT_CHARS = 80

export function fiveHourLeft(limits: readonly Limit[], at: number): number | null {
  const limit = limits.find(one => one.kind === 'five_hour')

  return limit === undefined ? null : percentLeft(limit, at)
}

export function isCapped({ cap, left, liftedUntil, at }: CapFacts): boolean {
  return cap > 0 && left !== null && left < cap && (liftedUntil === null || liftedUntil <= at)
}

export function liftUntil(limits: readonly Limit[], at: number): number {
  const resetsAt = limits.find(one => one.kind === 'five_hour')?.resetsAt ?? null
  const reset = resetsAt === null ? Number.NaN : Date.parse(resetsAt)

  return Number.isFinite(reset) && reset > at ? reset : at + FIVE_HOURS_MS
}

export function capLabel(cap: number): string {
  return cap > 0 ? `Spend cap: ask under ${cap}% left` : 'Spend cap: off'
}

export function capQuestion(left: number, cap: number, about: string): string {
  const what = about.trim() === '' ? 'a helper agent' : `a helper agent (${about.trim().slice(0, ABOUT_CHARS)})`

  return `${left}% of your 5-hour limit is left, under your spend cap of ${cap}%. Claude wants to start ${what}. Helper agents use the limit quickly. Start it?`
}

export function capRefusal(left: number, cap: number): string {
  return `The user's spend cap in Claude Clubhouse stopped this helper agent: ${left}% of the 5-hour limit is left, under their cap of ${cap}%. Do the work yourself without subagents, or ask the user.`
}
