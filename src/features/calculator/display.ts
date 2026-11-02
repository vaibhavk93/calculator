import { D, evaluatePreview, type InputState } from '../../engine'
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
}

const BARE_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/

/**
 * Decides what the display shows. The rules, in the order they apply:
 *   - nothing typed          -> "0"
 *   - just after "="         -> the result, large; the expression that made it above, with " ="
 *   - a single number typed  -> that number, as typed, large; no expression line (it would only repeat it)
 *   - an expression          -> the expression above, the live result below
 */
export function computeDisplay(
  input: InputState,
  lastExpression: string | null,
  settings: Pick<Settings, 'numberSystem' | 'decimals' | 'angle'>,
): DisplayView {
  const fmt = { system: settings.numberSystem, decimals: settings.decimals }
  const { expr, fresh } = input

  if (expr === '') return { exprLine: '', resultLine: '0', copyText: null, echo: null }

  if (fresh) {
    const value = new D(expr)
    return {
      exprLine: lastExpression ? `${formatExpression(lastExpression, fmt.system)} =` : '',
      resultLine: formatPlain(expr, fmt),
      copyText: formatForCopy(value, fmt.decimals),
      echo: wordsOf(value, fmt.system),
    }
  }

  if (BARE_NUMBER.test(expr)) {
    return {
      exprLine: '',
      // Shown as typed, so "1.50" and "12." keep their trailing characters while you work.
      resultLine: formatExpression(expr, fmt.system),
      copyText: formatForCopy(new D(expr), fmt.decimals),
      echo: wordsOf(new D(expr), fmt.system),
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
    }
  }

  // Half-typed or malformed: say nothing, except for real maths problems worth knowing about now.
  const worthSaying = preview.code === 'div-zero' || preview.code === 'domain' || preview.code === 'overflow'
  return {
    exprLine,
    resultLine: '',
    copyText: null,
    echo: worthSaying ? { text: preview.message, tone: 'error' } : null,
  }
}

function wordsOf(value: InstanceType<typeof D>, system: Settings['numberSystem']): DisplayView['echo'] {
  const words = magnitudeWords(value, system)
  return words ? { text: words, tone: 'info' } : null
}
