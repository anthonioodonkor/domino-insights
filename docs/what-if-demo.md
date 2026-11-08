# What breaks if…? Interactive assessment

Open the scenario lab at `/#what-if`. The current implementation uses the existing
development database schema and generated bindings; no schema publication is needed.

## Judge walkthrough

1. Choose **Primary chiller / backup available**, then **Run failure assessment**.
   Inspect the saved result and surviving backup path.
2. Choose **Shared cooling pump** and run another assessment. Compare the
   downstream services and tenants. The seeded model predicts both air handlers
   and both halls at risk, with three tenants and $29,000/hour of potential exposure.
   These are seed-based expectations; the interface uses the actual persisted result.
3. Move the duration slider to 15 minutes. At the seeded rate this gives $7,250
   of illustrative exposure. Explain the assumptions shown alongside the estimate.
4. Inspect the disrupted requirements and the recommended investigation.
5. Optionally choose **Start simulated response…**, then explicitly confirm.
   This creates a synthetic unavailable reading through `ingestDemoTelemetry`.
   The backend creates an incident, work order, fresh assessment, and active fault.
   An existing open response is shown rather than creating another from the UI.
6. Follow **Review work orders**. The rest of the dashboard updates through its
   subscriptions. This action does not notify anyone or operate physical equipment.

The **How to respond properly** checklist is visible before and after creation.
It identifies suggested owners, investigation and coordination steps, approval
requirements, and the recovery evidence needed for closure. **Copy response brief**
prepares a handoff with the asset, available incident/work-order IDs, affected
services, and the checklist. It does not send the brief or assign anyone.
**Your next step** uses the subscribed incident-response state and warns when a
new fault is newer than the recorded approval. These are instructions, not task
completion checkboxes; lifecycle actions beyond creation remain backend operations.

## Data and action boundaries

- The server's `analyzeCascade` result is authoritative. The UI reads the result
  from `cascade_assessment`, not a reducer return value or a second cascade model.
- Explanations join the persisted affected IDs to current dependency edges and rules.
  Historical assessments are not immutable snapshots of graph or lease metadata.
- The model assumes one failed root and other assets available. It does not include
  concurrent recorded faults, physical capacity, backup readiness, probability, or
  time-to-failure. Emerging disruptions are conditional service-loss predictions.
- Exposure is the saved fictional hourly rate times the selected duration / 60.
  It does not implement grace periods, billing caps, repair costs, or revenue loss.
  Do not mix it with the separate scenario CSV's temperature-based $30 example.
- Historical LBNL readings remain separate; no research sample is turned into a
  live fault. The AI question-answering service remains read-only.
- Run IDs use UUIDs; the most recent 12 session IDs survive a tab refresh through
  sessionStorage. Assessment rows persist in the database. Each response uses a
  stable `RESPONSE-<assessment ID>` reading ID for the existing reducer deduplication.
- Unknown call outcomes are reported without automatic retries. Check subscription
  results first. Existing incident acknowledgement/approval/recovery reducers remain
  available for a separate response lifecycle; this screen does not auto-resolve faults.
- Existing backend write permissions and shared demo state are unchanged. The
  confirmation is a UX safeguard, not an authorization mechanism. Use the development
  database; production role authorization and per-user scenario isolation remain separate work.

## Verification

```sh
node --experimental-strip-types --test scripts/assessment_insights.test.mjs
node --experimental-strip-types --test scripts/response_plan.test.mjs
npm run build
```

The tests cover alternate-source explanations, shared dependencies, inconsistent
rules, malformed assessment IDs, and exposure arithmetic. Browser checks should
also verify persisted results, scenario comparison, mobile layout, and cancellation
before performing any optional simulated incident creation.

Verified during implementation: production build and all five insight tests pass.
Headless Chrome against the development database verified persisted chiller/pump
assessments, backup protection, the $29,000/hour and $7,250/15-minute example,
confirmation/cancellation, refresh persistence, no mobile horizontal overflow, and
no browser runtime errors. The desktop result was visually reviewed. The browser
check saved two hypothetical assessments but did not create a fault or work order.
The new incident-creation button delegates to the existing reducer; its committed
write path was not exercised in this browser check.

To rerun that browser check with Playwright installed separately:

```sh
node scripts/verify_what_if.cjs /absolute/path/to/node_modules/playwright http://127.0.0.1:5188/
```
