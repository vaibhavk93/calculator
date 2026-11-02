import log from 'loglevel'

// Initialize loglevel with detailed formatting
log.setDefaultLevel(log.levels.DEBUG)

// Override default methods to include timestamps and context
const originalFactory = log.methodFactory

log.methodFactory = (methodName, logLevel, loggerName) => {
  const rawLog = originalFactory(methodName, logLevel, loggerName)

  return function (message?: any, ...rest: any[]) {
    const timestamp = new Date().toISOString()
    const level = String(methodName).toUpperCase()
    const context = String(loggerName || 'APP')

    const formatted = `[${timestamp}] [${context}] [${level}] ${String(message)}`
    
    // Console output
    rawLog(formatted, ...rest)
    
    // Store in localStorage for later analysis
    try {
      const logs = JSON.parse(localStorage.getItem('app_logs') || '[]')
      logs.push({
        timestamp,
        level,
        context,
        message: String(message),
        data: rest.length > 0 ? rest : undefined
      })
      
      // Keep only last 500 logs to avoid storage bloat
      if (logs.length > 500) logs.shift()
      localStorage.setItem('app_logs', JSON.stringify(logs))
    } catch (e) {
      // Silently fail if localStorage is unavailable
    }
  }
}

log.rebuild()

// Create context-specific loggers
export const createLogger = (context: string) => {
  const contextLog = log.getLogger(context)
  return {
    debug: (msg: string, data?: any) => contextLog.debug(msg, data),
    info: (msg: string, data?: any) => contextLog.info(msg, data),
    warn: (msg: string, data?: any) => contextLog.warn(msg, data),
    error: (msg: string, data?: any) => contextLog.error(msg, data)
  }
}

// Export main logger
export const logger = createLogger('VKCalc')

// Utility to get all logs for debugging
export const getLogs = () => {
  try {
    return JSON.parse(localStorage.getItem('app_logs') || '[]')
  } catch {
    return []
  }
}

// Utility to export logs as JSON
export const exportLogs = () => {
  const logs = getLogs()
  const jsonStr = JSON.stringify(logs, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `calculator-logs-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Clear logs
export const clearLogs = () => {
  localStorage.removeItem('app_logs')
  logger.info('Logs cleared')
}
