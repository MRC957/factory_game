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

### 2) Crafting and Automation Progression
- Start with manual crafting.
- Hire workers to automate recipe production.
- Assign workers by recipe/production line.
- Add worker specialization later (speed, efficiency, quality).
- Add conditional automation rules later (example: craft only if margin > target).

### 3) Blueprints, R&D, and Progression
- Unlock/buy blueprints that change recipe economics.
- Blueprint effects can include:
  - Lower input usage
  - Higher output yield
  - Faster production time
- Blueprints can be expensive and not always immediately profitable.
- Extend into a research tree with distinct branches:
  - Efficiency branch
  - Throughput branch
  - Market intelligence branch

### 4) Recipe Design and Profitability
- Some recipes should be intentionally unprofitable in normal conditions.
- Provide recipe variants (cheap/slow vs expensive/fast).
- Support multi-step production chains where bottlenecks matter.
- Include byproducts/waste with optional recycling or disposal costs.

### 5) Dynamic Market and Financial Pressure
- Slightly dynamic prices (daily or periodic fluctuations).
- Supply/demand events (shortage spikes, demand booms, etc.).
- Hidden/operating costs to prevent trivial exponential growth:
  - Salaries
  - Energy/utilities
  - Maintenance
  - Rent/taxes/loan interest (later phase)
- Optional lightweight competitor pressure (flooding one market reduces sale price).

### 6) Operations and Infrastructure
- Limited storage/warehouse capacity.
- Upgradeable warehouse and logistics throughput.
- Transport delay between production stages (later phase).
- Machine reliability/failure and preventive maintenance.

### 7) Goals and Game Structure
- Contracts/objectives with deadlines, rewards, and penalties.
- Short-term goals layered over long-term growth.
- Bankruptcy/insolvency pressure as a fail state.

### 8) Dashboards and Decision Support
- Financial dashboard:
  - Cash, equity, daily/weekly profit, burn rate
- Operations dashboard:
  - Throughput, worker assignment, idle time, bottlenecks, stockouts
- Market dashboard:
  - Current prices, trend, volatility indicator
- Craft margin dashboard:
  - Input cost, output value, estimated margin per recipe
- What-if simulation panel:
  - Preview expected impact before buying workers/blueprints or changing recipes

---

## MVP Scope (GUI)

### MVP Objective
Deliver a playable **GUI** vertical slice with the core loop, basic automation, dynamic prices, and actionable dashboards.

### MVP Must Include
- GUI screens/panels for:
  - Market (buy/sell)
  - Factory (manual craft + worker assignment)
  - Blueprints (unlock/purchase)
  - Dashboards (finance, market, margins)
- Manual crafting for early progression.
- Worker hiring and assignment automation.
- Blueprint purchases with meaningful trade-offs.
- Slightly dynamic market pricing.
- At least one intentionally unprofitable recipe.
- Daily operating cost (at minimum worker salaries).

### MVP Should Include (If Time Allows)
- Basic contract system (small set of timed orders).
- Warehouse capacity limits.
- Simple byproduct/waste handling.

### Explicitly Out of MVP
- Deep event engine.
- Full competitor simulation.
- Complex maintenance/failure systems.
- Full research tree.

---

## Post-MVP Roadmap
1. Save/load and seeded runs.
2. Contract/event expansion.
3. Warehouse/logistics depth.
4. Maintenance and machine reliability.
5. Research tree and advanced automation rules.
6. Competitor and market-share mechanics.
