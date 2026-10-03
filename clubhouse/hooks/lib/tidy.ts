const TIDY_MODEL = 'haiku'
const TIDY_SYSTEM =
  "Rewrite the user's draft message to an AI coding assistant so it is clear and short. " +
  'Fix spelling and grammar, and remove filler and repetition. ' +
  'Keep every request, constraint, name, number, file path and stated preference, and keep the first-person voice. ' +
  'Do not answer the message, do not add anything new, and do not use headings. ' +
  'Reply with the rewritten message only.'

export const TIDY_MIN_CHARS = 40

export function tidyRequest(draft: string) {
  return {
    model: TIDY_MODEL,
    system: TIDY_SYSTEM,
    prompt: draft,
    maxTokens: Math.min(2000, Math.ceil(draft.length / 2) + 200),
  }
}
