/**
 * Tests for all render* functions and updateCostPreview / updateRecipeInfo.
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
  // Reset to English and a known state before each rendering test.
  window.setLanguage('en')
  window.render({ ...MOCK_STATE })
})

// ── renderStatusBar ───────────────────────────────────────────────────────────

describe('renderStatusBar()', () => {
  it('displays the current day', () => {
    window.renderStatusBar({ ...MOCK_STATE, day: 7 })
    expect(document.getElementById('stat-day').textContent).toBe('7')
  })

  it('displays cash as formatted dollar amount', () => {
    window.renderStatusBar({ ...MOCK_STATE, cash: 1234.56 })
    expect(document.getElementById('stat-cash').textContent).toMatch(/1,234\.56/)
  })

  it('applies val-cash class when cash is non-negative', () => {
    window.renderStatusBar({ ...MOCK_STATE, cash: 0 })
    expect(document.getElementById('stat-cash').className).toContain('val-cash')
  })

  it('applies val-warn class when cash is negative', () => {
    window.renderStatusBar({ ...MOCK_STATE, cash: -50 })
    expect(document.getElementById('stat-cash').className).toContain('val-warn')
  })

  it('displays total worker count', () => {
    window.renderStatusBar({ ...MOCK_STATE, total_workers: 5 })
    expect(document.getElementById('stat-workers').textContent).toBe('5')
  })

  it('displays daily salary', () => {
    window.renderStatusBar({ ...MOCK_STATE, daily_salary: 60.0 })
    expect(document.getElementById('stat-salary').textContent).toBe('$60.00')
  })

  it('shows assigned/free worker detail', () => {
    window.renderStatusBar({ ...MOCK_STATE, assigned_workers: 2, free_workers: 1 })
    const detail = document.getElementById('stat-workers-detail').textContent
    expect(detail).toContain('2')
    expect(detail).toContain('1')
  })
})

// ── renderMarket ──────────────────────────────────────────────────────────────

describe('renderMarket()', () => {
  const marketName = (tr) => tr.cells[0].querySelector('.item-name')?.textContent ?? tr.cells[0].textContent

  it('creates one row per item in ALL_ITEMS (6 items)', () => {
    window.renderMarket(MOCK_STATE)
    const rows = document.querySelectorAll('#market-tbody tr')
    expect(rows.length).toBe(6)
  })

  it('each row displays the item name', () => {
    window.renderMarket(MOCK_STATE)
    const rows = Array.from(document.querySelectorAll('#market-tbody tr'))
    const names = rows.map(marketName)
    expect(names).toContain('ore')
    expect(names).toContain('widget')
  })

  it('each row displays a formatted price', () => {
    window.renderMarket(MOCK_STATE)
    const rows = document.querySelectorAll('#market-tbody tr')
    const firstPrice = rows[0].cells[1].textContent
    expect(firstPrice).toMatch(/^\$\d+\.\d{2}$/)
  })

  it('highlights the selected item row with market-row-selected class', () => {
    window.setSelectedMarketItem('ingot')
    window.renderMarket(MOCK_STATE)
    const rows = Array.from(document.querySelectorAll('#market-tbody tr'))
    const ingotRow = rows.find(tr => marketName(tr) === 'ingot')
    expect(ingotRow?.className).toContain('market-row-selected')
  })

  it('only highlights one row at a time', () => {
    window.setSelectedMarketItem('ore')
    window.renderMarket(MOCK_STATE)
    const selected = document.querySelectorAll('#market-tbody .market-row-selected')
    expect(selected.length).toBe(1)
  })

  it('rows are clickable (onclick is set)', () => {
    window.renderMarket(MOCK_STATE)
    const rows = document.querySelectorAll('#market-tbody tr')
    for (const row of rows) {
      expect(typeof row.onclick).toBe('function')
    }
  })

  it('shows ↑ arrow for positive price change', () => {
    const state = cloneState({ price_change: { ore: 5.0, wood: 0, ingot: 0, gear: 0, widget: 0, scrap: 0 } })
    window.setSelectedMarketItem('ore')
    window.renderMarket(state)
    const rows = Array.from(document.querySelectorAll('#market-tbody tr'))
    const oreRow = rows.find(tr => marketName(tr) === 'ore')
    expect(oreRow?.cells[2].textContent).toContain('↑')
  })

  it('shows ↓ arrow for negative price change', () => {
    const state = cloneState({ price_change: { ore: -3.0, wood: 0, ingot: 0, gear: 0, widget: 0, scrap: 0 } })
    window.setSelectedMarketItem('ore')
    window.renderMarket(state)
    const rows = Array.from(document.querySelectorAll('#market-tbody tr'))
    const oreRow = rows.find(tr => marketName(tr) === 'ore')
    expect(oreRow?.cells[2].textContent).toContain('↓')
  })

  it('disables buy/sell controls and reduces opacity when market is closed', () => {
    const closedState = { ...MOCK_STATE, market_is_open: false }
    window.renderMarket(closedState)
    const buyBtn = document.getElementById('btn-buy')
    const sellBtn = document.getElementById('btn-sell')
    const marketQtyInput = document.getElementById('market-qty')
    expect(buyBtn?.disabled).toBe(true)
    expect(sellBtn?.disabled).toBe(true)
    expect(marketQtyInput?.disabled).toBe(true)
  })

  it('enables buy/sell controls when market is open', () => {
    const openState = { ...MOCK_STATE, market_is_open: true }
    window.renderMarket(openState)
    const buyBtn = document.getElementById('btn-buy')
    const sellBtn = document.getElementById('btn-sell')
    const marketQtyInput = document.getElementById('market-qty')
    expect(buyBtn?.disabled).toBe(false)
    expect(sellBtn?.disabled).toBe(false)
    expect(marketQtyInput?.disabled).toBe(false)
  })
})

// ── renderInventory ───────────────────────────────────────────────────────────

describe('renderInventory()', () => {
  it('creates one card per item in ALL_ITEMS', () => {
    window.renderInventory(MOCK_STATE, 'inventory-sidebar-grid')
    const cards = document.querySelectorAll('#inventory-sidebar-grid .inv-item')
    expect(cards.length).toBe(6)
  })

  const inventoryName = (el) => el.querySelector('.item-name')?.textContent ?? el.textContent

  it('each card shows the item name', () => {
    window.renderInventory(MOCK_STATE, 'inventory-sidebar-grid')
    const names = Array.from(
      document.querySelectorAll('#inventory-sidebar-grid .inv-name')
    ).map(inventoryName)
    expect(names).toContain('ore')
    expect(names).toContain('scrap')
  })

  it('each card shows the item quantity', () => {
    const state = cloneState({ inventory: { ...MOCK_STATE.inventory, ore: 42 } })
    window.renderInventory(state, 'inventory-sidebar-grid')
    const cards = Array.from(document.querySelectorAll('#inventory-sidebar-grid .inv-item'))
    const oreCard = cards.find(c => inventoryName(c.querySelector('.inv-name')) === 'ore')
    expect(oreCard?.querySelector('.inv-qty').textContent).toBe('42')
  })

  it('returns early if targetId does not exist in DOM', () => {
    // Should not throw.
    expect(() => window.renderInventory(MOCK_STATE, 'nonexistent-id')).not.toThrow()
  })
})

// ── renderFactory ─────────────────────────────────────────────────────────────

describe('renderFactory()', () => {
  it('creates one assignment row per recipe (4 recipes)', () => {
    window.renderFactory(MOCK_STATE)
    const rows = document.querySelectorAll('#assign-list .assign-row')
    expect(rows.length).toBe(4)
  })

  it('each row contains a quantity input for assignment', () => {
    window.renderFactory(MOCK_STATE)
    // There should be 4 inputs: assign-ingot, assign-gear, assign-widget, assign-scrap_mix
    for (const recipe of ['ingot', 'gear', 'widget', 'scrap_mix']) {
      const input = document.getElementById(`assign-${recipe}`)
      expect(input).not.toBeNull()
      expect(input.type).toBe('text')
    }
  })

  it('populates input value from current assignments', () => {
    const state = cloneState({ assignments: { ingot: 2, gear: 0, widget: 0, scrap_mix: 0 } })
    window.renderFactory(state)
    expect(document.getElementById('assign-ingot').value).toBe('2')
  })

  it('shows "active" label for assigned recipe', () => {
    const state = cloneState({ assignments: { ingot: 1, gear: 0, widget: 0, scrap_mix: 0 } })
    window.renderFactory(state)
    const rows = document.querySelectorAll('#assign-list .assign-row')
    const ingotRow = Array.from(rows).find(r => r.textContent.includes('ingot'))
    expect(ingotRow?.textContent).toMatch(/active|1/)
  })

  it('shows "idle" label for unassigned recipe', () => {
    const state = cloneState({ assignments: { ingot: 0, gear: 0, widget: 0, scrap_mix: 0 } })
    window.renderFactory(state)
    const rows = document.querySelectorAll('#assign-list .assign-row')
    const gearRow = Array.from(rows).find(r => r.textContent.includes('gear'))
    expect(gearRow?.textContent).toContain('idle')
  })

  it('renders one machine card per recipe', () => {
    window.renderFactory(MOCK_STATE)
    const cards = document.querySelectorAll('#machine-list .machine-card')
    expect(cards.length).toBe(4)
  })

  it('shows buy button for a missing machine', () => {
    window.renderFactory(MOCK_STATE)
    const cards = Array.from(document.querySelectorAll('#machine-list .machine-card'))
    const gearCard = cards.find(card => card.textContent.includes('Gear Press'))
    expect(gearCard?.textContent).toContain('Buy machine')
  })

  it('shows maintenance due state for owned worn machine', () => {
    window.renderFactory(MOCK_STATE)
    const cards = Array.from(document.querySelectorAll('#machine-list .machine-card'))
    const recyclerCard = cards.find(card => card.textContent.includes('Recycler'))
    expect(recyclerCard?.textContent).toContain('Maintenance due')
  })

  it('hides interval selector when machine strategy is corrective', () => {
    window.renderFactory(MOCK_STATE)
    expect(document.getElementById('machine-interval-ingot')).toBeNull()
  })

  it('shows interval selector when machine strategy is preventive', () => {
    window.renderFactory(MOCK_STATE)
    expect(document.getElementById('machine-interval-scrap_mix')).not.toBeNull()
  })

  it('displays days since last service for owned machines', () => {
    window.renderFactory(MOCK_STATE)
    const cards = Array.from(document.querySelectorAll('#machine-list .machine-card'))
    const smelterCard = cards.find(card => card.textContent.includes('Smelter'))
    expect(smelterCard?.textContent).toContain('Days since service: 3d')
  })

  it('disables service button when days since service is 0', () => {
    const stateWithFreshService = cloneState(MOCK_STATE)
    stateWithFreshService.machines.ingot.days_since_service = 0
    window.renderFactory(stateWithFreshService)
    // After fresh service, the button should be disabled
    const smelterCard = Array.from(document.querySelectorAll('#machine-list .machine-card'))
      .find(card => card.textContent.includes('Smelter'))
    const serviceBtn = Array.from(smelterCard?.querySelectorAll('button') || [])
      .find(btn => !btn.textContent.includes('Buy'))
    expect(serviceBtn?.disabled).toBe(true)
  })

  it('enables service button when days since service is greater than 0', () => {
    // Create a state with an owned machine that has wear since last service
    const enabledBtnState = { ...MOCK_STATE }
    enabledBtnState.machines = { ...MOCK_STATE.machines }
    enabledBtnState.machines.ingot = {
      ...MOCK_STATE.machines.ingot,
      days_since_service: 3  // Has days since last service, so button should be enabled
    }
    window.renderFactory(enabledBtnState)
    const smelterCard = Array.from(document.querySelectorAll('#machine-list .machine-card'))
      .find(card => card.textContent.includes('Smelter'))
    const serviceBtn = Array.from(smelterCard?.querySelectorAll('button') || [])
      .find(btn => !btn.textContent.includes('Buy'))
    expect(serviceBtn?.disabled).toBe(false)
  })

  it('does not show "Life left" in machine stats', () => {
    window.renderFactory(MOCK_STATE)
    const factoryPanel = document.getElementById('tab-factory')
    // Search for the text "Life left" or "machineLife" label
    const hasLifeLeft = factoryPanel?.textContent.includes('Life left') || 
                        factoryPanel?.textContent.includes('machineLife')
    expect(hasLifeLeft).toBe(false)
  })

  it('shows only "Wear" in machine stats, not "Life left"', () => {
    window.renderFactory(MOCK_STATE)
    const cards = Array.from(document.querySelectorAll('#machine-list .machine-card'))
    const smelterCard = cards.find(card => card.textContent.includes('Smelter'))
    expect(smelterCard?.textContent).toContain('Wear: 3 / 60d')
    expect(smelterCard?.textContent).not.toContain('Life:')
  })
})

// ── renderBlueprints ──────────────────────────────────────────────────────────

describe('renderBlueprints()', () => {
  it('creates one card per blueprint (3 blueprints)', () => {
    window.renderBlueprints(MOCK_STATE)
    const cards = document.querySelectorAll('#blueprints-grid .bp-card')
    expect(cards.length).toBe(3)
  })

  it('shows cost for each blueprint', () => {
    window.renderBlueprints(MOCK_STATE)
    const costs = Array.from(document.querySelectorAll('#blueprints-grid .bp-cost'))
    const costTexts = costs.map(el => el.textContent)
    expect(costTexts).toContain('$450.00')
  })

  it('shows blueprint description', () => {
    window.renderBlueprints(MOCK_STATE)
    const descs = Array.from(document.querySelectorAll('#blueprints-grid .bp-desc'))
      .map(el => el.textContent)
    expect(descs.some(d => d.includes('ore'))).toBe(true)
  })

  it('marks owned blueprints with "owned" CSS class', () => {
    const state = cloneState({
      owned_blueprints: ['smelter_optimization'],
      blueprints: {
        ...MOCK_STATE.blueprints,
        smelter_optimization: { ...MOCK_STATE.blueprints.smelter_optimization, owned: true },
      },
    })
    window.renderBlueprints(state)
    const owned = document.querySelector('#blueprints-grid .bp-card.owned')
    expect(owned).not.toBeNull()
  })

  it('disables buy button for owned blueprint', () => {
    const state = cloneState({
      owned_blueprints: ['precision_molds'],
      blueprints: {
        ...MOCK_STATE.blueprints,
        precision_molds: { ...MOCK_STATE.blueprints.precision_molds, owned: true },
      },
    })
    window.renderBlueprints(state)
    const cards = Array.from(document.querySelectorAll('#blueprints-grid .bp-card'))
    const pmCard = cards[1] // precision_molds is second
    const btn = pmCard?.querySelector('button')
    expect(btn?.disabled).toBe(true)
  })
})

// ── renderMargins ─────────────────────────────────────────────────────────────

describe('renderMargins()', () => {
  it('creates one row per recipe (4 recipes)', () => {
    window.renderMargins(MOCK_STATE)
    const rows = document.querySelectorAll('#margins-tbody tr')
    expect(rows.length).toBe(4)
  })

  const marginRecipeName = (tr) => tr.cells[0].querySelector('.item-name')?.textContent ?? tr.cells[0].textContent

  it('shows recipe name in each row', () => {
    window.renderMargins(MOCK_STATE)
    const rows = Array.from(document.querySelectorAll('#margins-tbody tr'))
    const names = rows.map(marginRecipeName)
    expect(names).toContain('ingot')
    expect(names).toContain('widget')
  })

  it('applies "profit" class for positive margin', () => {
    window.renderMargins(MOCK_STATE)
    // ingot has margin 11.0 → profitable
    const rows = document.querySelectorAll('#margins-tbody tr')
    const ingotRow = Array.from(rows).find(tr => marginRecipeName(tr) === 'ingot')
    const marginCell = ingotRow?.cells[5]
    expect(marginCell?.className).toBe('profit')
  })

  it('applies "loss" class for negative margin', () => {
    window.renderMargins(MOCK_STATE)
    // scrap_mix has margin -17.0 → unprofitable
    const rows = document.querySelectorAll('#margins-tbody tr')
    const scrapRow = Array.from(rows).find(tr => marginRecipeName(tr) === 'scrap_mix')
    const marginCell = scrapRow?.cells[5]
    expect(marginCell?.className).toBe('loss')
  })

  it('shows formatted input cost, output value, and margin', () => {
    window.renderMargins(MOCK_STATE)
    const rows = Array.from(document.querySelectorAll('#margins-tbody tr'))
    const ingotRow = rows.find(tr => marginRecipeName(tr) === 'ingot')
    // input_cost = 24, output_value = 35, margin = 11
    expect(ingotRow?.cells[2].textContent).toBe('$24.00')
    expect(ingotRow?.cells[4].textContent).toBe('$35.00')
    expect(ingotRow?.cells[5].textContent).toBe('+$11.00')
  })
})

// ── updateCostPreview ──────────────────────────────────────────────────────────

describe('updateCostPreview()', () => {
  beforeEach(() => {
    window.render({ ...MOCK_STATE })
    window.setSelectedMarketItem('ore')
  })

  it('calculates cost from quantity × selected item price', () => {
    document.getElementById('market-qty').value = '5'
    window.updateCostPreview()
    // ore price = 12.0, qty = 5 → $60.00
    expect(document.getElementById('cost-preview').textContent).toBe('$60.00')
  })

  it('shows $0.00 when quantity is 0', () => {
    document.getElementById('market-qty').value = '0'
    window.updateCostPreview()
    expect(document.getElementById('cost-preview').textContent).toBe('$0.00')
  })

  it('highlights the selected market row', () => {
    window.setSelectedMarketItem('gear')
    window.updateCostPreview()
    const selectedRow = document.querySelector('#market-tbody tr.market-row-selected')
    expect(selectedRow?.textContent).toContain('gear')
  })
})

// ── updateRecipeInfo ──────────────────────────────────────────────────────────

describe('updateRecipeInfo()', () => {
  beforeEach(() => {
    window.render({ ...MOCK_STATE })
  })

  it('shows inputs for the selected recipe', () => {
    document.getElementById('craft-recipe').value = 'ingot'
    window.updateRecipeInfo()
    expect(document.getElementById('recipe-info').innerHTML).toContain('ore')
  })

  it('shows outputs for the selected recipe', () => {
    document.getElementById('craft-recipe').value = 'gear'
    window.updateRecipeInfo()
    const info = document.getElementById('recipe-info').innerHTML
    expect(info).toContain('gear')
    expect(info).toContain('Outputs')
  })

  it('shows inputs and outputs labels', () => {
    document.getElementById('craft-recipe').value = 'widget'
    window.updateRecipeInfo()
    const info = document.getElementById('recipe-info').innerHTML
    expect(info).toContain('Inputs')
    expect(info).toContain('Outputs')
  })

  it('highlights missing inputs in red (loss class)', () => {
    const state = cloneState(MOCK_STATE)
    state.inventory.ore = 0
    window.render(state)
    document.getElementById('craft-recipe').value = 'ingot'
    window.updateRecipeInfo()
    const info = document.getElementById('recipe-info').innerHTML
    expect(info).toContain('class="loss"')
    expect(info).toContain('ore')
  })

  it('highlights missing machine status in red (loss class)', () => {
    window.render(MOCK_STATE)
    document.getElementById('craft-recipe').value = 'gear'
    window.updateRecipeInfo()
    const info = document.getElementById('recipe-info').innerHTML
    expect(info).toContain('Required machine')
    expect(info).toContain('class="loss"')
    expect(info).toContain('Missing')
  })

  it('highlights soft/hard failed machine status in red (loss class)', () => {
    const state = cloneState(MOCK_STATE)
    state.machines.ingot.owned = true
    state.machines.ingot.status = 'soft_failure'
    window.render(state)
    document.getElementById('craft-recipe').value = 'ingot'
    window.updateRecipeInfo()
    const info = document.getElementById('recipe-info').innerHTML
    expect(info).toContain('class="loss"')
    expect(info).toContain('Soft failure')
  })
})
