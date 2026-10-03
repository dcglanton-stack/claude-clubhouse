import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { FontChoice, Prefs } from '../../types'
import { DEFAULT_PREFS, PREFS_KEY, PREFS_SHAPE } from '../lib/defaults'
import {
  DEFAULT_FONT,
  DESIGN_FILE_CHARS,
  FONTS,
  FONT_PRESETS_KEY,
  designRequest,
  fontFrom,
  fontRequest,
  withFontPreset,
} from '../lib/fonts'
import { makeParts } from '../lib/parts'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const fontPresets = atom({ plugin: 'clubhouse', key: 'fontPresets' } as const, [])
const fontsView = atom({ plugin: 'clubhouse', key: 'fontsView' } as const, { note: null })

async function say($: EngineInterface, note: string): Promise<void> {
  await update($, fontsView, () => ({ note }))
}

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, await read($, prefs))
}

async function setFont($: EngineInterface, font: FontChoice, note: string): Promise<void> {
  await keep($, held => ({ ...held, font }))
  await say($, note)
}

async function savePreset($: EngineInterface, name: string, font: FontChoice): Promise<void> {
  await update($, fontPresets, held => withFontPreset(held, name, font))
  await $.store.set(FONT_PRESETS_KEY, await read($, fontPresets))
}

async function describe($: EngineInterface, wish: string): Promise<void> {
  if (wish.trim() === '') return
  await say($, `Finding a font for "${wish.trim()}"…`)
  const reply = await $.model.complete(fontRequest(wish)).catch(() => null)
  const font = reply !== null && reply.isAnswered ? fontFrom(reply.text) : null

  await (font === null
    ? say($, 'The model did not come back with a font from the list. Try other words.')
    : setFont($, font, `Headings are now in ${font.name}.`))
}

async function fromDesignFile($: EngineInterface, typed: string): Promise<void> {
  const userFolder = await $.env.get('HOME')
  const path = typed.trim().replace(/^~(?=\/)/, userFolder ?? '~')

  if (path === '') return
  const file = await $.fs.read(path).catch(() => null)

  if (typeof file !== 'string' || file.trim() === '') {
    await say($, `Could not read ${typed.trim()}. Type the full path to a design file, like ~/Downloads/DESIGN.md.`)

    return
  }

  await say($, 'Reading the design file…')
  const reply = await $.model.complete(designRequest(file.slice(0, DESIGN_FILE_CHARS))).catch(() => null)
  const font = reply !== null && reply.isAnswered ? fontFrom(reply.text) : null

  if (font === null) {
    await say($, 'No heading font could be worked out from that file.')

    return
  }

  const name = path.split('/').at(-1) ?? 'Design file'
  await savePreset($, name, font)
  await setFont($, font, `Headings are now in ${font.name}, the closest installed match, saved as the preset "${name}".`)
}

export function fontsRoom(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-fonts' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const kept = await read($, fontPresets)
    const view = await read($, fontsView)
    const current = chosen.font ?? DEFAULT_FONT
    const { frame, note, plain, title, card, heading, Button, Input } = makeParts(elements, chosen, e.surface)

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Fonts')}
        {note(
          'Pick the font of the Clubhouse headings, like the word Fonts above. All other text is drawn by the Claude app in its own font, which the Clubhouse cannot change. /clubhouse fonts opens this.',
        )}
        {card('Heading font', [
          plain(`Now: ${current.name}`),
          <Box gap={1} flexWrap="wrap">
            {FONTS.map(font => (
              <Button
                key={`font-${font.name}`}
                label={font.name}
                variant={font.name === current.name ? 'primary' : 'secondary'}
                onPress={() => void setFont($, font, `Headings are now in ${font.name}.`)}
              />
            ))}
          </Box>,
          note('These are fonts already on your Mac. Anthropic Serif is the default.'),
        ])}
        {heading('The quick brown fox')}
        {Input !== null &&
          card('Describe a font', [
            note('Say what you want the headings to feel like, or name a font. A small model picks the closest font on your Mac. Costs a few tokens.'),
            <Input
              key="font-wish"
              label="Font"
              placeholder="friendly and rounded"
              submitLabel="Find it"
              onSubmit={wish => void describe($, wish)}
            />,
          ])}
        {Input !== null &&
          card('From a design file', [
            note('Give the path to a design guide, like the DESIGN.md you used before. The heading font it names is matched to the closest font on your Mac and saved as a preset.'),
            <Input
              key="font-file"
              label="File"
              placeholder="~/Downloads/DESIGN.md"
              submitLabel="Use it"
              onSubmit={typed => void fromDesignFile($, typed)}
            />,
          ])}
        {card('Your font presets', [
          Input !== null && (
            <Input
              key="font-preset-name"
              label="Name"
              placeholder="Game day"
              submitLabel="Save current font"
              onSubmit={name =>
                void (name.trim() === ''
                  ? say($, 'Type a name for the preset, then press Save current font.')
                  : savePreset($, name, current).then(() => say($, `Saved ${current.name} as "${name.trim()}".`)))
              }
            />
          ),
          ...kept.map(one => (
            <Box gap={1} flexWrap="wrap">
              <Button
                key={`font-preset-${one.name}`}
                label={`${one.name} (${one.font.name})`}
                variant="primary"
                onPress={() => void setFont($, one.font, `Headings are now in ${one.font.name}.`)}
              />
              <Button
                key={`font-preset-delete-${one.name}`}
                label="Delete"
                onPress={() =>
                  void update($, fontPresets, held => held.filter(other => other.name !== one.name))
                    .then(async () => $.store.set(FONT_PRESETS_KEY, await read($, fontPresets)))
                    .then(() => say($, `Deleted the preset "${one.name}".`))
                }
              />
            </Box>
          )),
        ])}
        {view.note !== null && plain(view.note)}
      </Box>
    )
  })
}
