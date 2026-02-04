/**
 * Experimental feature warning utility.
 * @module commands/experimental-warning
 *
 * Emits a one-time warning when experimental commands are used.
 */

const warnedCommands = new Set<string>()

/**
 * Emits a one-time warning that a command is experimental.
 * Subsequent calls for the same command are silently ignored.
 */
export function warnExperimental(commandName: string): void {
  if (warnedCommands.has(commandName)) {
    return
  }

  warnedCommands.add(commandName)
  console.warn(
    `[experimental] The '${commandName}' command is experimental and may change without notice.`
  )
}
