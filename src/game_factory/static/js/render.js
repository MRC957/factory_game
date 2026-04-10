// ── Render ──────────────────────────────────────────────────────────────
// Master render: update G then repaint every section of the UI.
// Full re-renders are cheap here (small DOM, no virtual-DOM diffing needed).
function render(state) {
  mergeStatePatch(state);
  renderStatusBar(G);
  renderMarket(G);
  renderInventory(G, "inventory-sidebar-grid");
  renderFactory(G);
  renderContracts(G);
  renderBlueprints(G);
  renderMargins(G);
  renderContractHistory(G);
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
  if (sections.contracts) renderContracts(G);
  if (sections.blueprints) renderBlueprints(G);
  if (sections.margins) renderMargins(G);
  if (sections.contracts || sections.margins) renderContractHistory(G);
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

// ── Warehouse overflow warning tracker ─────────────────────────────
// Tracks which sources currently have a warehouse overflow risk.
// Sources: "automation" | "craft" | "buy"
const warehouseOverflowSources = new Set();

function setWarehouseOverflow(source, hasOverflow) {
  if (hasOverflow) warehouseOverflowSources.add(source);
  else warehouseOverflowSources.delete(source);
  const el = document.getElementById("warehouse-info");
  if (!el) return;
  if (warehouseOverflowSources.size > 0) {
    el.classList.add("warehouse-overflow-warn");
    const sources = Array.from(warehouseOverflowSources).join(", ");
    el.dataset.overflowSources = sources;
  } else {
    el.classList.remove("warehouse-overflow-warn");
    delete el.dataset.overflowSources;
  }
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
  renderWarehouse(s);
}

function renderWarehouse(s) {
  // Track automation overflow first so the warehouse panel reflects latest sources.
  const automationOverflow = s.automation_preview?.overflowed ?? {};
  setWarehouseOverflow("automation", Object.keys(automationOverflow).length > 0);

  const warehouseInfo = document.getElementById("warehouse-info");
  if (warehouseInfo && s.warehouse) {
    const usageClass = (s.warehouse.used ?? 0) >= (s.warehouse.capacity ?? 0) ? "risky" : "";
    const overflowSources = Array.from(warehouseOverflowSources);
    const sourceNote = overflowSources.length > 0
      ? `<br><span style="color:var(--gold);font-size:0.8em">⚠ overflow risk: ${overflowSources.join(", ")}</span>`
      : "";
    warehouseInfo.innerHTML =
      `<strong>Warehouse:</strong> L${s.warehouse.level} ` +
      `<br><span class="${usageClass}">${s.warehouse.used}/${s.warehouse.capacity} used</span>${sourceNote}`;
  }

  const upgradeButton = document.getElementById("btn-upgrade-warehouse");
  if (upgradeButton && s.warehouse) {
    upgradeButton.textContent = `Upgrade Warehouse (${fmt(s.warehouse.upgrade_cost ?? 0)})`;
  }
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
      <span class="assign-workers">${current > 0 ? `${current} ${t("active")}` : t("idle")}</span>`;
    list.appendChild(row);
  });

  const previewEl = document.getElementById("automation-preview");
  if (previewEl) {
    const produced = s.automation_preview?.produced || {};
    const wasteGenerated = s.automation_preview?.waste_generated || {};
    const overflowed = s.automation_preview?.overflowed || {};
    const orderedProducedItems = allItems(s).filter(item => (produced[item] ?? 0) > 0);
    const orderedWasteItems = allItems(s).filter(item => (wasteGenerated[item] ?? 0) > 0);
    const overflowedItems = allItems(s).filter(item => (overflowed[item] ?? 0) > 0);
    const producedText = orderedProducedItems
      .map(item => `${produced[item]}× ${itemIcon(item)}<span class="item-name">${item}</span>`)
      .join(", ");
    const wasteText = orderedWasteItems
      .map(item => `${wasteGenerated[item]}× ${itemIcon(item)}<span class="item-name">${item}</span>`)
      .join(", ");
    const overflowText = overflowedItems
      .map(item => `${overflowed[item]}× ${itemIcon(item)}<span class="item-name">${item}</span>`)
      .join(", ");

    if (!producedText) {
      previewEl.innerHTML = `<strong>${t("automationPreviewTitle")}:</strong> ${t("automationPreviewNone")}`;
    } else {
      previewEl.innerHTML = `<strong>${t("automationPreviewTitle")}:</strong> ${producedText}`;
    }
    if (wasteText) {
      previewEl.innerHTML += `<br><strong>Waste:</strong> ${wasteText}`;
    }
    if (overflowText) {
      previewEl.innerHTML += `<br><strong class="risky">Warning:</strong> <span class="risky">Warehouse overflow will discard ${overflowText}.</span>`;
    }
  }

  renderMachines(s);
}

function simulateOverflow(inventory, capacity) {
  const adjusted = { ...inventory };
  const overflowed = {};
  let used = Object.values(adjusted).reduce((sum, qty) => sum + Math.max(0, qty ?? 0), 0);
  if (used <= capacity) {
    return { adjusted, overflowed };
  }

  let overflow = used - capacity;
  Object.keys(adjusted)
    .sort((left, right) => (adjusted[right] ?? 0) - (adjusted[left] ?? 0))
    .forEach(item => {
      if (overflow <= 0) return;
      const available = Math.max(0, adjusted[item] ?? 0);
      if (available <= 0) return;
      const cut = Math.min(available, overflow);
      adjusted[item] -= cut;
      overflow -= cut;
      overflowed[item] = (overflowed[item] ?? 0) + cut;
    });

  return { adjusted, overflowed };
}

function computeManualCraftPreview(s, recipeName, requestedQty) {
  const recipe = s.effective_recipes?.[recipeName];
  const machine = s.machines?.[recipeName];
  if (!recipe || !machine) return null;

  if (!machine.owned || machine.status === "hard_failure") {
    return {
      craftable: 0,
      produced: {},
      wasteGenerated: {},
      overflowed: {},
      limitedBy: "machine",
    };
  }

  let craftable = Math.max(0, requestedQty);
  if (machine.status === "soft_failure") {
    craftable = Math.max(1, Math.floor((craftable + 1) / 2));
  }

  Object.entries(recipe.inputs || {}).forEach(([item, qty]) => {
    if (qty > 0) {
      craftable = Math.min(craftable, Math.floor((s.inventory?.[item] ?? 0) / qty));
    }
  });

  const nextInventory = { ...(s.inventory || {}) };
  Object.entries(recipe.inputs || {}).forEach(([item, qty]) => {
    nextInventory[item] = (nextInventory[item] ?? 0) - (qty * craftable);
  });

  const produced = {};
  Object.entries(recipe.outputs || {}).forEach(([item, qty]) => {
    produced[item] = qty * craftable;
    nextInventory[item] = (nextInventory[item] ?? 0) + produced[item];
  });

  const wasteGenerated = {};
  if (["gear", "widget"].includes(recipeName) && craftable > 0) {
    const scrap = Math.floor(craftable / 2);
    if (scrap > 0) {
      wasteGenerated.scrap = scrap;
      nextInventory.scrap = (nextInventory.scrap ?? 0) + scrap;
    }
  }

  const { overflowed } = simulateOverflow(nextInventory, s.warehouse?.capacity ?? Number.MAX_SAFE_INTEGER);
  return { craftable, produced, wasteGenerated, overflowed };
}

function contractDaysLeft(contract, currentDay) {
  return Math.max(0, Number(contract.deadline_day ?? currentDay) - Number(currentDay ?? 0));
}

function contractCanClaim(contract, inventory) {
  if (!contract || !["accepted", "completed"].includes(contract.status)) return false;
  return (inventory?.[contract.item] ?? 0) >= (contract.qty ?? 0);
}

function groupContracts(contracts) {
  const grouped = new Map();
  (Array.isArray(contracts) ? contracts : []).forEach(contract => {
    const key = contract.group_key ?? contract.name ?? contract.id;
    if (!grouped.has(key)) {
      grouped.set(key, { title: contract.name, entries: [] });
    }
    grouped.get(key).entries.push(contract);
  });
  return Array.from(grouped.values());
}

function renderContracts(s) {
  const summary = document.getElementById("contracts-summary");
  const contractsList = document.getElementById("contracts-list");
  if (!contractsList) return;

  const contracts = Array.isArray(s.contracts) ? s.contracts : [];
  const openCount = contracts.filter(contract => contract.status === "open").length;
  const activeCount = contracts.filter(contract => contract.status !== "open").length;
  if (summary) {
    summary.innerHTML = `Open offers: <strong>${openCount}</strong><br>Accepted or ready: <strong>${activeCount}</strong>`;
  }

  contractsList.innerHTML = "";
  if (contracts.length === 0) {
    contractsList.innerHTML = `<div class="machine-note">No contracts available.</div>`;
    return;
  }

  groupContracts(contracts).forEach(group => {
    const wrapper = document.createElement("section");
    wrapper.className = "contract-group";
    wrapper.innerHTML = `<div class="contract-group-title">${group.title}</div>`;

    group.entries.forEach(contract => {
      const card = document.createElement("div");
      const status = contract.status || "open";
      const daysLeft = contractDaysLeft(contract, s.day);
      const dueSoon = daysLeft <= 1;
      const canClaim = contractCanClaim(contract, s.inventory);
      const actionBtn = status === "open"
        ? `<button class="btn-primary" onclick="doAcceptContract('${contract.id}')">Accept</button>`
        : canClaim
          ? `<button class="btn-craft" onclick="doClaimContract('${contract.id}')">Claim ${fmt(contract.reward ?? 0)}</button>`
          : `<button class="btn-primary" disabled>${status}</button>`;
      card.className = `machine-card machine-owned contract-card${dueSoon ? " contract-due-soon" : ""}`;
      card.innerHTML = `
        <div class="machine-head">
          <div>
            <div class="machine-name">${contract.difficulty} • ${contract.qty}× ${itemIcon(contract.item)}<span class="item-name">${contract.item}</span></div>
            <div class="machine-recipe"><span class="loss">Penalty ${fmt(contract.penalty ?? 0)}</span> • <span class="profit">Reward ${fmt(contract.reward ?? 0)}</span></div>
          </div>
          <div class="machine-status ${dueSoon ? "hard_failure" : status === "completed" ? "operational" : "soft_failure"}">${status}</div>
        </div>
        <div class="machine-stats">
          <span>Deadline: day ${contract.deadline_day}</span>
          <span class="${dueSoon ? "loss" : ""}">Due in ${daysLeft} day(s)</span>
        </div>
        ${actionBtn}
      `;
      wrapper.appendChild(card);
    });

    contractsList.appendChild(wrapper);
  });
}

function renderContractHistory(s) {
  const historyList = document.getElementById("contract-history-list");
  if (!historyList) return;

  const history = Array.isArray(s.contract_history) ? s.contract_history : [];
  historyList.innerHTML = "";
  if (history.length === 0) {
    historyList.innerHTML = `<div class="machine-note">No contract history yet.</div>`;
    return;
  }

  groupContracts(history).forEach(group => {
    const wrapper = document.createElement("section");
    wrapper.className = "contract-group";
    wrapper.innerHTML = `<div class="contract-group-title">${group.title}</div>`;

    group.entries.forEach(contract => {
      const row = document.createElement("div");
      row.className = "contract-history-row";
      row.innerHTML = `
        <span>${contract.difficulty}</span>
        <span>${contract.qty}× ${contract.item}</span>
        <span>${fmt(contract.reward ?? 0)}</span>
        <span class="${contract.status === "claimed" ? "profit" : contract.status === "failed" ? "loss" : "risky"}">${contract.status}</span>
        <span>Day ${contract.resolved_day ?? "-"}</span>
      `;
      wrapper.appendChild(row);
    });

    historyList.appendChild(wrapper);
  });
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
  if (strategy === "preventive") return t("machinePreventive");
  if (strategy === "predictive") return t("machinePredictive");
  return t("machineCorrective");
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
    const predictiveTarget = machine.strategy === "predictive"
      ? `<span>${t("machinePredictiveTarget")}: ${machine.predictive_maintenance_day ?? "-"}</span>`
      : "";

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
        ${machine.strategy === "preventive" ? `<span>${t("machineInterval")}: ${machine.preventive_interval}d</span>` : ""}
        ${predictiveTarget}
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

  // Check if buying this qty would overflow the warehouse
  const nextInventory = { ...(G.inventory || {}), [item]: (G.inventory?.[item] ?? 0) + qty };
  const { overflowed } = simulateOverflow(nextInventory, G.warehouse?.capacity ?? Number.MAX_SAFE_INTEGER);
  setWarehouseOverflow("buy", Object.keys(overflowed).length > 0);

  if (priceHistoryVisible) {
    renderPriceChart(G);
  }
}

function updateRecipeInfo() {
  if (!G) return;
  const recipe = document.getElementById("craft-recipe").value;
  const craftInput = document.getElementById("craft-qty");
  const requestedQty = parseCraftQty(craftInput?.value ?? "0", 0);
  const er = G.effective_recipes[recipe];
  if (!er) return;
  const machine = G.machines?.[recipe];
  const hoursPerBatch = G.craft_hours?.[recipe] ?? 1;
  const preview = computeManualCraftPreview(G, recipe, requestedQty);
  const craftMax = computeCraftMax();
  if (craftInput) {
    craftInput.max = String(craftMax);
    if (requestedQty > craftMax) {
      craftInput.value = String(craftMax);
    }
  }

  // ── Recipe section ─────────────────────────────────────────────
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

  let html = `<strong>${t("inputs")}:</strong> ${inputs}`;
  html += `<br><strong>${t("outputs")}:</strong> ${outputs}`;
  html += `<br><span style="color:var(--muted);font-size:0.85em">⏱ ${hoursPerBatch}h per batch</span>`;

  // ── Machine section ────────────────────────────────────────────
  const machineMissing = Boolean(machine && !machine.owned);
  const machineFailed = Boolean(machine && machine.owned && (machine.status === "soft_failure" || machine.status === "hard_failure"));
  if (machine) {
    html += `<hr class="recipe-sep">`;
    html += `<strong>${t("machineRequired")}:</strong> <span class="${machineMissing || machineFailed ? "loss" : ""}">${machine.name} (${machineStatusLabel(machine.owned ? machine.status : "missing")})</span>`;
  }

  // ── Expected output section ────────────────────────────────────
  if (requestedQty > 0 && preview) {
    html += `<hr class="recipe-sep">`;
    const craftable = preview.craftable ?? 0;
    const totalHours = craftable * hoursPerBatch;
    const currentHour = G.hour ?? 0;
    const endHour = currentHour + totalHours;
    const daysElapsed = Math.floor(endHour / 24);
    const endLocalHour = endHour % 24;
    const endDay = (G.day ?? 1) + daysElapsed;
    const stoppingTime = `${String(endLocalHour).padStart(2, "0")}:00`;
    const dayNote = daysElapsed > 0 ? ` (Day ${endDay})` : "";

    const previewOutputs = Object.entries(preview.produced || {})
      .filter(([, qty]) => qty > 0)
      .map(([item, qty]) => `${qty}× ${itemIcon(item)}<span class="item-name">${item}</span>`)
      .join(", ");
    const previewWaste = Object.entries(preview.wasteGenerated || {})
      .filter(([, qty]) => qty > 0)
      .map(([item, qty]) => `${qty}× ${itemIcon(item)}<span class="item-name">${item}</span>`)
      .join(", ");
    const previewOverflow = Object.entries(preview.overflowed || {})
      .filter(([, qty]) => qty > 0)
      .map(([item, qty]) => `${qty}× ${itemIcon(item)}<span class="item-name">${item}</span>`)
      .join(", ");

    html += `<strong>Expected for ${craftable} batch(es):</strong>`;
    if (craftable > 0) {
      html += `<br>⏱ Time: ${totalHours}h (${craftable} × ${hoursPerBatch}h)`;
      html += `<br>🏁 Done at ${stoppingTime}${dayNote}`;
    }
    if (previewOutputs) html += `<br><strong>Output:</strong> ${previewOutputs}`;
    if (previewWaste)   html += `<br><strong>Waste:</strong> ${previewWaste}`;
    if (previewOverflow) {
      html += `<br><strong class="risky">⚠ Overflow:</strong> <span class="risky">Warehouse will discard ${previewOverflow}.</span>`;
    }

    setWarehouseOverflow("craft", previewOverflow.length > 0);
  } else {
    setWarehouseOverflow("craft", false);
  }

  document.getElementById("recipe-info").innerHTML = html;
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
  updateRecipeInfo();
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
