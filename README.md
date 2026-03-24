# Game Factory MVP

A Python web factory game MVP with a browser GUI: buy raw materials, buy and maintain machines, craft products, hire workers for automation, unlock blueprints, and react to dynamic market prices.

## Run locally

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH="src"
python main.py
```

Then open your browser at `http://localhost:5000`.

## Run in devcontainer

- Open this folder in VS Code.
- Reopen in Container when prompted.
- Run:

```bash
PYTHONPATH=src python main.py
```

Then open `http://localhost:5000`.

## Gameplay (GUI)

- Use the **Market** tab to buy/sell items (8:00-18:00 hours only).
- Use the **Factory** tab for manual crafting, machine management, and worker assignment.
- Use the **Blueprints** tab to purchase production upgrades.
- Use the **Margins** tab to inspect current recipe profitability.
- Use the bottom bar to advance time and view activity logs.

## MVP mechanics covered

- 24h clock with action time costs and market open/closed state.
- Machine purchase required before crafting each recipe.
- Bathtub-style machine reliability with soft/hard failures and escalation.
- Preventive maintenance (scheduled, 0.6× risk reduction) and corrective repair (run-to-failure).
- Manual crafting gated by machine availability and condition.
- Worker automation by recipe assignment.
- Blueprint upgrades for recipe efficiency/output.
- Not-always-profitable recipes.
- Slightly dynamic daily prices.
- Financial, market, and margin dashboards in the web UI.

## Documentation

- **[Machine Maintenance & Wear System](docs/machine_maintenance.md)** — Deep dive on failure mechanics, zones, strategies, and costs.
- **[Game Design Document](docs/game_design.md)** — High-level design decisions and feature scope.

## Save system and sessions

- Use the bottom bar `Save` / `Load` buttons to persist or restore a run.
- Saves are stored as JSON files in `saves/` (slot-based, default slot: `default`).
- Browser sessions are isolated: opening the game in two different browsers/incognito windows creates two independent player states running simultaneously.

## Roadmap (summary)

1. Expand save/load robustness and deterministic seeded runs.
2. Add contracts and richer market events with clearer risk/reward.
3. Improve operations depth: warehouse limits and logistics throughput.
4. Add smarter automation rules and worker specialization.
5. Expand machine lifecycle systems and machine-level upgrades.
6. Introduce a research tree (efficiency, throughput, reliability, market intelligence).
7. Add broader financial pressure (energy/utilities, rent/tax style costs).
8. Introduce competitor pressure and market-share dynamics.
