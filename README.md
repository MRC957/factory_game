# Game Factory MVP

A Python web factory game MVP with a browser GUI: buy raw materials, craft products, hire workers for automation, unlock blueprints, and react to dynamic market prices.

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

- Use the **Market** tab to buy/sell items.
- Use the **Factory** tab for manual crafting and worker assignment.
- Use the **Blueprints** tab to purchase production upgrades.
- Use the **Margins** tab to inspect current recipe profitability.
- Use the bottom bar to advance days and view activity logs.

## MVP mechanics covered

- Manual crafting at start.
- Worker automation by recipe assignment.
- Blueprint upgrades for recipe efficiency/output.
- Not-always-profitable recipes.
- Slightly dynamic daily prices.
- Financial, market, and margin dashboards in the web UI.

## Save system and sessions

- Use the bottom bar `Save` / `Load` buttons to persist or restore a run.
- Saves are stored as JSON files in `saves/` (slot-based, default slot: `default`).
- Browser sessions are isolated: opening the game in two different browsers/incognito windows creates two independent player states running simultaneously.
