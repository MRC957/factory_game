from __future__ import annotations

import ast
import random
from math import floor
import uuid
from typing import Any, Dict

from .game_constants import (
    DEFAULT_PREVENTIVE_INTERVAL,
    HOURS_PER_DAY,
    ITEM_CATALOG,
    MACHINE_CATALOG,
    MACHINE_STATUSES,
    MARKET_CLOSE_HOUR,
    MARKET_OPEN_HOUR,
    PREDICTIVE_MAINTENANCE_BLUEPRINT,
    Blueprint,
    MachineStatus,
    MaintenanceStrategy,
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
        self.waste_inventory: Dict[str, int] = {"scrap": 0}
        self.warehouse_level = 1
        self.warehouse_base_capacity = 80
        self.warehouse_step_capacity = 40

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
        self.market_event: dict[str, Any] | None = None

        self.recipes = dict(RECIPE_CATALOG)
        self.machines: Dict[str, Dict[str, Any]] = {
            recipe_name: {
                "owned": False,
                "status": MachineStatus.MISSING.value,
                "strategy": MaintenanceStrategy.CORRECTIVE.value,
                "preventive_interval": DEFAULT_PREVENTIVE_INTERVAL,
                "predictive_maintenance_day": None,
                "days_operated": 0,
                "days_since_service": 0,
                "maintenance_due": False,
                "maintenance_due_notified": False,
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
            PREDICTIVE_MAINTENANCE_BLUEPRINT: Blueprint(
                PREDICTIVE_MAINTENANCE_BLUEPRINT,
                1250.0,
                "Unlock predictive maintenance strategy with remaining-life based servicing.",
            ),
        }
        self.owned_blueprints: set[str] = set()
        self.worker_recipe_streak_days: Dict[str, int] = {
            recipe_name: 0 for recipe_name in RECIPE_CATALOG
        }
        self.contract_offers: list[dict[str, Any]] = []
        self.contract_history: list[dict[str, Any]] = []
        self._seed_contract_offers(count=3)
        self._record_price_history()

    def _warehouse_capacity(self) -> int:
        return self.warehouse_base_capacity + (self.warehouse_level - 1) * self.warehouse_step_capacity

    def _warehouse_used(self) -> int:
        return sum(max(0, qty) for qty in self.inventory.values())

    def _simulate_overflow(self, inventory: dict[str, int]) -> tuple[dict[str, int], dict[str, int]]:
        adjusted_inventory = dict(inventory)
        overflowed: dict[str, int] = {}
        capacity = self._warehouse_capacity()
        used = sum(max(0, qty) for qty in adjusted_inventory.values())
        if used <= capacity:
            return adjusted_inventory, overflowed

        overflow = used - capacity
        for item in sorted(adjusted_inventory.keys(), key=lambda k: adjusted_inventory[k], reverse=True):
            if overflow <= 0:
                break
            available = max(0, adjusted_inventory[item])
            if available <= 0:
                continue
            cut = min(available, overflow)
            adjusted_inventory[item] -= cut
            overflow -= cut
            overflowed[item] = overflowed.get(item, 0) + cut
        return adjusted_inventory, overflowed

    def _overflow_to_waste(self) -> dict[str, int]:
        adjusted_inventory, overflowed = self._simulate_overflow(self.inventory)
        self.inventory = adjusted_inventory
        total_waste = sum(overflowed.values())
        if total_waste > 0:
            self.waste_inventory["scrap"] = self.waste_inventory.get("scrap", 0) + total_waste
        return overflowed

    def _recipe_byproduct(self, recipe_name: str, batches: int) -> dict[str, int]:
        if recipe_name not in {"gear", "widget"} or batches <= 0:
            return {}
        scrap = batches // 2
        return {"scrap": scrap} if scrap > 0 else {}

    def _new_contract_offer(self) -> dict[str, Any]:
        templates = [
            {
                "key": "local_gear_order",
                "name": "Local Gear Order",
                "item": "gear",
                "tiers": [
                    {"difficulty": "Easy", "qty": 3, "reward": 520.0, "penalty": 70.0, "deadline_days": 3},
                    {"difficulty": "Standard", "qty": 6, "reward": 1160.0, "penalty": 150.0, "deadline_days": 4},
                    {"difficulty": "Hard", "qty": 10, "reward": 2100.0, "penalty": 280.0, "deadline_days": 5},
                ],
            },
            {
                "key": "widget_rush",
                "name": "Widget Rush",
                "item": "widget",
                "tiers": [
                    {"difficulty": "Easy", "qty": 2, "reward": 760.0, "penalty": 120.0, "deadline_days": 4},
                    {"difficulty": "Standard", "qty": 4, "reward": 1680.0, "penalty": 260.0, "deadline_days": 5},
                    {"difficulty": "Hard", "qty": 7, "reward": 3220.0, "penalty": 520.0, "deadline_days": 6},
                ],
            },
            {
                "key": "ingot_supply",
                "name": "Ingot Supply",
                "item": "ingot",
                "tiers": [
                    {"difficulty": "Easy", "qty": 8, "reward": 340.0, "penalty": 45.0, "deadline_days": 3},
                    {"difficulty": "Standard", "qty": 14, "reward": 680.0, "penalty": 95.0, "deadline_days": 4},
                    {"difficulty": "Hard", "qty": 22, "reward": 1180.0, "penalty": 180.0, "deadline_days": 5},
                ],
            },
            {
                "key": "recycler_pickup",
                "name": "Recycler Pickup",
                "item": "scrap",
                "tiers": [
                    {"difficulty": "Easy", "qty": 10, "reward": 140.0, "penalty": 25.0, "deadline_days": 5},
                    {"difficulty": "Standard", "qty": 18, "reward": 290.0, "penalty": 60.0, "deadline_days": 6},
                    {"difficulty": "Hard", "qty": 28, "reward": 500.0, "penalty": 110.0, "deadline_days": 7},
                ],
            },
        ]
        base = self.rng.choice(templates)
        tier_roll = self.rng.random()
        if tier_roll < 0.5:
            tier = base["tiers"][0]
        elif tier_roll < 0.85:
            tier = base["tiers"][1]
        else:
            tier = base["tiers"][2]
        return {
            "id": uuid.uuid4().hex[:8],
            "group_key": base["key"],
            "name": base["name"],
            "item": base["item"],
            "difficulty": tier["difficulty"],
            "qty": int(tier["qty"]),
            "reward": float(tier["reward"]),
            "penalty": float(tier["penalty"]),
            "deadline_day": self.day + int(tier["deadline_days"]),
            "status": "open",
        }

    def _seed_contract_offers(self, count: int) -> None:
        while len([c for c in self.contract_offers if c["status"] == "open"]) < count:
            self.contract_offers.append(self._new_contract_offer())

    def to_save_dict(self) -> dict[str, Any]:
        return {
            "version": 2,
            "day": self.day,
            "hour": self.hour,
            "cash": self.cash,
            "total_workers": self.total_workers,
            "assignments": dict(self.assignments),
            "inventory": dict(self.inventory),
            "waste_inventory": dict(self.waste_inventory),
            "warehouse_level": self.warehouse_level,
            "warehouse_base_capacity": self.warehouse_base_capacity,
            "warehouse_step_capacity": self.warehouse_step_capacity,
            "market_prices": dict(self.market_prices),
            "price_change": dict(self.price_change),
            "price_history": list(self.price_history),
            "market_event": dict(self.market_event) if self.market_event else None,
            "machines": {key: dict(value) for key, value in self.machines.items()},
            "worker_recipe_streak_days": dict(self.worker_recipe_streak_days),
            "contract_offers": [dict(c) for c in self.contract_offers],
            "contract_history": [dict(c) for c in self.contract_history],
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

        saved_waste = payload.get("waste_inventory", {})
        if isinstance(saved_waste, dict):
            g.waste_inventory["scrap"] = int(saved_waste.get("scrap", g.waste_inventory["scrap"]))

        g.warehouse_level = max(1, int(payload.get("warehouse_level", g.warehouse_level)))
        g.warehouse_base_capacity = max(10, int(payload.get("warehouse_base_capacity", g.warehouse_base_capacity)))
        g.warehouse_step_capacity = max(5, int(payload.get("warehouse_step_capacity", g.warehouse_step_capacity)))

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

        saved_event = payload.get("market_event")
        g.market_event = dict(saved_event) if isinstance(saved_event, dict) else None

        saved_blueprints = payload.get("owned_blueprints", [])
        if isinstance(saved_blueprints, list):
            g.owned_blueprints = {
                bp for bp in saved_blueprints if bp in g.blueprints}

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
                if machine["status"] not in MACHINE_STATUSES:
                    machine["status"] = MachineStatus.OPERATIONAL.value if machine["owned"] else MachineStatus.MISSING.value
                machine["strategy"] = str(raw_machine.get(
                    "strategy", machine["strategy"]))
                if machine["strategy"] not in g.available_maintenance_strategies():
                    machine["strategy"] = MaintenanceStrategy.CORRECTIVE.value
                machine["preventive_interval"] = max(
                    3,
                    int(raw_machine.get("preventive_interval",
                        machine["preventive_interval"])),
                )
                raw_predictive_day = raw_machine.get("predictive_maintenance_day", machine["predictive_maintenance_day"])
                machine["predictive_maintenance_day"] = None if raw_predictive_day is None else int(raw_predictive_day)
                machine["days_operated"] = max(
                    0, int(raw_machine.get("days_operated", machine["days_operated"])))
                machine["days_since_service"] = max(0, int(raw_machine.get(
                    "days_since_service", machine["days_since_service"])))
                machine["maintenance_due"] = bool(raw_machine.get(
                    "maintenance_due", machine["maintenance_due"]))
                machine["maintenance_due_notified"] = bool(raw_machine.get(
                    "maintenance_due_notified", machine["maintenance_due_notified"]))
                if not machine["owned"]:
                    machine["status"] = MachineStatus.MISSING.value
                    machine["days_operated"] = 0
                    machine["days_since_service"] = 0
                    machine["predictive_maintenance_day"] = None
                    machine["maintenance_due"] = False
                    machine["maintenance_due_notified"] = False

        saved_streaks = payload.get("worker_recipe_streak_days", {})
        if isinstance(saved_streaks, dict):
            for recipe_name in g.worker_recipe_streak_days:
                g.worker_recipe_streak_days[recipe_name] = max(
                    0, int(saved_streaks.get(recipe_name, g.worker_recipe_streak_days[recipe_name]))
                )

        saved_contracts = payload.get("contract_offers", [])
        if isinstance(saved_contracts, list):
            g.contract_offers = [dict(c) for c in saved_contracts if isinstance(c, dict)]

        saved_contract_history = payload.get("contract_history", [])
        if isinstance(saved_contract_history, list):
            g.contract_history = [dict(c) for c in saved_contract_history if isinstance(c, dict)]
        g._seed_contract_offers(count=3)

        rng_state = payload.get("rng_state")
        if isinstance(rng_state, str):
            try:
                g.rng.setstate(ast.literal_eval(rng_state))
            except Exception:
                pass

        return g

    def available_maintenance_strategies(self) -> tuple[str, ...]:
        strategies = [MaintenanceStrategy.CORRECTIVE.value, MaintenanceStrategy.PREVENTIVE.value]
        if PREDICTIVE_MAINTENANCE_BLUEPRINT in self.owned_blueprints:
            strategies.append(MaintenanceStrategy.PREDICTIVE.value)
        return tuple(strategies)

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

    def senior_bonus_workers(self, recipe_name: str) -> int:
        streak = self.worker_recipe_streak_days.get(recipe_name, 0)
        workers = self.assignments.get(recipe_name, 0)
        if workers <= 0:
            return 0
        return workers if streak >= 10 else 0

    def _format_clock(self) -> str:
        return f"Day {self.day}, {self.hour:02d}:00"

    def _is_market_open(self) -> bool:
        return MARKET_OPEN_HOUR <= self.hour < MARKET_CLOSE_HOUR

    def _automation_tick(self, inventory: dict[str, int]) -> tuple[dict[str, int], dict[str, int], dict[str, int], list[str]]:
        next_inventory = dict(inventory)
        produced: dict[str, int] = {}
        waste_generated: dict[str, int] = {}
        lines: list[str] = []

        for recipe_name, workers in self.assignments.items():
            if workers <= 0:
                continue

            machine = self._machine_state(recipe_name)
            spec = self._machine_spec(recipe_name)
            if not machine["owned"]:
                lines.append(f"Automation {recipe_name}: missing {spec.name}.")
                continue
            if machine["status"] == MachineStatus.HARD_FAILURE.value:
                lines.append(
                    f"Automation {recipe_name}: blocked by {spec.name} hard failure.")
                continue

            senior_bonus = self.senior_bonus_workers(recipe_name)
            effective_workers = self._machine_capacity(recipe_name, workers + senior_bonus)

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

                byproduct = self._recipe_byproduct(recipe_name, craftable)
                for item, qty in byproduct.items():
                    next_inventory[item] = next_inventory.get(item, 0) + qty
                    waste_generated[item] = waste_generated.get(item, 0) + qty
                self._mark_machine_used(recipe_name)

            suffix = " (soft failure)" if machine["status"] == MachineStatus.SOFT_FAILURE.value else ""
            bonus_note = f" (+{senior_bonus} senior bonus)" if senior_bonus > 0 else ""
            lines.append(
                f"Automation {recipe_name}: {craftable}/{workers} batch(es){suffix}{bonus_note}")

        return next_inventory, produced, waste_generated, lines

    def preview_end_of_day_automation(self) -> dict[str, Any]:
        next_inventory, _produced, waste_generated, _ = self._automation_tick(self.inventory)
        preview_inventory, overflowed = self._simulate_overflow(next_inventory)
        produced = {
            item: preview_inventory.get(item, 0) - self.inventory.get(item, 0)
            for item in self.inventory
        }
        return {
            "produced": {item: qty for item, qty in produced.items() if qty > 0},
            "waste_generated": {item: qty for item, qty in waste_generated.items() if qty > 0},
            "overflowed": overflowed,
            "warehouse_used": sum(max(0, qty) for qty in preview_inventory.values()),
            "warehouse_capacity": self._warehouse_capacity(),
        }

    def _run_day_rollover(self) -> list[str]:
        lines: list[str] = []
        self.inventory, _, automation_waste, automation_lines = self._automation_tick(
            self.inventory)
        lines.extend(automation_lines)
        if automation_waste:
            waste_text = ", ".join(f"{qty} {item}" for item, qty in automation_waste.items())
            lines.append(f"Automation waste generated: {waste_text}.")

        # Worker learning: streak grows for recipes with active assignments.
        for recipe_name, workers in self.assignments.items():
            if workers > 0:
                self.worker_recipe_streak_days[recipe_name] += 1
            else:
                self.worker_recipe_streak_days[recipe_name] = 0

        overflowed = self._overflow_to_waste()
        if overflowed:
            overflow_text = ", ".join(f"{qty} {item}" for item, qty in overflowed.items())
            lines.append(f"Warehouse overflow converted to waste: {overflow_text}.")

        lines.extend(self._update_machines_for_day_rollover())

        lines.extend(self._update_contracts_for_new_day())

        event_lines = self._update_market_event_for_new_day()
        lines.extend(event_lines)

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

    def _update_contracts_for_new_day(self) -> list[str]:
        lines: list[str] = []
        next_day = self.day + 1
        active_contracts: list[dict[str, Any]] = []
        for contract in self.contract_offers:
            status = contract.get("status")
            if status not in {"accepted", "completed", "open"}:
                continue

            if status == "open":
                if next_day > int(contract["deadline_day"]):
                    archived = dict(contract)
                    archived["status"] = "expired"
                    archived["resolved_day"] = self.day
                    self.contract_history.insert(0, archived)
                    lines.append(f"Contract expired: {contract['name']} [{contract['difficulty']}].")
                    continue
                active_contracts.append(contract)
                continue

            if status == "accepted" and self.inventory.get(contract["item"], 0) >= int(contract["qty"]):
                contract["status"] = "completed"
                lines.append(f"Contract ready to claim: {contract['name']}.")
                status = "completed"

            if next_day > int(contract["deadline_day"]):
                penalty = float(contract.get("penalty", 0.0))
                self.cash -= penalty
                archived = dict(contract)
                archived["status"] = "failed"
                archived["resolved_day"] = self.day
                self.contract_history.insert(0, archived)
                lines.append(f"Contract failed: {contract['name']} [{contract['difficulty']}] (deadline missed, penalty ${penalty:.2f}).")
                continue
            active_contracts.append(contract)

        self.contract_offers = active_contracts
        self._seed_contract_offers(count=3)
        return lines

    def _update_market_event_for_new_day(self) -> list[str]:
        lines: list[str] = []
        if self.market_event:
            self.market_event["days_left"] = int(self.market_event.get("days_left", 0)) - 1
            if self.market_event["days_left"] <= 0:
                lines.append(f"Market event ended: {self.market_event.get('name', 'Unknown')}")
                self.market_event = None

        if self.market_event is None and self.rng.random() < 0.22:
            choices = [
                {
                    "name": "Ore Shortage",
                    "days_left": self.rng.randint(3, 5),
                    "effects": {"ore": 1.25},
                    "description": "Ore suppliers are constrained. Ore prices trend higher.",
                },
                {
                    "name": "Machinery Boom",
                    "days_left": self.rng.randint(3, 5),
                    "effects": {"gear": 1.20, "widget": 1.20},
                    "description": "Industrial demand spikes for advanced components.",
                },
            ]
            self.market_event = dict(self.rng.choice(choices))
            lines.append(f"Market event started: {self.market_event['name']} — {self.market_event['description']}")
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
            if self.market_event:
                effects = self.market_event.get("effects", {})
                if item in effects:
                    new_price *= float(effects[item])
            new_price = max(min_price, min(max_price, new_price))
            self.market_prices[item] = round(new_price, 2)
            self.price_change[item] = drift

    def upgrade_warehouse(self) -> str:
        upgrade_cost = 300.0 * self.warehouse_level
        if self.cash < upgrade_cost:
            return f"Not enough cash. Need ${upgrade_cost:.2f}, have ${self.cash:.2f}."
        self.cash -= upgrade_cost
        self.warehouse_level += 1
        return (
            f"Warehouse upgraded to level {self.warehouse_level} for ${upgrade_cost:.2f}. "
            f"Capacity is now {self._warehouse_capacity()} units."
        )

    def accept_contract(self, contract_id: str) -> str:
        contract = next((c for c in self.contract_offers if c.get("id") == contract_id), None)
        if not contract:
            return f"Unknown contract '{contract_id}'."
        if contract.get("status") != "open":
            return f"Contract '{contract.get('name', contract_id)}' cannot be accepted."
        contract["status"] = "accepted"
        if self.inventory.get(str(contract["item"]), 0) >= int(contract["qty"]):
            contract["status"] = "completed"
            return (
                f"Accepted contract '{contract['name']}' [{contract['difficulty']}] "
                f"(deliver {contract['qty']} {contract['item']} by day {contract['deadline_day']}). Ready to claim now."
            )
        return (
            f"Accepted contract '{contract['name']}' [{contract['difficulty']}] "
            f"(deliver {contract['qty']} {contract['item']} by day {contract['deadline_day']})."
        )

    def claim_contract(self, contract_id: str) -> str:
        contract_index = next((i for i, c in enumerate(self.contract_offers) if c.get("id") == contract_id), None)
        contract = None if contract_index is None else self.contract_offers[contract_index]
        if not contract:
            return f"Unknown contract '{contract_id}'."
        assert contract_index is not None
        status = contract.get("status")
        if status not in {"accepted", "completed"}:
            return f"Contract '{contract.get('name', contract_id)}' is not ready to claim."

        item = str(contract["item"])
        qty = int(contract["qty"])
        if self.inventory.get(item, 0) < qty:
            return f"Not enough {item} to fulfill contract '{contract['name']}'."

        self.inventory[item] -= qty
        reward = float(contract["reward"])
        self.cash += reward
        archived = dict(contract)
        archived["status"] = "claimed"
        archived["resolved_day"] = self.day
        self.contract_history.insert(0, archived)
        self.contract_offers.pop(contract_index)
        self._seed_contract_offers(count=3)
        return f"Claimed contract '{contract['name']}' [{contract['difficulty']}] for ${reward:.2f}."

    def next_day(self) -> str:
        return self.advance_time(HOURS_PER_DAY)
