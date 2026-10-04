import type { Task } from '../../types'

export const MAX_TASKS = 40
export const TODO_WORDS: readonly string[] = ['to-do', 'todo', 'todos', 'to do']

const TASK_CHARS = 200

export function taskProblem(text: string, held: readonly Task[]): string | null {
  if (text.trim() === '') return 'Type a task in the box and press Enter.'

  return held.length >= MAX_TASKS ? `The list holds ${MAX_TASKS} tasks. Clear some first.` : null
}

export function withTask(held: readonly Task[], text: string): Task[] {
  const id = 1 + Math.max(0, ...held.map(one => one.id))

  return [...held, { id, text: text.trim().replace(/\s+/g, ' ').slice(0, TASK_CHARS), isDone: false }]
}

export function toggled(held: readonly Task[], id: number): Task[] {
  return held.map(one => (one.id === id ? { ...one, isDone: !one.isDone } : one))
}

export function stillOpen(held: readonly Task[]): Task[] {
  return held.filter(one => !one.isDone)
}

export function tally(held: readonly Task[]): string {
  const done = held.length - stillOpen(held).length

  return held.length === 0 ? 'Nothing yet' : `${done} of ${held.length} done`
}

export function taskWish(args: string): string | null {
  const typed = args.trim()
  const word = TODO_WORDS.find(one => typed.toLowerCase() === one || typed.toLowerCase().startsWith(`${one} `))

  return word === undefined ? null : typed.slice(word.length).trim()
}
