import { atom, read } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { HELPER_CONFIG, HELPER_FRONT, helperConfig } from '../lib/appColor'
import { DEFAULT_PREFS, PREFS_SHAPE } from '../lib/defaults'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})

async function claim($: EngineInterface): Promise<void> {
  const userFolder = await $.env.get('HOME')
  const mine = await $.session.id().catch(() => '')

  if (userFolder === undefined || mine === '') return
  const holder = await $.fs.read(`${userFolder}/${HELPER_FRONT}`).then(
    text => text.trim(),
    () => '',
  )

  if (holder === mine) return
  await $.fs.write(`${userFolder}/${HELPER_FRONT}`, mine).catch(() => undefined)
  await $.fs.write(`${userFolder}/${HELPER_CONFIG}`, helperConfig(await read($, prefs))).catch(() => undefined)
}

export function front(on: On): void {
  on('session.attach', async ($, e, next) => {
    if (e.surface === 'desktop') await claim($)

    return next(e)
  })
  on('ui.press', async ($, e, next) => {
    await claim($)

    return next(e)
  })
}
