# Factory Game — Product Design and Feature Set

## Vision
A factory/tycoon game where the player buys raw materials, transforms them through production chains, and sells higher-value goods while balancing profitability, automation, and market risk.

## Mandatory Product Constraints
- The final game must be **GUI-first** (desktop GUI or web GUI).
- The final game must **not** be a CLI game.
- Any CLI implementation can be used only as internal prototyping, not as the target player experience.

---

## Complete Feature Pool

### 1) Core Economy Loop
- Buy raw materials from a market.
- Craft intermediate and advanced products.
- Sell outputs for revenue and reinvest capital.
- Keep cash flow positive while scaling operations.

### 2) Time and Clock System
A 24-hour clock replaces the binary "Next Day" button. Every player action consumes time, making time the fundamental resource — not just a backdrop for automation.

- **Day clock**: each in-game day has 24 hours, displayed as a progress bar or clock face.
- **"Advance time" control**: replaces "Next Day". Player chooses how many hours to spend (e.g. 1 h, 4 h, 8 h, rest-of-day). Advancing to hour 24 triggers the daily reset (salary deduction, price update, worker automation tick, maintenance tick).
- **Action time costs** (all actions consume hours from the day's clock):
  - Manual crafting: 1–4 hours per batch depending on recipe complexity.
  - Buying or selling on the market: 1 hour per transaction.
  - Hiring / firing workers: 1 hour per operation.
  - Emergency machine repair: 4–8 hours.
  - Scheduled preventive maintenance: 2–4 hours per machine.
- **Market open/close hours**: the market operates only during business hours (e.g. 08:00–18:00). Buy/sell actions outside those hours are blocked. Players must plan purchasing around the clock. Emergency night-market purchases are possible at a premium price surcharge.
- **Worker automation**: workers produce one batch per assigned recipe per full 24-hour cycle automatically (unchanged in rate, but now tied to the clock rollover).
- **Sleeping / idle time**: advancing time without actions still passes the clock, allowing players to "wait out" a bad market hour window without doing anything costly.

### 3) Crafting and Automation Progression
- Manual crafting requires the appropriate machine to be installed (see section 6).
- Hire workers to automate recipe production — they use the same machines overnight.
- Assign workers by recipe/production line.
- Worker productivity growth: workers gain experience per day assigned. After 10 days on the same recipe, a worker becomes "senior" and produces +1 bonus batch/day.
- Add conditional automation rules later (craft only if margin > target, stop if stock exceeds threshold).

### 4) Blueprints, R&D, and Progression
- Unlock/buy blueprints that change recipe economics.
- Blueprint effects can include:
  - Lower input usage
  - Higher output yield
  - Reduced crafting time cost (fewer hours per batch)
  - Unlock **predictive maintenance** (replaces reactive failure with a remaining-life indicator, preventing surprise breakdowns)
- Blueprints can be expensive and not always immediately profitable.
- Extend into a research tree with distinct branches:
  - Efficiency branch (input reduction, yield boost)
  - Throughput branch (speed / time reduction, automation multipliers)
  - Reliability branch (maintenance, machine longevity)
  - Market intelligence branch (price forecasting, event early-warning)

### 5) Recipe Design and Profitability
- Some recipes should be intentionally unprofitable in normal conditions.
- Provide recipe variants (cheap/slow vs expensive/fast — trade hours for margin).
- Support multi-step production chains where bottlenecks matter.
- Include byproducts/waste with optional recycling or disposal costs.

### 6) Machines and Maintenance
Machines are required to craft; they cannot be bypassed. This makes capital investment a prerequisite for production and gives maintenance a real cost.

- **Machine purchase**: each recipe type requires buying the corresponding machine before crafting is possible (e.g. Smelter for ingots, Gear Press for gears). Machines have an upfront purchase cost and a rated **lifetime** (e.g. 60 days of operation).
- **Bathtub reliability curve**: failure probability follows a realistic bathtub curve:
  - *Infant mortality zone* (first ~5 days): elevated failure risk while the machine is run-in.
  - *Useful life zone* (middle): low, constant failure rate.
  - *Wear-out zone* (final ~10 days before end-of-life): sharply rising failure probability.
- **Failure modes**:
  - *Soft failure*: output reduced by 50% until repaired.
  - *Hard failure*: machine completely stopped; urgent repair or replacement needed.
- **Maintenance strategies** (player's choice per machine):
  - *Corrective (run-to-failure)*: cheapest upfront, highest risk of hard failure and unplanned downtime. Emergency repair costs 3× more and takes 4–8 hours.
  - *Preventive*: schedule a maintenance window every N days (player-configurable). Costs cash + 2–4 hours of player time, but resets the wear counter and avoids unplanned stops.
  - *Predictive* (unlocked via blueprint): machine shows a "remaining life" health bar. Maintenance is triggered only when health drops below a threshold, minimising both unnecessary downtime and surprise failures.
- **Machine replacement**: when a machine reaches end-of-life or suffers a hard failure beyond repair, the player buys a replacement. Second-hand machines are cheaper but start in the wear-out zone.

### 7) Dynamic Market and Financial Pressure
- Prices fluctuate daily within bounded ranges.
- **Market hours**: buy/sell only available 08:00–18:00. Night purchases incur a +30% surcharge (emergency supplier).
- **Supply/demand events**: every 5–15 days a random event fires (ore shortage, construction boom, recession, new competitor). Events last 3–7 days and shift prices and demand.
- Hidden/operating costs to prevent trivial exponential growth:
  - Salaries (daily, per worker)
  - Machine maintenance costs (per maintenance event)
  - Energy/utilities (per production tick, later phase)
  - Rent/taxes/loan interest (later phase)
- Optional lightweight competitor pressure (flooding one market reduces sale price).

### 8) Operations and Infrastructure
- **Warehouse capacity**: inventory capped per item (e.g. 100 units). Exceeding capacity requires selling before advancing time or buying a warehouse upgrade.
- Upgradeable warehouse and logistics throughput.
- Transport delay between production stages (later phase).

### 9) Goals and Game Structure
- **Contracts with deadlines**: optional timed orders (e.g. "deliver 10 widgets within 5 days for $2,500"). Failure incurs a cash penalty; success unlocks better contract tiers.
- Short-term daily goals layered over long-term growth targets.
- Bankruptcy/insolvency pressure as a fail state.

### 10) Dashboards and Decision Support
- Financial dashboard:
  - Cash, equity, daily/weekly profit, burn rate
- Operations dashboard:
  - Throughput, worker assignment, idle time, bottlenecks, stockouts, machine health indicators
- Market dashboard:
  - Current prices, trend, volatility indicator, open/closed status, next event countdown
- Craft margin dashboard:
  - Input cost, output value, estimated margin per recipe, time cost per batch
- Maintenance dashboard:
  - Machine health, maintenance strategy, scheduled/overdue maintenance events
- What-if simulation panel:
  - Preview expected impact before buying machines/workers/blueprints or changing recipes

---

## MVP Scope (GUI)

### MVP Objective
Deliver a playable **GUI** vertical slice with the core loop, basic automation, the 24h clock, dynamic prices, and actionable dashboards.

### MVP Must Include
- GUI screens/panels for:
  - Market (buy/sell, with open/close indicators)
  - Factory (manual craft + worker assignment + machine purchase)
  - Blueprints (unlock/purchase)
  - Dashboards (finance, market, margins, machine health)
- **24h clock** with action time costs; "Advance time" control replacing "Next Day".
- Market open/close window (08:00–18:00); night surcharge for emergency purchases.
- **Machine purchase** required before crafting any recipe.
- **Bathtub reliability curve** with corrective and preventive maintenance strategies.
- Worker hiring and assignment automation.
- Blueprint purchases with meaningful trade-offs (including predictive maintenance blueprint).
- Slightly dynamic market pricing.
- At least one intentionally unprofitable recipe.
- Daily operating cost (worker salaries).

### MVP Should Include (If Time Allows)
- Basic contract system (3–5 timed order types with deadline and cash reward).
- Warehouse capacity limits with upgrade path.
- Simple supply/demand market event (1–2 event types).
- Worker experience and "senior worker" bonus.
- Simple byproduct/waste handling.

### Explicitly Out of MVP
- Deep event engine with many event types.
- Full competitor simulation.
- Full research tree.
- Transport delays between production stages.
- Energy/utility costs.
- Second-hand machine market.

---

## Post-MVP Roadmap
1. Save/load and seeded runs.
2. Full contract/event expansion (more event types, contract tiers, penalties).
3. Warehouse/logistics depth (transport delays, throughput upgrades).
4. Worker specialisation and conditional automation rules.
5. Advanced machine mechanics: second-hand market, cascade failures, machine-level blueprints.
6. Research tree (efficiency, throughput, reliability, market intelligence branches).
7. Energy/utility costs and rent/tax pressure.
8. Competitor and market-share mechanics.
