from __future__ import annotations

import ast
from dataclasses import dataclass
from math import floor
import random
from typing import Any, Dict


@dataclass(frozen=True)
class Recipe:
    name: str
    inputs: Dict[str, int]
    outputs: Dict[str, int]


@dataclass(frozen=True)
class Blueprint:
    name: str
    cost: float
    description: str


@dataclass(frozen=True)
class MachineSpec:
    recipe: str
    name: str
    purchase_cost: float
    rated_lifetime_days: int
    preventive_cost: float
    preventive_hours: int
    emergency_repair_cost: float
    emergency_repair_hours: int


ITEM_CATALOG: dict[str, dict[str, float | str]] = {
    "ore": {"icon": "🪨", "base_price": 12.0, "min_price": 6.0, "max_price": 28.0},
    "wood": {"icon": "🪵", "base_price": 9.0, "min_price": 5.0, "max_price": 24.0},
    "ingot": {"icon": "🔩", "base_price": 35.0, "min_price": 18.0, "max_price": 78.0},
    "gear": {"icon": "⚙️", "base_price": 85.0, "min_price": 45.0, "max_price": 170.0},
    "widget": {"icon": "📦", "base_price": 190.0, "min_price": 95.0, "max_price": 380.0},
    "scrap": {"icon": "🗑️", "base_price": 4.0, "min_price": 1.5, "max_price": 12.0},
}
ITEM_IDS: tuple[str, ...] = tuple(ITEM_CATALOG.keys())

RECIPE_CATALOG: dict[str, Recipe] = {
    "ingot": Recipe("ingot", {"ore": 2}, {"ingot": 1}),
    "gear": Recipe("gear", {"ingot": 2, "wood": 1}, {"gear": 1}),
    "widget": Recipe("widget", {"gear": 1, "ingot": 1}, {"widget": 1}),
    "scrap_mix": Recipe("scrap_mix", {"ore": 1, "wood": 1}, {"scrap": 1}),
}
RECIPE_IDS: tuple[str, ...] = tuple(RECIPE_CATALOG.keys())

MACHINE_CATALOG: dict[str, MachineSpec] = {
    "ingot": MachineSpec("ingot", "Smelter", 260.0, 60, 45.0, 3, 135.0, 6),
    "gear": MachineSpec("gear", "Gear Press", 420.0, 60, 70.0, 3, 210.0, 6),
    "widget": MachineSpec("widget", "Assembly Bench", 620.0, 60, 95.0, 4, 285.0, 7),
    "scrap_mix": MachineSpec("scrap_mix", "Recycler", 180.0, 60, 35.0, 2, 105.0, 4),
}
MACHINE_IDS: tuple[str, ...] = tuple(MACHINE_CATALOG.keys())
MACHINE_STRATEGIES: tuple[str, ...] = ("corrective", "preventive")
DEFAULT_PREVENTIVE_INTERVAL = 10

HOURS_PER_DAY = 24
MARKET_OPEN_HOUR = 8
MARKET_CLOSE_HOUR = 18
NIGHT_MARKET_SURCHARGE = 0.30
MANUAL_CRAFT_HOURS: dict[str, int] = {
    "ingot": 1,
    "scrap_mix": 1,
    "gear": 2,
    "widget": 4,
}


class FactoryGame:
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
                machine["owned"] = bool(raw_machine.get("owned", machine["owned"]))
                machine["status"] = str(raw_machine.get("status", machine["status"]))
                if machine["status"] not in {"missing", "operational", "soft_failure", "hard_failure"}:
                    machine["status"] = "operational" if machine["owned"] else "missing"
                machine["strategy"] = str(raw_machine.get("strategy", machine["strategy"]))
                if machine["strategy"] not in MACHINE_STRATEGIES:
                    machine["strategy"] = "corrective"
                machine["preventive_interval"] = max(
                    3,
                    int(raw_machine.get("preventive_interval", machine["preventive_interval"])),
                )
                machine["days_operated"] = max(0, int(raw_machine.get("days_operated", machine["days_operated"])))
                machine["days_since_service"] = max(0, int(raw_machine.get("days_since_service", machine["days_since_service"])))
                machine["maintenance_due"] = bool(raw_machine.get("maintenance_due", machine["maintenance_due"]))
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

    def _machine_spec(self, recipe_name: str) -> MachineSpec:
        return MACHINE_CATALOG[recipe_name]

    def _machine_state(self, recipe_name: str) -> Dict[str, Any]:
        return self.machines[recipe_name]

    def _machine_capacity(self, recipe_name: str, requested_batches: int) -> int:
        machine = self._machine_state(recipe_name)
        if machine["status"] == "hard_failure":
            return 0
        if machine["status"] == "soft_failure":
            return max(1, (requested_batches + 1) // 2)
        return requested_batches

    def _machine_remaining_life(self, recipe_name: str) -> int:
        machine = self._machine_state(recipe_name)
        return max(0, self._machine_spec(recipe_name).rated_lifetime_days - machine["days_operated"])

    def _mark_machine_used(self, recipe_name: str) -> None:
        if recipe_name in self._machines_used_today:
            self._machines_used_today[recipe_name] = True

    def _machine_blocker(self, recipe_name: str) -> str | None:
        machine = self._machine_state(recipe_name)
        spec = self._machine_spec(recipe_name)
        if not machine["owned"]:
            return f"Missing machine: buy the {spec.name} before crafting {recipe_name}."
        if machine["status"] == "hard_failure":
            return f"{spec.name} has a hard failure. Repair it before crafting {recipe_name}."
        return None

    def _machine_failure_zone(self, recipe_name: str) -> str:
        machine = self._machine_state(recipe_name)
        spec = self._machine_spec(recipe_name)
        days = machine["days_operated"]
        # Bathtub reliability curve:
        # - early days (run-in) have elevated risk,
        # - middle life has low/steady risk,
        # - end-of-life has sharply rising risk.
        if days <= 5:
            return "infant"
        if days >= spec.rated_lifetime_days - 10:
            return "wear_out"
        return "useful"

    def _machine_failure_chance(self, recipe_name: str) -> float:
        machine = self._machine_state(recipe_name)
        zone = self._machine_failure_zone(recipe_name)
        # Base daily failure chance by reliability zone.
        if zone == "infant":
            chance = 0.12
        elif zone == "wear_out":
            remaining = max(0, self._machine_remaining_life(recipe_name))
            # Wear-out risk increases as remaining life approaches 0.
            chance = 0.12 + (10 - min(10, remaining)) * 0.02
        else:
            chance = 0.025

        # Preventive strategy reduces risk while maintenance is on schedule,
        # but becomes riskier when running overdue.
        if machine["strategy"] == "preventive":
            if machine["days_since_service"] <= machine["preventive_interval"]:
                chance *= 0.6
            else:
                chance *= 1.4
        return min(0.95, chance)

    def _roll_machine_failure(self, recipe_name: str) -> str | None:
        machine = self._machine_state(recipe_name)
        spec = self._machine_spec(recipe_name)
        if not machine["owned"]:
            return None

        chance = self._machine_failure_chance(recipe_name)
        # No failure today. If preventive maintenance is due, surface a reminder.
        if self.rng.random() >= chance:
            if machine["strategy"] == "preventive" and machine["maintenance_due"]:
                return f"{spec.name} preventive maintenance is due."
            return None

        zone = self._machine_failure_zone(recipe_name)
        # Failure severity rules:
        # - soft failures can escalate to hard failures on a later event,
        # - wear-out (or zero life left) fails hard immediately,
        # - otherwise roll for hard vs soft based on zone-specific bias.
        if machine["status"] == "soft_failure":
            hard_failure = True
        elif zone == "wear_out" or self._machine_remaining_life(recipe_name) == 0:
            hard_failure = True
        else:
            hard_bias = 0.30 if zone == "infant" else 0.18
            hard_failure = self.rng.random() < hard_bias

        machine["status"] = "hard_failure" if hard_failure else "soft_failure"
        machine["maintenance_due"] = True
        failure_kind = "hard failure" if hard_failure else "soft failure"
        return f"{spec.name} suffered a {failure_kind}."

    def _update_machines_for_day_rollover(self) -> list[str]:
        lines: list[str] = []
        for recipe_name, used in self._machines_used_today.items():
            machine = self._machine_state(recipe_name)
            if not machine["owned"]:
                self._machines_used_today[recipe_name] = False
                continue
            # Only machines that were actually used age for this day.
            if used:
                machine["days_operated"] += 1
                machine["days_since_service"] += 1
            machine["maintenance_due"] = (
                machine["strategy"] == "preventive"
                and machine["days_since_service"] >= machine["preventive_interval"]
            )
            # We roll failure checks on used machines once per day rollover.
            if used and machine["status"] != "hard_failure":
                failure_line = self._roll_machine_failure(recipe_name)
                if failure_line:
                    lines.append(failure_line)
            self._machines_used_today[recipe_name] = False
        return lines

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
                lines.append(f"Automation {recipe_name}: blocked by {spec.name} hard failure.")
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
                    next_inventory[item] = next_inventory.get(item, 0) - qty * craftable

                for item, qty in recipe.outputs.items():
                    amount = qty * craftable
                    if amount <= 0:
                        continue
                    next_inventory[item] = next_inventory.get(item, 0) + amount
                    produced[item] = produced.get(item, 0) + amount
                self._mark_machine_used(recipe_name)

            suffix = " (soft failure)" if machine["status"] == "soft_failure" else ""
            lines.append(f"Automation {recipe_name}: {craftable}/{workers} batch(es){suffix}")

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
        self.inventory, _, automation_lines = self._automation_tick(self.inventory)
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

    def _max_batches(self, recipe: Recipe) -> int:
        possible = float("inf")
        for item, qty in recipe.inputs.items():
            if qty <= 0:
                continue
            possible = min(possible, floor(self.inventory[item] / qty))
        return int(possible if possible != float("inf") else 0)

    def _apply_recipe(self, recipe: Recipe, batches: int) -> int:
        if batches <= 0:
            return 0
        can_make = min(batches, self._max_batches(recipe))
        if can_make <= 0:
            return 0

        for item, qty in recipe.inputs.items():
            self.inventory[item] -= qty * can_make

        for item, qty in recipe.outputs.items():
            self.inventory[item] += qty * can_make

        return can_make

    def buy(self, item: str, qty: int) -> str:
        if item not in self.market_prices:
            return f"Unknown item '{item}'."
        if qty <= 0:
            return "Quantity must be > 0."

        base_total = self.market_prices[item] * qty
        is_night_market = not self._is_market_open()
        total = base_total * \
            (1.0 + NIGHT_MARKET_SURCHARGE) if is_night_market else base_total
        if self.cash < total:
            return f"Not enough cash. Need ${total:.2f}, have ${self.cash:.2f}."

        self.cash -= total
        self.inventory[item] += qty
        if is_night_market:
            return (
                f"Bought {qty} {item} for ${total:.2f} (night-market surcharge +{int(NIGHT_MARKET_SURCHARGE * 100)}%)."
                f"\n{self._consume_action_time(1)}"
            )
        return f"Bought {qty} {item} for ${total:.2f}.\n{self._consume_action_time(1)}"

    def sell(self, item: str, qty: int) -> str:
        if item not in self.market_prices:
            return f"Unknown item '{item}'."
        if qty <= 0:
            return "Quantity must be > 0."
        if not self._is_market_open():
            return (
                "Market is closed (08:00–18:00). "
                "Selling is unavailable outside business hours."
            )
        if self.inventory[item] < qty:
            return f"Not enough {item} in inventory."

        total = self.market_prices[item] * qty
        self.inventory[item] -= qty
        self.cash += total
        return f"Sold {qty} {item} for ${total:.2f}.\n{self._consume_action_time(1)}"

    def craft_manual(self, recipe_name: str, qty: int) -> str:
        if recipe_name not in self.recipes:
            return f"Unknown recipe '{recipe_name}'."
        if qty <= 0:
            return "Quantity must be > 0."

        machine_blocker = self._machine_blocker(recipe_name)
        if machine_blocker:
            return machine_blocker

        recipe = self.recipe_effective(recipe_name)
        effective_qty = self._machine_capacity(recipe_name, qty)
        done = self._apply_recipe(recipe, effective_qty)
        if done == 0:
            return "Missing required inputs."
        self._mark_machine_used(recipe_name)
        per_batch_hours = MANUAL_CRAFT_HOURS.get(recipe_name, 2)
        time_report = self._consume_action_time(per_batch_hours * done)
        machine = self._machine_state(recipe_name)
        suffix = " (soft failure reduced throughput)" if machine["status"] == "soft_failure" else ""
        if done < qty:
            return f"Crafted {done}/{qty} batches of {recipe_name} (inputs or machine capacity limited){suffix}.\n{time_report}"
        return f"Crafted {done} batches of {recipe_name}{suffix}.\n{time_report}"

    def hire(self, qty: int) -> str:
        if qty <= 0:
            return "Quantity must be > 0."
        total_cost = qty * self.worker_hire_cost
        if self.cash < total_cost:
            return f"Not enough cash. Need ${total_cost:.2f}, have ${self.cash:.2f}."

        self.cash -= total_cost
        self.total_workers += qty
        return f"Hired {qty} worker(s) for ${total_cost:.2f}.\n{self._consume_action_time(1)}"

    def fire(self, qty: int) -> str:
        if qty <= 0:
            return "Quantity must be > 0."
        if qty > self.total_workers:
            return f"Cannot fire {qty}. Only {self.total_workers} worker(s) available."

        fire_cost = qty * self.worker_fire_fee
        if self.cash < fire_cost:
            return f"Not enough cash to fire workers. Need ${fire_cost:.2f}, have ${self.cash:.2f}."

        to_unassign = max(0, sum(self.assignments.values()) -
                          (self.total_workers - qty))
        if to_unassign > 0:
            for recipe_name in sorted(self.assignments, key=lambda name: self.assignments[name], reverse=True):
                current = self.assignments[recipe_name]
                if current <= 0:
                    continue
                reduction = min(current, to_unassign)
                self.assignments[recipe_name] -= reduction
                to_unassign -= reduction
                if to_unassign == 0:
                    break

        self.total_workers -= qty
        self.cash -= fire_cost
        return f"Fired {qty} worker(s) for ${fire_cost:.2f}.\n{self._consume_action_time(1)}"

    def assign(self, recipe_name: str, qty: int) -> str:
        if recipe_name not in self.recipes:
            return f"Unknown recipe '{recipe_name}'."
        if qty < 0:
            return "Assigned workers must be >= 0."

        others = sum(v for k, v in self.assignments.items()
                     if k != recipe_name)
        if others + qty > self.total_workers:
            free = self.total_workers - others
            return f"Not enough workers. Max assignable to {recipe_name}: {free}."

        self.assignments[recipe_name] = qty
        return f"Assigned {qty} worker(s) to {recipe_name}."

    def buy_machine(self, recipe_name: str) -> str:
        spec = MACHINE_CATALOG.get(recipe_name)
        if not spec:
            return f"Unknown machine recipe '{recipe_name}'."

        machine = self._machine_state(recipe_name)
        if machine["owned"]:
            return f"{spec.name} already purchased."
        if self.cash < spec.purchase_cost:
            return f"Not enough cash. Need ${spec.purchase_cost:.2f}, have ${self.cash:.2f}."

        self.cash -= spec.purchase_cost
        machine.update({
            "owned": True,
            "status": "operational",
            "strategy": "corrective",
            "preventive_interval": DEFAULT_PREVENTIVE_INTERVAL,
            "days_operated": 0,
            "days_since_service": 0,
            "maintenance_due": False,
        })
        return f"Bought {spec.name} for ${spec.purchase_cost:.2f}."

    def update_machine_settings(self, recipe_name: str, strategy: str, preventive_interval: int | None = None) -> str:
        spec = MACHINE_CATALOG.get(recipe_name)
        if not spec:
            return f"Unknown machine recipe '{recipe_name}'."
        if strategy not in MACHINE_STRATEGIES:
            return f"Unknown maintenance strategy '{strategy}'."

        machine = self._machine_state(recipe_name)
        if not machine["owned"]:
            return f"Missing machine: buy the {spec.name} first."

        machine["strategy"] = strategy
        if preventive_interval is not None:
            if preventive_interval < 3 or preventive_interval > 20:
                return "Preventive interval must be between 3 and 20 operating days."
            machine["preventive_interval"] = preventive_interval
        machine["maintenance_due"] = (
            strategy == "preventive"
            and machine["days_since_service"] >= machine["preventive_interval"]
        )
        return (
            f"Updated {spec.name}: strategy={machine['strategy']}, "
            f"interval={machine['preventive_interval']} day(s)."
        )

    def service_machine(self, recipe_name: str) -> str:
        spec = MACHINE_CATALOG.get(recipe_name)
        if not spec:
            return f"Unknown machine recipe '{recipe_name}'."

        machine = self._machine_state(recipe_name)
        if not machine["owned"]:
            return f"Missing machine: buy the {spec.name} first."

        if machine["status"] in {"soft_failure", "hard_failure"}:
            cost = spec.emergency_repair_cost
            hours = spec.emergency_repair_hours
            if self.cash < cost:
                return f"Not enough cash. Need ${cost:.2f}, have ${self.cash:.2f}."
            self.cash -= cost
            machine["status"] = "operational"
            machine["days_since_service"] = 0
            machine["maintenance_due"] = False
            self._machines_used_today[recipe_name] = False
            return f"Repaired {spec.name} for ${cost:.2f}.\n{self._consume_action_time(hours)}"

        cost = spec.preventive_cost
        hours = spec.preventive_hours
        if self.cash < cost:
            return f"Not enough cash. Need ${cost:.2f}, have ${self.cash:.2f}."

        self.cash -= cost
        machine["days_since_service"] = 0
        machine["maintenance_due"] = False
        self._machines_used_today[recipe_name] = False
        return f"Performed preventive maintenance on {spec.name} for ${cost:.2f}.\n{self._consume_action_time(hours)}"

    def buy_blueprint(self, name: str) -> str:
        bp = self.blueprints.get(name)
        if not bp:
            return f"Unknown blueprint '{name}'."
        if name in self.owned_blueprints:
            return f"Blueprint '{name}' already owned."
        if self.cash < bp.cost:
            return f"Not enough cash. Need ${bp.cost:.2f}, have ${self.cash:.2f}."

        self.cash -= bp.cost
        self.owned_blueprints.add(name)
        return f"Bought blueprint '{name}'."

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
