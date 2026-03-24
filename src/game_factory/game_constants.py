from __future__ import annotations

from dataclasses import dataclass
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
