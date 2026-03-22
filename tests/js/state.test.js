/**
 * Tests for DOM-state management functions:
 * setSelectedMarketItem, setLanguage, toggleInventorySidebar,
 * togglePriceHistory, switchTab, applyTranslations.
 */
import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { createDOM }  from './helpers/dom.js'
import { loadGame }   from './helpers/load-game.js'
import { MOCK_STATE } from './helpers/mock-state.js'

let lsStore = {}

beforeAll(async () => {
  createDOM()

  lsStore = {}
  vi.stubGlobal('localStorage', {
    getItem(k)    { return lsStore[k] ?? null },
    setItem(k, v) { lsStore[k] = String(v) },
    removeItem(k) { delete lsStore[k] },
  })

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({ ...MOCK_STATE }),
  }))

  await loadGame()
  // Render initial state so DOM reflects a valid game snapshot.
  window.render({ ...MOCK_STATE })
})

// ── setSelectedMarketItem ─────────────────────────────────────────────────────

describe('setSelectedMarketItem()', () => {
  it('updates the #selected-market-item text', () => {
    window.setSelectedMarketItem('gear')
    expect(document.getElementById('selected-market-item').textContent).toBe('gear')
  })

  it('highlights the correct row in the market table', () => {
    window.setSelectedMarketItem('ingot')
    const rows = document.querySelectorAll('#market-tbody tr')
    const ingotRow = Array.from(rows).find(tr => tr.textContent.includes('ingot'))
    expect(ingotRow?.className).toContain('market-row-selected')
  })

  it('removes highlight from previously selected row', () => {
    window.setSelectedMarketItem('ore')
    window.setSelectedMarketItem('widget')
    const rows = document.querySelectorAll('#market-tbody tr')
    const oreRow = Array.from(rows).find(tr =>
      (tr.cells[0]?.querySelector('.item-name')?.textContent ?? tr.cells[0]?.textContent) === 'ore'
    )
    expect(oreRow?.className).not.toContain('market-row-selected')
  })

  it('accepts all valid items', () => {
    for (const item of ['ore', 'wood', 'ingot', 'gear', 'widget', 'scrap']) {
      window.setSelectedMarketItem(item)
      expect(document.getElementById('selected-market-item').textContent).toBe(item)
    }
  })

  it('ignores unknown items', () => {
    window.setSelectedMarketItem('ore')
    window.setSelectedMarketItem('unobtanium')
    // Should still show 'ore'
    expect(document.getElementById('selected-market-item').textContent).toBe('ore')
  })
})

// ── setLanguage ───────────────────────────────────────────────────────────────

describe('setLanguage()', () => {
  afterEach(() => {
    window.setLanguage('en')
    lsStore = {}
  })

  it('switches to French and persists to localStorage', () => {
    window.setLanguage('fr')
    expect(lsStore['factory_lang']).toBe('fr')
  })

  it('switches back to English and persists', () => {
    window.setLanguage('fr')
    window.setLanguage('en')
    expect(lsStore['factory_lang']).toBe('en')
  })

  it('unknown lang string defaults to English', () => {
    window.setLanguage('de') // unsupported → falls back to 'en'
    expect(window.t('buy')).toBe('Buy')
  })

  it('updates DOM labels on language switch', () => {
    window.setLanguage('fr')
    expect(document.getElementById('btn-buy').textContent).toBe('Acheter')
    window.setLanguage('en')
    expect(document.getElementById('btn-buy').textContent).toBe('Buy')
  })

  it('updates the page title on switch', () => {
    window.setLanguage('fr')
    expect(document.title).toBe('⚙ USINE GAME')
    window.setLanguage('en')
    expect(document.title).toBe('⚙ FACTORY GAME')
  })
})

// ── toggleInventorySidebar ────────────────────────────────────────────────────

describe('toggleInventorySidebar()', () => {
  afterEach(() => {
    // Ensure sidebar is expanded (not minimized) after each test.
    const sidebar = document.getElementById('inventory-sidebar')
    if (sidebar.classList.contains('minimized')) {
      window.toggleInventorySidebar()
    }
  })

  it('adds "minimized" class to sidebar when toggled once', () => {
    window.toggleInventorySidebar()
    expect(document.getElementById('inventory-sidebar').classList.contains('minimized')).toBe(true)
  })

  it('removes "minimized" class on second toggle', () => {
    window.toggleInventorySidebar()
    window.toggleInventorySidebar()
    expect(document.getElementById('inventory-sidebar').classList.contains('minimized')).toBe(false)
  })

  it('persists minimized state to localStorage', () => {
    window.toggleInventorySidebar()
    expect(lsStore['inventory_sidebar_minimized']).toBe('1')
  })

  it('persists expanded state to localStorage', () => {
    window.toggleInventorySidebar() // minimize
    window.toggleInventorySidebar() // expand
    expect(lsStore['inventory_sidebar_minimized']).toBe('0')
  })

  it('updates the toggle button text', () => {
    const btn = document.getElementById('btn-toggle-inventory')
    window.toggleInventorySidebar() // minimize → show expand arrow
    expect(btn.textContent).toBe('▶')
    window.toggleInventorySidebar() // expand → show collapse arrow
    expect(btn.textContent).toBe('◀')
  })
})

// ── togglePriceHistory ────────────────────────────────────────────────────────

describe('togglePriceHistory()', () => {
  afterEach(() => {
    // Ensure panel is hidden after each test.
    const panel = document.getElementById('price-history-panel')
    if (panel.style.display !== 'none') {
      window.togglePriceHistory()
    }
  })

  it('shows the price-history-panel on first toggle', () => {
    window.togglePriceHistory()
    expect(document.getElementById('price-history-panel').style.display).toBe('block')
  })

  it('hides the panel on second toggle', () => {
    window.togglePriceHistory()
    window.togglePriceHistory()
    expect(document.getElementById('price-history-panel').style.display).toBe('none')
  })

  it('updates the toggle button text when showing', () => {
    window.setLanguage('en')
    window.togglePriceHistory()
    expect(document.getElementById('btn-toggle-history').textContent).toBe(
      window.t('hidePriceHistory')
    )
  })

  it('updates the toggle button text when hiding', () => {
    window.setLanguage('en')
    window.togglePriceHistory() // show
    window.togglePriceHistory() // hide
    expect(document.getElementById('btn-toggle-history').textContent).toBe(
      window.t('showPriceHistory')
    )
  })
})

// ── switchTab ─────────────────────────────────────────────────────────────────

describe('switchTab()', () => {
  it('activates the target tab panel', () => {
    window.switchTab('factory')
    expect(document.getElementById('tab-factory').classList.contains('active')).toBe(true)
  })

  it('deactivates all other tab panels', () => {
    window.switchTab('blueprints')
    const inactive = ['market', 'factory', 'margins']
    for (const name of inactive) {
      expect(document.getElementById(`tab-${name}`).classList.contains('active')).toBe(false)
    }
  })

  it('activates the corresponding tab button', () => {
    window.switchTab('margins')
    const btn = document.querySelector('#tab-bar .tab-btn[data-tab="margins"]')
    expect(btn?.classList.contains('active')).toBe(true)
  })

  it('deactivates all other tab buttons', () => {
    window.switchTab('market')
    const others = ['factory', 'blueprints', 'margins']
    for (const name of others) {
      const btn = document.querySelector(`#tab-bar .tab-btn[data-tab="${name}"]`)
      expect(btn?.classList.contains('active')).toBe(false)
    }
  })

  it('can switch between all four tabs', () => {
    for (const name of ['market', 'factory', 'blueprints', 'margins']) {
      window.switchTab(name)
      expect(document.getElementById(`tab-${name}`).classList.contains('active')).toBe(true)
    }
  })
})

// ── applyTranslations ─────────────────────────────────────────────────────────

describe('applyTranslations()', () => {
  it('sets tab button text in English', () => {
    window.setLanguage('en')
    expect(document.getElementById('tab-btn-market').textContent).toBe('Market')
    expect(document.getElementById('tab-btn-factory').textContent).toBe('Factory')
  })

  it('sets tab button text in French', () => {
    window.setLanguage('fr')
    expect(document.getElementById('tab-btn-market').textContent).toBe('Marché')
    window.setLanguage('en')
  })

  it('sets the Next Day button label', () => {
    window.setLanguage('en')
    expect(document.getElementById('btn-next-day').textContent).toBe('⏭ Next Day')
  })
})
