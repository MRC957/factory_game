from __future__ import annotations

from math import floor
from typing import Any

from game_factory.game_constants import MANUAL_CRAFT_HOURS, NIGHT_MARKET_SURCHARGE, MachineStatus


class _GameplayContext:
    inventory: dict[str, int]
    market_prices: dict[str, float]
    cash: float
    recipes: dict[str, Any]
    assignments: dict[str, int]
    total_workers: int
    worker_hire_cost: float
    worker_fire_fee: float
    blueprints: dict[str, Any]
    owned_blueprints: set[str]

    def _is_market_open(self) -> bool:
        ...

    def _consume_action_time(self, hours: int) -> str:
        ...

    def _machine_blocker(self, recipe_name: str) -> str | None:
        ...

    def recipe_effective(self, recipe_name: str):
        ...

    def _machine_capacity(self, recipe_name: str, requested_batches: int) -> int:
        ...

    def _mark_machine_used(self, recipe_name: str) -> None:
        ...

    def _machine_state(self, recipe_name: str) -> dict[str, Any]:
        ...

    def _overflow_to_waste(self) -> dict[str, int]:
        ...

    def _recipe_byproduct(self, recipe_name: str, batches: int) -> dict[str, int]:
        ...


class GameplayActionsMixin(_GameplayContext):
    def _max_batches(self, recipe) -> int:
        possible = float("inf")
        for item, qty in recipe.inputs.items():
            if qty <= 0:
                continue
            possible = min(possible, floor(self.inventory[item] / qty))
        return int(possible if possible != float("inf") else 0)

    def _apply_recipe(self, recipe, batches: int) -> int:
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
        overflowed = self._overflow_to_waste()
        overflow_note = ""
        if overflowed:
            overflow_note = "\nWarehouse overflow converted some inventory to waste."
        if is_night_market:
            return (
                f"Bought {qty} {item} for ${total:.2f} (night-market surcharge +{int(NIGHT_MARKET_SURCHARGE * 100)}%)."
                f"{overflow_note}\n{self._consume_action_time(1)}"
            )
        return f"Bought {qty} {item} for ${total:.2f}.{overflow_note}\n{self._consume_action_time(1)}"

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
        byproduct = self._recipe_byproduct(recipe_name, done)
        for item, byproduct_qty in byproduct.items():
            self.inventory[item] = self.inventory.get(item, 0) + byproduct_qty
        overflowed = self._overflow_to_waste()
        self._mark_machine_used(recipe_name)
        per_batch_hours = MANUAL_CRAFT_HOURS.get(recipe_name, 2)
        time_report = self._consume_action_time(per_batch_hours * done)
        machine = self._machine_state(recipe_name)
        suffix = " (soft failure reduced throughput)" if machine["status"] == MachineStatus.SOFT_FAILURE.value else ""
        byproduct_note = ""
        if byproduct:
            byproduct_text = ", ".join(f"+{qty} {item}" for item, qty in byproduct.items())
            byproduct_note = f" {byproduct_text} byproduct"
        overflow_note = ""
        if overflowed:
            overflow_note = " (overflow converted some output to waste)"
        if done < qty:
            return f"Crafted {done}/{qty} batches of {recipe_name} (inputs or machine capacity limited){suffix}{byproduct_note}{overflow_note}.\n{time_report}"
        return f"Crafted {done} batches of {recipe_name}{suffix}{byproduct_note}{overflow_note}.\n{time_report}"

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

    def assign_all(self, new_assignments: dict[str, int]) -> str:
        """Set all worker assignments at once. Unknown recipes are ignored."""
        filtered = {k: v for k, v in new_assignments.items() if k in self.recipes and v >= 0}
        total = sum(filtered.values())
        if total > self.total_workers:
            return (f"Not enough workers. Total requested: {total}, "
                    f"but only {self.total_workers} available.")
        for recipe_name, qty in filtered.items():
            self.assignments[recipe_name] = qty
        parts = ", ".join(f"{r}: {filtered.get(r, self.assignments.get(r, 0))}" for r in self.recipes)
        return f"Assignments updated: {parts}."

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
