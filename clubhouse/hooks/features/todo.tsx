import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { DEFAULT_PREFS, PREFS_SHAPE } from '../lib/defaults'
import { makeParts } from '../lib/parts'
import { stillOpen, tally, taskProblem, toggled, withTask } from '../lib/todo'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const todos = atom({ plugin: 'clubhouse', key: 'todos' } as const, [])
const todoNote = atom({ plugin: 'clubhouse', key: 'todoNote' } as const, null)

let draft = ''

async function add($: EngineInterface, typed: string): Promise<void> {
  const problem = taskProblem(typed, await read($, todos))

  if (problem === null) {
    draft = ''
    await update($, todos, held => withTask(held, typed))
  }

  await update($, todoNote, () => problem)
}

export function todoRoom(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-todo' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const tasks = await read($, todos)
    const problem = await read($, todoNote)
    const { frame, ink, note, plain, title, card, Button, Input } = makeParts(elements, await read($, prefs), e.surface)

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('To-do')}
        {note(
          'A scratchpad for this session: add tasks and cross them off as you go. The list is yours alone (Claude does not read it) and it is gone when the session ends. /clubhouse to-do opens this, and /clubhouse to-do call the bank adds a task.',
        )}
        {Input === null
          ? card('Add a task', [note('This screen has no text box. Type /clubhouse to-do and the task instead.')])
          : card('Add a task', [
              <Input
                key="todo-text"
                label="Task"
                placeholder="What needs doing"
                submitLabel="Add"
                value={draft}
                onInput={typed => {
                  draft = typed
                }}
                onSubmit={typed => void add($, typed)}
              />,
              <Box>
                <Button key="todo-add" label="Add" variant="primary" onPress={() => void add($, draft)} />
              </Box>,
            ])}
        {problem !== null && plain(problem)}
        {tasks.length > 0 &&
          card(tally(tasks), [
            ...tasks.map(one => (
              <Box gap={1}>
                <Button
                  key={`todo-check-${one.id}`}
                  label={one.isDone ? '✓' : '○'}
                  onPress={() => void update($, todos, held => toggled(held, one.id))}
                />
                <Box flexGrow={1} flexShrink={1}>
                  <Text {...ink} strikethrough={one.isDone} dimColor={one.isDone} wrap="wrap">
                    {one.text}
                  </Text>
                </Box>
              </Box>
            )),
            <Box gap={1} flexWrap="wrap">
              {stillOpen(tasks).length < tasks.length && (
                <Button
                  key="todo-clear-done"
                  label="Clear crossed off"
                  onPress={() => void update($, todos, held => stillOpen(held))}
                />
              )}
              <Button key="todo-clear-all" label="Clear all" onPress={() => void update($, todos, () => [])} />
            </Box>,
          ])}
      </Box>
    )
  })
}
