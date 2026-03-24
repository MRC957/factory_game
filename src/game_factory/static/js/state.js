// ── State ───────────────────────────────────────────────────────────────
// G holds the latest snapshot from /api/state (or embedded in action responses).
// All render functions read from G, so they can be re-run cheaply after any action.
let G = null;

// Catalog fallbacks used before the first /api/state payload arrives.
const FALLBACK_ITEMS   = ["ore", "wood", "ingot", "gear", "widget", "scrap"];
const FALLBACK_RECIPES = ["ingot", "gear", "widget", "scrap_mix"];

// Emoji icons for each item / recipe name, shown in market, inventory, etc.
const FALLBACK_ITEM_EMOJI = {
  ore:      "🪨",
  wood:     "🪵",
  ingot:    "🔩",
  gear:     "⚙️",
  widget:   "📦",
  scrap:    "🗑️",
  scrap_mix:"🗑️",
};

function allItems(state = G) {
  return Array.isArray(state?.items) && state.items.length > 0 ? state.items : FALLBACK_ITEMS;
}

function allRecipes(state = G) {
  return Array.isArray(state?.recipes) && state.recipes.length > 0 ? state.recipes : FALLBACK_RECIPES;
}

/** Returns a <span> element string with the emoji for a given item/recipe name. */
function itemIcon(name) {
  const emoji = G?.item_icons?.[name] ?? FALLBACK_ITEM_EMOJI[name];
  return emoji ? `<span class="item-icon" aria-hidden="true">${emoji}</span>` : "";
}
let priceHistoryVisible = false;
let selectedMarketItem = "ore";
let inventorySidebarMinimized = localStorage.getItem("inventory_sidebar_minimized") === "1";

const I18N = {
  en: {
    title: "⚙ FACTORY GAME",
    day: "Day",
    time: "Time",
    marketStatus: "Market",
    marketOpen: "Open",
    marketClosed: "Closed",
    cash: "Cash",
    workers: "Workers",
    dailySalary: "Daily salary",
    language: "Language",
    tabMarket: "Market",
    tabFactory: "Factory",
    tabBlueprints: "Blueprints",
    tabMargins: "Margins",
    marketPrices: "Market Prices",
    item: "Item",
    selectedItem: "Selected item",
    price: "Price",
    change: "Change",
    buySell: "Buy / Sell",
    quantity: "Quantity",
    maxBuy: "Max Buy",
    maxSell: "Max Sell",
    total: "Total",
    buy: "Buy",
    sell: "Sell",
    inventory: "Inventory",
    collapseInventory: "Collapse inventory",
    expandInventory: "Expand inventory",
    priceHistory: "Price History",
    showPriceHistory: "Show Price History",
    hidePriceHistory: "Hide Price History",
    manualCrafting: "Manual Crafting",
    recipe: "Recipe",
    batches: "Batches",
    maxCraft: "Max Craft",
    craft: "Craft",
    workersTitle: "Workers",
    hireQuantity: "Hire quantity ($150 each)",
    maxHire: "Max Hire",
    hireWorkers: "Hire Workers",
    fireQuantity: "Fire quantity ($40 fee each)",
    maxFire: "Max Fire",
    fireWorkers: "Fire Workers",
    automationAssignment: "Automation Assignment",
    automationNote: "Workers produce 1 batch per assigned worker per day automatically.",
    automationPreviewTitle: "End-of-day automation preview",
    automationPreviewNone: "No automated output expected with current assignments and inputs.",
    machineFleetTitle: "Machines",
    machineNote: "Buy the required machine for each recipe, then keep it reliable with preventive maintenance or corrective repairs.",
    machineRequired: "Required machine",
    machineStatus: "Status",
    machineStrategy: "Strategy",
    machineInterval: "Interval",
    machineWear: "Wear",
    machineLife: "Life left",
    machineBuy: "Buy machine",
    machineService: "Service",
    machineRepair: "Repair",
    machineCorrective: "Corrective",
    machinePreventive: "Preventive",
    machineDue: "Maintenance due",
    machineOwned: "Owned",
    machineMissing: "Missing",
    machineOperational: "Operational",
    machineSoftFailure: "Soft failure",
    machineHardFailure: "Hard failure",
    hoursToAdvance: "Hours to advance",
    advanceTime: "⏭ Advance Time",
    restOfDay: "Rest of day",
    save: "Save",
    load: "Load",
    saveSlot: "Slot",
    recipeHint: "Select a recipe to see its inputs and outputs.",
    inputs: "Inputs",
    outputs: "Outputs",
    notEnoughHistory: "Not enough history yet for {item}. Advance days to build the graph.",
    latestHistory: "{item} latest: {price} on day {day}.",
    historyRange: "Day {start} → Day {end}",
    workersDetail: "({assigned} assigned, {free} free)",
    active: "active",
    idle: "idle"
  },
  fr: {
    title: "⚙ USINE GAME",
    day: "Jour",
    time: "Heure",
    marketStatus: "Marché",
    marketOpen: "Ouvert",
    marketClosed: "Fermé",
    cash: "Trésorerie",
    workers: "Ouvriers",
    dailySalary: "Salaire journalier",
    language: "Langue",
    tabMarket: "Marché",
    tabFactory: "Usine",
    tabBlueprints: "Plans",
    tabMargins: "Marges",
    marketPrices: "Prix du marché",
    item: "Article",
    selectedItem: "Article sélectionné",
    price: "Prix",
    change: "Variation",
    buySell: "Acheter / Vendre",
    quantity: "Quantité",
    maxBuy: "Max Acheter",
    maxSell: "Max Vendre",
    total: "Total",
    buy: "Acheter",
    sell: "Vendre",
    inventory: "Inventaire",
    collapseInventory: "Réduire l'inventaire",
    expandInventory: "Agrandir l'inventaire",
    priceHistory: "Historique des prix",
    showPriceHistory: "Afficher l'historique",
    hidePriceHistory: "Masquer l'historique",
    manualCrafting: "Fabrication manuelle",
    recipe: "Recette",
    batches: "Lots",
    maxCraft: "Max Fabriquer",
    craft: "Fabriquer",
    workersTitle: "Ouvriers",
    hireQuantity: "Quantité à embaucher (150$ chacun)",
    maxHire: "Max Embauche",
    hireWorkers: "Embaucher",
    fireQuantity: "Quantité à licencier (40$ de coût chacun)",
    maxFire: "Max Licencier",
    fireWorkers: "Licencier",
    automationAssignment: "Affectation automatique",
    automationNote: "Chaque ouvrier affecté produit 1 lot par jour automatiquement.",
    automationPreviewTitle: "Aperçu de production automatique en fin de journée",
    automationPreviewNone: "Aucune production automatique attendue avec les affectations et stocks actuels.",
    machineFleetTitle: "Machines",
    machineNote: "Achetez la machine requise pour chaque recette, puis gardez-la fiable avec la maintenance préventive ou les réparations correctives.",
    machineRequired: "Machine requise",
    machineStatus: "État",
    machineStrategy: "Stratégie",
    machineInterval: "Intervalle",
    machineWear: "Usure",
    machineLife: "Vie restante",
    machineBuy: "Acheter la machine",
    machineService: "Maintenir",
    machineRepair: "Réparer",
    machineCorrective: "Corrective",
    machinePreventive: "Préventive",
    machineDue: "Maintenance due",
    machineOwned: "Possédée",
    machineMissing: "Absente",
    machineOperational: "Opérationnelle",
    machineSoftFailure: "Panne partielle",
    machineHardFailure: "Panne majeure",
    hoursToAdvance: "Heures à avancer",
    advanceTime: "⏭ Avancer le temps",
    restOfDay: "Fin de journée",
    save: "Sauvegarder",
    load: "Charger",
    saveSlot: "Slot",
    recipeHint: "Sélectionnez une recette pour voir ses entrées et sorties.",
    inputs: "Entrées",
    outputs: "Sorties",
    notEnoughHistory: "Pas encore assez d'historique pour {item}. Avancez des jours pour construire le graphe.",
    latestHistory: "{item} dernier prix: {price} au jour {day}.",
    historyRange: "Jour {start} → Jour {end}",
    workersDetail: "({assigned} affectés, {free} libres)",
    active: "actifs",
    idle: "inactif"
  }
};

let currentLang = localStorage.getItem("factory_lang") || "en";

function t(key, vars = {}) {
  const dict = I18N[currentLang] || I18N.en;
  const template = dict[key] ?? I18N.en[key] ?? key;
  return Object.entries(vars).reduce((acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)), template);
}

function applyTranslations() {
  document.title = t("title");
  document.getElementById("title").textContent = t("title");
  document.getElementById("lbl-day").textContent = t("day");
  document.getElementById("lbl-time").textContent = t("time");
  document.getElementById("lbl-market-status").textContent = t("marketStatus");
  document.getElementById("lbl-cash").textContent = t("cash");
  document.getElementById("lbl-workers").textContent = t("workers");
  document.getElementById("lbl-salary").textContent = t("dailySalary");
  document.getElementById("lbl-lang").textContent = t("language");
  document.getElementById("tab-btn-market").textContent = t("tabMarket");
  document.getElementById("tab-btn-factory").textContent = t("tabFactory");
  document.getElementById("tab-btn-blueprints").textContent = t("tabBlueprints");
  document.getElementById("tab-btn-margins").textContent = t("tabMargins");
  document.getElementById("market-prices-title").textContent = t("marketPrices");
  document.getElementById("th-item").textContent = t("item");
  document.getElementById("th-price").textContent = t("price");
  document.getElementById("th-change").textContent = t("change");
  document.getElementById("buy-sell-title").textContent = t("buySell");
  document.getElementById("lbl-market-qty").textContent = t("quantity");
  document.getElementById("btn-max-buy").textContent = t("maxBuy");
  document.getElementById("btn-max-sell").textContent = t("maxSell");
  document.getElementById("lbl-total").textContent = t("total");
  document.getElementById("btn-buy").textContent = t("buy");
  document.getElementById("btn-sell").textContent = t("sell");
  document.getElementById("inventory-sidebar-title").textContent = t("inventory");
  document.getElementById("btn-toggle-inventory").title = inventorySidebarMinimized ? t("expandInventory") : t("collapseInventory");
  document.getElementById("price-history-title").textContent = t("priceHistory");
  document.getElementById("btn-toggle-history").textContent = priceHistoryVisible ? t("hidePriceHistory") : t("showPriceHistory");
  document.getElementById("manual-crafting-title").textContent = t("manualCrafting");
  document.getElementById("lbl-craft-recipe").textContent = t("recipe");
  document.getElementById("lbl-craft-qty").textContent = t("batches");
  document.getElementById("btn-max-craft").textContent = t("maxCraft");
  document.getElementById("btn-craft").textContent = t("craft");
  document.getElementById("workers-title").textContent = t("workersTitle");
  document.getElementById("lbl-hire-qty").textContent = t("hireQuantity");
  document.getElementById("btn-max-hire").textContent = t("maxHire");
  document.getElementById("btn-hire").textContent = t("hireWorkers");
  document.getElementById("lbl-fire-qty").textContent = t("fireQuantity");
  document.getElementById("btn-max-fire").textContent = t("maxFire");
  document.getElementById("btn-fire").textContent = t("fireWorkers");
  document.getElementById("automation-title").textContent = t("automationAssignment");
  document.getElementById("automation-note").textContent = t("automationNote");
  document.getElementById("machine-fleet-title").textContent = t("machineFleetTitle");
  document.getElementById("machine-note").textContent = t("machineNote");
  document.getElementById("hours-label").textContent = t("hoursToAdvance");
  document.getElementById("btn-advance-time").textContent = t("advanceTime");
  const hoursInput = document.getElementById("hours-input");
  if (hoursInput) {
    const restOption = hoursInput.querySelector('option[value="rest"]');
    if (restOption) restOption.textContent = t("restOfDay");
  }
  document.getElementById("btn-save-game").textContent = t("save");
  document.getElementById("btn-load-game").textContent = t("load");
  document.getElementById("save-slot").placeholder = t("saveSlot");
  if (!G) {
    document.getElementById("recipe-info").innerHTML = t("recipeHint");
  }
}

function applyInventorySidebarState() {
  const sidebar = document.getElementById("inventory-sidebar");
  const btn = document.getElementById("btn-toggle-inventory");
  if (!sidebar || !btn) return;
  sidebar.classList.toggle("minimized", inventorySidebarMinimized);
  btn.textContent = inventorySidebarMinimized ? "▶" : "◀";
  btn.title = inventorySidebarMinimized ? t("expandInventory") : t("collapseInventory");
}

function toggleInventorySidebar() {
  inventorySidebarMinimized = !inventorySidebarMinimized;
  localStorage.setItem("inventory_sidebar_minimized", inventorySidebarMinimized ? "1" : "0");
  applyInventorySidebarState();
}

function setSelectedMarketItem(item) {
  if (!allItems().includes(item)) return;
  selectedMarketItem = item;
  if (G) {
    renderMarket(G);
    updateCostPreview();
  }
}

const QtyInput = {
  parse(rawValue, fallback = 0) {
    const digitsOnly = String(rawValue ?? "").replace(/\D+/g, "");
    if (!digitsOnly) return fallback;
    return Math.max(0, Number.parseInt(digitsOnly, 10));
  },

  normalize(inputId, fallback = 0) {
    const input = document.getElementById(inputId);
    if (!input) return null;
    const normalized = QtyInput.parse(input.value, fallback);
    if (input.value !== String(normalized)) {
      input.value = String(normalized);
    }
    return normalized;
  },

  adjust(inputId, delta, fallback = 0) {
    const input = document.getElementById(inputId);
    if (!input) return null;
    const current = QtyInput.parse(input.value, fallback);
    const next = Math.max(0, current + delta);
    input.value = String(next);
    return next;
  },
};

function parseMarketQty(rawValue, fallback = 0) {
  return QtyInput.parse(rawValue, fallback);
}

function onMarketQtyInput() {
  QtyInput.normalize("market-qty", 0);
  updateCostPreview();
}

function adjustMarketQty(delta) {
  QtyInput.adjust("market-qty", delta, 0);
  updateCostPreview();
}

function parseCraftQty(rawValue, fallback = 0) {
  return QtyInput.parse(rawValue, fallback);
}

function onCraftQtyInput() {
  QtyInput.normalize("craft-qty", 0);
}

function adjustCraftQty(delta) {
  QtyInput.adjust("craft-qty", delta, 0);
}

function parseHireQty(rawValue, fallback = 0) {
  return QtyInput.parse(rawValue, fallback);
}

function onHireQtyInput() {
  QtyInput.normalize("hire-qty", 0);
}

function adjustHireQty(delta) {
  QtyInput.adjust("hire-qty", delta, 0);
}

function parseFireQty(rawValue, fallback = 0) {
  return QtyInput.parse(rawValue, fallback);
}

function onFireQtyInput() {
  QtyInput.normalize("fire-qty", 0);
}

function adjustFireQty(delta) {
  QtyInput.adjust("fire-qty", delta, 0);
}

function onAssignmentQtyInput(recipe) {
  QtyInput.normalize(`assign-${recipe}`, 0);
}

function adjustAssignmentQty(recipe, delta) {
  QtyInput.adjust(`assign-${recipe}`, delta, 0);
}

function setLanguage(lang) {
  currentLang = lang === "fr" ? "fr" : "en";
  localStorage.setItem("factory_lang", currentLang);
  applyTranslations();
  if (G) {
    render(G);
  }
}
