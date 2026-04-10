from __future__ import annotations

import pytest

from game_factory.game import FactoryGame


def test_fire_workers_with_fee_and_auto_unassign() -> None:
    game = FactoryGame(seed=7)

    assert game.hire(2).startswith("Hired")
    assert game.assign("gear", 2).startswith("Assigned")

    message = game.fire(1)

    assert message.startswith("Fired 1 worker(s)")
    assert game.total_workers == 1
    assert sum(game.assignments.values()) == 1


def test_fire_workers_fails_when_not_enough_cash_for_fee() -> None:
    game = FactoryGame(seed=7)

    assert game.hire(3).startswith("Hired")
    message = game.fire(2)

    assert message.startswith("Not enough cash to fire workers")
    assert game.total_workers == 3


def test_market_prices_stay_within_configured_bounds() -> None:
    game = FactoryGame(seed=11)

    for _ in range(300):
        game.next_day()

    for item, (min_price, max_price) in game.price_bounds.items():
        assert min_price <= game.market_prices[item] <= max_price


def test_market_price_history_starts_and_grows_each_day() -> None:
    game = FactoryGame(seed=13)

    assert len(game.price_history) == 1
    assert game.price_history[0]["day"] == 1

    game.next_day()
    game.next_day()

    assert len(game.price_history) == 3
    assert [entry["day"] for entry in game.price_history] == [1, 2, 3]
    for entry in game.price_history:
        for item in game.market_prices:
            assert item in entry


def test_buy_at_night_uses_emergency_surcharge() -> None:
    game = FactoryGame(seed=5)
    game.hour = 22
    price = game.market_prices["ore"]
    cash_before = game.cash

    message = game.buy("ore", 1)

    assert "night-market surcharge" in message
    assert game.cash == pytest.approx(cash_before - (price * 1.30))
    assert game.hour == 23


def test_sell_is_blocked_when_market_closed() -> None:
    game = FactoryGame(seed=5)
    game.inventory["ore"] = 3
    game.hour = 21

    message = game.sell("ore", 1)

    assert message.startswith("Market is closed")
    assert game.inventory["ore"] == 3


def test_advance_time_rolls_over_day_and_resets_hour() -> None:
    game = FactoryGame(seed=5)
    game.hour = 20
    game.advance_time(6)

    assert game.day == 2
    assert game.hour == 2


def test_preview_end_of_day_automation_uses_effective_recipes() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    assert game.buy_machine("gear").startswith("Bought Gear Press")
    assert game.buy_blueprint("precision_molds").startswith("Bought blueprint")
    game.inventory["ingot"] = 4
    game.inventory["wood"] = 2
    game.total_workers = 2
    game.assignments["gear"] = 2

    preview = game.preview_end_of_day_automation()

    assert preview["produced"]["gear"] == 4


def test_preview_end_of_day_automation_shows_only_net_outputs() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    assert game.buy_machine("ingot").startswith("Bought Smelter")
    assert game.buy_machine("gear").startswith("Bought Gear Press")
    game.inventory["ore"] = 2
    game.inventory["wood"] = 1
    game.inventory["ingot"] = 1
    game.total_workers = 2
    game.assignments["ingot"] = 1
    game.assignments["gear"] = 1

    preview = game.preview_end_of_day_automation()

    assert preview["produced"] == {"gear": 1}


def test_manual_craft_requires_machine_purchase() -> None:
    game = FactoryGame(seed=5)
    game.inventory["ore"] = 2

    message = game.craft_manual("ingot", 1)

    assert message.startswith("Missing machine")
    assert game.inventory["ingot"] == 0


def test_machine_purchase_enables_manual_craft() -> None:
    game = FactoryGame(seed=5)
    game.cash = 1000.0
    game.inventory["ore"] = 2
    assert game.buy_machine("ingot").startswith("Bought Smelter")

    message = game.craft_manual("ingot", 1)

    assert message.startswith("Crafted 1 batches of ingot")
    assert game.inventory["ingot"] == 1


def test_automation_preview_shows_no_output_without_machine() -> None:
    game = FactoryGame(seed=5)
    game.inventory["ore"] = 4
    game.total_workers = 2
    game.assignments["ingot"] = 2

    preview = game.preview_end_of_day_automation()

    assert preview["produced"] == {}


def test_machine_can_fail_on_rollover_and_be_repaired() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    assert game.buy_machine("ingot").startswith("Bought Smelter")
    game.inventory["ore"] = 4
    game.total_workers = 1
    game.assignments["ingot"] = 1
    game.machines["ingot"]["days_operated"] = 59
    game.rng.random = lambda: 0.0

    rollover_message = game.next_day()

    assert "hard failure" in rollover_message
    assert game.machines["ingot"]["status"] == "hard_failure"

    repair_message = game.service_machine("ingot")

    assert repair_message.startswith("Repaired Smelter")
    assert game.machines["ingot"]["status"] == "operational"


def test_preventive_maintenance_resets_due_counter() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    assert game.buy_machine("gear").startswith("Bought Gear Press")
    assert game.update_machine_settings("gear", "preventive", 5).startswith("Updated Gear Press")
    game.machines["gear"]["days_since_service"] = 5
    game.machines["gear"]["maintenance_due"] = True
    game.hour = 9

    message = game.service_machine("gear")

    assert message.startswith("Performed preventive maintenance on Gear Press")
    assert game.machines["gear"]["days_since_service"] == 0
    assert game.machines["gear"]["maintenance_due"] is False
    assert game.hour == 12


def test_soft_failure_is_serviced_with_standard_maintenance() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    assert game.buy_machine("ingot").startswith("Bought Smelter")
    game.machines["ingot"]["status"] = "soft_failure"

    cash_before = game.cash
    message = game.service_machine("ingot")

    assert message.startswith("Performed preventive maintenance on Smelter")
    assert game.machines["ingot"]["status"] == "operational"
    assert game.cash == pytest.approx(cash_before - 45.0)


def test_cannot_change_machine_settings_when_maintenance_is_due() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    assert game.buy_machine("gear").startswith("Bought Gear Press")
    assert game.update_machine_settings("gear", "preventive", 5).startswith("Updated Gear Press")
    game.machines["gear"]["days_since_service"] = 5
    game.machines["gear"]["maintenance_due"] = True

    message = game.update_machine_settings("gear", "corrective")

    assert message.startswith("Gear Press maintenance is due")
    assert game.machines["gear"]["strategy"] == "preventive"


def test_shorter_preventive_interval_gives_stronger_risk_reduction() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    assert game.buy_machine("gear").startswith("Bought Gear Press")
    game.machines["gear"]["days_operated"] = 20
    game.machines["gear"]["days_since_service"] = 0

    game.update_machine_settings("gear", "preventive", 5)
    short_interval_chance = game._machine_failure_chance("gear")

    game.update_machine_settings("gear", "preventive", 15)
    long_interval_chance = game._machine_failure_chance("gear")

    assert short_interval_chance < long_interval_chance


def test_predictive_strategy_is_unlocked_by_blueprint() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0

    assert "predictive" not in game.available_maintenance_strategies()

    game.buy_blueprint("predictive_maintenance_suite")

    assert "predictive" in game.available_maintenance_strategies()


def test_predictive_due_uses_remaining_life_threshold() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    game.buy_blueprint("predictive_maintenance_suite")
    game.buy_machine("ingot")
    game.update_machine_settings("ingot", "predictive")
    game.machines["ingot"]["predictive_maintenance_day"] = 50
    game.machines["ingot"]["days_operated"] = 50

    game._update_machines_for_day_rollover()

    assert game.machines["ingot"]["maintenance_due"] is True


def test_predictive_alert_is_emitted_when_target_day_reached() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    game.buy_blueprint("predictive_maintenance_suite")
    game.buy_machine("ingot")
    game.update_machine_settings("ingot", "predictive")
    game.machines["ingot"]["predictive_maintenance_day"] = 54
    game.machines["ingot"]["days_operated"] = 53
    game._machines_used_today["ingot"] = True

    lines = game._update_machines_for_day_rollover()

    assert any("predictive alert" in line.lower() for line in lines)


def test_predictive_risk_is_low_before_day_and_high_after_day() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    game.buy_blueprint("predictive_maintenance_suite")
    game.buy_machine("ingot")
    game.update_machine_settings("ingot", "predictive")
    game.machines["ingot"]["predictive_maintenance_day"] = 20

    game.machines["ingot"]["days_operated"] = 19
    before_chance = game._machine_failure_chance("ingot")

    game.machines["ingot"]["days_operated"] = 21
    after_chance = game._machine_failure_chance("ingot")

    assert after_chance > before_chance


def test_warehouse_upgrade_increases_capacity() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    capacity_before = game._warehouse_capacity()

    message = game.upgrade_warehouse()

    assert message.startswith("Warehouse upgraded")
    assert game._warehouse_capacity() > capacity_before


def test_buy_can_overflow_into_waste() -> None:
    game = FactoryGame(seed=5)
    game.cash = 10000.0

    game.buy("ore", 100)

    assert game.waste_inventory["scrap"] > 0
    assert game._warehouse_used() <= game._warehouse_capacity()


def test_contract_accept_and_claim_flow() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    contract = next(c for c in game.contract_offers if c["status"] == "open")
    game.inventory[contract["item"]] = contract["qty"]

    accept_message = game.accept_contract(contract["id"])
    claim_message = game.claim_contract(contract["id"])

    assert accept_message.startswith("Accepted contract")
    assert claim_message.startswith("Claimed contract")
    assert all(active["id"] != contract["id"] for active in game.contract_offers)
    assert game.contract_history[0]["status"] == "claimed"


def test_worker_automation_preview_includes_waste_generation() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    game.buy_machine("gear")
    game.inventory["ingot"] = 8
    game.inventory["wood"] = 4
    game.total_workers = 2
    game.assignments["gear"] = 2

    preview = game.preview_end_of_day_automation()

    assert preview["waste_generated"]["scrap"] == 1


def test_open_contract_expires_and_is_removed_without_penalty() -> None:
    game = FactoryGame(seed=5)
    contract = next(c for c in game.contract_offers if c["status"] == "open")
    contract["deadline_day"] = game.day
    cash_before = game.cash

    lines = game._update_contracts_for_new_day()

    assert any("expired" in line.lower() for line in lines)
    assert all(active["id"] != contract["id"] for active in game.contract_offers)
    assert game.contract_history[0]["status"] == "expired"
    assert game.cash == cash_before


def test_accepted_contract_missed_deadline_pays_penalty() -> None:
    game = FactoryGame(seed=5)
    contract = next(c for c in game.contract_offers if c["status"] == "open")
    game.accept_contract(contract["id"])
    contract["deadline_day"] = game.day
    cash_before = game.cash

    lines = game._update_contracts_for_new_day()

    assert any("penalty" in line.lower() for line in lines)
    assert game.cash == pytest.approx(cash_before - contract["penalty"])
    assert all(active["id"] != contract["id"] for active in game.contract_offers)
    assert game.contract_history[0]["status"] == "failed"


def test_worker_senior_bonus_after_streak() -> None:
    game = FactoryGame(seed=5)
    game.cash = 5000.0
    game.buy_machine("ingot")
    game.inventory["ore"] = 100
    game.total_workers = 2
    game.assignments["ingot"] = 2
    game.worker_recipe_streak_days["ingot"] = 10

    preview = game.preview_end_of_day_automation()

    assert preview["produced"].get("ingot", 0) >= 2


def test_market_event_can_start_and_end() -> None:
    game = FactoryGame(seed=5)
    game.rng.random = lambda: 0.0

    start_lines = game._update_market_event_for_new_day()
    assert game.market_event is not None
    assert any("started" in line for line in start_lines)

    game.market_event["days_left"] = 1
    end_lines = game._update_market_event_for_new_day()
    assert any("ended" in line for line in end_lines)
