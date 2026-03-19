# Game Factory MVP

A Python CLI factory game MVP: buy raw materials, craft products, hire workers for automation, unlock blueprints, and react to dynamic market prices.

## Run locally

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH="src"
python main.py
```

## Run in devcontainer

- Open this folder in VS Code.
- Reopen in Container when prompted.
- Run:

```bash
PYTHONPATH=src python main.py
```

## Commands

- `help`
- `status`
- `market`
- `margins`
- `buy <item> <qty>`
- `sell <item> <qty>`
- `craft <recipe> <qty>`
- `hire <qty>`
- `assign <recipe> <workers>`
- `blueprints`
- `blueprint buy <name>`
- `next [days]`
- `quit`

## MVP mechanics covered

- Manual crafting at start.
- Worker automation by recipe assignment.
- Blueprint upgrades for recipe efficiency/output.
- Not-always-profitable recipes.
- Slightly dynamic daily prices.
- Financial, market, and margin dashboards.
