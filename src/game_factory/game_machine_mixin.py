from __future__ import annotations

from typing import Any, Dict

from game_factory.game_constants import (
    DEFAULT_PREVENTIVE_INTERVAL,
    MACHINE_CATALOG,
    MachineSpec,
    MachineFailureZone,
    MachineStatus,
    MaintenanceStrategy,
)


class _MachineContext:
    machines: Dict[str, Dict[str, Any]]
    _machines_used_today: Dict[str, bool]
    cash: float
    rng: Any

    def _consume_action_time(self, hours: int) -> str:
        ...

    def available_maintenance_strategies(self) -> tuple[str, ...]:
        ...


class MachineLifecycleMixin(_MachineContext):
    def _machine_spec(self, recipe_name: str) -> MachineSpec:
        return MACHINE_CATALOG[recipe_name]

    def _machine_state(self, recipe_name: str) -> Dict[str, Any]:
        return self.machines[recipe_name]

    def _machine_capacity(self, recipe_name: str, requested_batches: int) -> int:
        machine = self._machine_state(recipe_name)
        if machine["status"] == MachineStatus.HARD_FAILURE.value:
            return 0
        if machine["status"] == MachineStatus.SOFT_FAILURE.value:
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
        if machine["status"] == MachineStatus.HARD_FAILURE.value:
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
            return MachineFailureZone.INFANT.value
        if days >= spec.rated_lifetime_days - 10:
            return MachineFailureZone.WEAR_OUT.value
        return MachineFailureZone.USEFUL.value

    def _preventive_on_schedule_modifier(self, preventive_interval: int) -> float:
        interval = max(3, min(20, int(preventive_interval)))
        normalized = (interval - 3) / 17
        return 0.45 + normalized * 0.35

    def _schedule_predictive_maintenance_day(self, recipe_name: str) -> int:
        machine = self._machine_state(recipe_name)
        current_day = int(machine["days_operated"])
        remaining = self._machine_remaining_life(recipe_name)
        if remaining <= 1:
            return current_day
        max_offset = min(15, max(1, remaining - 1))
        min_offset = min(5, max_offset)
        return current_day + self.rng.randint(min_offset, max_offset)

    def _predictive_maintenance_due(self, recipe_name: str) -> bool:
        machine = self._machine_state(recipe_name)
        due_day = machine.get("predictive_maintenance_day")
        if due_day is None:
            return False
        return int(machine["days_operated"]) >= int(due_day)

    def _machine_base_failure_chance(self, recipe_name: str) -> float:
        zone = self._machine_failure_zone(recipe_name)
        if zone == MachineFailureZone.INFANT.value:
            return 0.12
        if zone == MachineFailureZone.WEAR_OUT.value:
            remaining = max(0, self._machine_remaining_life(recipe_name))
            return 0.12 + (10 - min(10, remaining)) * 0.02
        return 0.025

    def _machine_failure_chance(self, recipe_name: str) -> float:
        machine = self._machine_state(recipe_name)
        chance = self._machine_base_failure_chance(recipe_name)

        # Preventive strategy reduces risk while maintenance is on schedule,
        # but becomes riskier when running overdue.
        if machine["strategy"] == MaintenanceStrategy.PREVENTIVE.value:
            if machine["days_since_service"] <= machine["preventive_interval"]:
                chance *= self._preventive_on_schedule_modifier(machine["preventive_interval"])
            else:
                chance *= 1.4
        elif machine["strategy"] == MaintenanceStrategy.PREDICTIVE.value:
            due_day = machine.get("predictive_maintenance_day")
            if due_day is None:
                due_day = self._schedule_predictive_maintenance_day(recipe_name)
                machine["predictive_maintenance_day"] = int(due_day)
            chance *= 0.10 if int(machine["days_operated"]) <= int(due_day) else 10.0
        return min(0.95, chance)

    def _roll_machine_failure(self, recipe_name: str) -> str | None:
        machine = self._machine_state(recipe_name)
        spec = self._machine_spec(recipe_name)
        if not machine["owned"]:
            return None

        chance = self._machine_failure_chance(recipe_name)
        # No failure today.
        if self.rng.random() >= chance:
            return None

        zone = self._machine_failure_zone(recipe_name)
        # Failure severity rules:
        # - soft failures can escalate to hard failures on a later event,
        # - wear-out (or zero life left) fails hard immediately,
        # - otherwise roll for hard vs soft based on zone-specific bias.
        if machine["status"] == MachineStatus.SOFT_FAILURE.value:
            hard_failure = True
        elif zone == MachineFailureZone.WEAR_OUT.value or self._machine_remaining_life(recipe_name) == 0:
            hard_failure = True
        else:
            hard_bias = 0.30 if zone == MachineFailureZone.INFANT.value else 0.18
            hard_failure = self.rng.random() < hard_bias

        machine["status"] = MachineStatus.HARD_FAILURE.value if hard_failure else MachineStatus.SOFT_FAILURE.value
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
            previous_due = bool(machine["maintenance_due"])
            # Only machines that were actually used age for this day.
            if used:
                machine["days_operated"] += 1
                machine["days_since_service"] += 1
            machine["maintenance_due"] = (
                machine["strategy"] == MaintenanceStrategy.PREVENTIVE.value
                and machine["days_since_service"] >= machine["preventive_interval"]
            )
            if machine["strategy"] == MaintenanceStrategy.PREDICTIVE.value:
                if machine.get("predictive_maintenance_day") is None:
                    machine["predictive_maintenance_day"] = self._schedule_predictive_maintenance_day(recipe_name)
                machine["maintenance_due"] = self._predictive_maintenance_due(recipe_name)
            if machine["maintenance_due"] and not previous_due:
                spec = self._machine_spec(recipe_name)
                if machine["strategy"] == MaintenanceStrategy.PREVENTIVE.value:
                    lines.append(f"{spec.name} preventive maintenance is due.")
                elif machine["strategy"] == MaintenanceStrategy.PREDICTIVE.value:
                    due_day = int(machine.get("predictive_maintenance_day") or machine["days_operated"])
                    lines.append(f"{spec.name} predictive alert: target maintenance day {due_day} reached. Failure risk will rise sharply if delayed.")
            # We roll failure checks on used machines once per day rollover.
            if used and machine["status"] != MachineStatus.HARD_FAILURE.value:
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
            "status": MachineStatus.OPERATIONAL.value,
            "strategy": MaintenanceStrategy.CORRECTIVE.value,
            "preventive_interval": DEFAULT_PREVENTIVE_INTERVAL,
            "predictive_maintenance_day": None,
            "days_operated": 0,
            "days_since_service": 0,
            "maintenance_due": False,
        })
        return f"Bought {spec.name} for ${spec.purchase_cost:.2f}."

    def update_machine_settings(self, recipe_name: str, strategy: str, preventive_interval: int | None = None) -> str:
        spec = MACHINE_CATALOG.get(recipe_name)
        if not spec:
            return f"Unknown machine recipe '{recipe_name}'."
        if strategy not in self.available_maintenance_strategies():
            return f"Unknown maintenance strategy '{strategy}'."

        machine = self._machine_state(recipe_name)
        if not machine["owned"]:
            return f"Missing machine: buy the {spec.name} first."

        is_due_now = bool(machine["maintenance_due"])
        if machine["strategy"] == MaintenanceStrategy.PREVENTIVE.value:
            is_due_now = is_due_now or machine["days_since_service"] >= machine["preventive_interval"]
        if machine["strategy"] == MaintenanceStrategy.PREDICTIVE.value:
            is_due_now = is_due_now or self._predictive_maintenance_due(recipe_name)
        if is_due_now and (strategy != machine["strategy"] or preventive_interval is not None):
            return f"{spec.name} maintenance is due. Service the machine before changing settings."

        machine["strategy"] = strategy
        if preventive_interval is not None:
            if preventive_interval < 3 or preventive_interval > 20:
                return "Preventive interval must be between 3 and 20 operating days."
            machine["preventive_interval"] = preventive_interval
        if strategy == MaintenanceStrategy.PREDICTIVE.value:
            current_day = int(machine["days_operated"])
            due_day = machine.get("predictive_maintenance_day")
            if due_day is None or int(due_day) <= current_day:
                machine["predictive_maintenance_day"] = self._schedule_predictive_maintenance_day(recipe_name)
        machine["maintenance_due"] = (
            strategy == MaintenanceStrategy.PREVENTIVE.value
            and machine["days_since_service"] >= machine["preventive_interval"]
        )
        if strategy == MaintenanceStrategy.PREDICTIVE.value:
            machine["maintenance_due"] = self._predictive_maintenance_due(recipe_name)
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

        if machine["status"] == MachineStatus.HARD_FAILURE.value:
            cost = spec.emergency_repair_cost
            hours = spec.emergency_repair_hours
            if self.cash < cost:
                return f"Not enough cash. Need ${cost:.2f}, have ${self.cash:.2f}."
            self.cash -= cost
            machine["status"] = MachineStatus.OPERATIONAL.value
            machine["days_since_service"] = 0
            if machine["strategy"] == MaintenanceStrategy.PREDICTIVE.value:
                machine["predictive_maintenance_day"] = self._schedule_predictive_maintenance_day(recipe_name)
            machine["maintenance_due"] = False
            self._machines_used_today[recipe_name] = False
            return f"Repaired {spec.name} for ${cost:.2f}.\n{self._consume_action_time(hours)}"

        cost = spec.preventive_cost
        hours = spec.preventive_hours
        if self.cash < cost:
            return f"Not enough cash. Need ${cost:.2f}, have ${self.cash:.2f}."

        self.cash -= cost
        machine["status"] = MachineStatus.OPERATIONAL.value
        machine["days_since_service"] = 0
        if machine["strategy"] == MaintenanceStrategy.PREDICTIVE.value:
            machine["predictive_maintenance_day"] = self._schedule_predictive_maintenance_day(recipe_name)
        machine["maintenance_due"] = False
        self._machines_used_today[recipe_name] = False
        return f"Performed preventive maintenance on {spec.name} for ${cost:.2f}.\n{self._consume_action_time(hours)}"
