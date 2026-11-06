import type { ToolSpec } from '../../lib/tool'
import { TOOLS as everyday } from './everyday'
import { TOOLS as gold } from './gold'
import { TOOLS as invest } from './invest'
import { TOOLS as loans } from './loans'
import { TOOLS as metrics } from './metrics'
import { TOOLS as planning } from './planning'
import { TOOLS as savings } from './savings'
import { TOOLS as tax } from './tax'

/** Every calculator the Tools tab lists. One file per module; add a spec there, not here. */
export const ALL_TOOLS: ToolSpec[] = [...everyday, ...gold, ...loans, ...invest, ...savings, ...tax, ...metrics, ...planning]
