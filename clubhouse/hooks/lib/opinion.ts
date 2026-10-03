import type { Opinion, OpinionModel } from '../../types'

export type SessionRow = { role: string; text: string; toolUses: readonly unknown[] }

export type OpinionReply =
  | { isAnswered: true; text: string }
  | { isAnswered: false; reason: string }
  | null

export const DEFAULT_QUESTION = 'Is this session on the right track, and what would you do differently?'
export const OPINION_MODELS: readonly OpinionModel[] = ['haiku', 'sonnet', 'opus']
export const OPINION_MODEL_LABEL: Record<OpinionModel, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
}
export const IDLE_OPINION: Opinion = { status: 'idle', text: '', source: null }

const DIGEST_CHARS = 14_000
const MESSAGE_CHARS = 1500
const HERE_FRAME =
  'Pause the task. The user is asking a side question about this session; your answer will not be added to the conversation. ' +
  'Answer briefly and candidly in plain language, without using tools.\n\nQuestion: '
const OUTSIDE_SYSTEM =
  'You are an independent reviewer giving a second opinion on a session between a user and an AI coding assistant. ' +
  'You see only an excerpt of it. Be candid and specific: say whether the work is on the right track, ' +
  'name risks or mistakes you notice, and suggest what to do next. Do not defer to the assistant. ' +
  'Answer in plain language, in under 200 words.'

export function digest(rows: readonly SessionRow[]): string {
  const lines: string[] = []
  let used = 0

  for (const row of [...rows].reverse()) {
    const tools = row.toolUses.length === 0 ? '' : ` [used ${row.toolUses.length} tools]`
    const text = row.text.trim().slice(0, MESSAGE_CHARS)

    if (text === '' && tools === '') continue
    const line = `${row.role === 'user' ? 'User' : 'Assistant'}: ${text}${tools}`

    if (used + line.length > DIGEST_CHARS) break
    lines.unshift(line)
    used += line.length
  }

  return lines.join('\n\n')
}

export function hereRequest(question: string) {
  return { prompt: `${HERE_FRAME}${question}` }
}

export function outsideRequest(model: OpinionModel, question: string, rows: readonly SessionRow[]) {
  return {
    model,
    system: OUTSIDE_SYSTEM,
    prompt: `Excerpt of the session, oldest first:\n\n${digest(rows)}\n\nThe user asks: ${question}`,
    maxTokens: 600,
  }
}

export function opinionOf(reply: OpinionReply, source: 'here' | 'outside'): Opinion {
  if (reply === null) {
    return { status: 'failed', text: 'The model could not be reached.', source }
  }

  if (!reply.isAnswered) {
    return {
      status: 'failed',
      text:
        reply.reason === 'nothing-to-fork'
          ? 'There is no conversation to ask about yet. Send a prompt first.'
          : `The model did not answer (${reply.reason}).`,
      source,
    }
  }

  return { status: 'ready', text: reply.text.trim(), source }
}
