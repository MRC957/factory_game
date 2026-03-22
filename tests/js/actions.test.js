/**
 * Tests for async action functions (doBuy, doSell, doCraft, doHire, doFire,
 * doAssign, doBuyBlueprint, doAdvanceTime).
 *
 * Each action is tested for:
 *  - Correct API path + payload sent to fetch.
 *  - Success case: log entry added, DOM updated from returned state.
 *  - Guard case: invalid input (qty < 1) logs an error without calling fetch.
 */
import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { createDOM }              from './helpers/dom.js'
import { loadGame }               from './helpers/load-game.js'
import { MOCK_STATE, cloneState } from './helpers/mock-state.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal API response that mimics {message, state} endpoints. */
function apiResponse(message, stateOverrides = {}) {
  return {
    message,
    state: cloneState(stateOverrides),
  }
}

/** Return fetch calls that happened since last reset. */
function fetchCalls() {
  return window.fetch.mock.calls
}

/** Read all log entries currently in #log-box. */
function logEntries() {
  return Array.from(document.querySelectorAll('#log-box .log-entry'))
    .map(el => el.textContent)
}

let fetchMock

beforeAll(async () => {
  createDOM()

  vi.stubGlobal('localStorage', {
    _s: {},
    getItem(k)    { return this._s[k] ?? null },
    setItem(k, v) { this._s[k] = String(v) },
    removeItem(k) { delete this._s[k] },
  })

  // Initial fetch mock for the boot IIFE.
  fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ ...MOCK_STATE }) })
  vi.stubGlobal('fetch', fetchMock)

  await loadGame()
  window.render({ ...MOCK_STATE })
})

beforeEach(() => {
  // Reset log and fetch mock before each test.
  document.getElementById('log-box').innerHTML = ''
  fetchMock.mockReset()
})

// ── doBuy ─────────────────────────────────────────────────────────────────────

describe('doBuy()', () => {
  it('POSTs to /api/buy with the selected item and quantity', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Bought 3 ore for $36.00.'),
    })
    window.setSelectedMarketItem('ore')
    document.getElementById('market-qty').value = '3'
    await window.doBuy()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/buy')
    const body = JSON.parse(opts.body)
    expect(body).toMatchObject({ item: 'ore', qty: 3 })
  })

  it('logs a success entry on successful buy', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Bought 2 ore for $24.00.'),
    })
    document.getElementById('market-qty').value = '2'
    await window.doBuy()
    expect(logEntries().some(t => t.includes('Bought'))).toBe(true)
  })

  it('logs an error entry on failed buy', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Not enough cash. Need $190.00, have $0.00.'),
    })
    document.getElementById('market-qty').value = '1'
    await window.doBuy()
    const entry = document.querySelector('#log-box .log-err')
    expect(entry).not.toBeNull()
    expect(entry.textContent).toContain('Not enough cash')
  })

  it('does not call fetch when quantity is 0', async () => {
    document.getElementById('market-qty').value = '0'
    await window.doBuy()
    expect(fetchMock).not.toHaveBeenCalled()
    const entry = document.querySelector('#log-box .log-err')
    expect(entry).not.toBeNull()
  })

  it('does not call fetch when quantity is non-numeric', async () => {
    document.getElementById('market-qty').value = 'abc'
    await window.doBuy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('updates the DOM with the returned state', async () => {
    const newState = cloneState({ cash: 464.0, inventory: { ...MOCK_STATE.inventory, ore: 8 } })
    fetchMock.mockResolvedValueOnce({ json: async () => ({ message: 'Bought 3 ore for $36.00.', state: newState }) })
    document.getElementById('market-qty').value = '3'
    await window.doBuy()
    expect(document.getElementById('stat-cash').textContent).toContain('464')
  })
})

// ── doSell ────────────────────────────────────────────────────────────────────

describe('doSell()', () => {
  it('POSTs to /api/sell with selected item and quantity', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Sold 2 ore for $24.00.'),
    })
    window.setSelectedMarketItem('ore')
    document.getElementById('market-qty').value = '2'
    await window.doSell()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/sell')
    expect(JSON.parse(opts.body)).toMatchObject({ item: 'ore', qty: 2 })
  })

  it('logs a success entry on successful sell', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Sold 1 ingot for $35.00.'),
    })
    document.getElementById('market-qty').value = '1'
    await window.doSell()
    expect(logEntries().some(t => t.includes('Sold'))).toBe(true)
  })

  it('logs an error when there is not enough inventory', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Not enough ore in inventory.'),
    })
    document.getElementById('market-qty').value = '99'
    await window.doSell()
    expect(document.querySelectorAll('#log-box .log-err').length).toBeGreaterThan(0)
  })

  it('does not call fetch when quantity is 0', async () => {
    document.getElementById('market-qty').value = '0'
    await window.doSell()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── doCraft ───────────────────────────────────────────────────────────────────

describe('doCraft()', () => {
  it('POSTs to /api/craft with recipe and quantity', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Crafted 2 batches of ingot.'),
    })
    document.getElementById('craft-recipe').value = 'ingot'
    document.getElementById('craft-qty').value = '2'
    await window.doCraft()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/craft')
    expect(JSON.parse(opts.body)).toMatchObject({ recipe: 'ingot', qty: 2 })
  })

  it('logs a success entry on successful craft', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Crafted 1 batches of gear.'),
    })
    document.getElementById('craft-qty').value = '1'
    await window.doCraft()
    expect(logEntries().some(t => t.includes('Crafted'))).toBe(true)
  })

  it('logs an error when inputs are missing', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Missing required inputs.'),
    })
    document.getElementById('craft-qty').value = '5'
    await window.doCraft()
    expect(document.querySelectorAll('#log-box .log-err').length).toBeGreaterThan(0)
  })

  it('does not call fetch when quantity is 0', async () => {
    document.getElementById('craft-qty').value = '0'
    await window.doCraft()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── doHire ────────────────────────────────────────────────────────────────────

describe('doHire()', () => {
  it('POSTs to /api/hire with the quantity', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Hired 2 worker(s) for $300.00.'),
    })
    document.getElementById('hire-qty').value = '2'
    await window.doHire()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/hire')
    expect(JSON.parse(opts.body)).toMatchObject({ qty: 2 })
  })

  it('logs a success entry on hire', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Hired 1 worker(s) for $150.00.'),
    })
    document.getElementById('hire-qty').value = '1'
    await window.doHire()
    expect(logEntries().some(t => t.includes('Hired'))).toBe(true)
  })

  it('logs an error when cash is insufficient', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Not enough cash. Need $150.00, have $50.00.'),
    })
    document.getElementById('hire-qty').value = '1'
    await window.doHire()
    expect(document.querySelectorAll('#log-box .log-err').length).toBeGreaterThan(0)
  })

  it('does not call fetch when quantity is 0', async () => {
    document.getElementById('hire-qty').value = '0'
    await window.doHire()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── doFire ────────────────────────────────────────────────────────────────────

describe('doFire()', () => {
  it('POSTs to /api/fire with the quantity', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Fired 1 worker(s) for $40.00.'),
    })
    document.getElementById('fire-qty').value = '1'
    await window.doFire()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/fire')
    expect(JSON.parse(opts.body)).toMatchObject({ qty: 1 })
  })

  it('logs a success entry on fire', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Fired 1 worker(s) for $40.00.'),
    })
    document.getElementById('fire-qty').value = '1'
    await window.doFire()
    expect(logEntries().some(t => t.includes('Fired'))).toBe(true)
  })

  it('does not call fetch when quantity is 0', async () => {
    document.getElementById('fire-qty').value = '0'
    await window.doFire()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── doAssign ──────────────────────────────────────────────────────────────────

describe('doAssign()', () => {
  beforeEach(() => {
    // Render factory section so assign-<recipe> inputs exist.
    window.renderFactory({ ...MOCK_STATE })
  })

  it('POSTs to /api/assign with recipe and quantity', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Assigned 2 worker(s) to ingot.'),
    })
    document.getElementById('assign-ingot').value = '2'
    await window.doAssign('ingot')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/assign')
    expect(JSON.parse(opts.body)).toMatchObject({ recipe: 'ingot', qty: 2 })
  })

  it('logs a success entry on assignment', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Assigned 1 worker(s) to gear.'),
    })
    document.getElementById('assign-gear').value = '1'
    await window.doAssign('gear')
    expect(logEntries().some(t => t.includes('Assigned'))).toBe(true)
  })

  it('logs an error when assignment fails', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Not enough workers. Max assignable to ingot: 0.'),
    })
    document.getElementById('assign-ingot').value = '99'
    await window.doAssign('ingot')
    expect(document.querySelectorAll('#log-box .log-err').length).toBeGreaterThan(0)
  })
})

// ── doBuyBlueprint ────────────────────────────────────────────────────────────

describe('doBuyBlueprint()', () => {
  it("POSTs to /api/buy_blueprint with the blueprint name", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse("Bought blueprint 'smelter_optimization'."),
    })
    await window.doBuyBlueprint('smelter_optimization')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/buy_blueprint')
    expect(JSON.parse(opts.body)).toMatchObject({ name: 'smelter_optimization' })
  })

  it('logs a success entry on blueprint purchase', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse("Bought blueprint 'precision_molds'."),
    })
    await window.doBuyBlueprint('precision_molds')
    expect(logEntries().some(t => t.includes('Bought'))).toBe(true)
  })

  it('logs an error when blueprint is already owned', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse("Blueprint 'smelter_optimization' already owned."),
    })
    await window.doBuyBlueprint('smelter_optimization')
    expect(document.querySelectorAll('#log-box .log-err').length).toBeGreaterThan(0)
  })
})

// ── doSave / doLoad ──────────────────────────────────────────────────────────

describe('doSave()', () => {
  it('POSTs to /api/save with the selected slot', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse("Game saved to slot 'alpha'."),
    })
    document.getElementById('save-slot').value = 'alpha'
    await window.doSave()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/save')
    expect(JSON.parse(opts.body)).toMatchObject({ slot: 'alpha' })
  })

  it('falls back to default slot when input is empty', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse("Game saved to slot 'default'."),
    })
    document.getElementById('save-slot').value = ''
    await window.doSave()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.slot).toBe('default')
  })
})

describe('doLoad()', () => {
  it('POSTs to /api/load with the selected slot', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse("Game loaded from slot 'alpha'.", { day: 3 }),
    })
    document.getElementById('save-slot').value = 'alpha'
    await window.doLoad()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/load')
    expect(JSON.parse(opts.body)).toMatchObject({ slot: 'alpha' })
    expect(document.getElementById('stat-day').textContent).toBe('3')
  })

  it('logs error style when save slot does not exist', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse("No save found for slot 'missing'."),
    })
    document.getElementById('save-slot').value = 'missing'
    await window.doLoad()
    expect(document.querySelectorAll('#log-box .log-err').length).toBeGreaterThan(0)
  })
})

// ── doAdvanceTime ────────────────────────────────────────────────────────────

describe('doAdvanceTime()', () => {
  it('POSTs to /api/advance_time with selected hours', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => apiResponse('Advanced 4h.', { day: 1, hour: 12, clock: '12:00' }),
    })
    document.getElementById('hours-input').value = '4'
    await window.doAdvanceTime()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/advance_time')
    expect(JSON.parse(opts.body)).toMatchObject({ hours: 4 })
  })

  it('logs a day separator when rolling to next day', async () => {
    const nextState = cloneState({ day: 2 })
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ message: 'Salaries paid: $0.00', state: nextState }),
    })
    document.getElementById('hours-input').value = 'rest'
    await window.doAdvanceTime()
    const daySep = document.querySelector('#log-box .log-day')
    expect(daySep).not.toBeNull()
    expect(daySep.textContent).toContain('2')  // new day number
  })

  it('logs the time advance summary message', async () => {
    const nextState = cloneState({ day: 2 })
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ message: 'Advanced 1h.', state: nextState }),
    })
    document.getElementById('hours-input').value = '1'
    await window.doAdvanceTime()
    expect(logEntries().some(t => t.includes('Advanced'))).toBe(true)
  })

  it('logs a bankruptcy warning when state.bankrupt is true', async () => {
    const bankruptState = cloneState({ day: 2, bankrupt: true, cash: -600 })
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ message: 'Advanced 8h.', state: bankruptState }),
    })
    document.getElementById('hours-input').value = '8'
    await window.doAdvanceTime()
    const warnEntry = Array.from(document.querySelectorAll('#log-box .log-err'))
      .find(el => el.textContent.includes('BANKRUPTCY'))
    expect(warnEntry).not.toBeNull()
  })

  it('defaults to 1 hour when value is invalid', async () => {
    const nextState = cloneState({ day: 2 })
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ message: 'Advanced 1h.', state: nextState }),
    })
    document.getElementById('hours-input').value = 'abc'
    await window.doAdvanceTime()
    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.hours).toBe(1)
  })

  it('updates the time in the status bar', async () => {
    const nextState = cloneState({ day: 1, hour: 16, clock: '16:00' })
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ message: 'Advanced 8h.', state: nextState }),
    })
    document.getElementById('hours-input').value = '8'
    await window.doAdvanceTime()
    expect(document.getElementById('stat-time').textContent).toBe('16:00')
  })
})
