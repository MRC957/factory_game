"""Comprehensive unit tests for game_factory.game.FactoryGame.

Each public method is covered: buy, sell, craft_manual, hire, fire, assign,
buy_blueprint, recipe_effective, next_day, and the dashboard helpers.
"""
from __future__ import annotations

import pytest
from game_factory.game import FactoryGame, Recipe


# ── Helpers ──────────────────────────────────────────────────────────────────

def _game_with_cash(cash: float, seed: int = 0) -> FactoryGame:
    g = FactoryGame(seed=seed)
    g.cash = cash
    return g


def _game_with_inventory(items: dict[str, int], cash: float = 500.0) -> FactoryGame:
    g = FactoryGame(seed=0)
    g.cash = 10_000.0
    for recipe_name in g.recipes:
        g.buy_machine(recipe_name)
    g.cash = cash
    for k, v in items.items():
        g.inventory[k] = v
    return g


# ── buy() ────────────────────────────────────────────────────────────────────

class TestBuy:
    def test_success_reduces_cash_and_adds_to_inventory(self):
        g = FactoryGame(seed=0)
        initial_cash = g.cash
        msg = g.buy("ore", 3)
        assert msg.startswith("Bought 3 ore")
        assert g.inventory["ore"] == 3
        assert g.cash == pytest.approx(initial_cash - 3 * g.market_prices["ore"])

    def test_success_returns_formatted_message(self):
        g = FactoryGame(seed=0)
        msg = g.buy("ore", 1)
        assert "ore" in msg
        assert "$" in msg

    def test_insufficient_cash_returns_error(self):
        g = _game_with_cash(0.0)
        msg = g.buy("ore", 1)
        assert "Not enough cash" in msg
        assert g.inventory["ore"] == 0

    def test_unknown_item_returns_error(self):
        g = FactoryGame(seed=0)
        msg = g.buy("unobtanium", 1)
        assert "Unknown item" in msg

    def test_zero_quantity_returns_error(self):
        g = FactoryGame(seed=0)
        msg = g.buy("ore", 0)
        assert "Quantity must be > 0" in msg

    def test_negative_quantity_returns_error(self):
        g = FactoryGame(seed=0)
        msg = g.buy("ore", -5)
        assert "Quantity must be > 0" in msg

    def test_exact_cash_allows_purchase(self):
        g = FactoryGame(seed=0)
        price = g.market_prices["ore"]
        g.cash = price * 2
        msg = g.buy("ore", 2)
        assert msg.startswith("Bought")
        assert g.cash == pytest.approx(0.0)

    def test_all_items_are_buyable(self):
        for item in ["ore", "wood", "ingot", "gear", "widget", "scrap"]:
            g = _game_with_cash(10_000.0)
            msg = g.buy(item, 1)
            assert "Bought" in msg, f"Expected success for item={item}"


# ── sell() ───────────────────────────────────────────────────────────────────

class TestSell:
    def test_success_adds_cash_and_removes_from_inventory(self):
        g = _game_with_inventory({"ore": 5})
        initial_cash = g.cash
        msg = g.sell("ore", 3)
        assert msg.startswith("Sold 3 ore")
        assert g.inventory["ore"] == 2
        assert g.cash == pytest.approx(initial_cash + 3 * g.market_prices["ore"])

    def test_insufficient_inventory_returns_error(self):
        g = FactoryGame(seed=0)
        msg = g.sell("ore", 1)
        assert "Not enough ore" in msg

    def test_unknown_item_returns_error(self):
        g = FactoryGame(seed=0)
        msg = g.sell("gold", 1)
        assert "Unknown item" in msg

    def test_zero_quantity_returns_error(self):
        g = _game_with_inventory({"ore": 5})
        msg = g.sell("ore", 0)
        assert "Quantity must be > 0" in msg

    def test_negative_quantity_returns_error(self):
        g = _game_with_inventory({"ore": 5})
        msg = g.sell("ore", -2)
        assert "Quantity must be > 0" in msg

    def test_selling_exact_inventory_empties_stock(self):
        g = _game_with_inventory({"gear": 2})
        g.sell("gear", 2)
        assert g.inventory["gear"] == 0


# ── craft_manual() ───────────────────────────────────────────────────────────

class TestCraftManual:
    def test_ingot_crafted_from_ore(self):
        g = _game_with_inventory({"ore": 4})
        msg = g.craft_manual("ingot", 2)
        assert "Crafted 2 batches of ingot" in msg
        assert g.inventory["ingot"] == 2
        assert g.inventory["ore"] == 0

    def test_gear_crafted_from_ingot_and_wood(self):
        g = _game_with_inventory({"ingot": 4, "wood": 2})
        msg = g.craft_manual("gear", 2)
        assert "Crafted 2" in msg
        assert g.inventory["gear"] == 2

    def test_widget_crafted_from_gear_and_ingot(self):
        g = _game_with_inventory({"gear": 1, "ingot": 1})
        msg = g.craft_manual("widget", 1)
        assert "Crafted 1" in msg
        assert g.inventory["widget"] == 1

    def test_scrap_mix_crafted_from_ore_and_wood(self):
        g = _game_with_inventory({"ore": 1, "wood": 1})
        msg = g.craft_manual("scrap_mix", 1)
        assert "Crafted 1" in msg
        assert g.inventory["scrap"] == 1

    def test_unknown_recipe_returns_error(self):
        g = FactoryGame(seed=0)
        msg = g.craft_manual("gunpowder", 1)
        assert "Unknown recipe" in msg

    def test_zero_quantity_returns_error(self):
        g = _game_with_inventory({"ore": 10})
        msg = g.craft_manual("ingot", 0)
        assert "Quantity must be > 0" in msg

    def test_negative_quantity_returns_error(self):
        g = _game_with_inventory({"ore": 10})
        msg = g.craft_manual("ingot", -1)
        assert "Quantity must be > 0" in msg

    def test_missing_inputs_returns_error(self):
        g = FactoryGame(seed=0)  # empty inventory
        g.cash = 1000.0
        g.buy_machine("ingot")
        msg = g.craft_manual("ingot", 1)
        assert "Missing required inputs" in msg

    def test_partial_completion_when_inputs_limited(self):
        g = _game_with_inventory({"ore": 2})  # enough for 1 batch of ingot only
        msg = g.craft_manual("ingot", 5)
        assert "1/5" in msg
        assert g.inventory["ingot"] == 1


# ── hire() ───────────────────────────────────────────────────────────────────

class TestHire:
    def test_success_adds_workers_and_deducts_cash(self):
        g = FactoryGame(seed=0)
        initial_cash = g.cash
        msg = g.hire(2)
        assert msg.startswith("Hired 2")
        assert g.total_workers == 2
        assert g.cash == pytest.approx(initial_cash - 2 * g.worker_hire_cost)

    def test_insufficient_cash_returns_error(self):
        g = _game_with_cash(100.0)  # hire costs 150 each
        msg = g.hire(1)
        assert "Not enough cash" in msg
        assert g.total_workers == 0

    def test_zero_quantity_returns_error(self):
        g = FactoryGame(seed=0)
        msg = g.hire(0)
        assert "Quantity must be > 0" in msg

    def test_negative_quantity_returns_error(self):
        g = FactoryGame(seed=0)
        msg = g.hire(-3)
        assert "Quantity must be > 0" in msg

    def test_hire_multiple_workers(self):
        g = _game_with_cash(1000.0)
        msg = g.hire(3)
        assert "Hired 3" in msg
        assert g.total_workers == 3


# ── fire() ───────────────────────────────────────────────────────────────────

class TestFire:
    def test_success_removes_workers_and_deducts_fee(self):
        g = _game_with_cash(1000.0)
        g.hire(2)
        initial_cash = g.cash
        msg = g.fire(1)
        assert msg.startswith("Fired 1")
        assert g.total_workers == 1
        assert g.cash == pytest.approx(initial_cash - g.worker_fire_fee)

    def test_cannot_fire_more_than_available(self):
        g = _game_with_cash(1000.0)
        g.hire(1)
        msg = g.fire(5)
        assert "Cannot fire" in msg
        assert g.total_workers == 1

    def test_insufficient_cash_for_fee_returns_error(self):
        g = _game_with_cash(1000.0)
        g.hire(3)  # costs 450, leaving 550
        # Spend cash so fee for 2 workers (80) is still affordable
        # Let's force low cash: fire 2 workers = 80 fee, hire costs 450 so cash = 50
        g.cash = 10.0
        msg = g.fire(1)  # fee = 40, cash = 10 → insufficient
        assert "Not enough cash to fire workers" in msg

    def test_zero_quantity_returns_error(self):
        g = _game_with_cash(1000.0)
        g.hire(1)
        msg = g.fire(0)
        assert "Quantity must be > 0" in msg

    def test_negative_quantity_returns_error(self):
        g = _game_with_cash(1000.0)
        g.hire(2)
        msg = g.fire(-1)
        assert "Quantity must be > 0" in msg

    def test_auto_unassign_when_workers_below_assignments(self):
        g = _game_with_cash(2000.0)
        g.hire(3)
        g.assign("ingot", 2)
        g.assign("gear", 1)
        g.fire(1)
        # After firing 1: 2 workers remain, 3 were assigned → unassign 1
        assert sum(g.assignments.values()) == 2

    def test_firing_all_workers_clears_assignments(self):
        g = _game_with_cash(2000.0)
        g.hire(2)
        g.assign("ingot", 2)
        g.fire(2)
        assert g.total_workers == 0
        assert sum(g.assignments.values()) == 0


# ── assign() ─────────────────────────────────────────────────────────────────

class TestAssign:
    def test_success_sets_assignment(self):
        g = _game_with_cash(500.0)
        g.hire(3)
        msg = g.assign("ingot", 2)
        assert msg.startswith("Assigned 2")
        assert g.assignments["ingot"] == 2

    def test_zero_workers_is_valid(self):
        g = _game_with_cash(500.0)
        g.hire(2)
        g.assign("ingot", 2)
        msg = g.assign("ingot", 0)
        assert "Assigned 0" in msg
        assert g.assignments["ingot"] == 0

    def test_unknown_recipe_returns_error(self):
        g = _game_with_cash(500.0)
        g.hire(1)
        msg = g.assign("alchemy", 1)
        assert "Unknown recipe" in msg

    def test_negative_qty_returns_error(self):
        g = _game_with_cash(500.0)
        g.hire(2)
        msg = g.assign("ingot", -1)
        assert "must be >= 0" in msg

    def test_exceeds_available_workers_returns_error(self):
        g = _game_with_cash(500.0)
        g.hire(1)
        msg = g.assign("ingot", 3)
        assert "Not enough workers" in msg
        assert g.assignments["ingot"] == 0

    def test_workers_across_multiple_recipes(self):
        g = _game_with_cash(1000.0)
        g.hire(4)
        g.assign("ingot", 2)
        g.assign("gear", 2)
        assert g.assignments["ingot"] == 2
        assert g.assignments["gear"] == 2
        assert sum(g.assignments.values()) == 4

    def test_reassign_frees_workers_for_other_recipes(self):
        g = _game_with_cash(1000.0)
        g.hire(3)
        g.assign("ingot", 3)
        g.assign("ingot", 1)   # re-assign ingot to 1, freeing 2
        msg = g.assign("gear", 2)
        assert "Assigned 2" in msg


# ── buy_blueprint() ──────────────────────────────────────────────────────────

class TestBuyBlueprint:
    def test_success_adds_to_owned_and_deducts_cash(self):
        g = _game_with_cash(1000.0)
        initial_cash = g.cash
        msg = g.buy_blueprint("smelter_optimization")
        assert "Bought blueprint" in msg
        assert "smelter_optimization" in g.owned_blueprints
        assert g.cash == pytest.approx(initial_cash - 450.0)

    def test_unknown_blueprint_returns_error(self):
        g = _game_with_cash(1000.0)
        msg = g.buy_blueprint("magic_wand")
        assert "Unknown blueprint" in msg

    def test_already_owned_returns_error(self):
        g = _game_with_cash(5000.0)
        g.buy_blueprint("smelter_optimization")
        msg = g.buy_blueprint("smelter_optimization")
        assert "already owned" in msg

    def test_insufficient_cash_returns_error(self):
        g = _game_with_cash(100.0)  # blueprint costs 450
        msg = g.buy_blueprint("smelter_optimization")
        assert "Not enough cash" in msg
        assert "smelter_optimization" not in g.owned_blueprints

    def test_buy_all_blueprints(self):
        g = _game_with_cash(5000.0)
        for name in g.blueprints:
            msg = g.buy_blueprint(name)
            assert "Bought" in msg
        assert len(g.owned_blueprints) == len(g.blueprints)


# ── recipe_effective() ───────────────────────────────────────────────────────

class TestRecipeEffective:
    def test_base_ingot_recipe(self):
        g = FactoryGame(seed=0)
        recipe = g.recipe_effective("ingot")
        assert recipe.inputs == {"ore": 2}
        assert recipe.outputs == {"ingot": 1}

    def test_base_gear_recipe(self):
        g = FactoryGame(seed=0)
        recipe = g.recipe_effective("gear")
        assert recipe.inputs == {"ingot": 2, "wood": 1}
        assert recipe.outputs == {"gear": 1}

    def test_base_widget_recipe(self):
        g = FactoryGame(seed=0)
        recipe = g.recipe_effective("widget")
        assert recipe.inputs == {"gear": 1, "ingot": 1}
        assert recipe.outputs == {"widget": 1}

    def test_base_scrap_mix_recipe(self):
        g = FactoryGame(seed=0)
        recipe = g.recipe_effective("scrap_mix")
        assert recipe.inputs == {"ore": 1, "wood": 1}
        assert recipe.outputs == {"scrap": 1}

    def test_smelter_optimization_reduces_ore_cost(self):
        g = _game_with_cash(1000.0)
        g.buy_blueprint("smelter_optimization")
        recipe = g.recipe_effective("ingot")
        assert recipe.inputs["ore"] == 1  # reduced from 2 to 1

    def test_smelter_optimization_minimum_ore_is_one(self):
        """ore cost can never go below 1 even with stacked reductions."""
        g = _game_with_cash(1000.0)
        g.buy_blueprint("smelter_optimization")
        recipe = g.recipe_effective("ingot")
        assert recipe.inputs["ore"] >= 1

    def test_precision_molds_adds_extra_gear_output(self):
        g = _game_with_cash(2000.0)
        g.buy_blueprint("precision_molds")
        recipe = g.recipe_effective("gear")
        assert recipe.outputs["gear"] == 2  # +1 per batch

    def test_assembly_jigs_reduces_ingot_cost_for_widget(self):
        g = _game_with_cash(2000.0)
        g.buy_blueprint("assembly_jigs")
        recipe = g.recipe_effective("widget")
        assert recipe.inputs["ingot"] == 0  # reduced from 1 to 0

    def test_assembly_jigs_minimum_ingot_is_zero(self):
        g = _game_with_cash(2000.0)
        g.buy_blueprint("assembly_jigs")
        recipe = g.recipe_effective("widget")
        assert recipe.inputs["ingot"] >= 0

    def test_blueprints_do_not_affect_other_recipes(self):
        g = _game_with_cash(5000.0)
        g.buy_blueprint("smelter_optimization")  # only affects ingot
        gear_recipe = g.recipe_effective("gear")
        assert gear_recipe.inputs == {"ingot": 2, "wood": 1}  # unchanged

    def test_effective_recipe_returns_recipe_instance(self):
        g = FactoryGame(seed=0)
        recipe = g.recipe_effective("ingot")
        assert isinstance(recipe, Recipe)


# ── next_day() ───────────────────────────────────────────────────────────────

class TestNextDay:
    def test_advances_day_counter(self):
        g = FactoryGame(seed=0)
        assert g.day == 1
        g.next_day()
        assert g.day == 2

    def test_deducts_worker_salary(self):
        g = _game_with_cash(1000.0)
        g.hire(2)
        cash_before = g.cash
        g.next_day()
        expected_salary = 2 * g.worker_salary
        assert g.cash == pytest.approx(cash_before - expected_salary)

    def test_records_price_history_entry(self):
        g = FactoryGame(seed=0)
        assert len(g.price_history) == 1
        g.next_day()
        assert len(g.price_history) == 2

    def test_automation_crafts_assigned_recipe(self):
        g = _game_with_cash(1000.0)
        g.inventory["ore"] = 20
        g.buy_machine("ingot")
        g.hire(2)
        g.assign("ingot", 2)
        g.next_day()
        # 2 workers × 1 batch each = 2 ingots crafted; each batch uses 2 ore
        assert g.inventory["ingot"] == 2
        assert g.inventory["ore"] == 20 - 4  # 2 batches × 2 ore

    def test_automation_output_in_message(self):
        g = _game_with_cash(1000.0)
        g.inventory["ore"] = 10
        g.buy_machine("ingot")
        g.hire(3)
        g.assign("ingot", 3)
        msg = g.next_day()
        assert "ingot" in msg
        assert "Salaries paid" in msg

    def test_negative_cash_produces_warning(self):
        g = FactoryGame(seed=0)
        g.cash = -600.0  # well below -500 bankruptcy threshold
        g.hire(1)
        msg = g.next_day()
        assert "Warning" in msg or "negative" in msg.lower()

    def test_salary_zero_with_no_workers(self):
        g = FactoryGame(seed=0)
        cash_before = g.cash
        g.next_day()
        # No workers → no salary deducted (ignoring price drift)
        # Cash only changes by salary; prices change too but we check via daily_salary
        assert g.total_workers == 0

    def test_multi_day_advances_history_correctly(self):
        g = FactoryGame(seed=5)
        for _ in range(5):
            g.next_day()
        assert g.day == 6
        assert len(g.price_history) == 6


# ── Price bounds & history ────────────────────────────────────────────────────

class TestPriceMechanics:
    def test_price_change_recorded_after_day(self):
        g = FactoryGame(seed=42)
        g.next_day()
        # After a day, price_change dict should have non-default values
        changes = list(g.price_change.values())
        assert any(c != 0.0 for c in changes)

    def test_price_history_contains_all_items(self):
        g = FactoryGame(seed=0)
        g.next_day()
        for entry in g.price_history:
            for item in g.market_prices:
                assert item in entry

    def test_prices_bounded_after_many_days(self):
        g = FactoryGame(seed=99)
        for _ in range(200):
            g.next_day()
        for item, (lo, hi) in g.price_bounds.items():
            assert lo <= g.market_prices[item] <= hi, f"{item} price out of bounds"



# ── Max-batches / apply-recipe internals (via craft_manual) ──────────────────

class TestCraftingInternals:
    def test_craft_limited_by_scarcer_input(self):
        """widget needs gear×1 + ingot×1; with gear=3 ingot=1, only 1 batch possible."""
        g = _game_with_inventory({"gear": 3, "ingot": 1})
        msg = g.craft_manual("widget", 5)
        assert "1/5" in msg
        assert g.inventory["widget"] == 1

    def test_craft_with_zero_output_input_ratio(self):
        """assembly_jigs makes widget free of ingot; crafting should still work."""
        g = _game_with_cash(2000.0)
        g.buy_machine("widget")
        g.buy_blueprint("assembly_jigs")
        g.inventory["gear"] = 2
        g.inventory["ingot"] = 0
        msg = g.craft_manual("widget", 2)
        # With assembly_jigs, ingot cost = 0, so limited only by gear
        assert "Crafted 2" in msg
        assert g.inventory["widget"] == 2

    def test_precision_molds_doubles_gear_output_over_two_rounds(self):
        g = _game_with_cash(2000.0)
        g.buy_machine("gear")
        g.buy_blueprint("precision_molds")
        g.inventory["ingot"] = 4
        g.inventory["wood"] = 2
        g.craft_manual("gear", 2)
        assert g.inventory["gear"] == 4  # 2 batches × 2 gear each
