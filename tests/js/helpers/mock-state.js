/**
 * Canonical mock of the /api/state response payload.
 * Mirrors what web_gui._game_state() returns for a freshly-constructed FactoryGame.
 */
export const MOCK_STATE = {
  day: 1,
  hour: 8,
  clock: "08:00",
  market_open_hour: 8,
  market_close_hour: 18,
  market_is_open: true,
  cash: 500.0,
  items: ["ore", "wood", "ingot", "gear", "widget", "scrap"],
  recipes: ["ingot", "gear", "widget", "scrap_mix"],
  item_icons: {
    ore: "🪨",
    wood: "🪵",
    ingot: "🔩",
    gear: "⚙️",
    widget: "📦",
    scrap: "🗑️",
  },
  total_workers: 2,
  assigned_workers: 1,
  free_workers: 1,
  worker_hire_cost: 150.0,
  worker_fire_fee: 40.0,
  daily_salary: 40.0,
  inventory: {
    ore: 5, wood: 3, ingot: 2, gear: 1, widget: 0, scrap: 0,
  },
  market_prices: {
    ore: 12.0, wood: 9.0, ingot: 35.0, gear: 85.0, widget: 190.0, scrap: 4.0,
  },
  price_bounds: {
    ore:    { min: 6.0,   max: 28.0  },
    wood:   { min: 5.0,   max: 24.0  },
    ingot:  { min: 18.0,  max: 78.0  },
    gear:   { min: 45.0,  max: 170.0 },
    widget: { min: 95.0,  max: 380.0 },
    scrap:  { min: 1.5,   max: 12.0  },
  },
  price_history: [
    { day: 1, ore: 12.0, wood: 9.0, ingot: 35.0, gear: 85.0, widget: 190.0, scrap: 4.0 },
  ],
  price_change: {
    ore: 2.5, wood: -1.0, ingot: 0.0, gear: 3.1, widget: -0.5, scrap: 0.0,
  },
  assignments: { ingot: 1, gear: 0, widget: 0, scrap_mix: 0 },
  owned_blueprints: [],
  blueprints: {
    smelter_optimization: { cost: 450.0, description: 'Ingot recipe consumes 1 less ore (min 1).', owned: false },
    precision_molds:      { cost: 700.0, description: 'Gear recipe produces +1 gear per batch.',   owned: false },
    assembly_jigs:        { cost: 1000.0, description: 'Widget recipe consumes 1 less ingot (min 0).', owned: false },
  },
  effective_recipes: {
    ingot:    { inputs: { ore: 2 },                outputs: { ingot: 1 } },
    gear:     { inputs: { ingot: 2, wood: 1 },     outputs: { gear: 1  } },
    widget:   { inputs: { gear: 1, ingot: 1 },     outputs: { widget: 1 } },
    scrap_mix:{ inputs: { ore: 1, wood: 1 },       outputs: { scrap: 1 } },
  },
  margins: {
    ingot:    { input_cost: 24.0,  output_value: 35.0,  margin: 11.0  },
    gear:     { input_cost: 79.0,  output_value: 85.0,  margin: 6.0   },
    widget:   { input_cost: 120.0, output_value: 190.0, margin: 70.0  },
    scrap_mix:{ input_cost: 21.0,  output_value: 4.0,   margin: -17.0 },
  },
  bankrupt: false,
}

/** Deep-clone so tests can mutate without poisoning the base object. */
export function cloneState(overrides = {}) {
  return Object.assign(JSON.parse(JSON.stringify(MOCK_STATE)), overrides)
}
