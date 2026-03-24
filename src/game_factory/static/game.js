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

// ── Utilities ───────────────────────────────────────────────────────────
// fmt: formats a number as a dollar amount, e.g. 12.5 → "$12.50"
function fmt(n)   { return "$" + n.toFixed(2); }
// fmtCash: use separators only when absolute cash reaches at least 1000.
function fmtCash(n) {
  if (Math.abs(n) >= 1000) {
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return "$" + n.toFixed(2);
}
// fmtS: signed dollar amount for margins/deltas, e.g. -5 → "-$5.00", 3 → "+$3.00"
function fmtS(n)  { return (n >= 0 ? "+" : "") + "$" + n.toFixed(2); }

// Append one or more lines to the activity log at the bottom of the screen.
// msg may contain newlines (multi-day advance output); each line gets its own div.
function log(msg, cls = "") {
  const box = document.getElementById("log-box");
  msg.split("\n").filter(Boolean).forEach(line => {
    const div = document.createElement("div");
    div.className = "log-entry " + cls;
    div.textContent = line;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

// Insert a day-separator heading before the automation output of a new day.
function logDay(day) {
  const div = document.createElement("div");
  div.className = "log-entry log-day";
  div.textContent = "── Day " + day + " ──────────────────";
  document.getElementById("log-box").appendChild(div);
  document.getElementById("log-box").scrollTop = document.getElementById("log-box").scrollHeight;
}

// Thin fetch wrapper: GET when body is null, POST+JSON otherwise.
// All action endpoints return {message, state}; /api/state just returns the state dict.
async function api(path, body = null) {
  const startedAt = performance.now();
  const opts = body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : { method: "GET" };
  const res = await fetch(path, opts);
  const payload = await res.json();
  const elapsed = performance.now() - startedAt;
  console.debug(`[api] ${path} ${elapsed.toFixed(1)}ms`);
  return payload;
}

// ── Render ──────────────────────────────────────────────────────────────
// Master render: update G then repaint every section of the UI.
// Full re-renders are cheap here (small DOM, no virtual-DOM diffing needed).
function render(state) {
  mergeStatePatch(state);
  renderStatusBar(G);
  renderMarket(G);
  renderInventory(G, "inventory-sidebar-grid");
  renderFactory(G);   // rebuilds the assignment inputs with current worker counts
  renderBlueprints(G);
  renderMargins(G);
  renderPriceChart(G);
  updateCostPreview();    // recalculate the buy/sell cost preview with new prices
  updateRecipeInfo();     // refresh the crafting recipe breakdown
}

function mergeStatePatch(statePatch) {
  if (!statePatch) return;
  if (!G) {
    G = statePatch;
    return;
  }
  G = { ...G, ...statePatch };
}

function renderAction(statePatch, sections = {}) {
  mergeStatePatch(statePatch);
  if (!G) return;

  if (sections.status) renderStatusBar(G);
  if (sections.market) renderMarket(G);
  if (sections.inventory) renderInventory(G, "inventory-sidebar-grid");
  if (sections.factory) renderFactory(G);
  if (sections.blueprints) renderBlueprints(G);
  if (sections.margins) renderMargins(G);
  if (sections.chart) renderPriceChart(G);
  if (sections.costPreview) updateCostPreview();
  if (sections.recipeInfo) updateRecipeInfo();
}

function renderStatusBar(s) {
  document.getElementById("stat-day").textContent = s.day;
  document.getElementById("stat-time").textContent = s.clock ?? `${String(s.hour ?? 0).padStart(2, "0")}:00`;
  const marketStatus = document.getElementById("stat-market-status");
  const isOpen = Boolean(s.market_is_open);
  marketStatus.textContent = isOpen ? t("marketOpen") : t("marketClosed");
  marketStatus.className = "stat-value " + (isOpen ? "val-cash" : "val-warn");
  const cashEl = document.getElementById("stat-cash");
  cashEl.textContent = fmtCash(s.cash);
  cashEl.className = "stat-value " + (s.cash >= 0 ? "val-cash" : "val-warn");
  document.getElementById("stat-workers").textContent = s.total_workers;
  document.getElementById("stat-workers-detail").textContent =
    t("workersDetail", { assigned: s.assigned_workers, free: s.free_workers });
  document.getElementById("stat-salary").textContent = fmt(s.daily_salary);
}

function renderMarket(s) {
  const tbody = document.getElementById("market-tbody");
  tbody.innerHTML = "";
  allItems(s).forEach(item => {
    const price  = s.market_prices[item] ?? 0;
    // price_change is already converted to % by the server (fraction × 100).
    const change = s.price_change[item]  ?? 0;
    const arrow  = change > 0 ? "↑" : change < 0 ? "↓" : "→";
    const cls    = change > 0 ? "up" : change < 0 ? "down" : "flat";
    const tr = document.createElement("tr");
    tr.className = item === selectedMarketItem ? "market-row-selected" : "";
    tr.onclick = () => setSelectedMarketItem(item);
    tr.style.cursor = "pointer";
    tr.innerHTML = `<td>${itemIcon(item)}<span class="item-name">${item}</span></td><td>${fmt(price)}</td>
      <td class="${cls}">${arrow} ${change > 0 ? "+" : ""}${change.toFixed(1)}%</td>`;
    tbody.appendChild(tr);
  });

  // Disable buy/sell controls when market is closed
  const isOpen = Boolean(s.market_is_open);
  const buySellSection = document.querySelector('[id="buy-sell-title"]')?.closest('.card');
  if (buySellSection) {
    buySellSection.style.opacity = isOpen ? "1" : "0.5";
    buySellSection.style.pointerEvents = isOpen ? "auto" : "none";
  }
  
  // Disable individual controls as well
  const buyButton = document.getElementById("btn-buy");
  const sellButton = document.getElementById("btn-sell");
  const maxBuyBtn = document.getElementById("btn-max-buy");
  const maxSellBtn = document.getElementById("btn-max-sell");
  const marketQtyInput = document.getElementById("market-qty");
  if (buyButton) buyButton.disabled = !isOpen;
  if (sellButton) sellButton.disabled = !isOpen;
  if (maxBuyBtn) maxBuyBtn.disabled = !isOpen;
  if (maxSellBtn) maxSellBtn.disabled = !isOpen;
  if (marketQtyInput) marketQtyInput.disabled = !isOpen;
}

function renderInventory(s, targetId = "inventory-sidebar-grid") {
  const grid = document.getElementById(targetId);
  if (!grid) return;
  grid.innerHTML = "";
  allItems(s).forEach(item => {
    const qty = s.inventory[item] ?? 0;
    const div = document.createElement("div");
    div.className = "inv-item";
    div.innerHTML = `<div class="inv-name">${itemIcon(item)}<span class="item-name">${item}</span></div>
      <div class="inv-qty" style="color:${qty > 0 ? "var(--text)" : "var(--muted)"}">${qty}</div>`;
    grid.appendChild(div);
  });
}

function renderPriceChart(s) {
  if (!priceHistoryVisible) return;
  const svg = document.getElementById("price-chart-svg");
  const note = document.getElementById("chart-note");
  if (!svg || !note) return;

  const item = selectedMarketItem;
  const history = Array.isArray(s.price_history) ? s.price_history : [];
  const pointsRaw = history
    .map(entry => ({ day: Number(entry.day), price: Number(entry[item]) }))
    .filter(p => Number.isFinite(p.day) && Number.isFinite(p.price));

  svg.innerHTML = "";
  if (pointsRaw.length < 2) {
    note.textContent = t("notEnoughHistory", { item });
    return;
  }

  const width = 780;
  const height = 220;
  const padLeft = 42;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 30;
  const minDay = pointsRaw[0].day;
  const maxDay = pointsRaw[pointsRaw.length - 1].day;
  const prices = pointsRaw.map(p => p.price);
  const minPriceRaw = Math.min(...prices);
  const maxPriceRaw = Math.max(...prices);
  const range = Math.max(0.01, maxPriceRaw - minPriceRaw);
  const minPrice = minPriceRaw - range * 0.08;
  const maxPrice = maxPriceRaw + range * 0.08;

  const x = (day) => {
    if (maxDay === minDay) return padLeft;
    return padLeft + ((day - minDay) / (maxDay - minDay)) * (width - padLeft - padRight);
  };
  const y = (price) => {
    return height - padBottom - ((price - minPrice) / (maxPrice - minPrice)) * (height - padTop - padBottom);
  };

  const grid = document.createElementNS("http://www.w3.org/2000/svg", "line");
  grid.setAttribute("x1", String(padLeft));
  grid.setAttribute("y1", String(height - padBottom));
  grid.setAttribute("x2", String(width - padRight));
  grid.setAttribute("y2", String(height - padBottom));
  grid.setAttribute("stroke", "#2a3a5e");
  grid.setAttribute("stroke-width", "1");
  svg.appendChild(grid);

  const axis = document.createElementNS("http://www.w3.org/2000/svg", "line");
  axis.setAttribute("x1", String(padLeft));
  axis.setAttribute("y1", String(padTop));
  axis.setAttribute("x2", String(padLeft));
  axis.setAttribute("y2", String(height - padBottom));
  axis.setAttribute("stroke", "#2a3a5e");
  axis.setAttribute("stroke-width", "1");
  svg.appendChild(axis);

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  const points = pointsRaw.map(p => `${x(p.day)},${y(p.price)}`).join(" ");
  polyline.setAttribute("points", points);
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "#f5a623");
  polyline.setAttribute("stroke-width", "2.4");
  svg.appendChild(polyline);

  const last = pointsRaw[pointsRaw.length - 1];
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  marker.setAttribute("cx", String(x(last.day)));
  marker.setAttribute("cy", String(y(last.price)));
  marker.setAttribute("r", "3.8");
  marker.setAttribute("fill", "#4ecca3");
  svg.appendChild(marker);

  const dayLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  dayLabel.setAttribute("x", String(width - padRight));
  dayLabel.setAttribute("y", String(height - 8));
  dayLabel.setAttribute("text-anchor", "end");
  dayLabel.setAttribute("fill", "#8899bb");
  dayLabel.setAttribute("font-size", "12");
  dayLabel.textContent = t("historyRange", { start: minDay, end: maxDay });
  svg.appendChild(dayLabel);

  const priceTopLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  priceTopLabel.setAttribute("x", "8");
  priceTopLabel.setAttribute("y", String(padTop + 4));
  priceTopLabel.setAttribute("fill", "#8899bb");
  priceTopLabel.setAttribute("font-size", "12");
  priceTopLabel.textContent = fmt(maxPriceRaw);
  svg.appendChild(priceTopLabel);

  const priceBottomLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  priceBottomLabel.setAttribute("x", "8");
  priceBottomLabel.setAttribute("y", String(height - padBottom));
  priceBottomLabel.setAttribute("fill", "#8899bb");
  priceBottomLabel.setAttribute("font-size", "12");
  priceBottomLabel.textContent = fmt(minPriceRaw);
  svg.appendChild(priceBottomLabel);

  note.textContent = t("latestHistory", { item, price: fmt(last.price), day: last.day });
}

function renderFactory(s) {
  const list = document.getElementById("assign-list");
  list.innerHTML = "";
  allRecipes(s).forEach(recipe => {
    const current = s.assignments[recipe] ?? 0;
    const row = document.createElement("div");
    row.className = "assign-row";
    row.innerHTML = `
      <span class="assign-recipe">${itemIcon(recipe)}<span class="item-name">${recipe}</span></span>
      <div class="qty-stepper">
        <button class="qty-stepper-btn" type="button" onclick="adjustAssignmentQty('${recipe}', -1)" aria-label="Decrease quantity">−</button>
        <input type="text" id="assign-${recipe}" value="${current}" inputmode="numeric" oninput="onAssignmentQtyInput('${recipe}')" aria-label="Assignment quantity for ${recipe}">
        <button class="qty-stepper-btn" type="button" onclick="adjustAssignmentQty('${recipe}', 1)" aria-label="Increase quantity">+</button>
      </div>
      <button class="btn-primary" onclick="doAssign('${recipe}')" style="padding:6px 12px;">Set</button>
      <span class="assign-workers">${current > 0 ? `${current} ${t("active")}` : t("idle")}</span>`;
    list.appendChild(row);
  });

  const previewEl = document.getElementById("automation-preview");
  if (previewEl) {
    const produced = s.automation_preview?.produced || {};
    const orderedProducedItems = allItems(s).filter(item => (produced[item] ?? 0) > 0);
    const producedText = orderedProducedItems
      .map(item => `${produced[item]}× ${itemIcon(item)}<span class="item-name">${item}</span>`)
      .join(", ");

    if (!producedText) {
      previewEl.innerHTML = `<strong>${t("automationPreviewTitle")}:</strong> ${t("automationPreviewNone")}`;
    } else {
      previewEl.innerHTML = `<strong>${t("automationPreviewTitle")}:</strong> ${producedText}`;
    }
  }

  renderMachines(s);
}

function machineStatusLabel(status) {
  const map = {
    missing: t("machineMissing"),
    operational: t("machineOperational"),
    soft_failure: t("machineSoftFailure"),
    hard_failure: t("machineHardFailure"),
  };
  return map[status] ?? status;
}

function machineStrategyLabel(strategy) {
  return strategy === "preventive" ? t("machinePreventive") : t("machineCorrective");
}

function renderMachines(s) {
  const grid = document.getElementById("machine-list");
  if (!grid) return;
  grid.innerHTML = "";

  const strategies = Array.isArray(s.maintenance_strategies) ? s.maintenance_strategies : ["corrective", "preventive"];
  const intervalOptions = [5, 10, 15];

  allRecipes(s).forEach(recipe => {
    const machine = s.machines?.[recipe];
    if (!machine) return;

    const status = machine.owned ? machine.status : "missing";
    const card = document.createElement("div");
    card.className = `machine-card machine-${status}${machine.owned ? " machine-owned" : ""}`;

    const strategyOptions = strategies
      .map(strategy => `<option value="${strategy}" ${machine.strategy === strategy ? "selected" : ""}>${machineStrategyLabel(strategy)}</option>`)
      .join("");
    const selectedInterval = intervalOptions.includes(machine.preventive_interval) ? machine.preventive_interval : intervalOptions[0];
    const intervalMarkup = intervalOptions
      .map(interval => `<option value="${interval}" ${selectedInterval === interval ? "selected" : ""}>${interval}d</option>`)
      .join("");
    const showInterval = machine.strategy === "preventive";

    if (!machine.owned) {
      card.innerHTML = `
        <div class="machine-head">
          <div>
            <div class="machine-name">${machine.name}</div>
            <div class="machine-recipe">${t("machineRequired")}: ${itemIcon(recipe)}<span class="item-name">${recipe}</span></div>
          </div>
          <div class="machine-status missing">${t("machineMissing")}</div>
        </div>
        <div class="machine-stats">
          <span>${t("machineWear")}: 0 / ${machine.rated_lifetime_days}d</span>
        </div>
        <button class="btn-primary" onclick="doBuyMachine('${recipe}')">${t("machineBuy")} (${fmt(machine.purchase_cost)})</button>`;
      grid.appendChild(card);
      return;
    }

    const serviceLabel = status === "soft_failure" || status === "hard_failure" ? t("machineRepair") : t("machineService");
    const serviceCost = status === "soft_failure" || status === "hard_failure"
      ? fmt(machine.emergency_repair_cost)
      : fmt(machine.preventive_cost);
    const serviceHours = status === "soft_failure" || status === "hard_failure"
      ? machine.emergency_repair_hours
      : machine.preventive_hours;
    const dueNote = machine.maintenance_due ? `<div class="machine-status soft_failure">${t("machineDue")}</div>` : "";
    const serviceButtonHTML = machine.days_since_service === 0
      ? `<button class="btn-primary" onclick="doServiceMachine('${recipe}')" disabled>${serviceLabel} (${serviceCost}, ${serviceHours}h)</button>`
      : `<button class="btn-primary" onclick="doServiceMachine('${recipe}')">${serviceLabel} (${serviceCost}, ${serviceHours}h)</button>`;

    card.innerHTML = `
      <div class="machine-head">
        <div>
          <div class="machine-name">${machine.name}</div>
          <div class="machine-recipe">${t("machineRequired")}: ${itemIcon(recipe)}<span class="item-name">${recipe}</span></div>
        </div>
        <div class="machine-status ${status}">${machineStatusLabel(status)}</div>
      </div>
      <div class="machine-stats">
        <span>${t("machineWear")}: ${machine.days_operated} / ${machine.rated_lifetime_days}d</span>
        <span>Days since service: ${machine.days_since_service}d</span>
        <span>${t("machineStrategy")}: ${machineStrategyLabel(machine.strategy)}</span>
        <span>${t("machineInterval")}: ${machine.preventive_interval}d</span>
      </div>
      ${dueNote}
      <div class="machine-controls">
        <select id="machine-strategy-${recipe}" onchange="doUpdateMachineSettings('${recipe}')" aria-label="Machine strategy for ${recipe}">
          ${strategyOptions}
        </select>
        ${showInterval
          ? `<select id="machine-interval-${recipe}" onchange="doUpdateMachineSettings('${recipe}')" aria-label="Machine interval for ${recipe}">
          ${intervalMarkup}
        </select>`
          : ""
        }
      </div>
      ${serviceButtonHTML}`;
    grid.appendChild(card);
  });
}

function renderBlueprints(s) {
  const grid = document.getElementById("blueprints-grid");
  grid.innerHTML = "";
  Object.entries(s.blueprints).forEach(([name, bp]) => {
    const div = document.createElement("div");
    div.className = "bp-card" + (bp.owned ? " owned" : "");
    // Convert snake_case keys to Title Case for display (e.g. "smelter_optimization" → "Smelter Optimization").
    const label = name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    div.innerHTML = `
      <div class="bp-name">${label}${bp.owned ? '<span class="owned-badge">✓ Owned</span>' : ""}</div>
      <div class="bp-cost">${fmt(bp.cost)}</div>
      <div class="bp-desc">${bp.description}</div>
      <button class="${bp.owned ? "btn-owned" : "btn-buy"}"
        ${bp.owned ? "disabled" : ""}
        onclick="doBuyBlueprint('${name}')">
        ${bp.owned ? "Purchased" : "Buy Blueprint"}
      </button>`;
    grid.appendChild(div);
  });
}

function renderMargins(s) {
  const tbody = document.getElementById("margins-tbody");
  tbody.innerHTML = "";
  allRecipes(s).forEach(recipe => {
    // s.margins uses effective recipes (post-blueprint), matching what the player
    // actually experiences — not the bare base recipe values.
    const m  = s.margins[recipe];
    const er = s.effective_recipes[recipe];
    if (!m) return;
    const inputs  = Object.entries(er.inputs).map(([k, v]) => `${v}× ${k}`).join(", ");
    const outputs = Object.entries(er.outputs).map(([k, v]) => `${v}× ${k}`).join(", ");
    const margin  = m.margin;
    // Three-way colour coding: green profit, red loss, gold exact break-even.
    const cls     = margin > 0 ? "profit" : margin < 0 ? "loss" : "risky";
    const verdict = margin > 0 ? "Profitable" : margin < 0 ? "Unprofitable" : "Break-even";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:700">${itemIcon(recipe)}<span class="item-name">${recipe}</span></td>
      <td style="color:var(--muted); font-size:0.85rem">${inputs}</td>
      <td>${fmt(m.input_cost)}</td>
      <td style="color:var(--muted); font-size:0.85rem">${outputs}</td>
      <td>${fmt(m.output_value)}</td>
      <td class="${cls}">${fmtS(margin)}</td>
      <td class="${cls}">${verdict}</td>`;
    tbody.appendChild(tr);
  });
}

function updateCostPreview() {
  if (!G) return;
  const item = selectedMarketItem;
  const qty  = parseMarketQty(document.getElementById("market-qty").value, 0);
  const price = G.market_prices[item] ?? 0;
  document.getElementById("cost-preview").textContent = fmt(price * qty);
  if (priceHistoryVisible) {
    renderPriceChart(G);
  }
}

function updateRecipeInfo() {
  if (!G) return;
  const recipe = document.getElementById("craft-recipe").value;
  const er = G.effective_recipes[recipe];
  if (!er) return;
  const machine = G.machines?.[recipe];
  const inputs  = Object.entries(er.inputs)
    .map(([k, v]) => `${v}× ${itemIcon(k)}<span class="item-name">${k}</span>`)
    .join(", ");
  const outputs = Object.entries(er.outputs)
    .map(([k, v]) => `${v}× ${itemIcon(k)}<span class="item-name">${k}</span>`)
    .join(", ");
  const machineText = machine
    ? `<br><strong>${t("machineRequired")}:</strong> ${machine.name} (${machineStatusLabel(machine.owned ? machine.status : "missing")})`
    : "";
  document.getElementById("recipe-info").innerHTML =
    `<strong>${t("inputs")}:</strong> ${inputs}<br><strong>${t("outputs")}:</strong> ${outputs}${machineText}`;
}

function setMarketMax(mode) {
  if (!G) return;
  const item = selectedMarketItem;
  const price = G.market_prices[item] ?? 0;
  const byCash = price > 0 ? Math.floor((G.cash ?? 0) / price) : 0;
  const byInventory = G.inventory[item] ?? 0;
  const maxQty = mode === "buy" ? byCash : byInventory;
  document.getElementById("market-qty").value = String(Math.max(0, maxQty));
  updateCostPreview();
}

function setCraftMax() {
  if (!G) return;
  const recipeName = document.getElementById("craft-recipe").value;
  const recipe = G.effective_recipes[recipeName];
  if (!recipe) return;
  let maxBatches = Number.POSITIVE_INFINITY;
  const entries = Object.entries(recipe.inputs || {});
  if (entries.length === 0) {
    maxBatches = 0;
  } else {
    entries.forEach(([item, qty]) => {
      if (qty > 0) {
        const canMake = Math.floor((G.inventory[item] ?? 0) / qty);
        maxBatches = Math.min(maxBatches, canMake);
      }
    });
  }
  if (!Number.isFinite(maxBatches)) maxBatches = 0;
  document.getElementById("craft-qty").value = String(Math.max(0, maxBatches));
}

function setHireMax() {
  if (!G) return;
  const fee = G.worker_hire_cost ?? 0;
  const maxQty = fee > 0 ? Math.floor((G.cash ?? 0) / fee) : 0;
  document.getElementById("hire-qty").value = String(Math.max(0, maxQty));
}

function setFireMax() {
  if (!G) return;
  const fee = G.worker_fire_fee ?? 0;
  const byCash = fee > 0 ? Math.floor((G.cash ?? 0) / fee) : 0;
  const byHeadcount = G.total_workers ?? 0;
  const maxQty = Math.min(byCash, byHeadcount);
  document.getElementById("fire-qty").value = String(Math.max(0, maxQty));
  // no cost preview needed for fire — value is just updated in place
}

function togglePriceHistory() {
  priceHistoryVisible = !priceHistoryVisible;
  const panel = document.getElementById("price-history-panel");
  panel.style.display = priceHistoryVisible ? "block" : "none";
  document.getElementById("btn-toggle-history").textContent = priceHistoryVisible ? t("hidePriceHistory") : t("showPriceHistory");
  if (priceHistoryVisible && G) {
    renderPriceChart(G);
  }
}

// ── Tabs ────────────────────────────────────────────────────────────────
// Pure CSS-class toggle: only one .tab-panel and one .tab-btn carry .active at a time.
// No history/routing — tabs are purely presentational, state lives in G.
function switchTab(name) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  document.querySelector(`#tab-bar .tab-btn[data-tab="${name}"]`)?.classList.add("active");
}

// ── Actions ─────────────────────────────────────────────────────────────
// Each action follows the same pattern:
//   1. Read form values.
//   2. Client-side guard (avoids a pointless round trip for obviously bad input).
//   3. POST to the API.
//   4. Log the human-readable message returned by the game engine.
//   5. Call render() with the embedded state snapshot to refresh the UI.
//
// Success/failure is inferred from the message prefix rather than HTTP status
// codes because the game model returns descriptive strings, not exceptions.

async function doBuy() {
  const item = selectedMarketItem;
  const qty  = parseMarketQty(document.getElementById("market-qty").value, 0);
  if (qty < 1) { log("Enter a valid quantity.", "log-err"); return; }
  const r = await api("/api/buy", { item, qty });
  log(r.message, r.message.startsWith("Bought") ? "log-ok" : "log-err");
  render(r.state);
}

async function doSell() {
  const item = selectedMarketItem;
  const qty  = parseMarketQty(document.getElementById("market-qty").value, 0);
  if (qty < 1) { log("Enter a valid quantity.", "log-err"); return; }
  const r = await api("/api/sell", { item, qty });
  log(r.message, r.message.startsWith("Sold") ? "log-ok" : "log-err");
  render(r.state);
}

async function doCraft() {
  const recipe = document.getElementById("craft-recipe").value;
  const qty    = parseCraftQty(document.getElementById("craft-qty").value, 0);
  if (qty < 1) { log("Enter a valid quantity.", "log-err"); return; }
  const r = await api("/api/craft", { recipe, qty });
  log(r.message, r.message.startsWith("Crafted") ? "log-ok" : "log-err");
  render(r.state);
}

async function doHire() {
  const qty = parseHireQty(document.getElementById("hire-qty").value, 0);
  if (qty < 1) { log("Enter a valid quantity.", "log-err"); return; }
  const r = await api("/api/hire", { qty });
  log(r.message, r.message.startsWith("Hired") ? "log-ok" : "log-err");
  render(r.state);
}

async function doFire() {
  const qty = parseFireQty(document.getElementById("fire-qty").value, 0);
  if (qty < 1) { log("Enter a valid quantity.", "log-err"); return; }
  const r = await api("/api/fire", { qty });
  log(r.message, r.message.startsWith("Fired") ? "log-ok" : "log-err");
  render(r.state);
}

async function doAssign(recipe) {
  const qty = QtyInput.parse(document.getElementById("assign-" + recipe).value, 0);
  const r = await api("/api/assign", { recipe, qty });
  log(r.message, r.message.startsWith("Assigned") ? "log-ok" : "log-err");
  renderAction(r.state, {
    status: true,
    factory: true,
  });
}

async function doBuyBlueprint(name) {
  const r = await api("/api/buy_blueprint", { name });
  log(r.message, r.message.startsWith("Bought") ? "log-ok" : "log-err");
  render(r.state);
}

async function doBuyMachine(recipe) {
  const r = await api("/api/buy_machine", { recipe });
  log(r.message, r.message.startsWith("Bought") ? "log-ok" : "log-err");
  renderAction(r.state, {
    status: true,
    inventory: true,
    factory: true,
    recipeInfo: true,
  });
}

async function doUpdateMachineSettings(recipe) {
  const strategy = document.getElementById(`machine-strategy-${recipe}`)?.value ?? "corrective";
  const intervalValue = document.getElementById(`machine-interval-${recipe}`)?.value;
  const payload = { recipe, strategy };
  if (strategy === "preventive" && intervalValue != null) {
    payload.preventive_interval = Number.parseInt(intervalValue, 10);
  }
  const r = await api("/api/update_machine_settings", payload);
  log(r.message, r.message.startsWith("Updated") ? "log-ok" : "log-err");
  renderAction(r.state, {
    status: true,
    factory: true,
    recipeInfo: true,
  });
}

async function doServiceMachine(recipe) {
  const r = await api("/api/service_machine", { recipe });
  log(
    r.message,
    r.message.startsWith("Performed") || r.message.startsWith("Repaired") ? "log-ok" : "log-err"
  );
  renderAction(r.state, {
    status: true,
    inventory: true,
    factory: true,
    recipeInfo: true,
  });
}

async function doSave() {
  const slot = document.getElementById("save-slot").value || "default";
  const r = await api("/api/save", { slot });
  log(r.message, r.message.startsWith("Game saved") ? "log-ok" : "log-err");
  renderAction(r.state, { status: true });
}

async function doLoad() {
  const slot = document.getElementById("save-slot").value || "default";
  const r = await api("/api/load", { slot });
  log(r.message, r.message.startsWith("Game loaded") ? "log-ok" : "log-err");
  render(r.state);
}

function resolveAdvanceHours() {
  if (!G) return 1;
  const value = document.getElementById("hours-input")?.value ?? "1";
  if (value === "rest") {
    const remaining = 24 - (G.hour ?? 0);
    return Math.max(1, remaining);
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

async function doAdvanceTime() {
  const hours = resolveAdvanceHours();
  const prevDay = G?.day ?? null;
  const r = await api("/api/advance_time", { hours });
  if (prevDay !== null && r.state.day > prevDay) {
    logDay(r.state.day);
  }
  log(r.message);
  if (r.state.bankrupt) log("⚠ BANKRUPTCY RISK: Cash is critically low!", "log-err");
  render(r.state);
}

// ── Keyboard shortcut: Enter on Advance Time ────────────────────────────
document.getElementById("hours-input").addEventListener("keydown", e => {
  if (e.key === "Enter") doAdvanceTime();
});

// ── Boot ────────────────────────────────────────────────────────────────
// Immediately-invoked async IIFE: fetch the initial state and paint the UI.
// updateRecipeInfo() is called explicitly after render() to populate the
// crafting hint box, which depends on G being set first.
(async () => {
  try {
    const langSelect = document.getElementById("lang-select");
    langSelect.value = currentLang;
    applyTranslations();
    applyInventorySidebarState();
    setSelectedMarketItem(selectedMarketItem);
    const s = await api("/api/state");
    render(s);
    updateRecipeInfo();
  } catch (err) {
    // Surface network/JSON errors in the game log so they are visible without
    // having to open DevTools. Common causes: Flask not running, wrong port.
    log("❌ Could not reach the game server: " + err.message, "log-err");
    log("Make sure Flask is running: PYTHONPATH=src python main.py", "log-err");
  }
})();
