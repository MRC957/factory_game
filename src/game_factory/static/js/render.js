// ── Render ──────────────────────────────────────────────────────────────
// Master render: update G then repaint every section of the UI.
// Full re-renders are cheap here (small DOM, no virtual-DOM diffing needed).
function render(state) {
  mergeStatePatch(state);
  renderStatusBar(G);
  renderMarket(G);
  renderInventory(G, "inventory-sidebar-grid");
  renderFactory(G);
  renderBlueprints(G);
  renderMargins(G);
  renderPriceChart(G);
  updateCostPreview();
  updateRecipeInfo();
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
    const price = s.market_prices[item] ?? 0;
    const change = s.price_change[item] ?? 0;
    const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
    const cls = change > 0 ? "up" : change < 0 ? "down" : "flat";
    const tr = document.createElement("tr");
    tr.className = item === selectedMarketItem ? "market-row-selected" : "";
    tr.onclick = () => setSelectedMarketItem(item);
    tr.style.cursor = "pointer";
    tr.innerHTML = `<td>${itemIcon(item)}<span class="item-name">${item}</span></td><td>${fmt(price)}</td>
      <td class="${cls}">${arrow} ${change > 0 ? "+" : ""}${change.toFixed(1)}%</td>`;
    tbody.appendChild(tr);
  });

  const isOpen = Boolean(s.market_is_open);
  const buySellSection = document.querySelector('[id="buy-sell-title"]')?.closest('.card');
  if (buySellSection) {
    buySellSection.style.opacity = isOpen ? "1" : "0.5";
    buySellSection.style.pointerEvents = isOpen ? "auto" : "none";
  }

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

    const serviceLabel = status === "hard_failure" ? t("machineRepair") : t("machineService");
    const serviceCost = status === "hard_failure"
      ? fmt(machine.emergency_repair_cost)
      : fmt(machine.preventive_cost);
    const serviceHours = status === "hard_failure"
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
    const m = s.margins[recipe];
    const er = s.effective_recipes[recipe];
    if (!m) return;
    const inputs = Object.entries(er.inputs).map(([k, v]) => `${v}× ${k}`).join(", ");
    const outputs = Object.entries(er.outputs).map(([k, v]) => `${v}× ${k}`).join(", ");
    const margin = m.margin;
    const cls = margin > 0 ? "profit" : margin < 0 ? "loss" : "risky";
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
  const qty = parseMarketQty(document.getElementById("market-qty").value, 0);
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
  const inputs = Object.entries(er.inputs)
    .map(([k, v]) => {
      const available = G.inventory?.[k] ?? 0;
      const missing = available < v;
      return `<span class="${missing ? "loss" : ""}">${v}× ${itemIcon(k)}<span class="item-name">${k}</span></span>`;
    })
    .join(", ");
  const outputs = Object.entries(er.outputs)
    .map(([k, v]) => `${v}× ${itemIcon(k)}<span class="item-name">${k}</span>`)
    .join(", ");
  const machineMissing = Boolean(machine && !machine.owned);
  const machineFailed = Boolean(machine && machine.owned && (machine.status === "soft_failure" || machine.status === "hard_failure"));
  const machineText = machine
    ? `<br><strong>${t("machineRequired")}:</strong> <span class="${machineMissing || machineFailed ? "loss" : ""}">${machine.name} (${machineStatusLabel(machine.owned ? machine.status : "missing")})</span>`
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
function switchTab(name) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  document.querySelector(`#tab-bar .tab-btn[data-tab="${name}"]`)?.classList.add("active");
}
