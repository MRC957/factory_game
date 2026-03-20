"""Comprehensive API endpoint tests for game_factory.web_gui.

Covers every endpoint: /, /api/state, /api/buy, /api/sell, /api/craft,
/api/hire, /api/fire, /api/assign, /api/buy_blueprint, /api/next_day.
Also verifies _game_state() field completeness.
"""
from __future__ import annotations

from collections.abc import Generator

import pytest

import game_factory.web_gui as web_gui
from game_factory.game import FactoryGame


@pytest.fixture()
def client() -> Generator[object, None, None]:
    web_gui._game = FactoryGame(seed=21)
    web_gui.app.config["TESTING"] = True
    with web_gui.app.test_client() as test_client:
        yield test_client


@pytest.fixture()
def rich_client() -> Generator[object, None, None]:
    """Client pre-loaded with workers, inventory, and a blueprint."""
    g = FactoryGame(seed=7)
    g.cash = 5000.0
    g.hire(3)
    g.inventory["ore"] = 20
    g.inventory["ingot"] = 10
    g.inventory["gear"] = 5
    g.inventory["wood"] = 10
    g.inventory["widget"] = 2
    g.assign("ingot", 2)
    g.buy_blueprint("smelter_optimization")
    web_gui._game = g
    web_gui.app.config["TESTING"] = True
    with web_gui.app.test_client() as test_client:
        yield test_client


# ── Index ────────────────────────────────────────────────────────────────────

class TestIndex:
    def test_returns_200(self, client):
        resp = client.get("/")
        assert resp.status_code == 200

    def test_returns_html(self, client):
        resp = client.get("/")
        assert b"<!DOCTYPE html>" in resp.data or b"<html" in resp.data

    def test_content_type_is_html(self, client):
        resp = client.get("/")
        assert "text/html" in resp.content_type


# ── /api/state ───────────────────────────────────────────────────────────────

class TestApiState:
    def test_returns_200(self, client):
        resp = client.get("/api/state")
        assert resp.status_code == 200

    def test_contains_core_fields(self, client):
        payload = client.get("/api/state").get_json()
        required = [
            "day", "cash", "total_workers", "assigned_workers", "free_workers",
            "worker_hire_cost", "worker_fire_fee", "daily_salary",
            "inventory", "market_prices", "price_bounds", "price_history",
            "price_change", "assignments", "owned_blueprints",
            "blueprints", "effective_recipes", "margins", "bankrupt",
        ]
        for field in required:
            assert field in payload, f"Missing field: {field}"

    def test_day_starts_at_1(self, client):
        payload = client.get("/api/state").get_json()
        assert payload["day"] == 1

    def test_cash_starts_at_500(self, client):
        payload = client.get("/api/state").get_json()
        assert payload["cash"] == pytest.approx(500.0)

    def test_inventory_contains_all_items(self, client):
        payload = client.get("/api/state").get_json()
        for item in ["ore", "wood", "ingot", "gear", "widget", "scrap"]:
            assert item in payload["inventory"]

    def test_price_history_starts_with_day_1(self, client):
        payload = client.get("/api/state").get_json()
        assert payload["price_history"][0]["day"] == 1

    def test_effective_recipes_keys_match_recipes(self, client):
        payload = client.get("/api/state").get_json()
        for recipe in ["ingot", "gear", "widget", "scrap_mix"]:
            assert recipe in payload["effective_recipes"]

    def test_effective_recipes_have_inputs_and_outputs(self, client):
        payload = client.get("/api/state").get_json()
        for recipe_name, recipe in payload["effective_recipes"].items():
            assert "inputs" in recipe, f"No inputs for {recipe_name}"
            assert "outputs" in recipe, f"No outputs for {recipe_name}"

    def test_margins_contain_all_recipes(self, client):
        payload = client.get("/api/state").get_json()
        for recipe in ["ingot", "gear", "widget", "scrap_mix"]:
            assert recipe in payload["margins"]
            for field in ["input_cost", "output_value", "margin"]:
                assert field in payload["margins"][recipe]

    def test_bankrupt_is_false_at_start(self, client):
        payload = client.get("/api/state").get_json()
        assert payload["bankrupt"] is False

    def test_price_bounds_structure(self, client):
        payload = client.get("/api/state").get_json()
        for item, bounds in payload["price_bounds"].items():
            assert "min" in bounds
            assert "max" in bounds
            assert bounds["min"] < bounds["max"]

    def test_blueprints_structure(self, client):
        payload = client.get("/api/state").get_json()
        for name, bp in payload["blueprints"].items():
            assert "cost" in bp
            assert "description" in bp
            assert "owned" in bp


# ── /api/buy ─────────────────────────────────────────────────────────────────

class TestApiBuy:
    def test_success_returns_message_and_state(self, client):
        resp = client.post("/api/buy", json={"item": "ore", "qty": 2})
        assert resp.status_code == 200
        payload = resp.get_json()
        assert "message" in payload
        assert "state" in payload
        assert payload["message"].startswith("Bought")

    def test_success_updates_inventory_in_state(self, client):
        resp = client.post("/api/buy", json={"item": "ore", "qty": 3})
        state = resp.get_json()["state"]
        assert state["inventory"]["ore"] == 3

    def test_success_deducts_cash_in_state(self, client):
        price = client.get("/api/state").get_json()["market_prices"]["ore"]
        resp = client.post("/api/buy", json={"item": "ore", "qty": 2})
        state = resp.get_json()["state"]
        assert state["cash"] == pytest.approx(500.0 - 2 * price)

    def test_insufficient_cash_returns_error_message(self, client):
        resp = client.post("/api/buy", json={"item": "widget", "qty": 100})
        payload = resp.get_json()
        assert "Not enough cash" in payload["message"]

    def test_unknown_item_returns_error(self, client):
        resp = client.post("/api/buy", json={"item": "gold", "qty": 1})
        assert "Unknown item" in resp.get_json()["message"]


# ── /api/sell ────────────────────────────────────────────────────────────────

class TestApiSell:
    def test_success_returns_sold_message(self, rich_client):
        resp = rich_client.post("/api/sell", json={"item": "ore", "qty": 5})
        payload = resp.get_json()
        assert payload["message"].startswith("Sold")

    def test_success_reduces_inventory_in_state(self, rich_client):
        resp = rich_client.post("/api/sell", json={"item": "ore", "qty": 5})
        state = resp.get_json()["state"]
        assert state["inventory"]["ore"] == 15  # started with 20

    def test_insufficient_inventory_returns_error(self, client):
        resp = client.post("/api/sell", json={"item": "ingot", "qty": 1})
        assert "Not enough ingot" in resp.get_json()["message"]

    def test_unknown_item_returns_error(self, client):
        resp = client.post("/api/sell", json={"item": "emerald", "qty": 1})
        assert "Unknown item" in resp.get_json()["message"]


# ── /api/craft ───────────────────────────────────────────────────────────────

class TestApiCraft:
    def test_success_returns_crafted_message(self, rich_client):
        resp = rich_client.post("/api/craft", json={"recipe": "ingot", "qty": 2})
        payload = resp.get_json()
        assert "Crafted" in payload["message"]

    def test_success_updates_inventory(self, rich_client):
        resp = rich_client.post("/api/craft", json={"recipe": "ingot", "qty": 2})
        state = resp.get_json()["state"]
        # rich_client had 20 ore; smelter_optimization blueprint → 1 ore per ingot
        # 2 batches × 1 ore = 2 ore consumed; 2 ingots produced
        assert state["inventory"]["ingot"] == 12  # 10 existing + 2 crafted

    def test_missing_inputs_returns_error(self, client):
        resp = client.post("/api/craft", json={"recipe": "widget", "qty": 1})
        assert "Missing required inputs" in resp.get_json()["message"]

    def test_unknown_recipe_returns_error(self, client):
        resp = client.post("/api/craft", json={"recipe": "magic", "qty": 1})
        assert "Unknown recipe" in resp.get_json()["message"]


# ── /api/hire ────────────────────────────────────────────────────────────────

class TestApiHire:
    def test_success_returns_hired_message(self, client):
        resp = client.post("/api/hire", json={"qty": 1})
        payload = resp.get_json()
        assert payload["message"].startswith("Hired 1")

    def test_success_updates_worker_count(self, client):
        resp = client.post("/api/hire", json={"qty": 2})
        state = resp.get_json()["state"]
        assert state["total_workers"] == 2

    def test_insufficient_cash_returns_error(self, client):
        web_gui._game.cash = 50.0
        resp = client.post("/api/hire", json={"qty": 1})
        assert "Not enough cash" in resp.get_json()["message"]

    def test_daily_salary_updates_in_state(self, client):
        client.post("/api/hire", json={"qty": 3})
        state = client.get("/api/state").get_json()
        assert state["daily_salary"] == pytest.approx(3 * web_gui._game.worker_salary)


# ── /api/fire ────────────────────────────────────────────────────────────────

class TestApiFire:
    def test_success_returns_fired_message(self, rich_client):
        resp = rich_client.post("/api/fire", json={"qty": 1})
        assert resp.get_json()["message"].startswith("Fired 1 worker(s)")

    def test_success_reduces_worker_count(self, rich_client):
        resp = rich_client.post("/api/fire", json={"qty": 1})
        assert resp.get_json()["state"]["total_workers"] == 2

    def test_cannot_fire_more_than_available(self, client):
        resp = client.post("/api/fire", json={"qty": 5})
        assert "Cannot fire" in resp.get_json()["message"]

    def test_insufficient_cash_for_fee_returns_error(self, rich_client):
        web_gui._game.cash = 10.0  # fire fee is 40
        resp = rich_client.post("/api/fire", json={"qty": 1})
        assert "Not enough cash to fire workers" in resp.get_json()["message"]


# ── /api/assign ──────────────────────────────────────────────────────────────

class TestApiAssign:
    def test_success_returns_assigned_message(self, rich_client):
        resp = rich_client.post("/api/assign", json={"recipe": "gear", "qty": 1})
        assert resp.get_json()["message"].startswith("Assigned 1")

    def test_success_updates_assignments_in_state(self, rich_client):
        rich_client.post("/api/assign", json={"recipe": "gear", "qty": 1})
        state = rich_client.get("/api/state").get_json()
        assert state["assignments"]["gear"] == 1

    def test_invalid_recipe_returns_error(self, rich_client):
        resp = rich_client.post("/api/assign", json={"recipe": "forge", "qty": 1})
        assert "Unknown recipe" in resp.get_json()["message"]

    def test_exceeds_workers_returns_error(self, client):
        resp = client.post("/api/assign", json={"recipe": "ingot", "qty": 99})
        assert "Not enough workers" in resp.get_json()["message"]


# ── /api/buy_blueprint ───────────────────────────────────────────────────────

class TestApiBuyBlueprint:
    def test_success_returns_bought_message(self, client):
        web_gui._game.cash = 1000.0
        resp = client.post("/api/buy_blueprint", json={"name": "smelter_optimization"})
        assert resp.get_json()["message"].startswith("Bought blueprint")

    def test_success_reflects_in_state(self, client):
        web_gui._game.cash = 1000.0
        client.post("/api/buy_blueprint", json={"name": "smelter_optimization"})
        state = client.get("/api/state").get_json()
        assert "smelter_optimization" in state["owned_blueprints"]

    def test_already_owned_returns_error(self, rich_client):
        resp = rich_client.post("/api/buy_blueprint", json={"name": "smelter_optimization"})
        assert "already owned" in resp.get_json()["message"]

    def test_unknown_blueprint_returns_error(self, client):
        resp = client.post("/api/buy_blueprint", json={"name": "mystery_box"})
        assert "Unknown blueprint" in resp.get_json()["message"]

    def test_insufficient_cash_returns_error(self, client):
        web_gui._game.cash = 100.0
        resp = client.post("/api/buy_blueprint", json={"name": "smelter_optimization"})
        assert "Not enough cash" in resp.get_json()["message"]

    def test_blueprint_owned_flag_updates_in_state(self, client):
        web_gui._game.cash = 1000.0
        client.post("/api/buy_blueprint", json={"name": "smelter_optimization"})
        state = client.get("/api/state").get_json()
        assert state["blueprints"]["smelter_optimization"]["owned"] is True

    def test_effective_recipe_updates_after_blueprint(self, client):
        """After buying smelter_optimization, ingot recipe should need 1 ore."""
        web_gui._game.cash = 1000.0
        client.post("/api/buy_blueprint", json={"name": "smelter_optimization"})
        state = client.get("/api/state").get_json()
        assert state["effective_recipes"]["ingot"]["inputs"]["ore"] == 1


# ── /api/next_day ────────────────────────────────────────────────────────────

class TestApiNextDay:
    def test_single_day_advances_day_counter(self, client):
        resp = client.post("/api/next_day", json={"days": 1})
        state = resp.get_json()["state"]
        assert state["day"] == 2

    def test_multi_day_advances_correctly(self, client):
        resp = client.post("/api/next_day", json={"days": 5})
        state = resp.get_json()["state"]
        assert state["day"] == 6

    def test_returns_message_and_state(self, client):
        resp = client.post("/api/next_day", json={"days": 1})
        payload = resp.get_json()
        assert "message" in payload
        assert "state" in payload

    def test_salary_deducted_after_next_day(self, rich_client):
        cash_before = web_gui._game.cash
        resp = rich_client.post("/api/next_day", json={"days": 1})
        state = resp.get_json()["state"]
        expected_salary = web_gui._game.worker_salary * 3
        # cash after = cash_before - salary (automation may also change inventory)
        # We just check cash went down by at least the salary
        assert state["cash"] <= cash_before - expected_salary + 0.01  # +0.01 floating point

    def test_price_history_grows_with_days(self, client):
        client.post("/api/next_day", json={"days": 3})
        state = client.get("/api/state").get_json()
        assert len(state["price_history"]) == 4  # day 1 + 3 advances

    def test_message_contains_salary_info(self, client):
        resp = client.post("/api/next_day", json={"days": 1})
        assert "Salaries paid" in resp.get_json()["message"]

    def test_days_defaults_to_1_when_omitted(self, client):
        resp = client.post("/api/next_day", json={})
        state = resp.get_json()["state"]
        assert state["day"] == 2

    def test_automation_crafts_during_next_day(self, rich_client):
        ore_before = web_gui._game.inventory["ore"]
        rich_client.post("/api/next_day", json={"days": 1})
        state = rich_client.get("/api/state").get_json()
        # rich_client assigned 2 workers to ingot; with smelter_optimization blueprint
        # each worker crafts 1 batch using 1 ore → 2 ore consumed, 2 ingots produced
        assert state["inventory"]["ore"] < ore_before

    def test_bankrupt_flag_true_when_cash_very_negative(self, client):
        web_gui._game.cash = -600.0
        resp = client.post("/api/next_day", json={"days": 1})
        state = resp.get_json()["state"]
        assert state["bankrupt"] is True
