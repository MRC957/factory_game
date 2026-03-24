// ── Actions ─────────────────────────────────────────────────────────────

async function doBuy() {
  const item = selectedMarketItem;
  const qty = parseMarketQty(document.getElementById("market-qty").value, 0);
  if (qty < 1) { log("Enter a valid quantity.", "log-err"); return; }
  const r = await api("/api/buy", { item, qty });
  log(r.message, r.message.startsWith("Bought") ? "log-ok" : "log-err");
  render(r.state);
}

async function doSell() {
  const item = selectedMarketItem;
  const qty = parseMarketQty(document.getElementById("market-qty").value, 0);
  if (qty < 1) { log("Enter a valid quantity.", "log-err"); return; }
  const r = await api("/api/sell", { item, qty });
  log(r.message, r.message.startsWith("Sold") ? "log-ok" : "log-err");
  render(r.state);
}

async function doCraft() {
  const recipe = document.getElementById("craft-recipe").value;
  const qty = parseCraftQty(document.getElementById("craft-qty").value, 0);
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
  if (value === "market_open") {
    const hour = G.hour ?? 0;
    const marketOpenHour = G.market_open_hour ?? 8;
    if (hour < marketOpenHour) {
      return Math.max(1, marketOpenHour - hour);
    }
    return Math.max(1, (24 - hour) + marketOpenHour);
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
