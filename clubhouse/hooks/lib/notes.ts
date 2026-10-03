import type { NotesView, SessionNote } from '../../types'

export const NOTES_KEY = 'notes'
export const MAX_NOTES = 12
export const DEFAULT_NOTES_VIEW: NotesView = { note: null, where: 'folder', keep: 'once' }

const NOTE_CHARS = 1200

export function folderName(path: string): string {
  return path.split('/').filter(part => part !== '').at(-1) ?? path
}

export function noteFrom(text: string, view: NotesView, folder: string, at: number): SessionNote {
  return {
    id: `note-${at}`,
    text: text.trim().slice(0, NOTE_CHARS),
    folder: view.where === 'folder' ? folder : null,
    keep: view.keep,
    at,
  }
}

export function noteProblem(text: string, held: readonly SessionNote[]): string | null {
  if (text.trim() === '') return 'Type the note and press Enter, then press Save note.'

  return held.length >= MAX_NOTES ? `You have ${MAX_NOTES} notes waiting, the most the Clubhouse keeps. Delete one first.` : null
}

export function claim(notes: readonly SessionNote[], folder: string): { taken: SessionNote[]; left: SessionNote[] } {
  const taken = notes.filter(one => one.folder === null || one.folder === folder)

  return { taken, left: notes.filter(one => !taken.includes(one) || one.keep === 'always') }
}

export function aboutNote(note: SessionNote): string {
  const where = note.folder === null ? 'any folder' : `the folder ${folderName(note.folder)}`

  return note.keep === 'once'
    ? `Goes once, to the next session that starts in ${where}.`
    : `Goes to every session that starts in ${where}, until you delete it.`
}

export function contextOf(notes: readonly SessionNote[]): string {
  return [
    'Session notes from Claude Clubhouse. The user wrote these earlier, in another session, for this session to read. They are the user\'s own notes: take them into account and mention briefly that you have them.',
    ...notes.map(one => `- ${one.text}`),
  ].join('\n')
}

export function asNotes(stored: unknown): SessionNote[] {
  if (!Array.isArray(stored)) return []

  return stored
    .flatMap(one => {
      const record = one as Partial<Record<keyof SessionNote, unknown>> | null

      return record !== null &&
        typeof record === 'object' &&
        typeof record.id === 'string' &&
        typeof record.text === 'string' &&
        record.text.trim() !== '' &&
        typeof record.at === 'number' &&
        (record.folder === null || typeof record.folder === 'string')
        ? [
            {
              id: record.id,
              text: record.text.slice(0, NOTE_CHARS),
              folder: record.folder,
              keep: record.keep === 'always' ? ('always' as const) : ('once' as const),
              at: record.at,
            },
          ]
        : []
    })
    .slice(0, MAX_NOTES)
}
