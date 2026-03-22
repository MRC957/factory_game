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
