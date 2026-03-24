from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict


class ItemName(str, Enum):
    ORE = "ore"
    WOOD = "wood"
    INGOT = "ingot"
    GEAR = "gear"
    WIDGET = "widget"
    SCRAP = "scrap"


class RecipeName(str, Enum):
    INGOT = "ingot"
    GEAR = "gear"
    WIDGET = "widget"
    SCRAP_MIX = "scrap_mix"


class MachineStatus(str, Enum):
    MISSING = "missing"
    OPERATIONAL = "operational"
    SOFT_FAILURE = "soft_failure"
    HARD_FAILURE = "hard_failure"


class MachineFailureZone(str, Enum):
    INFANT = "infant"
    USEFUL = "useful"
    WEAR_OUT = "wear_out"


class MaintenanceStrategy(str, Enum):
    CORRECTIVE = "corrective"
    PREVENTIVE = "preventive"


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
    ItemName.ORE.value: {"icon": "🪨", "base_price": 12.0, "min_price": 6.0, "max_price": 28.0},
    ItemName.WOOD.value: {"icon": "🪵", "base_price": 9.0, "min_price": 5.0, "max_price": 24.0},
    ItemName.INGOT.value: {"icon": "🔩", "base_price": 35.0, "min_price": 18.0, "max_price": 78.0},
    ItemName.GEAR.value: {"icon": "⚙️", "base_price": 120.0, "min_price": 70.0, "max_price": 240.0},
    ItemName.WIDGET.value: {"icon": "📦", "base_price": 280.0, "min_price": 160.0, "max_price": 560.0},
    ItemName.SCRAP.value: {"icon": "🗑️", "base_price": 4.0, "min_price": 1.5, "max_price": 12.0},
}
ITEM_IDS: tuple[str, ...] = tuple(ITEM_CATALOG.keys())

RECIPE_CATALOG: dict[str, Recipe] = {
    RecipeName.INGOT.value: Recipe(RecipeName.INGOT.value, {ItemName.ORE.value: 2}, {ItemName.INGOT.value: 1}),
    RecipeName.GEAR.value: Recipe(RecipeName.GEAR.value, {ItemName.INGOT.value: 2, ItemName.WOOD.value: 1}, {ItemName.GEAR.value: 1}),
    RecipeName.WIDGET.value: Recipe(RecipeName.WIDGET.value, {ItemName.GEAR.value: 1, ItemName.INGOT.value: 1}, {ItemName.WIDGET.value: 1}),
    RecipeName.SCRAP_MIX.value: Recipe(RecipeName.SCRAP_MIX.value, {ItemName.ORE.value: 1, ItemName.WOOD.value: 1}, {ItemName.SCRAP.value: 1}),
}
RECIPE_IDS: tuple[str, ...] = tuple(RECIPE_CATALOG.keys())

MACHINE_CATALOG: dict[str, MachineSpec] = {
    RecipeName.INGOT.value: MachineSpec(RecipeName.INGOT.value, "Smelter", 260.0, 60, 45.0, 3, 135.0, 6),
    RecipeName.GEAR.value: MachineSpec(RecipeName.GEAR.value, "Gear Press", 420.0, 60, 70.0, 3, 210.0, 6),
    RecipeName.WIDGET.value: MachineSpec(RecipeName.WIDGET.value, "Assembly Bench", 620.0, 60, 95.0, 4, 285.0, 7),
    RecipeName.SCRAP_MIX.value: MachineSpec(RecipeName.SCRAP_MIX.value, "Recycler", 180.0, 60, 35.0, 2, 105.0, 4),
}
MACHINE_IDS: tuple[str, ...] = tuple(MACHINE_CATALOG.keys())
MACHINE_STRATEGIES: tuple[str, ...] = tuple(strategy.value for strategy in MaintenanceStrategy)
MACHINE_STATUSES: tuple[str, ...] = tuple(status.value for status in MachineStatus)
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
