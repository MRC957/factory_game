# Machine Maintenance & Wear System

## Overview

The machine system in Factory Game models real-world industrial equipment lifecycle. Machines have a **lifecycle with three distinct reliability phases**, experience age-dependent failure rates, and require strategic maintenance decisions.

## Key Concepts

### 1. The Bathtub Reliability Curve

All machines follow the classic **bathtub curve** reliability model, dividing equipment life into three zones:

```
Failure Rate
    ▲
    │     ╱╲
    │    ╱  ╲___╱╲╲
    │   ╱        ╲ ╲╲
    │  ╱          ╲___╲╲╲
    │                    ╲╲╲╲
    └────┬────┬────────┬─────────► Days Operated
       Infant   Useful      Wear-out
      (0-5 d)  (6-50 d)    (51-60 d)
       12%      2.5%        12-20%
```

#### **Infant Zone (Days 0-5)**
- **Failure Rate**: 12% per day
- **Cause**: Manufacturing defects, improper setup, run-in issues
- **Observation**: New machines need careful operation during break-in
- **Strategy**: Light usage recommended; preventive maintenance is beneficial but primary focus should be setup quality

#### **Useful Life Zone (Days 6-50)**
- **Failure Rate**: 2.5% per day (baseline)
- **Cause**: Normal wear and tear under expected conditions
- **Observation**: Most productive phase; failures are rare but possible
- **Strategy**: All maintenance strategies work well here; focus on normal operation

#### **Wear-Out Zone (Days 51+)**
- **Failure Rate**: 12% + (10 remaining days) × 0.02 per day
  - Day 51: 12% base
  - Day 55: 12% + 10×0.02 = 12.4%
  - Day 60: 12% + 0×0.02 = 12% (end of rated lifetime)
- **Cause**: Accumulated fatigue, worn components, degraded systems
- **Observation**: Exponential risk increase; critical window for decisions
- **Strategy**: Urgent maintenance required; all failures become hard failures instantly

### 2. Failure Escalation

The system uses a **soft/hard failure escalation model** to create interesting gameplay decisions:

#### **Soft Failures** (Operational but Degraded)
- Machine continues working but at **50% reduced capacity**
- Reduces manual crafting output by half
- Reduces automation worker effectiveness by half
- Can escalate to hard failure on the next failure event
- Signal: **yellow warning status** ("Soft failure")
- Recovery: Any maintenance action (preventive or corrective) clears soft failure

#### **Hard Failures** (Complete Shutdown)
- Machine is completely **non-functional**
- Blocks all manual crafting for that recipe
- Provides zero automation output for that recipe
- Cannot be used for crafting/automation
- Signal: **red critical status** ("Hard failure")
- Recovery: Emergency repair (higher cost, more time) required

#### **Escalation Rules by Zone**
- **Infant Zone**: 30% chance soft → hard, 70% soft failure
- **Useful Zone**: 18% chance soft → hard, 82% soft failure  
- **Wear-Out Zone**: 100% failure becomes hard immediately (no soft failures possible)

### 3. Days Operated vs. Days Since Service

Two independent counters track machine health:

#### **Days Operated**
- Increments by 1 each day the machine is **actually used** (crafted or automated)
- Does not increment on idle days
- Directly maps to position on bathtub curve
- Cannot be reset (permanent age)
- Determines failure zone and base failure chance

#### **Days Since Service**
- Increments by 1 each day the machine is **not serviced**
- Resets to 0 immediately after any maintenance (preventive or corrective)
- Only relevant for **preventive maintenance strategy**
- Used to determine if preventive maintenance is "due" or overdue
- Has no direct impact on failure chance (that's determined by strategy modifiers)

**Example Timeline:**
```
Day 1: Buy machine → days_operated=0, days_since_service=0
Day 1-5: Craft with machine daily → days_operated=5, days_since_service=5
Day 6: Preventive maintenance → days_operated=5, days_since_service=0
Day 7: Craft with machine → days_operated=6, days_since_service=1
Day 8: Rest (don't craft) → days_operated=6, days_since_service=2
```

### 4. Maintenance Strategies

#### **Corrective Maintenance** (Run-to-Failure)
- **Philosophy**: Repair only when machines fail
- **Risk Modifier**: 1.0× (no modifier, base failure rate unchanged)
- **Prevention Interval**: N/A (not used)
- **Best For**: Low-value machines, rapid prototyping, cash-strapped early game
- **Tradeoff**: Low maintenance cost but risk of catastrophic failures

**Flow:**
```
Operating normally → Soft failure → Repair when convenient
           ↓
      Can escalate → Hard failure → Emergency repair (expensive!)
```

#### **Preventive Maintenance** (Scheduled)
- **Philosophy**: Service on a fixed schedule to prevent failures
- **Interval Range**: 5, 10, 15 days (player configurable)
- **Risk Modifiers**:
  - **On-schedule**: 0.6× base failure rate (40% risk reduction)
  - **Overdue** (days_since_service > interval): 1.4× base failure rate (40% risk increase)
- **Best For**: High-value machines, stable operations, reliable production chains
- **Tradeoff**: Regular maintenance cost but significantly lower failure risk when maintained

**Flow:**
```
Days 1-10 (on-schedule):
  Operating at 0.6× risk (safer)
  
Day 11 (overdue on 10-day interval):
  Risk jumps to 1.4× (less safe than base)
  Maintenance is now critical
```

**Example with 10-day Interval:**
- Day 1-10: Service on day 10 (on-schedule) → 0.6× risk during entire period
- Day 11: Haven't serviced yet → 1.4× risk
- Day 20: Service on day 20 (2 days overdue) → risk was 1.4× for days 11-20
- Day 21: Service on day 21 (1 day overdue) → risk was 1.4× for day 21 only

#### **Predictive Maintenance** (Threshold-Based, Unlockable)
- **Status**: Future enhancement (unlock via "Predictive Maintenance Suite" blueprint)
- **Philosophy**: Service based on health threshold rather than fixed schedule
- **Mechanism**: Player sets wear threshold (e.g., 45% of lifetime)
- **Benefit**: Combines low risk of preventive with flexibility of corrective
- **Trigger**: System automatically flags maintenance due when threshold crossed

### 5. Service Costs

Each machine has two service cost profiles:

#### **Preventive Service**
- **Cost**: Lower (e.g., $35-95 depending on machine)
- **Time**: 2-4 hours
- **Trigger**: Following the maintenance schedule
- **Effect**: Resets days_since_service to 0, prevents failures proactively
- **Best Used**: During stable production periods

#### **Emergency Repair**
- **Cost**: Higher (3× preventive cost)
- **Time**: 4-7 hours (longer than preventive)
- **Trigger**: Machine has soft or hard failure
- **Effect**: Recovers machine to operational status immediately
- **Best Used**: After failures occur, as damage control

**Cost Example (Smelter):**
- Preventive Service: $45, 3 hours
- Emergency Repair: $135, 6 hours (3× cost and time)

## Strategic Gameplay

### Early Game (Days 1-20)
- Machines are in infant zone with 12% failure rate
- High failure risk regardless of strategy
- Recommendation: Use **corrective maintenance** to save early cash
- Build cash reserves to handle emergency repairs

### Mid Game (Days 21-50)
- Machines enter useful life zone with 2.5% baseline failure rate
- Failures become rare; strategic maintenance decisions matter
- **Preventive maintenance** becomes attractive for key machines
- **Corrective maintenance** still viable for less critical machines

### Late Game (Days 51+)
- Machines enter wear-out zone with escalating failure risk (12-20%)
- Failures become frequent and severe
- **Urgent decision required**: Service immediately or risk catastrophic failure
- Emergency repairs become very expensive
- Consider machine replacement or second-hand equipment (future feature)

### Maintenance Decision Tree

```
Is this a critical machine?
├─ YES → Use preventive (0.6× risk reduction)
│        └─ Schedule service at interval
└─ NO → Use corrective (pay only when broken)
         └─ Let it run until failure

Has machine entered wear-out zone (day 51+)?
├─ YES → Activate maintenance NOW (risk is 12-20%)
│        └─ Any pause risks failure spiral
└─ NO → Can plan maintenance ahead

Maintenance overdue in preventive mode?
├─ YES → Service URGENTLY (risk jumps to 1.4×)
│        └─ Every day of delay multiplies risk
└─ NO → On track, continue normal ops
```

## Technical Implementation

### State Fields per Machine
```javascript
{
  owned: boolean,                    // Have we purchased this machine?
  status: "missing"|"operational"|"soft_failure"|"hard_failure",
  strategy: "corrective"|"preventive",
  preventive_interval: 5|10|15,      // Days (only used if preventive)
  days_operated: number,             // Permanent age (only increments when used)
  days_since_service: number,        // Resets to 0 after maintenance
  maintenance_due: boolean,          // Flag for UI warning
}
```

### Failure Check (Per Day Rollover)
1. **Determine zone** by days_operated vs. rated_lifetime_days
2. **Calculate base chance** (12%, 2.5%, or 12%+ scaling)
3. **Apply strategy modifier**:
   - Preventive on-schedule: 0.6×
   - Preventive overdue: 1.4×
   - Corrective: 1.0×
4. **Roll failure** against chance
5. **Escalate if needed**: Soft failure → hard via zone-specific bias
6. **Update status** and set maintenance_due flag
7. **Log** failure in activity log

### Service Action
- Clear soft/hard failure status
- Reset days_since_service to 0
- Log service action with cost
- Consume action time (2-7 hours depending on repair type)
- Cost appropriate to machine and situation (preventive or emergency)

## UI Indicators

### Wear Display
- **Format**: "Wear: X / 60d"
- **Shows**: Absolute days operated and lifetime
- **Helps**: Quickly see position on bathtub curve
- **Example**: "Wear: 3 / 60d" (early infant zone), "Wear: 55 / 60d" (critical wear-out)

### Days Since Service
- **Format**: "Days since service: Xd"
- **Shows**: How long since last maintenance
- **Helps**: Plan preventive maintenance schedule
- **Disabled**: Service button disabled when X=0 (just serviced)

### Status Line
- **Operational** (green): Running normally, all capacity available
- **Soft failure** (yellow): Working at 50% capacity, can escalate
- **Hard failure** (red): Completely non-functional, emergency repair needed
- **Missing** (gray): Not yet purchased

### Maintenance Due Warning
- **Color**: Yellow badge with text "Maintenance due"
- **Appears when**:
  - Preventive mode: days_since_service >= interval (on schedule) during useful/infant zones
  - After any failure: soft or hard failure status
- **Not shown**: Corrective mode on stable machines

## Common Scenarios

### Scenario 1: Emergency Cost Spiral
```
Day 52: Machine enters wear-out (12% failure rate)
Day 53: Soft failure occurs (50% output loss)
Day 54: No repair → Hard failure (100% blocked)
Day 54: Emergency repair costs $405 (3× $135)
Day 55: Just recovered, but at 12% daily risk...
```
**Lesson**: Service wear-out machines preemptively, not reactively.

### Scenario 2: Preventive Efficiency
```
Day 10 (interval=10): Service day → days_since_service=0
Day 11-20: Running at 0.6× risk (9% reduction in failure chance)
Day 20: Service again (on-schedule) → resets to 0
Days 21-30: Same 0.6× protection
```
**Lesson**: Preventive works best with consistency.

### Scenario 3: Overdue Penalty
```
Day 10: Missed preventive service (interval=10)
Day 11: Risk jumps from 0.6× to 1.4× (80% increase!)
Day 15: Finally service → back to 0.6× for next window
```
**Lesson**: Overdue preventive is worse than doing nothing.

## See Also
- [Game Design Document](game_design.md) — Overall system design
- [README](../README.md) — Getting started, controls, mechanics overview
