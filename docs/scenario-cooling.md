# Cooling cascade replay

The campus replay is a deterministic, fictional model at one-minute cadence. It starts at `2026-07-16T19:00:00Z`. It uses a modeled cooling degradation and a backup response. The LBNL data is a separate sensor-bias evaluation.

| Minute from start | Expected state and evidence |
|---:|---|
| 0–2 | Baseline with stable chilled water, cool supply air and normal server-hall temperature. |
| 3 | Primary chiller supply temperature begins rising (`EV-02`). |
| 5–6 | The air handler loses cooling capacity. Facilities assigns technician `TECH-01` to `WO-01` (`EV-03`, `EV-04`). |
| 7–9 | A separate maintenance-link fault takes the primary access controller offline. The maintenance check fails and an authorized escorted route is approved via `COMP-BR-02` (`EV-05`, `EV-06`, `EV-08`). |
| 8 | Both server-hall tenants are flagged as at risk. Only `TEN-01` has crossed its own temperature threshold (`EV-07`). |
| 10–11 | Technician arrives four minutes after assignment. An operator approves standby cooling, including the standby pump. Plant-panel demand increases (`EV-09`–`EV-11`). |
| 11–14 | Server-hall temperature peaks at 28.8 °C at minute 11 and falls to 26.9 °C at minute 14. The primary chiller remains degraded while the hall recovers on the standby path. |
| 17–19 | The access controller is restored. Server-hall temperature is 23.2 °C by minute 19, when recovery is verified and the work order is resolved (`EV-13`–`EV-15`). |

For the fictional SLA, each sample represents one minute. Count consecutive samples strictly above the tenant threshold and reset the counter at or below it. Bill each qualifying minute after the grace period, prorated at one-sixtieth of the hourly rate. `TEN-01` exceeds 27 °C for six minutes (minutes 8–13), resulting in three billable minutes at USD 10 each and **USD 30** of illustrative exposure. `TEN-02` never crosses 29 °C. `TEN-03` uses the office floor, which remains below its own threshold. Their modeled exposure is USD 0.

For backend testing, inject telemetry in timestamp order. The operational events give the expected sequence and scripted external actions. Keep these roles separate when wiring the reducer so scripted incident milestones do not pre-create alerts that the backend is being tested on. Operator approval and escorted access are explicit scripted actions. UPS charge, panel voltage and generator status show continuity during the cooling incident.
