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


def test_state_includes_price_bounds_and_history(client) -> None:
    response = client.get("/api/state")

    assert response.status_code == 200
    payload = response.get_json()

    assert "price_bounds" in payload
    assert "price_history" in payload
    assert "worker_fire_fee" in payload
    assert payload["price_history"][0]["day"] == 1


def test_fire_endpoint_reduces_workers_and_returns_updated_state(client) -> None:
    hire_response = client.post("/api/hire", json={"qty": 2})
    assert hire_response.status_code == 200

    fire_response = client.post("/api/fire", json={"qty": 1})

    assert fire_response.status_code == 200
    payload = fire_response.get_json()
    assert payload["message"].startswith("Fired 1 worker(s)")
    assert payload["state"]["total_workers"] == 1


def test_fire_endpoint_returns_error_message_when_cash_too_low(client) -> None:
    hire_response = client.post("/api/hire", json={"qty": 3})
    assert hire_response.status_code == 200

    fire_response = client.post("/api/fire", json={"qty": 2})

    assert fire_response.status_code == 200
    payload = fire_response.get_json()
    assert payload["message"].startswith("Not enough cash to fire workers")
    assert payload["state"]["total_workers"] == 3
