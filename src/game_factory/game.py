from __future__ import annotations

import ast
import random
from math import floor
from typing import Any, Dict

from .game_constants import (
    DEFAULT_PREVENTIVE_INTERVAL,
    HOURS_PER_DAY,
    ITEM_CATALOG,
    MACHINE_CATALOG,
    MACHINE_STRATEGIES,
    MARKET_CLOSE_HOUR,
    MARKET_OPEN_HOUR,
    Blueprint,
    Recipe,
    RECIPE_CATALOG,
)
from .game_machine_mixin import MachineLifecycleMixin
from .game_operations_mixin import GameplayActionsMixin


class FactoryGame(MachineLifecycleMixin, GameplayActionsMixin):
    def __init__(self, seed: int | None = None) -> None:
        self.rng = random.Random(seed)
        self.day = 1
        self.hour = MARKET_OPEN_HOUR
        self.cash = 500.0

        self.worker_hire_cost = 150.0
        self.worker_fire_fee = 40.0
        self.worker_salary = 20.0
        self.total_workers = 0
        self.assignments: Dict[str, int] = {
            recipe_name: 0 for recipe_name in RECIPE_CATALOG}

        self.inventory: Dict[str, int] = {
            item_name: 0 for item_name in ITEM_CATALOG}

        self.market_prices: Dict[str, float] = {
            item_name: float(item["base_price"])
            for item_name, item in ITEM_CATALOG.items()
        }
        self.price_bounds: Dict[str, tuple[float, float]] = {
            item_name: (
                float(item["min_price"]),
                float(item["max_price"]),
            )
            for item_name, item in ITEM_CATALOG.items()
        }
        self.price_change: Dict[str, float] = {
            k: 0.0 for k in self.market_prices}
        self.price_history: list[dict[str, float | int]] = []

        self.recipes = dict(RECIPE_CATALOG)
        self.machines: Dict[str, Dict[str, Any]] = {
            recipe_name: {
                "owned": False,
                "status": "missing",
                "strategy": "corrective",
                "preventive_interval": DEFAULT_PREVENTIVE_INTERVAL,
                "days_operated": 0,
                "days_since_service": 0,
                "maintenance_due": False,
            }
            for recipe_name in MACHINE_CATALOG
        }
        self._machines_used_today: Dict[str, bool] = {
            recipe_name: False for recipe_name in MACHINE_CATALOG
        }

        self.blueprints = {
            "smelter_optimization": Blueprint(
                "smelter_optimization", 450.0, "Ingot recipe consumes 1 less ore (min 1)."
            ),
            "precision_molds": Blueprint(
                "precision_molds", 700.0, "Gear recipe produces +1 gear per batch."
            ),
            "assembly_jigs": Blueprint(
                "assembly_jigs", 1000.0, "Widget recipe consumes 1 less ingot (min 0)."
            ),
        }
        self.owned_blueprints: set[str] = set()
        self._record_price_history()

    def to_save_dict(self) -> dict[str, Any]:
        return {
            "version": 2,
            "day": self.day,
            "hour": self.hour,
            "cash": self.cash,
            "total_workers": self.total_workers,
            "assignments": dict(self.assignments),
            "inventory": dict(self.inventory),
            "market_prices": dict(self.market_prices),
            "price_change": dict(self.price_change),
            "price_history": list(self.price_history),
            "machines": {key: dict(value) for key, value in self.machines.items()},
            "owned_blueprints": sorted(self.owned_blueprints),
            "rng_state": repr(self.rng.getstate()),
        }

    @classmethod
    def from_save_dict(cls, payload: dict[str, Any]) -> FactoryGame:
        g = cls()
        g.day = int(payload.get("day", g.day))
        g.hour = int(payload.get("hour", g.hour)) % HOURS_PER_DAY
        g.cash = float(payload.get("cash", g.cash))
        g.total_workers = int(payload.get("total_workers", g.total_workers))

        saved_assignments = payload.get("assignments", {})
        if isinstance(saved_assignments, dict):
            for key in g.assignments:
                g.assignments[key] = int(
                    saved_assignments.get(key, g.assignments[key]))

        saved_inventory = payload.get("inventory", {})
        if isinstance(saved_inventory, dict):
            for key in g.inventory:
                g.inventory[key] = int(
                    saved_inventory.get(key, g.inventory[key]))

        saved_prices = payload.get("market_prices", {})
        if isinstance(saved_prices, dict):
            for key in g.market_prices:
                g.market_prices[key] = float(
                    saved_prices.get(key, g.market_prices[key]))

        saved_change = payload.get("price_change", {})
        if isinstance(saved_change, dict):
            for key in g.price_change:
                g.price_change[key] = float(
                    saved_change.get(key, g.price_change[key]))

        saved_history = payload.get("price_history", [])
        if isinstance(saved_history, list) and saved_history:
            g.price_history = saved_history
        else:
            g.price_history = []
            g._record_price_history()

        saved_machines = payload.get("machines", {})
        if isinstance(saved_machines, dict):
            for recipe_name, machine in g.machines.items():
                raw_machine = saved_machines.get(recipe_name, {})
                if not isinstance(raw_machine, dict):
                    continue
                machine["owned"] = bool(
                    raw_machine.get("owned", machine["owned"]))
                machine["status"] = str(
                    raw_machine.get("status", machine["status"]))
                if machine["status"] not in {"missing", "operational", "soft_failure", "hard_failure"}:
                    machine["status"] = "operational" if machine["owned"] else "missing"
                machine["strategy"] = str(raw_machine.get(
                    "strategy", machine["strategy"]))
                if machine["strategy"] not in MACHINE_STRATEGIES:
                    machine["strategy"] = "corrective"
                machine["preventive_interval"] = max(
                    3,
                    int(raw_machine.get("preventive_interval",
                        machine["preventive_interval"])),
                )
                machine["days_operated"] = max(
                    0, int(raw_machine.get("days_operated", machine["days_operated"])))
                machine["days_since_service"] = max(0, int(raw_machine.get(
                    "days_since_service", machine["days_since_service"])))
                machine["maintenance_due"] = bool(raw_machine.get(
                    "maintenance_due", machine["maintenance_due"]))
                if not machine["owned"]:
                    machine["status"] = "missing"
                    machine["days_operated"] = 0
                    machine["days_since_service"] = 0
                    machine["maintenance_due"] = False

        saved_blueprints = payload.get("owned_blueprints", [])
        if isinstance(saved_blueprints, list):
            g.owned_blueprints = {
                bp for bp in saved_blueprints if bp in g.blueprints}

        rng_state = payload.get("rng_state")
        if isinstance(rng_state, str):
            try:
                g.rng.setstate(ast.literal_eval(rng_state))
            except Exception:
                pass

        return g

    def _record_price_history(self) -> None:
        snapshot: dict[str, float | int] = {"day": self.day}
        for item, price in self.market_prices.items():
            snapshot[item] = round(price, 2)
        self.price_history.append(snapshot)

    def recipe_effective(self, recipe_name: str) -> Recipe:
        recipe = self.recipes[recipe_name]
        inputs = dict(recipe.inputs)
        outputs = dict(recipe.outputs)

        if recipe_name == "ingot" and "smelter_optimization" in self.owned_blueprints:
            inputs["ore"] = max(1, inputs["ore"] - 1)

        if recipe_name == "gear" and "precision_molds" in self.owned_blueprints:
            outputs["gear"] = outputs.get("gear", 0) + 1

        if recipe_name == "widget" and "assembly_jigs" in self.owned_blueprints:
            inputs["ingot"] = max(0, inputs["ingot"] - 1)

        return Recipe(recipe.name, inputs, outputs)

    def _format_clock(self) -> str:
        return f"Day {self.day}, {self.hour:02d}:00"

    def _is_market_open(self) -> bool:
        return MARKET_OPEN_HOUR <= self.hour < MARKET_CLOSE_HOUR

    def _automation_tick(self, inventory: dict[str, int]) -> tuple[dict[str, int], dict[str, int], list[str]]:
        next_inventory = dict(inventory)
        produced: dict[str, int] = {}
        lines: list[str] = []

        for recipe_name, workers in self.assignments.items():
            if workers <= 0:
                continue

            machine = self._machine_state(recipe_name)
            spec = self._machine_spec(recipe_name)
            if not machine["owned"]:
                lines.append(f"Automation {recipe_name}: missing {spec.name}.")
                continue
            if machine["status"] == "hard_failure":
                lines.append(
                    f"Automation {recipe_name}: blocked by {spec.name} hard failure.")
                continue

            effective_workers = self._machine_capacity(recipe_name, workers)

            recipe = self.recipe_effective(recipe_name)
            craftable = effective_workers
            for item, qty in recipe.inputs.items():
                if qty <= 0:
                    continue
                available = next_inventory.get(item, 0)
                craftable = min(craftable, floor(available / qty))

            if craftable > 0:
                for item, qty in recipe.inputs.items():
                    if qty <= 0:
                        continue
                    next_inventory[item] = next_inventory.get(
                        item, 0) - qty * craftable

                for item, qty in recipe.outputs.items():
                    amount = qty * craftable
                    if amount <= 0:
                        continue
                    next_inventory[item] = next_inventory.get(item, 0) + amount
                    produced[item] = produced.get(item, 0) + amount
                self._mark_machine_used(recipe_name)

            suffix = " (soft failure)" if machine["status"] == "soft_failure" else ""
            lines.append(
                f"Automation {recipe_name}: {craftable}/{workers} batch(es){suffix}")

        return next_inventory, produced, lines

    def preview_end_of_day_automation(self) -> dict[str, dict[str, int]]:
        next_inventory, _, _ = self._automation_tick(self.inventory)
        produced = {
            item: next_inventory.get(item, 0) - self.inventory.get(item, 0)
            for item in self.inventory
        }
        return {
            "produced": {item: qty for item, qty in produced.items() if qty > 0},
        }

    def _run_day_rollover(self) -> list[str]:
        lines: list[str] = []
        self.inventory, _, automation_lines = self._automation_tick(
            self.inventory)
        lines.extend(automation_lines)
        lines.extend(self._update_machines_for_day_rollover())

        salaries = self.total_workers * self.worker_salary
        self.cash -= salaries
        lines.append(f"Salaries paid: ${salaries:.2f}")

        self._update_prices()
        self.day += 1
        self._record_price_history()

        if self.cash < 0:
            lines.append(
                "Warning: negative cash. Sell stock or cut costs quickly.")
        return lines

    def advance_time(self, hours: int) -> str:
        if hours <= 0:
            return "Hours must be > 0."

        remaining = hours
        lines: list[str] = [f"Advanced {hours}h."]
        while remaining > 0:
            until_rollover = HOURS_PER_DAY - self.hour
            step = min(remaining, until_rollover)
            self.hour += step
            remaining -= step

            if self.hour >= HOURS_PER_DAY:
                self.hour = 0
                lines.extend(self._run_day_rollover())

        lines.append(f"Current time: {self._format_clock()}.")
        return "\n".join(lines)

    def _consume_action_time(self, hours: int) -> str:
        return self.advance_time(hours)

    def _update_prices(self) -> None:
        for item, current in list(self.market_prices.items()):
            drift = self.rng.uniform(-0.08, 0.08)
            min_price, max_price = self.price_bounds[item]
            new_price = current * (1.0 + drift)
            new_price = max(min_price, min(max_price, new_price))
            self.market_prices[item] = round(new_price, 2)
            self.price_change[item] = drift

    def next_day(self) -> str:
        return self.advance_time(HOURS_PER_DAY)
