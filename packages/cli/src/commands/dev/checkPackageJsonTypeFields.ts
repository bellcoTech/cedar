import fs from 'node:fs'
import path from 'node:path'

import { colors as c } from '@cedarjs/cli-helpers'

// @ts-expect-error - Types not available for JS files
import { getPaths } from '../../lib/index.js'

const CJS_TYPE = 'commonjs'

const readType = (pkgJsonPath: string): string | null => {
  if (!fs.existsSync(pkgJsonPath)) {
    return null
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    return parsed.type ?? CJS_TYPE
  } catch {
    return null
  }
}

/**
 * Warn when the project's `package.json` `type` fields disagree across
 * root, api, and web.
 *
 * Cedar's CLI selects the api-server bin based on the root `package.json`
 * `type` (the `cedar-*` CJS bins when not "module", the `cedarjs-*` ESM
 * bins when "module"). Module resolution for cedar packages then follows
 * each consumer's own workspace `type`. When root and a workspace
 * disagree, the framework can load CJS variants of a dual-package like
 * `@cedarjs/context` while user code loads ESM variants — two physical
 * files, two `let CONTEXT_STORAGE`, AsyncLocalStorage-backed state like
 * `context.currentUser` silently invisible across the boundary.
 *
 * See https://github.com/cedarjs/cedar/pull/1779 for context.
 */
export const checkPackageJsonTypeFields = (): void => {
  const cedarPaths = getPaths()
  const rootType = readType(path.join(cedarPaths.base, 'package.json'))
  const apiType = readType(path.join(cedarPaths.api.base, 'package.json'))
  const webType = readType(path.join(cedarPaths.web.base, 'package.json'))

  const presentTypes = [rootType, apiType, webType].filter(
    (t): t is string => t !== null,
  )

  if (new Set(presentTypes).size <= 1) {
    return
  }

  const lines: string[] = [
    `${c.warning('Warning:')} \`type\` field mismatch detected across your project's package.json files:`,
    `  root: ${rootType ?? '<missing>'}`,
  ]

  if (apiType !== null) {
    lines.push(`  api:  ${apiType}`)
  }

  if (webType !== null) {
    lines.push(`  web:  ${webType}`)
  }

  lines.push(
    'Cedar expects all three to agree — either all "module" or all omitted/"commonjs".',
  )
  lines.push(
    'A mismatch can cause subtle dual-package issues, e.g. `context.currentUser` being invisible across CJS and ESM-loaded code.',
  )

  console.warn(lines.join('\n'))
}
