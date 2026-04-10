/**
 * Minimal DOM fixture with every element ID that game.js references.
 * Call createDOM() before evaluating game.js so all getElementById() calls
 * and the module-level event listener on #hours-input succeed.
 */
export function createDOM() {
  document.body.innerHTML = `
    <!-- Status bar -->
    <span id="title"></span>
    <span id="lbl-day"></span>
    <span id="stat-day"></span>
    <span id="lbl-time"></span>
    <span id="stat-time"></span>
    <span id="lbl-market-status"></span>
    <span id="stat-market-status" class="stat-value"></span>
    <span id="lbl-cash"></span>
    <span id="stat-cash" class="stat-value"></span>
    <span id="lbl-workers"></span>
    <span id="stat-workers"></span>
    <span id="stat-workers-detail"></span>
    <span id="lbl-salary"></span>
    <span id="stat-salary"></span>
    <span id="lbl-lang"></span>

    <!-- Tab buttons (referenced by applyTranslations + switchTab) -->
    <button id="tab-btn-market"></button>
    <button id="tab-btn-factory"></button>
    <button id="tab-btn-contracts"></button>
    <button id="tab-btn-blueprints"></button>
    <button id="tab-btn-margins"></button>

    <!-- Tab bar + panels (switchTab queries .tab-btn[data-tab=...]) -->
    <div id="tab-bar">
      <button class="tab-btn" data-tab="market"></button>
      <button class="tab-btn" data-tab="factory"></button>
      <button class="tab-btn" data-tab="contracts"></button>
      <button class="tab-btn" data-tab="blueprints"></button>
      <button class="tab-btn" data-tab="margins"></button>
    </div>
    <div id="tab-market"     class="tab-panel active"></div>
    <div id="tab-factory"    class="tab-panel"></div>
    <div id="tab-contracts"  class="tab-panel"></div>
    <div id="tab-blueprints" class="tab-panel"></div>
    <div id="tab-margins"    class="tab-panel"></div>

    <!-- Market prices table -->
    <span id="market-prices-title"></span>
    <table>
      <thead><tr>
        <th id="th-item"></th>
        <th id="th-price"></th>
        <th id="th-change"></th>
      </tr></thead>
      <tbody id="market-tbody"></tbody>
    </table>

    <!-- Buy / Sell form -->
    <span id="buy-sell-title"></span>
    <label id="lbl-market-item"></label>
    <label id="lbl-selected-item"></label>
    <span  id="selected-market-item">ore</span>
    <label id="lbl-market-qty"></label>
    <input id="market-qty" type="number" value="0" />
    <button id="btn-max-buy"></button>
    <button id="btn-max-sell"></button>
    <label id="lbl-total"></label>
    <span  id="cost-preview"></span>
    <button id="btn-buy"></button>
    <button id="btn-sell"></button>

    <!-- Inventory sidebar -->
    <aside id="inventory-sidebar">
      <span   id="inventory-sidebar-title"></span>
      <button id="btn-toggle-inventory"></button>
      <div id="warehouse-info"></div>
      <button id="btn-upgrade-warehouse"></button>
      <div class="inv-grid" id="inventory-sidebar-grid"></div>
    </aside>

    <!-- Price history -->
    <span  id="price-history-title"></span>
    <button id="btn-toggle-history"></button>
    <div id="price-history-panel" style="display:none">
      <svg id="price-chart-svg"></svg>
      <span id="chart-note"></span>
    </div>

    <!-- Manual crafting -->
    <span  id="manual-crafting-title"></span>
    <label id="lbl-craft-recipe"></label>
    <select id="craft-recipe">
      <option value="ingot">ingot</option>
      <option value="gear">gear</option>
      <option value="widget">widget</option>
      <option value="scrap_mix">scrap_mix</option>
    </select>
    <label id="lbl-craft-qty"></label>
    <div class="qty-stepper">
      <button id="btn-qty-craft-dec"></button>
      <input id="craft-qty" type="text" value="1" />
      <button id="btn-qty-craft-inc"></button>
    </div>
    <button id="btn-max-craft"></button>
    <button id="btn-craft"></button>
    <div id="recipe-info"></div>

    <!-- Workers -->
    <span  id="workers-title"></span>
    <label id="lbl-hire-qty"></label>
    <div class="qty-stepper">
      <button id="btn-qty-hire-dec"></button>
      <input id="hire-qty" type="text" value="1" />
      <button id="btn-qty-hire-inc"></button>
    </div>
    <button id="btn-max-hire"></button>
    <button id="btn-hire"></button>
    <label id="lbl-fire-qty"></label>
    <div class="qty-stepper">
      <button id="btn-qty-fire-dec"></button>
      <input id="fire-qty" type="text" value="1" />
      <button id="btn-qty-fire-inc"></button>
    </div>
    <button id="btn-max-fire"></button>
    <button id="btn-fire"></button>

    <!-- Automation -->
    <span id="automation-title"></span>
    <span id="automation-note"></span>
    <div  id="assign-list"></div>
    <button id="btn-assign-all"></button>
    <div  id="automation-preview"></div>

    <!-- Contracts -->
    <div id="contracts-summary"></div>
    <div id="contracts-list"></div>
    <div id="contract-history-list"></div>

    <!-- Machines -->
    <span id="machine-fleet-title"></span>
    <span id="machine-note"></span>
    <div id="machine-list"></div>

    <!-- Blueprints -->
    <div id="blueprints-grid"></div>

    <!-- Margins -->
    <table><tbody id="margins-tbody"></tbody></table>

    <!-- Bottom bar -->
    <div  id="log-box"></div>
    <label id="hours-label"></label>
    <select id="hours-input">
      <option value="1">+1h</option>
      <option value="4">+4h</option>
      <option value="8">+8h</option>
      <option value="rest">Rest of day</option>
      <option value="market_open">To next market opening</option>
    </select>
    <button id="btn-advance-time"></button>
    <input id="save-slot" type="text" value="default" />
    <button id="btn-save-game"></button>
    <button id="btn-load-game"></button>

    <!-- Language selector -->
    <select id="lang-select">
      <option value="en">EN</option>
      <option value="fr">FR</option>
    </select>
  `
}
