import { D, evaluatePreview, type InputState } from '../../engine'
import { createLogger } from '../../lib/logger'

import { formatDecimal, formatExpression, formatForCopy, formatPlain, magnitudeWords } from '../../lib/format'
import type { Settings } from '../../store/types'

export interface DisplayView {
  /** The line above the result: what was typed, or what "=" just evaluated. */
  exprLine: string
  /** The big line. */
  resultLine: string
  /** Plain text for the clipboard, or null when there is nothing worth copying. */
  copyText: string | null
  /** "1.67 crore", or an error from the live preview. */
  echo: { text: string; tone: 'info' | 'error' } | null
  /** True while the big number is only a live preview of what is being typed; "=" turns it into the answer. */
  preview: boolean
}

const BARE_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/

/**
 * Decides what the display shows. The rules, in the order they apply:
 *   - nothing typed          -> "0"
 *   - just after "="         -> the result, large; the expression that made it above, with " ="
 *   - a single number typed  -> that number, as typed, large; no expression line (it would only repeat it)
 *   - an expression          -> the expression above, the live result below, dimmed (a preview, not the answer)
 */
export function computeDisplay(
  input: InputState,
  lastExpression: string | null,
  settings: Pick<Settings, 'numberSystem' | 'decimals' | 'angle'>,
): DisplayView {
  const fmt = { system: settings.numberSystem, decimals: settings.decimals }
  const { expr, fresh } = input
  const logger = createLogger('Calculator')
  logger.debug('Compute display', { expr, lastExpression, fresh, settings })

  if (expr === '') return { exprLine: '', resultLine: '0', copyText: null, echo: null, preview: false }

  if (fresh) {
    const value = new D(expr)
    return {
      exprLine: lastExpression ? `${formatExpression(lastExpression, fmt.system)} =` : '',
      resultLine: formatPlain(expr, fmt),
      copyText: formatForCopy(value, fmt.decimals),
      echo: wordsOf(value, fmt.system),
      preview: false,
    }
  }

  if (BARE_NUMBER.test(expr)) {
    return {
      exprLine: '',
      // Shown as typed, so "1.50" and "12." keep their trailing characters while you work.
      resultLine: formatExpression(expr, fmt.system),
      copyText: formatForCopy(new D(expr), fmt.decimals),
      echo: wordsOf(new D(expr), fmt.system),
      preview: false,
    }
  }

  const exprLine = formatExpression(expr, fmt.system)
  const preview = evaluatePreview(expr, { angle: settings.angle })

  if (preview.ok) {
    return {
      exprLine,
      resultLine: formatDecimal(preview.value, fmt),
      copyText: formatForCopy(preview.value, fmt.decimals),
      echo: wordsOf(preview.value, fmt.system),
      preview: true,
    }
  }

  // Half-typed or malformed: say nothing, except for real maths problems worth knowing about now.
  const worthSaying = preview.code === 'div-zero' || preview.code === 'domain' || preview.code === 'overflow'
  return {
    exprLine,
    resultLine: '',
    copyText: null,
    echo: worthSaying ? { text: preview.message, tone: 'error' } : null,
    preview: false,
  }
}

function wordsOf(value: InstanceType<typeof D>, system: Settings['numberSystem']): DisplayView['echo'] {
  const words = magnitudeWords(value, system)
  return words ? { text: words, tone: 'info' } : null
}

/** A finished calculation shown faded above the current line. `id` is null when it is not from history. */
export interface PastLine {
  id: string | null
  expression: string
  result: string
}

/**
 * The finished calculations to show above the current line, oldest first. `source` is newest first (history, or the last commit when history is off).
 * The calculation the big number is showing right now is not repeated above it.
 */
export function recentWork(
  input: InputState,
  lastExpression: string | null,
  source: PastLine[],
  max: number,
): PastLine[] {
  const newest = source[0]
  const showingNewest = input.fresh && newest !== undefined && newest.expression === lastExpression && newest.result === input.expr
  const skip = showingNewest ? 1 : 0
  return source.slice(skip, skip + Math.max(0, max)).reverse()
}
