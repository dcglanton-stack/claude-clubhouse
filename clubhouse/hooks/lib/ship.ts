export const SHIP_IT = 'Ship it'
export const SHIP_CANCEL = 'Cancel'
export const SHIP_MODEL = 'haiku'
export const MAIN_BRANCHES: readonly string[] = ['main', 'master']

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/
const SUBJECTS_SHOWN = 40

export function nextVersion(lastTag: string | null, wish: string): string | null {
  const asked = wish.trim().toLowerCase()
  const exact = VERSION.exec(asked)

  if (exact !== null) return `v${exact[1]}.${exact[2]}.${exact[3]}`
  if (asked !== '' && asked !== 'patch' && asked !== 'minor' && asked !== 'major') return null
  const last = VERSION.exec(lastTag ?? '')

  if (last === null) return asked === '' || asked === 'minor' ? 'v0.1.0' : asked === 'major' ? 'v1.0.0' : 'v0.0.1'
  const [major, minor, patch] = [Number(last[1]), Number(last[2]), Number(last[3])]

  if (asked === 'major') return `v${major + 1}.0.0`
  if (asked === 'minor') return `v${major}.${minor + 1}.0`

  return `v${major}.${minor}.${patch + 1}`
}

export function subjectsOf(log: string): string[] {
  return log
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '' && !/^merge /i.test(line))
    .slice(0, SUBJECTS_SHOWN)
}

export function plainNotes(subjects: readonly string[]): string {
  return subjects.map(one => `- ${one}`).join('\n')
}

export function notesRequest(subjects: readonly string[]): {
  model: string
  system: string
  prompt: string
  maxTokens: number
} {
  return {
    model: SHIP_MODEL,
    system:
      'You write release notes from commit subjects. Reply with 2 to 6 short bullet points in plain words, each starting with "- ", saying what changed for the person using it. No heading, no preamble, nothing that is not in the commits.',
    prompt: plainNotes(subjects),
    maxTokens: 300,
  }
}

export function shipQuestion(version: string, branch: string, notes: string): string {
  return `Ship ${version} from ${branch}? This makes the tag, pushes ${branch} and the tag to GitHub, and publishes a release with these notes:\n\n${notes}`
}
