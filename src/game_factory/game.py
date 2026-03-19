from __future__ import annotations

from dataclasses import dataclass
from math import floor
import random
from typing import Dict


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


class FactoryGame:
    def __init__(self, seed: int | None = None) -> None:
        self.rng = random.Random(seed)
        self.day = 1
        self.cash = 500.0

        self.worker_hire_cost = 150.0
        self.worker_salary = 20.0
        self.total_workers = 0
        self.assignments: Dict[str, int] = {"ingot": 0, "gear": 0, "widget": 0, "scrap_mix": 0}

        self.inventory: Dict[str, int] = {
            "ore": 0,
            "wood": 0,
            "ingot": 0,
            "gear": 0,
            "widget": 0,
            "scrap": 0,
        }

        self.market_prices: Dict[str, float] = {
            "ore": 12.0,
            "wood": 9.0,
            "ingot": 35.0,
            "gear": 85.0,
            "widget": 190.0,
            "scrap": 4.0,
        }
        self.price_change: Dict[str, float] = {k: 0.0 for k in self.market_prices}

        self.recipes = {
            "ingot": Recipe("ingot", {"ore": 2}, {"ingot": 1}),
            "gear": Recipe("gear", {"ingot": 2, "wood": 1}, {"gear": 1}),
            "widget": Recipe("widget", {"gear": 1, "ingot": 1}, {"widget": 1}),
            "scrap_mix": Recipe("scrap_mix", {"ore": 1, "wood": 1}, {"scrap": 1}),
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
        total = self.market_prices[item] * qty
        if self.cash < total:
            return f"Not enough cash. Need ${total:.2f}, have ${self.cash:.2f}."

        self.cash -= total
        self.inventory[item] += qty
        return f"Bought {qty} {item} for ${total:.2f}."

    def sell(self, item: str, qty: int) -> str:
        if item not in self.market_prices:
            return f"Unknown item '{item}'."
        if qty <= 0:
            return "Quantity must be > 0."
        if self.inventory[item] < qty:
            return f"Not enough {item} in inventory."

        total = self.market_prices[item] * qty
        self.inventory[item] -= qty
        self.cash += total
        return f"Sold {qty} {item} for ${total:.2f}."

    def craft_manual(self, recipe_name: str, qty: int) -> str:
        if recipe_name not in self.recipes:
            return f"Unknown recipe '{recipe_name}'."
        if qty <= 0:
            return "Quantity must be > 0."

        recipe = self.recipe_effective(recipe_name)
        done = self._apply_recipe(recipe, qty)
        if done == 0:
            return "Missing required inputs."
        if done < qty:
            return f"Crafted {done}/{qty} batches of {recipe_name} (inputs limited)."
        return f"Crafted {done} batches of {recipe_name}."

    def hire(self, qty: int) -> str:
        if qty <= 0:
            return "Quantity must be > 0."
        total_cost = qty * self.worker_hire_cost
        if self.cash < total_cost:
            return f"Not enough cash. Need ${total_cost:.2f}, have ${self.cash:.2f}."

        self.cash -= total_cost
        self.total_workers += qty
        return f"Hired {qty} worker(s) for ${total_cost:.2f}."

    def assign(self, recipe_name: str, qty: int) -> str:
        if recipe_name not in self.recipes:
            return f"Unknown recipe '{recipe_name}'."
        if qty < 0:
            return "Assigned workers must be >= 0."

        others = sum(v for k, v in self.assignments.items() if k != recipe_name)
        if others + qty > self.total_workers:
            free = self.total_workers - others
            return f"Not enough workers. Max assignable to {recipe_name}: {free}."

        self.assignments[recipe_name] = qty
        return f"Assigned {qty} worker(s) to {recipe_name}."

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
            new_price = max(1.0, current * (1.0 + drift))
            self.market_prices[item] = round(new_price, 2)
            self.price_change[item] = drift

    def next_day(self) -> str:
        lines: list[str] = []
        for recipe_name, workers in self.assignments.items():
            if workers <= 0:
                continue
            recipe = self.recipe_effective(recipe_name)
            crafted = self._apply_recipe(recipe, workers)
            lines.append(f"Automation {recipe_name}: {crafted}/{workers} batch(es)")

        salaries = self.total_workers * self.worker_salary
        self.cash -= salaries
        lines.append(f"Salaries paid: ${salaries:.2f}")

        self._update_prices()
        self.day += 1

        if self.cash < 0:
            lines.append("Warning: negative cash. Sell stock or cut costs quickly.")

        return "\n".join(lines)

    def dashboard_status(self) -> str:
        assigned = sum(self.assignments.values())
        free = self.total_workers - assigned
        inv = ", ".join(f"{k}:{v}" for k, v in self.inventory.items())
        bps = ", ".join(sorted(self.owned_blueprints)) or "none"
        return (
            f"Day {self.day}\n"
            f"Cash: ${self.cash:.2f}\n"
            f"Workers: {self.total_workers} (assigned: {assigned}, free: {free})\n"
            f"Daily salary burn: ${self.total_workers * self.worker_salary:.2f}\n"
            f"Inventory: {inv}\n"
            f"Owned blueprints: {bps}"
        )

    def dashboard_market(self) -> str:
        lines = ["Market prices:"]
        for item in sorted(self.market_prices.keys()):
            arrow = "↑" if self.price_change[item] > 0 else "↓" if self.price_change[item] < 0 else "→"
            pct = self.price_change[item] * 100
            lines.append(f"- {item:>6}: ${self.market_prices[item]:>7.2f} ({arrow} {pct:+.1f}%)")
        return "\n".join(lines)

    def dashboard_margins(self) -> str:
        lines = ["Estimated recipe margins (using current market):"]
        for recipe_name in self.recipes:
            recipe = self.recipe_effective(recipe_name)
            input_cost = sum(self.market_prices[item] * qty for item, qty in recipe.inputs.items())
            output_value = sum(self.market_prices[item] * qty for item, qty in recipe.outputs.items())
            margin = output_value - input_cost
            verdict = "profitable" if margin > 0 else "risky" if margin == 0 else "unprofitable"
            lines.append(
                f"- {recipe_name:>9}: in=${input_cost:>7.2f} out=${output_value:>7.2f} margin=${margin:>7.2f} ({verdict})"
            )
        return "\n".join(lines)

    def help_text(self) -> str:
        return (
            "Commands:\n"
            "  help\n"
            "  status\n"
            "  market\n"
            "  margins\n"
            "  buy <item> <qty>\n"
            "  sell <item> <qty>\n"
            "  craft <recipe> <qty>\n"
            "  hire <qty>\n"
            "  assign <recipe> <workers>\n"
            "  blueprints\n"
            "  blueprint buy <name>\n"
            "  next [days]\n"
            "  quit\n"
        )

    def blueprint_text(self) -> str:
        lines = ["Blueprint shop:"]
        for name, bp in self.blueprints.items():
            owned = "(owned)" if name in self.owned_blueprints else ""
            lines.append(f"- {name}: ${bp.cost:.2f} - {bp.description} {owned}".rstrip())
        return "\n".join(lines)


def run_cli() -> None:
    game = FactoryGame()
    print("Factory Game MVP")
    print("Type 'help' for commands.")

    while True:
        try:
            raw = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            return

        if not raw:
            continue

        parts = raw.split()
        cmd = parts[0].lower()

        if cmd in {"quit", "exit"}:
            print("Thanks for playing.")
            return

        if cmd == "help":
            print(game.help_text())
        elif cmd == "status":
            print(game.dashboard_status())
        elif cmd == "market":
            print(game.dashboard_market())
        elif cmd == "margins":
            print(game.dashboard_margins())
        elif cmd == "buy" and len(parts) == 3:
            print(game.buy(parts[1], int(parts[2])))
        elif cmd == "sell" and len(parts) == 3:
            print(game.sell(parts[1], int(parts[2])))
        elif cmd == "craft" and len(parts) == 3:
            print(game.craft_manual(parts[1], int(parts[2])))
        elif cmd == "hire" and len(parts) == 2:
            print(game.hire(int(parts[1])))
        elif cmd == "assign" and len(parts) == 3:
            print(game.assign(parts[1], int(parts[2])))
        elif cmd == "blueprints":
            print(game.blueprint_text())
        elif cmd == "blueprint" and len(parts) == 3 and parts[1] == "buy":
            print(game.buy_blueprint(parts[2]))
        elif cmd == "next":
            days = int(parts[1]) if len(parts) == 2 else 1
            if days <= 0:
                print("Days must be > 0.")
                continue
            for _ in range(days):
                print(game.next_day())
        else:
            print("Unknown or malformed command. Type 'help'.")
