export type ListedCommand = { name: string; description: string; source: string; plugin?: string }

export type CommandGroup = { id: string; title: string; canHide: boolean; commands: ListedCommand[] }

const YOURS = 'yours'
const BUILT_IN = 'built-in'
const CONNECTORS = 'connectors'
const LEADING: readonly string[] = [YOURS, BUILT_IN]

function titleOf(id: string): string {
  if (id === YOURS) return 'Your own'
  if (id === BUILT_IN) return 'Built in'
  if (id === CONNECTORS) return 'Connectors'

  return id
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function groupId(one: ListedCommand): string {
  const prefix = one.name.includes(':') ? one.name.split(':')[0] : undefined

  if (prefix !== undefined && prefix !== '') return prefix
  if (one.source === 'builtin') return BUILT_IN
  if (one.source === 'mcp') return CONNECTORS

  return one.plugin ?? YOURS
}

export function groupCommands(
  list: readonly ListedCommand[],
  hidden: readonly string[],
): CommandGroup[] {
  const groups = new Map<string, CommandGroup>()

  for (const one of list) {
    if (hidden.includes(one.name)) continue
    const id = groupId(one)
    const group = groups.get(id) ?? { id, title: titleOf(id), canHide: id !== BUILT_IN, commands: [] }
    group.commands.push(one)
    groups.set(id, group)
  }

  const rank = (id: string) => (LEADING.includes(id) ? LEADING.indexOf(id) : LEADING.length)

  return [...groups.values()]
    .map(group => ({
      ...group,
      commands: [...group.commands].sort((one, other) => one.name.localeCompare(other.name)),
    }))
    .sort((one, other) => rank(one.id) - rank(other.id) || one.title.localeCompare(other.title))
}

export function withoutHiddenSkills(listing: string, hidden: readonly string[]): string {
  if (hidden.length === 0) return listing
  const kept: string[] = []
  let isDropping = false

  for (const line of listing.split('\n')) {
    const entry = /^- (.+?)(?:: |$)/.exec(line)

    if (entry !== null) {
      isDropping = hidden.includes(entry[1] ?? '')
    } else if (line.trim() === '') {
      isDropping = false
    }

    if (!isDropping) kept.push(line)
  }

  return kept.join('\n')
}
