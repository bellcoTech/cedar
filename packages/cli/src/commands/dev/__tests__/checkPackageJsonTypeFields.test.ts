import fs from 'node:fs'

import { vi, afterEach, beforeEach, describe, it, expect } from 'vitest'

import { checkPackageJsonTypeFields } from '../checkPackageJsonTypeFields.js'

vi.mock('node:fs', () => {
  return {
    default: {
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
    },
  }
})

vi.mock('../../../lib/index.js', () => {
  return {
    getPaths: vi.fn(() => ({
      base: '/project',
      api: { base: '/project/api' },
      web: { base: '/project/web' },
    })),
  }
})

const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

const mockTypes = ({
  root,
  api,
  web,
}: {
  root: string | null | undefined
  api: string | null | undefined
  web: string | null | undefined
}) => {
  const entries: Record<string, string | null> = {
    '/project/package.json': root === undefined ? null : (root ?? '__omit__'),
    '/project/api/package.json': api === undefined ? null : (api ?? '__omit__'),
    '/project/web/package.json': web === undefined ? null : (web ?? '__omit__'),
  }

  vi.mocked(fs).existsSync.mockImplementation((p) => {
    return entries[p as string] !== null
  })

  vi.mocked(fs).readFileSync.mockImplementation((p) => {
    const entry = entries[p as string]
    if (entry === '__omit__') {
      return JSON.stringify({})
    }
    return JSON.stringify({ type: entry })
  })
}

afterEach(() => {
  vi.clearAllMocks()
  warnSpy.mockClear()
})

describe('checkPackageJsonTypeFields', () => {
  beforeEach(() => {
    warnSpy.mockClear()
  })

  it('does not warn when all three are "module"', () => {
    mockTypes({ root: 'module', api: 'module', web: 'module' })
    checkPackageJsonTypeFields()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does not warn when all three are unset (default commonjs)', () => {
    mockTypes({ root: null, api: null, web: null })
    checkPackageJsonTypeFields()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does not warn when explicit "commonjs" matches unset', () => {
    mockTypes({ root: 'commonjs', api: null, web: 'commonjs' })
    checkPackageJsonTypeFields()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('warns when root is commonjs but api is module', () => {
    mockTypes({ root: null, api: 'module', web: null })
    checkPackageJsonTypeFields()
    expect(warnSpy).toHaveBeenCalledOnce()
    const msg = warnSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('mismatch detected')
    expect(msg).toContain('root: commonjs')
    expect(msg).toContain('api:  module')
  })

  it('warns when api and web disagree', () => {
    mockTypes({ root: 'module', api: 'module', web: 'commonjs' })
    checkPackageJsonTypeFields()
    expect(warnSpy).toHaveBeenCalledOnce()
    const msg = warnSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('web:  commonjs')
  })

  it('omits missing workspaces from the warning detail', () => {
    mockTypes({ root: 'module', api: undefined, web: 'commonjs' })
    checkPackageJsonTypeFields()
    expect(warnSpy).toHaveBeenCalledOnce()
    const msg = warnSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('root: module')
    expect(msg).toContain('web:  commonjs')
    expect(msg).not.toContain('api: ')
  })
})
