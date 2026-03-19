"""Flask-based web GUI for Factory Game MVP.

Architecture: thin REST layer over FactoryGame.
The frontend is a single HTML page that drives the game entirely through
JSON API calls — no page reloads.  Every mutating endpoint returns the full
game state so the client never needs a separate /api/state poll after an action.
"""
from __future__ import annotations

import threading
import webbrowser
from typing import Any

from flask import Flask, jsonify, render_template, request

from game_factory.game import FactoryGame

# Single in-process game instance.  Fine for a single-player desktop MVP;
# replace with a session-keyed store if multi-user support is needed.
_game: FactoryGame = FactoryGame()

# template_folder is relative to this file's package directory, so Flask
# resolves it to src/game_factory/templates/ regardless of the cwd.
app = Flask(__name__, template_folder="templates")


# ── State serialisation ──────────────────────────────────────────────────────

def _compute_margins() -> dict[str, Any]:
    """Compute per-recipe profit margins at current market prices.

    Uses recipe_effective() so blueprint modifiers (reduced inputs, bonus
    output) are already baked in to the returned numbers.
    """
    g = _game
    result: dict[str, Any] = {}
    for recipe_name in g.recipes:
        # recipe_effective applies any owned-blueprint overrides to inputs/outputs.
        recipe = g.recipe_effective(recipe_name)
        input_cost = sum(g.market_prices[item] * qty for item, qty in recipe.inputs.items())
        output_value = sum(g.market_prices[item] * qty for item, qty in recipe.outputs.items())
        margin = output_value - input_cost
        result[recipe_name] = {
            "input_cost": round(input_cost, 2),
            "output_value": round(output_value, 2),
            "margin": round(margin, 2),
        }
    return result


def _game_state() -> dict[str, Any]:
    """Serialise the full game state to a plain JSON-compatible dict.

    This is the single source of truth sent to the frontend after every action.
    Keeping it complete (rather than returning diffs) keeps the client simple:
    each render() call replaces the entire UI from this snapshot.
    """
    g = _game
    assigned = sum(g.assignments.values())
    return {
        "day": g.day,
        "cash": round(g.cash, 2),
        "total_workers": g.total_workers,
        "assigned_workers": assigned,
        # free_workers is derived here so the client doesn't have to compute it.
        "free_workers": g.total_workers - assigned,
        "worker_hire_cost": g.worker_hire_cost,
        "daily_salary": round(g.total_workers * g.worker_salary, 2),
        "inventory": dict(g.inventory),
        "market_prices": {k: round(v, 2) for k, v in g.market_prices.items()},
        # price_change is stored as a fraction in the model; convert to % for display.
        "price_change": {k: round(v * 100, 1) for k, v in g.price_change.items()},
        "assignments": dict(g.assignments),
        "owned_blueprints": list(g.owned_blueprints),
        # Flatten blueprint metadata + ownership into one dict so the client
        # can render the shop without a separate lookup.
        "blueprints": {
            name: {
                "cost": bp.cost,
                "description": bp.description,
                "owned": name in g.owned_blueprints,
            }
            for name, bp in g.blueprints.items()
        },
        # Effective recipes (post-blueprint) are sent so the UI can show the
        # actual inputs/outputs the player will experience, not the base values.
        "effective_recipes": {
            name: {
                "inputs": dict(g.recipe_effective(name).inputs),
                "outputs": dict(g.recipe_effective(name).outputs),
            }
            for name in g.recipes
        },
        "margins": _compute_margins(),
        # Bankruptcy threshold is -$500 (a small grace buffer below zero).
        "bankrupt": g.cash < -500,
    }


# ── Routes ───────────────────────────────────────────────────────────────────
# Convention: every mutating endpoint returns {"message": str, "state": dict}
# so the client can update both the activity log and the full UI in one round trip.

@app.route("/")
def index() -> Any:
    # Serve the SPA shell; all game data comes from /api/* afterwards.
    return render_template("index.html")


@app.route("/api/state")
def api_state() -> Any:
    # Used only on initial page load; subsequent actions embed state in their response.
    return jsonify(_game_state())


@app.route("/api/buy", methods=["POST"])
def api_buy() -> Any:
    data = request.get_json(force=True)
    # str/int casts guard against the browser sending unexpected JSON types.
    msg = _game.buy(str(data["item"]), int(data["qty"]))
    return jsonify({"message": msg, "state": _game_state()})


@app.route("/api/sell", methods=["POST"])
def api_sell() -> Any:
    data = request.get_json(force=True)
    msg = _game.sell(str(data["item"]), int(data["qty"]))
    return jsonify({"message": msg, "state": _game_state()})


@app.route("/api/craft", methods=["POST"])
def api_craft() -> Any:
    data = request.get_json(force=True)
    msg = _game.craft_manual(str(data["recipe"]), int(data["qty"]))
    return jsonify({"message": msg, "state": _game_state()})


@app.route("/api/hire", methods=["POST"])
def api_hire() -> Any:
    data = request.get_json(force=True)
    msg = _game.hire(int(data["qty"]))
    return jsonify({"message": msg, "state": _game_state()})


@app.route("/api/assign", methods=["POST"])
def api_assign() -> Any:
    data = request.get_json(force=True)
    msg = _game.assign(str(data["recipe"]), int(data["qty"]))
    return jsonify({"message": msg, "state": _game_state()})


@app.route("/api/buy_blueprint", methods=["POST"])
def api_buy_blueprint() -> Any:
    data = request.get_json(force=True)
    msg = _game.buy_blueprint(str(data["name"]))
    return jsonify({"message": msg, "state": _game_state()})


@app.route("/api/next_day", methods=["POST"])
def api_next_day() -> Any:
    data = request.get_json(force=True) or {}
    # Clamp to at least 1; the client UI also limits the max to 30.
    days = max(1, int(data.get("days", 1)))
    messages: list[str] = []
    for _ in range(days):
        # next_day() advances automation, deducts salaries, and randomises prices.
        messages.append(_game.next_day())
    # Join multi-day summaries with newlines so the client log renders them as
    # separate lines without needing to know how many days were advanced.
    return jsonify({"message": "\n".join(messages), "state": _game_state()})


# ── Entry point ──────────────────────────────────────────────────────────────

def run_web_gui(port: int = 5000) -> None:
    """Start the Flask dev server and attempt to open the browser automatically.

    host="0.0.0.0" makes the server reachable from the host machine when running
    inside a devcontainer (VS Code forwards the port automatically).
    use_reloader=False prevents Flask from spawning a second process, which would
    break the threading.Timer browser-open trick and duplicate the game state.
    """
    url = f"http://localhost:{port}"
    print(f"Factory Game is running at {url}")
    print("Open that URL in your browser (or it may open automatically).")
    try:
        # Delay slightly so the server socket is bound before the browser hits it.
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    except Exception:
        # webbrowser.open can raise in headless environments; just skip it.
        pass
    # threaded=True: explicit here because some debugger configurations (debugpy)
    # can suppress Werkzeug's auto-detection of its own default, serialising all
    # requests onto one thread and causing the browser to hang indefinitely.
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False, threaded=True)
