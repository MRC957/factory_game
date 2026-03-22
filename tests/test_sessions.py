from __future__ import annotations

import game_factory.web_gui as web_gui


def test_two_clients_have_isolated_game_state() -> None:
    web_gui.app.config["TESTING"] = False
    web_gui._games_by_player.clear()

    with web_gui.app.test_client() as client_a, web_gui.app.test_client() as client_b:
        client_a.post("/api/buy", json={"item": "ore", "qty": 1})

        state_a = client_a.get("/api/state").get_json()
        state_b = client_b.get("/api/state").get_json()

        assert state_a["inventory"]["ore"] == 1
        assert state_b["inventory"]["ore"] == 0

    web_gui.app.config["TESTING"] = True
