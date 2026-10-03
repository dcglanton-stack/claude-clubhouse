import type { ToolRule, ToolRules } from '../../types'

export type ListedTool = { name: string; description: string; mcp: boolean }

export type ToolGroup = { id: string; title: string; tools: ListedTool[] }

const BUILT_IN = 'built-in'
const MCP_NAME = /^mcp__(.+?)__(.+)$/
const OPAQUE_ID = /^[0-9a-f]{8}-[0-9a-f-]{20,}$/
const MONEY_MOVE =
  /(^|_)(place|exercise|transfer|pay|execute)(_|$)|orders?_(create|edit|cancel|close)|cancel_.*order|close_position/
const ARGS_SHOWN = 260

export const RULE_LABEL: Record<ToolRule | 'allow', string> = {
  allow: 'Allowed',
  ask: 'Ask first',
  block: 'Blocked',
}

export function shortName(name: string): string {
  return MCP_NAME.exec(name)?.[2] ?? name
}

export function isMoneyTool(name: string): boolean {
  return MCP_NAME.test(name) && MONEY_MOVE.test(shortName(name))
}

export function nextRule(rule: ToolRule | undefined): ToolRule | undefined {
  if (rule === undefined) return 'ask'

  return rule === 'ask' ? 'block' : undefined
}

export function withRule(rules: ToolRules, names: readonly string[], rule: ToolRule | undefined): ToolRules {
  const kept = Object.fromEntries(Object.entries(rules).filter(([tool]) => !names.includes(tool)))

  return rule === undefined
    ? kept
    : { ...kept, ...Object.fromEntries(names.map(tool => [tool, rule] as const)) }
}

function commonWord(tools: readonly ListedTool[]): string | null {
  const first = shortName(tools[0]?.name ?? '').split('_')[0] ?? ''

  return first !== '' && tools.every(one => shortName(one.name).startsWith(`${first}_`)) ? first : null
}

function titleCase(text: string): string {
  return text
    .split(/[-_ ]/)
    .filter(word => word !== '')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function groupTools(list: readonly ListedTool[]): ToolGroup[] {
  const groups = new Map<string, ListedTool[]>()

  for (const one of list) {
    const id = MCP_NAME.exec(one.name)?.[1] ?? BUILT_IN
    groups.set(id, [...(groups.get(id) ?? []), one])
  }

  let unnamed = 0

  return [...groups.entries()]
    .map(([id, tools]) => {
      const sorted = [...tools].sort((one, other) => one.name.localeCompare(other.name))

      if (id === BUILT_IN) return { id, title: 'Built in', tools: sorted }
      if (!OPAQUE_ID.test(id)) return { id, title: titleCase(id.replace(/^plugin_/, '')), tools: sorted }
      const word = commonWord(sorted)
      unnamed += 1

      return {
        id,
        title: word === null ? `Connector ${unnamed}` : `${titleCase(word)} connector`,
        tools: sorted,
      }
    })
    .sort(
      (one, other) =>
        Number(one.id === BUILT_IN) - Number(other.id === BUILT_IN) || one.title.localeCompare(other.title),
    )
}

export function argSummary(input: object): string {
  const args = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== 'tool' && key !== 'tool_use_id' && key !== 'agentId'),
  )
  const text = JSON.stringify(args)

  if (text === '{}') return ''

  return text.length > ARGS_SHOWN ? `${text.slice(0, ARGS_SHOWN)}…` : text
}
