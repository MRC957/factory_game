/**
 * Tests for the Max-helper functions:
 * setMarketMax, setCraftMax, setHireMax, setFireMax.
 */
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { createDOM }              from './helpers/dom.js'
import { loadGame }               from './helpers/load-game.js'
import { MOCK_STATE, cloneState } from './helpers/mock-state.js'

beforeAll(async () => {
  createDOM()

  vi.stubGlobal('localStorage', {
    _s: {},
    getItem(k)    { return this._s[k] ?? null },
    setItem(k, v) { this._s[k] = String(v) },
    removeItem(k) { delete this._s[k] },
  })

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({ ...MOCK_STATE }),
  }))

  await loadGame()
})

beforeEach(() => {
  // Set a well-known game state before each test.
  window.render({ ...MOCK_STATE })
  window.setSelectedMarketItem('ore')
})

// ── setMarketMax('buy') ───────────────────────────────────────────────────────

describe("setMarketMax('buy')", () => {
  it('sets market-qty to floor(cash / price)', () => {
    // MOCK_STATE: cash=500, ore price=12 → floor(500/12)=41
    window.setMarketMax('buy')
    expect(Number(document.getElementById('market-qty').value)).toBe(41)
  })

  it('sets quantity to 0 when cash is 0', () => {
    const broke = cloneState({ cash: 0 })
    window.render(broke)
    window.setMarketMax('buy')
    expect(Number(document.getElementById('market-qty').value)).toBe(0)
  })

  it('uses the currently selected item price', () => {
    window.render({ ...MOCK_STATE })
    window.setSelectedMarketItem('widget') // price 190, cash 500 → floor(500/190)=2
    window.setMarketMax('buy')
    expect(Number(document.getElementById('market-qty').value)).toBe(2)
  })

  it('updates the cost preview after setting max', () => {
    window.setMarketMax('buy')
    // cost-preview should be updated (not necessarily a specific value, just not empty)
    expect(document.getElementById('cost-preview').textContent).toMatch(/^\$/)
  })
})

// ── setMarketMax('sell') ──────────────────────────────────────────────────────

describe("setMarketMax('sell')", () => {
  it('sets market-qty to the inventory count of the selected item', () => {
    // MOCK_STATE: inventory.ore = 5
    window.setSelectedMarketItem('ore')
    window.setMarketMax('sell')
    expect(Number(document.getElementById('market-qty').value)).toBe(5)
  })

  it('sets quantity to 0 when inventory is empty', () => {
    window.setSelectedMarketItem('widget') // inventory.widget = 0
    window.setMarketMax('sell')
    expect(Number(document.getElementById('market-qty').value)).toBe(0)
  })

  it('uses the currently selected item inventory', () => {
    window.setSelectedMarketItem('wood') // inventory.wood = 3
    window.setMarketMax('sell')
    expect(Number(document.getElementById('market-qty').value)).toBe(3)
  })
})

// ── setCraftMax ────────────────────────────────────────────────────────────────

describe('setCraftMax()', () => {
  it('sets craft-qty limited by the scarcest input', () => {
    // ingot recipe: ore×2; MOCK_STATE inventory: ore=5 → floor(5/2)=2 batches
    document.getElementById('craft-recipe').value = 'ingot'
    window.setCraftMax()
    expect(Number(document.getElementById('craft-qty').value)).toBe(2)
  })

  it('respects multi-input recipes (limited by scarcer resource)', () => {
    // gear: ingot×2 + wood×1; inventory: ingot=2→1 batch, wood=3→3 batches → min=1
    document.getElementById('craft-recipe').value = 'gear'
    window.setCraftMax()
    expect(Number(document.getElementById('craft-qty').value)).toBe(1)
  })

  it('sets 0 when inventory is empty', () => {
    const empty = cloneState({ inventory: { ore: 0, wood: 0, ingot: 0, gear: 0, widget: 0, scrap: 0 } })
    window.render(empty)
    document.getElementById('craft-recipe').value = 'ingot'
    window.setCraftMax()
    expect(Number(document.getElementById('craft-qty').value)).toBe(0)
  })

  it('handles assembly_jigs blueprint (ingot cost = 0) correctly', () => {
    // With assembly_jigs: widget needs gear×1 + ingot×0
    const blueprintState = cloneState({
      inventory: { ore: 0, wood: 0, ingot: 0, gear: 3, widget: 0, scrap: 0 },
      effective_recipes: {
        ...MOCK_STATE.effective_recipes,
        widget: { inputs: { gear: 1, ingot: 0 }, outputs: { widget: 1 } },
      },
    })
    window.render(blueprintState)
    document.getElementById('craft-recipe').value = 'widget'
    window.setCraftMax()
    // ingot cost is 0 → ignore it; limited only by gear=3 → 3 batches
    expect(Number(document.getElementById('craft-qty').value)).toBe(3)
  })
})

// ── setHireMax ────────────────────────────────────────────────────────────────

describe('setHireMax()', () => {
  it('sets hire-qty to floor(cash / hire_cost)', () => {
    // MOCK_STATE: cash=500, hire_cost=150 → floor(500/150)=3
    window.setHireMax()
    expect(Number(document.getElementById('hire-qty').value)).toBe(3)
  })

  it('sets 0 when cash < hire cost', () => {
    const broke = cloneState({ cash: 100, worker_hire_cost: 150 })
    window.render(broke)
    window.setHireMax()
    expect(Number(document.getElementById('hire-qty').value)).toBe(0)
  })

  it('calculates correctly with large cash balance', () => {
    const rich = cloneState({ cash: 1500, worker_hire_cost: 150 })
    window.render(rich)
    window.setHireMax()
    expect(Number(document.getElementById('hire-qty').value)).toBe(10)
  })
})

// ── setFireMax ────────────────────────────────────────────────────────────────

describe('setFireMax()', () => {
  it('is limited by the number of workers when fewer than cash allows', () => {
    // MOCK_STATE: cash=500, fire_fee=40 → floor(500/40)=12; total_workers=2 → min=2
    window.setFireMax()
    expect(Number(document.getElementById('fire-qty').value)).toBe(2)
  })

  it('is limited by cash when fewer workers can be afforded than headcount', () => {
    const state = cloneState({ cash: 30, worker_fire_fee: 40, total_workers: 5 })
    // floor(30/40)=0; min(0, 5)=0
    window.render(state)
    window.setFireMax()
    expect(Number(document.getElementById('fire-qty').value)).toBe(0)
  })

  it('sets 0 when there are no workers', () => {
    const noWorkers = cloneState({ cash: 1000, total_workers: 0 })
    window.render(noWorkers)
    window.setFireMax()
    expect(Number(document.getElementById('fire-qty').value)).toBe(0)
  })

  it('returns the minimum of cash capacity and headcount', () => {
    const state = cloneState({ cash: 80, worker_fire_fee: 40, total_workers: 10 })
    // floor(80/40)=2; min(2,10)=2
    window.render(state)
    window.setFireMax()
    expect(Number(document.getElementById('fire-qty').value)).toBe(2)
  })
})
