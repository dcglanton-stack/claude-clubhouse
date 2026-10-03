export const PRUNE_PROMPT =
  'Prune check for this project. Run git fetch --prune first, then look at every local branch, every branch on the remote, ' +
  'and every open pull request (gh pr list). For each one say whether it is already fully merged into the main branch, ' +
  'whether merging it now would conflict (test with git merge-tree, without changing any files), and when it last changed. ' +
  'Also say if the main branch here and on the remote differ. Then give me one short table: keep or delete, with the reason. ' +
  'Do not delete, close, merge or push anything yet: ask me first, and then only delete what I approve.'

export function withLine(draft: string, line: string): string {
  const typed = draft.trimEnd()

  return typed === '' ? line : `${typed} ${line}`
}
