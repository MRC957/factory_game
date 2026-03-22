"""Flask-based web GUI for Factory Game MVP.

Architecture: thin REST layer over FactoryGame.
The frontend is a single HTML page that drives the game entirely through
JSON API calls — no page reloads.  Mutating endpoints return a state snapshot
so the client can merge and re-render without a separate /api/state poll.
"""
from __future__ import annotations

import json
from pathlib import Path
import threading
import uuid
import webbrowser
from typing import Any

from flask import Flask, jsonify, render_template, request, session

from game_factory.game import (
    FactoryGame,
    ITEM_CATALOG,
    ITEM_IDS,
    MARKET_CLOSE_HOUR,
    MARKET_OPEN_HOUR,
    RECIPE_IDS,
)

# Single in-process game instance.  Fine for a single-player desktop MVP;
# replace with a session-keyed store if multi-user support is needed.
_game: FactoryGame = FactoryGame()
_games_by_player: dict[str, FactoryGame] = {}
SAVE_DIR = Path(__file__).resolve().parents[2] / "saves"
SAVE_DIR.mkdir(parents=True, exist_ok=True)

# template_folder is relative to this file's package directory, so Flask
# resolves it to src/game_factory/templates/ regardless of the cwd.
app = Flask(__name__, template_folder="templates")
app.config["SECRET_KEY"] = "factory-game-dev-secret"


def _player_id() -> str:
    sid = session.get("player_id")
    if not sid:
        sid = uuid.uuid4().hex
        session["player_id"] = sid
    return str(sid)


def _current_game() -> FactoryGame:
    if app.config.get("TESTING"):
        return _game
    sid = _player_id()
    if sid not in _games_by_player:
        _games_by_player[sid] = FactoryGame()
    return _games_by_player[sid]


def _set_current_game(game: FactoryGame) -> None:
    global _game
    if app.config.get("TESTING"):
        _game = game
        return
    _games_by_player[_player_id()] = game


def _safe_slot_name(raw: Any) -> str:
    slot = str(raw or "default").strip().lower()
    if not slot:
        return "default"
    return "".join(c for c in slot if c.isalnum() or c in {"-", "_"}) or "default"


def _save_file_path(slot: str) -> Path:
    if app.config.get("TESTING"):
        return SAVE_DIR / f"{slot}.json"
    return SAVE_DIR / f"{_player_id()}_{slot}.json"


# ── State serialisation ──────────────────────────────────────────────────────

def _compute_margins() -> dict[str, Any]:
    """Compute per-recipe profit margins at current market prices.

    Uses recipe_effective() so blueprint modifiers (reduced inputs, bonus
    output) are already baked in to the returned numbers.
    """
    g = _current_game()
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


def _game_state(compact: bool = False) -> dict[str, Any]:
    """Serialise the full game state to a plain JSON-compatible dict.

    This is the source of truth sent to the frontend.
    compact=True omits heavier derived/history fields for frequent actions.
    """
    g = _current_game()
    assigned = sum(g.assignments.values())
    state: dict[str, Any] = {
        "day": g.day,
        "hour": g.hour,
        "clock": f"{g.hour:02d}:00",
        "market_open_hour": MARKET_OPEN_HOUR,
        "market_close_hour": MARKET_CLOSE_HOUR,
        "market_is_open": MARKET_OPEN_HOUR <= g.hour < MARKET_CLOSE_HOUR,
        "cash": round(g.cash, 2),
        "items": list(ITEM_IDS),
        "recipes": list(RECIPE_IDS),
        "item_icons": {item_name: str(item["icon"]) for item_name, item in ITEM_CATALOG.items()},
        "total_workers": g.total_workers,
        "assigned_workers": assigned,
        # free_workers is derived here so the client doesn't have to compute it.
        "free_workers": g.total_workers - assigned,
        "worker_hire_cost": g.worker_hire_cost,
        "worker_fire_fee": g.worker_fire_fee,
        "daily_salary": round(g.total_workers * g.worker_salary, 2),
        "inventory": dict(g.inventory),
        "market_prices": {k: round(v, 2) for k, v in g.market_prices.items()},
        # price_change is stored as a fraction in the model; convert to % for display.
        "price_change": {k: round(v * 100, 1) for k, v in g.price_change.items()},
        "assignments": dict(g.assignments),
        "owned_blueprints": list(g.owned_blueprints),
        # Bankruptcy threshold is -$500 (a small grace buffer below zero).
        "bankrupt": g.cash < -500,
    }
    if compact:
        return state

    # Flatten blueprint metadata + ownership into one dict so the client
    # can render the shop without a separate lookup.
    state["blueprints"] = {
        name: {
            "cost": bp.cost,
            "description": bp.description,
            "owned": name in g.owned_blueprints,
        }
        for name, bp in g.blueprints.items()
    }
    # Effective recipes (post-blueprint) are sent so the UI can show the
    # actual inputs/outputs the player will experience, not the base values.
    state["effective_recipes"] = {
        name: {
            "inputs": dict(g.recipe_effective(name).inputs),
            "outputs": dict(g.recipe_effective(name).outputs),
        }
        for name in g.recipes
    }
    state["margins"] = _compute_margins()

    state["price_bounds"] = {
        item: {"min": bounds[0], "max": bounds[1]}
        for item, bounds in g.price_bounds.items()
    }
    state["price_history"] = list(g.price_history)
    return state


# ── Routes ───────────────────────────────────────────────────────────────────
# Convention: every mutating endpoint returns {"message": str, "state": dict}
# so the client can update the activity log and merge UI state in one round trip.

@app.route("/")
def index() -> Any:
    # Serve the SPA shell; all game data comes from /api/* afterwards.
    return render_template("index.html")


@app.route("/api/state")
def api_state() -> Any:
    # Used on initial page load (and refresh), returning the full snapshot.
    return jsonify(_game_state())


@app.route("/api/buy", methods=["POST"])
def api_buy() -> Any:
    data = request.get_json(force=True)
    # str/int casts guard against the browser sending unexpected JSON types.
    msg = _current_game().buy(str(data["item"]), int(data["qty"]))
    return jsonify({"message": msg, "state": _game_state(compact=True)})


@app.route("/api/sell", methods=["POST"])
def api_sell() -> Any:
    data = request.get_json(force=True)
    msg = _current_game().sell(str(data["item"]), int(data["qty"]))
    return jsonify({"message": msg, "state": _game_state(compact=True)})


@app.route("/api/craft", methods=["POST"])
def api_craft() -> Any:
    data = request.get_json(force=True)
    msg = _current_game().craft_manual(str(data["recipe"]), int(data["qty"]))
    return jsonify({"message": msg, "state": _game_state(compact=True)})


@app.route("/api/hire", methods=["POST"])
def api_hire() -> Any:
    data = request.get_json(force=True)
    msg = _current_game().hire(int(data["qty"]))
    return jsonify({"message": msg, "state": _game_state(compact=True)})


@app.route("/api/fire", methods=["POST"])
def api_fire() -> Any:
    data = request.get_json(force=True)
    msg = _current_game().fire(int(data["qty"]))
    return jsonify({"message": msg, "state": _game_state(compact=True)})


@app.route("/api/assign", methods=["POST"])
def api_assign() -> Any:
    data = request.get_json(force=True)
    msg = _current_game().assign(str(data["recipe"]), int(data["qty"]))
    return jsonify({"message": msg, "state": _game_state(compact=True)})


@app.route("/api/buy_blueprint", methods=["POST"])
def api_buy_blueprint() -> Any:
    data = request.get_json(force=True)
    msg = _current_game().buy_blueprint(str(data["name"]))
    return jsonify({"message": msg, "state": _game_state()})


@app.route("/api/next_day", methods=["POST"])
def api_next_day() -> Any:
    data = request.get_json(force=True) or {}
    # Clamp to at least 1; the client UI also limits the max to 30.
    days = max(1, int(data.get("days", 1)))
    messages: list[str] = []
    game = _current_game()
    for _ in range(days):
        # next_day() advances automation, deducts salaries, and randomises prices.
        messages.append(game.next_day())
    # Join multi-day summaries with newlines so the client log renders them as
    # separate lines without needing to know how many days were advanced.
    return jsonify({"message": "\n".join(messages), "state": _game_state()})


@app.route("/api/advance_time", methods=["POST"])
def api_advance_time() -> Any:
    data = request.get_json(force=True) or {}
    hours = max(1, int(data.get("hours", 1)))
    message = _current_game().advance_time(hours)
    return jsonify({"message": message, "state": _game_state()})


@app.route("/api/save", methods=["POST"])
def api_save() -> Any:
    data = request.get_json(force=True) or {}
    slot = _safe_slot_name(data.get("slot", "default"))
    path = _save_file_path(slot)
    payload = _current_game().to_save_dict()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return jsonify({"message": f"Game saved to slot '{slot}'.", "state": _game_state(compact=True)})


@app.route("/api/load", methods=["POST"])
def api_load() -> Any:
    data = request.get_json(force=True) or {}
    slot = _safe_slot_name(data.get("slot", "default"))
    path = _save_file_path(slot)
    if not path.exists():
        return jsonify({"message": f"No save found for slot '{slot}'.", "state": _game_state()})

    payload = json.loads(path.read_text(encoding="utf-8"))
    loaded_game = FactoryGame.from_save_dict(payload)
    _set_current_game(loaded_game)
    return jsonify({"message": f"Game loaded from slot '{slot}'.", "state": _game_state()})


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
