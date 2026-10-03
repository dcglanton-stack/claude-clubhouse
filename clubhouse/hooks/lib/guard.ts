export type GuardVerdict = { risk: 'none' | 'possible' | 'likely'; why: string }

export const GUARD_MODEL = 'haiku'
export const GUARD_SEND = 'Send it anyway'
export const GUARD_EDIT = 'Let me edit it'
export const GUARD_DROPPED = 'Not sent. Your prompt is back in the box so you can change it.'
export const HANDOFF_PERCENT = 85
export const HANDOFF_ARM = 'Write a handoff after my next prompt'
export const HANDOFF_PROMPT =
  'The user asked in Claude Clubhouse for a handoff file, because this conversation is close to full. Write HANDOFF.md in this session\'s folder (if one exists, replace it): what we are working on and why, what is done, what is in progress and exactly where it stands, what comes next in order, decisions and preferences the user stated, anything tried and rejected, and the files, branches and commands a fresh session needs. Write it so a new session can pick up with no other context. Then tell the user in two lines where it is.'

const SHORTEST_CHECKED = 24
const LONGEST_CHECKED = 6000
const SYSTEM =
  'You look at one prompt a person is about to send to an AI coding assistant and judge whether an automated safety filter is likely to stop it or send it to a more restricted model. ' +
  'Such filters react to requests that read like: making or spreading malware, exploits or attack tools; weapons able to cause mass harm (biological, chemical, nuclear, radiological); sexual content involving minors; serious violence or self-harm instructions; large-scale fraud or deception; or getting around security or safety controls. ' +
  'Ordinary coding, writing, analysis and questions are "none", and so is security work that is plainly defensive or about the person\'s own systems. ' +
  'Reply with one JSON object and nothing else: {"risk":"none"|"possible"|"likely","why":"one short plain sentence naming the part that could set a filter off"}. Do not suggest other wording.'

export function isWorthGuarding(text: string, originKind: string): boolean {
  const typed = text.trim()

  return (originKind === 'composer' || originKind === 'sdk') && typed.length >= SHORTEST_CHECKED && !typed.startsWith('/')
}

export function guardRequest(text: string): { model: string; system: string; prompt: string; maxTokens: number } {
  return { model: GUARD_MODEL, system: SYSTEM, prompt: text.slice(0, LONGEST_CHECKED), maxTokens: 120 }
}

export function verdictFrom(reply: string): GuardVerdict {
  try {
    const found = JSON.parse(reply.match(/\{[^{}]*\}/)?.[0] ?? 'null') as { risk?: unknown; why?: unknown } | null
    const risk = found?.risk === 'likely' || found?.risk === 'possible' ? found.risk : 'none'

    return { risk, why: typeof found?.why === 'string' ? found.why.trim().slice(0, 240) : '' }
  } catch {
    return { risk: 'none', why: '' }
  }
}

export function guardQuestion(verdict: GuardVerdict): string {
  const chance = verdict.risk === 'likely' ? 'is likely to' : 'might'

  return `This prompt ${chance} set off a safety filter, which can stop it or hand it to a more restricted model.${verdict.why === '' ? '' : ` ${verdict.why}`} This is a small model's guess, not the real filter.`
}
