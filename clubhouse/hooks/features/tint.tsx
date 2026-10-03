import { atom, read } from 'claude-code'
import type { EngineInterface, On, RenderElement, ResolveInput } from 'claude-code'

import { tintsRows } from '../lib/appColor'
import { DEFAULT_PREFS } from '../lib/defaults'
import { tintRow } from '../lib/parts'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS)

async function tinted<E extends ResolveInput>(
  $: EngineInterface,
  e: E,
  next: (e: E) => Promise<RenderElement>,
): Promise<RenderElement> {
  const chosen = await read($, prefs)
  const isActive = tintsRows(chosen) && e.surface !== 'terminal'

  if (!isActive) {
    return next(e)
  }

  return tintRow($.ui.resolve(e), chosen, await next(e))
}

export function tint(on: On): void {
  on('ui.render', { component: 'UserMessage' }, ($, e, next) => tinted($, e, next))
  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => tinted($, e, next))
  on('ui.render', { component: 'ToolUse' }, ($, e, next) => tinted($, e, next))
  on('ui.render', { component: 'ToolResult' }, ($, e, next) => tinted($, e, next))
  on('ui.render', { component: 'ToolGroup' }, ($, e, next) => tinted($, e, next))
  on('ui.render', { component: 'CommandOutput' }, ($, e, next) => tinted($, e, next))
  on('ui.render', { component: 'Spinner' }, ($, e, next) => tinted($, e, next))
}
