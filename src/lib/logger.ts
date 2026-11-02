import log from 'loglevel'

/**
 * Console-only debug traces.
 *
 * Nothing here is ever written to storage. The app's promise is that your
 * calculations stay yours and that you control the record, so a persisted
 * log of every key press would break it. Traces go to the console, where a
 * developer (or an AI session) can read them while the app is running.
 *
 * DEBUG while developing, WARN in a production build: below the level,
 * loglevel swaps the methods for no-ops, so a release build pays nothing
 * per key press.
 */
log.setDefaultLevel(import.meta.env.DEV ? log.levels.DEBUG : log.levels.WARN)

const originalFactory = log.methodFactory

log.methodFactory = (methodName, logLevel, loggerName) => {
  const rawLog = originalFactory(methodName, logLevel, loggerName)

  return (message?: unknown, ...rest: unknown[]) => {
    const at = new Date().toISOString()
    const where = String(loggerName ?? 'APP')
    const level = String(methodName).toUpperCase()
    rawLog(`[${at}] [${where}] [${level}] ${String(message)}`, ...rest)
  }
}

log.rebuild()

export interface Logger {
  debug: (message: string, data?: unknown) => void
  info: (message: string, data?: unknown) => void
  warn: (message: string, data?: unknown) => void
  error: (message: string, data?: unknown) => void
}

/** A logger tagged with where it is called from, e.g. `createLogger('Calculator')`. */
export function createLogger(context: string): Logger {
  const tagged = log.getLogger(context)
  return {
    debug: (message, data) => tagged.debug(message, data),
    info: (message, data) => tagged.info(message, data),
    warn: (message, data) => tagged.warn(message, data),
    error: (message, data) => tagged.error(message, data),
  }
}

export const logger = createLogger('Calc')
