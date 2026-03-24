from __future__ import annotations

from typing import Any, Dict

from game_factory.game_constants import (
    DEFAULT_PREVENTIVE_INTERVAL,
    MACHINE_CATALOG,
    MACHINE_STRATEGIES,
    MachineSpec,
)


class _MachineContext:
    machines: Dict[str, Dict[str, Any]]
    _machines_used_today: Dict[str, bool]
    cash: float
    rng: Any

    def _consume_action_time(self, hours: int) -> str:
        ...


class MachineLifecycleMixin(_MachineContext):
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
