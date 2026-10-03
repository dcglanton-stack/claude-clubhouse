import type { Summary } from '../../types'

const SUMMARY_MODEL = 'haiku'
const SUMMARY_SYSTEM =
  "You shorten an AI assistant's reply for the person it was written to. " +
  'Write the shortest version that loses nothing they must know: results, decisions they need to make, ' +
  'things they must do, warnings, and anything that failed or was not verified. ' +
  'Use at most six short bullet points in plain words, with no preamble and no closing line. ' +
  'If the reply asks the reader a question, end with that question on its own line.'

export type SummaryReply =
  | { isAnswered: true; text: string }
  | { isAnswered: false; reason: string }
  | null

export function summaryRequest(answer: string) {
  return { model: SUMMARY_MODEL, system: SUMMARY_SYSTEM, prompt: answer, maxTokens: 400 }
}

export function summaryOf(reply: SummaryReply, answer: string): Summary {
  if (reply === null) {
    return { status: 'failed', text: 'The summary model could not be reached.', sourceChars: answer.length }
  }

  if (!reply.isAnswered) {
    return {
      status: 'failed',
      text: `The summary model did not answer (${reply.reason}).`,
      sourceChars: answer.length,
    }
  }

  return { status: 'ready', text: reply.text.trim(), sourceChars: answer.length }
}
