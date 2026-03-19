// ── State ───────────────────────────────────────────────────────────────
// G holds the latest snapshot from /api/state (or embedded in action responses).
// All render functions read from G, so they can be re-run cheaply after any action.
let G = null;

// These constants mirror the server-side model and define rendering order.
const ALL_ITEMS   = ["ore", "wood", "ingot", "gear", "widget", "scrap"];
const ALL_RECIPES = ["ingot", "gear", "widget", "scrap_mix"];

// ── Utilities ───────────────────────────────────────────────────────────
// fmt: formats a number as a dollar amount, e.g. 12.5 → "$12.50"
function fmt(n)   { return "$" + n.toFixed(2); }
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
  const opts = body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : { method: "GET" };
  const res = await fetch(path, opts);
  return res.json();
}

// ── Render ──────────────────────────────────────────────────────────────
// Master render: update G then repaint every section of the UI.
// Full re-renders are cheap here (small DOM, no virtual-DOM diffing needed).
function render(state) {
  G = state;
  renderStatusBar(state);
  renderMarket(state);
  renderInventory(state);
  renderFactory(state);   // rebuilds the assignment inputs with current worker counts
  renderBlueprints(state);
  renderMargins(state);
  updateCostPreview();    // recalculate the buy/sell cost preview with new prices
  updateRecipeInfo();     // refresh the crafting recipe breakdown
}

function renderStatusBar(s) {
  document.getElementById("stat-day").textContent = s.day;
  const cashEl = document.getElementById("stat-cash");
  cashEl.textContent = fmt(s.cash);
  cashEl.className = "stat-value " + (s.cash >= 0 ? "val-cash" : "val-warn");
  document.getElementById("stat-workers").textContent = s.total_workers;
  document.getElementById("stat-workers-detail").textContent =
    `(${s.assigned_workers} assigned, ${s.free_workers} free)`;
  document.getElementById("stat-salary").textContent = fmt(s.daily_salary);
}

function renderMarket(s) {
  const tbody = document.getElementById("market-tbody");
  tbody.innerHTML = "";
  ALL_ITEMS.forEach(item => {
    const price  = s.market_prices[item] ?? 0;
    // price_change is already converted to % by the server (fraction × 100).
    const change = s.price_change[item]  ?? 0;
    const arrow  = change > 0 ? "↑" : change < 0 ? "↓" : "→";
    const cls    = change > 0 ? "up" : change < 0 ? "down" : "flat";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${item}</td><td>${fmt(price)}</td>
      <td class="${cls}">${arrow} ${change > 0 ? "+" : ""}${change.toFixed(1)}%</td>`;
    tbody.appendChild(tr);
  });
}

function renderInventory(s) {
  const grid = document.getElementById("inventory-grid");
  grid.innerHTML = "";
  ALL_ITEMS.forEach(item => {
    const qty = s.inventory[item] ?? 0;
    const div = document.createElement("div");
    div.className = "inv-item";
    div.innerHTML = `<div class="inv-name">${item}</div>
      <div class="inv-qty" style="color:${qty > 0 ? "var(--text)" : "var(--muted)"}">${qty}</div>`;
    grid.appendChild(div);
  });
}

function renderFactory(s) {
  const list = document.getElementById("assign-list");
  list.innerHTML = "";
  ALL_RECIPES.forEach(recipe => {
    const current = s.assignments[recipe] ?? 0;
    const row = document.createElement("div");
    row.className = "assign-row";
    // max is set to total_workers so the browser's native number validation
    // prevents obviously-invalid inputs before the request even leaves the client.
    row.innerHTML = `
      <span class="assign-recipe">${recipe}</span>
      <input type="number" id="assign-${recipe}" value="${current}" min="0" max="${s.total_workers}" style="width:70px">
      <button class="btn-primary" onclick="doAssign('${recipe}')" style="padding:6px 12px;">Set</button>
      <span class="assign-workers">${current > 0 ? current + " active" : "idle"}</span>`;
    list.appendChild(row);
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
  ALL_RECIPES.forEach(recipe => {
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
      <td style="font-weight:700">${recipe}</td>
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
  const item = document.getElementById("market-item").value;
  const qty  = parseInt(document.getElementById("market-qty").value) || 0;
  const price = G.market_prices[item] ?? 0;
  document.getElementById("cost-preview").textContent = fmt(price * qty);
}

function updateRecipeInfo() {
  if (!G) return;
  const recipe = document.getElementById("craft-recipe").value;
  const er = G.effective_recipes[recipe];
  if (!er) return;
  const inputs  = Object.entries(er.inputs).map(([k, v]) => `${v}× ${k}`).join(", ");
  const outputs = Object.entries(er.outputs).map(([k, v]) => `${v}× ${k}`).join(", ");
  document.getElementById("recipe-info").innerHTML =
    `<strong>Inputs:</strong> ${inputs}<br><strong>Outputs:</strong> ${outputs}`;
}

// ── Tabs ────────────────────────────────────────────────────────────────
// Pure CSS-class toggle: only one .tab-panel and one .tab-btn carry .active at a time.
// No history/routing — tabs are purely presentational, state lives in G.
function switchTab(name) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  // Match the button by its visible text rather than a data-attribute to keep the HTML leaner.
  [...document.querySelectorAll(".tab-btn")]
    .find(b => b.textContent.toLowerCase().trim() === name)
    ?.classList.add("active");
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
  const item = document.getElementById("market-item").value;
  const qty  = parseInt(document.getElementById("market-qty").value) || 0;
  if (qty < 1) { log("Enter a valid quantity.", "log-err"); return; }
  const r = await api("/api/buy", { item, qty });
  log(r.message, r.message.startsWith("Bought") ? "log-ok" : "log-err");
  render(r.state);
}

async function doSell() {
  const item = document.getElementById("market-item").value;
  const qty  = parseInt(document.getElementById("market-qty").value) || 0;
  if (qty < 1) { log("Enter a valid quantity.", "log-err"); return; }
  const r = await api("/api/sell", { item, qty });
  log(r.message, r.message.startsWith("Sold") ? "log-ok" : "log-err");
  render(r.state);
}

async function doCraft() {
  const recipe = document.getElementById("craft-recipe").value;
  const qty    = parseInt(document.getElementById("craft-qty").value) || 0;
  if (qty < 1) { log("Enter a valid quantity.", "log-err"); return; }
  const r = await api("/api/craft", { recipe, qty });
  log(r.message, r.message.startsWith("Crafted") ? "log-ok" : "log-err");
  render(r.state);
}

async function doHire() {
  const qty = parseInt(document.getElementById("hire-qty").value) || 0;
  if (qty < 1) { log("Enter a valid quantity.", "log-err"); return; }
  const r = await api("/api/hire", { qty });
  log(r.message, r.message.startsWith("Hired") ? "log-ok" : "log-err");
  render(r.state);
}

async function doAssign(recipe) {
  const qty = parseInt(document.getElementById("assign-" + recipe).value) || 0;
  const r = await api("/api/assign", { recipe, qty });
  log(r.message, r.message.startsWith("Assigned") ? "log-ok" : "log-err");
  render(r.state);
}

async function doBuyBlueprint(name) {
  const r = await api("/api/buy_blueprint", { name });
  log(r.message, r.message.startsWith("Bought") ? "log-ok" : "log-err");
  render(r.state);
}

async function doNextDay() {
  const days = parseInt(document.getElementById("days-input").value) || 1;
  if (days < 1) return;
  const r = await api("/api/next_day", { days });
  logDay(r.state.day);
  log(r.message);
  if (r.state.bankrupt) log("⚠ BANKRUPTCY RISK: Cash is critically low!", "log-err");
  render(r.state);
}

// ── Keyboard shortcut: Enter on Next Day ────────────────────────────────
document.getElementById("days-input").addEventListener("keydown", e => {
  if (e.key === "Enter") doNextDay();
});

// ── Boot ────────────────────────────────────────────────────────────────
// Immediately-invoked async IIFE: fetch the initial state and paint the UI.
// updateRecipeInfo() is called explicitly after render() to populate the
// crafting hint box, which depends on G being set first.
(async () => {
  try {
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
