/**
 * Tests for pure utility functions: fmt, fmtCash, fmtS, t().
 * Also covers log() and logDay() DOM-append behaviour.
 */
import { beforeAll, describe, it, expect, vi } from 'vitest'
import { createDOM }    from './helpers/dom.js'
import { loadGame }     from './helpers/load-game.js'
import { MOCK_STATE }   from './helpers/mock-state.js'

beforeAll(async () => {
  createDOM()

  // Mock localStorage (jsdom provides one, but we reset it to be safe).
  vi.stubGlobal('localStorage', {
    _store: {},
    getItem(k)    { return this._store[k] ?? null },
    setItem(k, v) { this._store[k] = String(v) },
    removeItem(k) { delete this._store[k] },
  })

  // Mock fetch so the boot IIFE doesn't fail.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({ ...MOCK_STATE }),
  }))

  await loadGame()
})

// ── fmt ──────────────────────────────────────────────────────────────────────

describe('fmt()', () => {
  it('formats a positive number as a dollar string', () => {
    expect(window.fmt(12.5)).toBe('$12.50')
  })
  it('formats zero', () => {
    expect(window.fmt(0)).toBe('$0.00')
  })
  it('formats a large number without separators', () => {
    expect(window.fmt(1234.5)).toBe('$1234.50')
  })
  it('formats a number with more than two decimal places (rounds)', () => {
    expect(window.fmt(1.005)).toMatch(/^\$1\.00$|^\$1\.01$/) // browser rounding
  })
  it('formats a negative number', () => {
    expect(window.fmt(-5)).toBe('$-5.00')
  })
})

// ── fmtCash ──────────────────────────────────────────────────────────────────

describe('fmtCash()', () => {
  it('formats small amounts without separators', () => {
    expect(window.fmtCash(500)).toBe('$500.00')
  })
  it('formats amounts < 1000 without thousands separator', () => {
    expect(window.fmtCash(999.99)).toBe('$999.99')
  })
  it('formats amounts >= 1000 with thousands separator', () => {
    // toLocaleString("en-US") produces "1,234.50"
    expect(window.fmtCash(1234.5)).toMatch(/\$1,234\.50/)
  })
  it('formats zero', () => {
    expect(window.fmtCash(0)).toBe('$0.00')
  })
  it('handles negative amounts below -1000 with separator', () => {
    const result = window.fmtCash(-2000)
    expect(result).toMatch(/\$-?2,000\.00|-2,000\.00/)
  })
})

// ── fmtS ─────────────────────────────────────────────────────────────────────

describe('fmtS()', () => {
  it('prefixes positive numbers with +$', () => {
    expect(window.fmtS(11)).toBe('+$11.00')
  })
  it('formats zero as +$0.00', () => {
    expect(window.fmtS(0)).toBe('+$0.00')
  })
  it('formats negative numbers with -$ (no extra sign)', () => {
    // fmtS prepends nothing for negatives; n.toFixed(2) on -17 gives "-17.00"
    expect(window.fmtS(-17)).toBe('$-17.00')
  })
  it('formats fractional positive', () => {
    expect(window.fmtS(6.5)).toBe('+$6.50')
  })
})

// ── t() – I18N translation ────────────────────────────────────────────────────

describe('t() EN translations', () => {
  it('returns the English label for "buy"', () => {
    window.setLanguage('en')
    expect(window.t('buy')).toBe('Buy')
  })
  it('returns the English label for "sell"', () => {
    expect(window.t('sell')).toBe('Sell')
  })
  it('returns the key itself when the key is unknown', () => {
    expect(window.t('nonexistent_key_xyz')).toBe('nonexistent_key_xyz')
  })
  it('substitutes {item} variable in template strings', () => {
    const result = window.t('notEnoughHistory', { item: 'gear' })
    expect(result).toContain('gear')
    expect(result).not.toContain('{item}')
  })
  it('substitutes multiple variables', () => {
    const result = window.t('latestHistory', { item: 'ore', price: '$12.00', day: 3 })
    expect(result).toContain('ore')
    expect(result).toContain('$12.00')
    expect(result).toContain('3')
  })
  it('substitutes {start} and {end} in historyRange', () => {
    const result = window.t('historyRange', { start: 1, end: 5 })
    expect(result).toContain('1')
    expect(result).toContain('5')
  })
})

describe('t() FR translations', () => {
  beforeAll(() => window.setLanguage('fr'))

  it('returns the French label for "buy"', () => {
    expect(window.t('buy')).toBe('Acheter')
  })
  it('returns the French label for "sell"', () => {
    expect(window.t('sell')).toBe('Vendre')
  })
  it('falls back to EN for an unknown key', () => {
    // A key that exists in EN but not FR would fall back to EN value.
    // All keys exist in both; unknown key falls back to the key itself.
    expect(window.t('totally_unknown')).toBe('totally_unknown')
  })
  it('substitutes variables in French templates', () => {
    const result = window.t('notEnoughHistory', { item: 'lingot' })
    expect(result).toContain('lingot')
    expect(result).not.toContain('{item}')
  })

  afterAll(() => window.setLanguage('en'))
})

// ── log() ────────────────────────────────────────────────────────────────────

describe('log()', () => {
  beforeEach(() => {
    document.getElementById('log-box').innerHTML = ''
  })

  it('appends a div to #log-box', () => {
    window.log('Test message')
    const entries = document.querySelectorAll('#log-box .log-entry')
    expect(entries.length).toBe(1)
    expect(entries[0].textContent).toBe('Test message')
  })

  it('applies the provided CSS class', () => {
    window.log('Error!', 'log-err')
    const entry = document.querySelector('#log-box .log-entry')
    expect(entry.className).toContain('log-err')
  })

  it('splits multi-line messages into separate divs', () => {
    window.log('Line A\nLine B\nLine C')
    const entries = document.querySelectorAll('#log-box .log-entry')
    expect(entries.length).toBe(3)
  })

  it('ignores empty lines in multi-line message', () => {
    window.log('A\n\nB')
    const entries = document.querySelectorAll('#log-box .log-entry')
    expect(entries.length).toBe(2)
  })
})

// ── logDay() ─────────────────────────────────────────────────────────────────

describe('logDay()', () => {
  beforeEach(() => {
    document.getElementById('log-box').innerHTML = ''
  })

  it('appends a day-separator entry to #log-box', () => {
    window.logDay(3)
    const entry = document.querySelector('#log-box .log-day')
    expect(entry).not.toBeNull()
    expect(entry.textContent).toContain('3')
  })

  it('uses the log-day CSS class', () => {
    window.logDay(1)
    const entry = document.querySelector('#log-box .log-entry')
    expect(entry.className).toContain('log-day')
  })
})
