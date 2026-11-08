# Domino Insights

**Building Intelligence | HackUTD 2026 | CBRE Challenge**

Domino Insights is a building-intelligence dashboard that connects infrastructure assets, operational records, tenant dependencies, historical research telemetry, and conversational AI.

The platform demonstrates how an interconnected building can be understood as a dependency network, allowing users to investigate operational conditions and ask evidence-grounded questions about critical infrastructure.

**Technology stack:** React, TypeScript, Vite, Tailwind CSS, Lucide React, Node.js, SpacetimeDB, and OpenAI.

**Development branch:** `integration/backend-data`  
**Last verified pushed commit:** `616e46c`  
**Database:** `cbre-telemetry-dev`  
**Project status:** Functional development prototype with a locally implemented CBRE-inspired frontend redesign.

---

## 1. Project capabilities

Domino Insights provides:

| Capability | Function |
|---|---|
| Campus overview | Displays facilities, systems, assets, and recorded operating status. |
| Infrastructure inventory | Identifies equipment, infrastructure domains, and asset criticality. |
| Tenant SLA exposure | Displays fictional tenant dependencies and illustrative hourly SLA penalties. |
| Work orders | Presents stored maintenance activity. |
| Incident monitoring | Displays recorded operational incidents. |
| Historical telemetry | Examines simulated chiller measurements with preserved source provenance. |
| Dependency network | Identifies direct relationships between upstream and downstream equipment. |
| Ask Domino AI | Converts natural-language questions into explanations grounded in approved database records. |
| Cascade assessment engine | Supports deterministic hypothetical failure analysis through a separate backend reducer. |

The dashboard is read-oriented. Its SpacetimeDB subscriptions synchronize stored records as they change; this does **not** mean the underlying demonstration telemetry comes from live physical equipment.

---

## 2. System architecture

```text
                         USER
                           |
                           v
                   React Dashboard
                 src/App.tsx
                 src/AskDominoChat.tsx
                           |
             +-------------+--------------+
             |                            |
             v                            v
      SpacetimeDB Client             POST /api/ask
      src/main.tsx                       |
             |                      Vite Proxy
             |                            |
             v                            v
      SpacetimeDB Maincloud        Node.js AI Server
      cbre-telemetry-dev           server/index.mjs
             |                            |
             |                 Approved read-only SQL
             |                            |
             +<---------------------------+
             |
             |  Campus, assets, faults,
             |  tenants, dependencies,
             |  historical telemetry
             |
             +------> Structured Evidence
                              |
                              v
                       OpenAI Responses API
                              |
                              v
                      Generated Explanation
                              |
                              v
                      React Chat Interface
```

### Application responsibilities

**React** handles presentation, database subscriptions, user interaction, and displaying AI responses.

**SpacetimeDB** stores campus entities, infrastructure relationships, operational events, simulation records, and research telemetry.

**Node.js** exposes the approved data endpoints, retrieves read-only evidence, validates AI requests, and communicates with the language model.

**OpenAI** generates explanatory answers from the supplied structured evidence. It does not directly execute SQL or modify database records.

---

## 3. Repository structure and file responsibilities

### Application and configuration

| File or directory | Responsibility |
|---|---|
| `README.md` | Primary project documentation, execution guide, and milestone record. |
| `package.json` | Declares frontend dependencies, Node.js requirements, and npm scripts. |
| `package-lock.json` | Locks installed package versions for reproducible installation. |
| `index.html` | HTML entry point for the React application. |
| `vite.config.ts` | Configures React, Tailwind CSS, and the development `/api` proxy. |
| `tsconfig.json` | Configures TypeScript compilation and type checking. |
| `.gitignore` | Excludes generated files, dependencies, and local configuration where applicable. |
| `.env.local` | Local Vite environment configuration. Do not commit secrets. |
| `spacetime.json` | SpacetimeDB project configuration. |
| `spacetime.local.json` | Local SpacetimeDB configuration where used. |
| `LICENSE` | Repository licensing information. |
| `AGENTS.md` | Repository-level guidance for development agents. |
| `CLAUDE.md` | Additional project development guidance. |
| `.github/` | GitHub repository configuration and automation, where present. |
| `.cursor/`, `.windsurfrules` | Local/editor development guidance and rules. |

### Frontend

| File | Responsibility |
|---|---|
| `src/main.tsx` | Initializes React and the shared SpacetimeDB provider connection. |
| `src/App.tsx` | Coordinates dashboard subscriptions, metrics, data presentation, and layout. |
| `src/DashboardSidebar.tsx` | Implements the CBRE-inspired navigation, section anchors, and connection indicator. |
| `src/AskDominoChat.tsx` | Provides AI question entry, suggested prompts, loading state, conversation display, and evidence timestamps. |
| `src/styles.css` | Defines Tailwind imports, design tokens, global styling, and reusable dashboard styles. |
| `src/module_bindings/` | Generated TypeScript bindings connecting the frontend to SpacetimeDB tables and operations. |

`src/App.tsx` currently subscribes to seven tables: `facility`, `system_component`, `asset_profile`, `tenant_lease`, `work_order`, `incident_log`, and `research_telemetry`.

Generated bindings should be regenerated when the backend schema changes rather than manually edited.

### Backend

| File | Responsibility |
|---|---|
| `spacetimedb/src/index.ts` | Defines the database schema, reducers, seed logic, dependency handling, and simulation operations. |
| `server/index.mjs` | Runs the local AI HTTP service, retrieves predefined database evidence, calls OpenAI, and returns JSON responses. |
| `spacetimedb/` configuration files | Support compiling and publishing the SpacetimeDB module. |

Key reducers include campus seeding, dependency-rule seeding, historical research ingestion, and deterministic cascade assessment.

The `analyzeCascade` reducer writes a simulated assessment. It is deliberately separate from the read-only AI question-answering workflow.

### Data-processing scripts

| File | Responsibility |
|---|---|
| `scripts/build_campus.py` | Generates synthetic campus data and supporting infrastructure records. |
| `scripts/build_llm.py` | Prepares retrieval and evaluation datasets for language-model assessment. |
| `scripts/fetch_weather.ts` | Supports acquisition of contextual weather snapshots. |
| `scripts/normalize_lbnl.py` | Normalizes historical LBNL chiller measurements and records timestamp provenance. |
| `scripts/replay_telemetry.ts` | Supports controlled local telemetry playback. |
| `scripts/research_adapter.mjs` | Maps research-source component identifiers into the development-campus contract. |
| `scripts/research_adapter.test.mjs` | Validates research adapter behavior and metadata. |
| `scripts/test_lbnl_timestamps.py` | Tests historical timestamp conversion assumptions. |
| `scripts/ingest_research_batch.mjs` | Previews and optionally ingests a validated historical telemetry batch into the development database. |

### Data files

| Path | Contents |
|---|---|
| `data/synthetic/assets.csv` | Fictional infrastructure asset inventory. |
| `data/synthetic/dependencies.csv` | Synthetic infrastructure dependency relationships. |
| `data/synthetic/tenant_leases.csv` | Fictional tenants and contractual exposure assumptions. |
| `data/synthetic/utility_readings.csv` | Synthetic utility measurements. |
| `data/synthetic/operational_events.json` | Generated operational events. |
| `data/scenarios/cooling_cascade.json` | Demonstration cooling-failure scenario and associated records. |
| `data/snapshots/weather_snapshot.json` | Contextual weather snapshot. |
| `data/processed/hvac_readings.csv` | Normalized historical chiller measurements. |
| `data/processed/hvac_provenance.json` | Source metadata, units, component crosswalks, and timestamp assumptions. |
| `data/processed/hvac_fault_annotations.json` | Research classification annotations for offline evaluation. |
| `data/llm/retrieval_corpus.jsonl` | Source-attributed documents prepared for retrieval experiments. |
| `data/llm/qa_eval_inputs.jsonl` | Evidence-based questions for AI evaluation. |
| `data/llm/qa_eval_answers.jsonl` | Reference answers for evaluation. |
| `data/llm/hvac_eval_inputs.jsonl` | Research telemetry windows for classification testing. |
| `data/llm/hvac_eval_labels.jsonl` | Reference classifications and sensor-bias labels. |

The offline LLM evaluation files support testing and research; they are not the evidence source automatically loaded by the current `/api/ask` endpoint.

### Supporting documentation

| File | Purpose |
|---|---|
| `docs/data-sources.md` | Data origin and source descriptions. |
| `docs/data-package.md` | Supporting instructions for the research and synthetic data package. |
| `docs/field-mapping.md` | Field types, component mappings, and telemetry data contracts. |
| `docs/hvac-research.md` | Historical HVAC research assumptions and scope. |
| `docs/scenario-cooling.md` | Synthetic cooling-cascade scenario documentation. |
| `docs/data-integration.md` | Research adapter, provenance validation, and backend integration decisions. |

### Generated directories

`node_modules/` contains installed packages. `dist/` contains the compiled production frontend. TypeScript build-info files contain generated compiler state.

These files are not primary application source code.

---

## 4. Prerequisites

Install:

- Git
- Node.js satisfying the project's declared engine requirements
- npm
- A modern web browser
- SpacetimeDB CLI for backend development
- Python 3 for data-processing scripts
- An active OpenAI API key with available API usage

The Node.js versions declared by the project include:

```text
^22.23.4 || ^24.22.1 || >=26.12.1
```

The existing cloud development database must be accessible for the documented application workflow.

---

## 5. Installation and startup

### Step 1 — Obtain the project

```bash
git clone --branch integration/backend-data \
  https://github.com/anthonioodonkor/domino-insights.git

cd domino-insights

npm ci
```

### Step 2 — Configure the frontend database connection

Create `.env.local` in the project root:

```dotenv
VITE_SPACETIMEDB_DB_NAME=cbre-telemetry-dev
VITE_SPACETIMEDB_HOST=https://maincloud.spacetimedb.com
```

These values select the development instance used by the prototype.

Do not replace the development database identifier with the separately maintained production database.

### Step 3 — Configure the AI service

In Git Bash, enter the OpenAI API key through a hidden prompt:

```bash
read -r -s -p "OpenAI API key (hidden): " OPENAI_API_KEY
```

Paste the key when prompted and press Enter.

Then run:

```bash
printf '\n'
export OPENAI_API_KEY
node server/index.mjs
```

The key is available to the Node.js process without being embedded in frontend code.

Expected startup output:

```text
Ask Domino AI server running
Health: http://127.0.0.1:8787/api/health
Campus: http://127.0.0.1:8787/api/campus
```

The default AI server binds to `127.0.0.1:8787`. Its port may be configured with `DOMINO_AI_PORT`.

The default language model is `gpt-4.1-mini`; it may be overridden with the server-side `OPENAI_MODEL` environment variable.

### Step 4 — Start the dashboard

In a second terminal:

```bash
npm run dev
```

Open the local URL printed by Vite, typically:

```text
http://localhost:5173/
```

Vite selects another available port if necessary.

Keep both the Vite frontend and Node.js AI server running during use.

### Step 5 — Validate the production build

```bash
npm run build
```

A successful build compiles TypeScript and creates production assets in `dist/`.

---

## 6. Operating the dashboard

### Campus Overview

Displays the facility count, system count, asset count, and recorded facility status.

### Infrastructure Assets

Lists assets, equipment domains, and recorded criticality classifications such as `CRITICAL`, `HIGH`, and `MEDIUM`.

The dashboard currently presents twelve of the twenty recorded assets in its overview panel.

### Tenant SLA Exposure

Displays fictional tenants alongside their illustrative hourly SLA penalty values.

These values represent scenario assumptions, not confirmed financial losses.

### Work Orders and Incident Logs

Display currently stored maintenance and incident records.

An empty section means no corresponding records were present in the retrieved dataset.

### Historical Chiller Telemetry

Displays research measurements associated with `MS-CHILLER-1`, including:

- Chilled-water return temperature
- Chilled-water supply temperature
- Chiller operating state
- Chiller electrical power

Historical research observations must not be interpreted as live operational conditions.

### Ask Domino AI

1. Navigate to **Ask Domino AI** using the sidebar.
2. Select a suggested question or enter a custom question.
3. Click **Ask Domino AI**.
4. Review the generated explanation and supporting record IDs.
5. Inspect the evidence retrieval timestamp to understand when the supporting records were queried.

Each question is evaluated independently. Previous chat messages are displayed in the browser but are not automatically forwarded as conversation history.

---

## 7. How an AI question is processed

A user question follows this sequence:

```text
1. User enters a question.
2. React validates the form and sends POST /api/ask.
3. Vite forwards the request to Node.js.
4. Node.js validates the question.
5. The server retrieves approved SpacetimeDB snapshots.
6. Database results are normalized into structured JSON.
7. The evidence and question are submitted to OpenAI.
8. The model generates a grounded explanation.
9. Node.js returns the answer and evidence metadata.
10. React displays the answer and retrieval timestamp.
```

The request handler accepts a nonempty question of up to 500 characters. The request body is limited to 4,096 bytes.

### Server-side evidence sources

The current AI implementation retrieves:

| Evidence | Database tables |
|---|---|
| Facility context | `facility` |
| Asset details | `asset_profile` |
| Component status | `system_component` |
| Fault records | `active_fault` |
| Tenant relationships | `tenant_lease` |
| Dependency relationships | `system_dependency`, `dependency_rule` |
| Historical measurements | `research_telemetry` |

These are predefined read-only queries. The AI does not receive permission to generate executable SQL.

### Language-model configuration

The server uses the OpenAI Responses API with server-side instructions emphasizing:

- Evidence-grounded answers
- Record-ID attribution
- Synthetic-data disclosure
- Historical-versus-operational separation
- Explicit uncertainty when evidence is insufficient
- No automatic operational actions

The current request includes `store: false` and limits generated output to 650 tokens.

---

## 8. API reference

| Method | Endpoint | Responsibility |
|---|---|---|
| `GET` | `/api/health` | Reports local service status and operating mode. |
| `GET` | `/api/campus` | Returns development-campus facility information. |
| `GET` | `/api/operations` | Returns asset, component, fault, and tenant snapshots. |
| `GET` | `/api/dependencies` | Returns dependency edges joined with rule metadata. |
| `GET` | `/api/telemetry` | Returns reviewed historical research measurements. |
| `POST` | `/api/ask` | Generates a natural-language explanation using database evidence. |

The health endpoint's `llmConnected` field is presently a static value, not a live model-authentication test.

### Example request

```bash
curl --request POST \
  'http://127.0.0.1:8787/api/ask' \
  --header 'Content-Type: application/json' \
  --data '{"question":"Which systems directly depend on MS-UPS-1?"}'
```

### Example response structure

```json
{
  "answer": "MS-PDU-1 and MS-ACS-1 directly depend on MS-UPS-1. Supporting dependency records are MS-DEP-4 and MS-DEP-14.",
  "database": "cbre-telemetry-dev",
  "retrievedAt": "<UTC retrieval timestamp>",
  "model": "gpt-4.1-mini-2025-04-14",
  "evidenceTables": [
    "facility",
    "asset_profile",
    "system_component",
    "active_fault",
    "tenant_lease",
    "system_dependency",
    "dependency_rule",
    "research_telemetry"
  ],
  "mode": "read-only"
}
```

The answer is model-generated and may vary in wording. Record identifiers and the response structure make its evidence traceable.

---

## 9. Understanding AI inputs and outputs

### Example A — Direct UPS dependencies

**Input**

```text
Which systems directly depend on MS-UPS-1,
and are there any unresolved faults recorded?
```

**Verified database evidence**

| Record | Meaning |
|---|---|
| `MS-UPS-1` | Critical UPS component |
| `MS-DEP-4` | Direct dependency connecting the UPS to `MS-PDU-1` |
| `MS-DEP-14` | Direct dependency connecting the UPS to `MS-ACS-1` |
| `unresolvedFaults: []` | No unresolved faults recorded in the retrieved snapshot |

**Expected interpretation**

The UPS has two directly dependent components: `MS-PDU-1` and `MS-ACS-1`.

No unresolved faults were recorded in the tested development snapshot. This does not independently verify that all physical equipment is healthy.

### Example B — Tenant dependencies

**Input**

```text
Which tenants depend on the server halls?
```

**Verified relationships**

| Tenant ID | Dependent component |
|---|---|
| `MS-TEN-A` | `MS-HALL-1` |
| `MS-TEN-B` | `MS-HALL-1` |
| `MS-TEN-C` | `MS-HALL-2` |

The AI may explain these relationships using tenant names and the fictional lease records.

The hourly penalties displayed in the dashboard are assumptions for potential SLA exposure, not evidence that a disruption has occurred.

### Example C — Chiller performance

**Input**

```text
What do the historical chiller readings show?
```

**Verified source**

```text
Sequence: LBNL-2E91
Component: MS-CHILLER-1
Source: research_simulation
Is live: false
Readings: 20
Metrics: 4
```

The model may summarize recorded temperatures, power measurements, and operating state.

The research timestamps use an assumed fixed UTC−06:00 conversion marked `unverified_fixed_offset`.

The `chiller_on` metric describes whether the simulated chiller was operating, not whether it was healthy.

### Example D — Hypothetical failure

**Input**

```text
What happens if MS-UPS-1 fails?
```

The read-only AI can identify direct dependencies and explain potential areas requiring investigation.

A complete failure-propagation result requires the deterministic cascade engine, which evaluates downstream relationships and dependency requirements.

The current `/api/ask` workflow does not automatically invoke that engine or create an assessment record. Therefore, the model must not invent a complete cascade outcome.

---

## 10. Development database and validated records

The active development instance is:

```text
Database: cbre-telemetry-dev
Facility: MS-DC-001
Name: Domino Multi-Silo Data Center
Location: Richardson, Texas
```

### Verified snapshot

| Record category | Count |
|---|---:|
| Facilities | 1 |
| Assets | 20 |
| System components | 20 |
| Tenants | 3 |
| Dependency edges | 20 |
| Dependency rules | 20 |
| Historical readings currently ingested | 20 |
| Research metrics | 4 |
| Unresolved faults | 0 |
| Work orders | 0 |
| Incident logs | 0 |

These are recorded verification values, not permanent invariants. Counts can change when development data changes.

---

## 11. Research data and simulation boundaries

The historical chiller data originates from a simulated LBNL chiller-plant dataset.

**Source reference:** https://doi.org/10.25984/1881324

The processed research data retains original measurement identity and provenance metadata.

### Component mapping

```text
Research component: COMP-CH-01
          |
          v
Development component: MS-CHILLER-1
```

This mapping enables the fictional campus to demonstrate historical data analysis. It does not represent a real-world equipment identity match.

### Research ingestion

Preview a validated batch:

```bash
node scripts/ingest_research_batch.mjs
```

The reviewed preview selects 20 readings from the `LBNL-2E91` sequence without database writes.

When explicitly authorized to update the development database:

```bash
node scripts/ingest_research_batch.mjs --execute
```

The ingestion reducer validates source metadata, numerical values, component mapping, and reading identities.

The reviewed batch contains five historical measurement minutes across four metrics.

### Deterministic cascade assessments

The `analyzeCascade` reducer handles hypothetical failure propagation through the dependency graph.

Unlike AI question answering, this operation records a simulation assessment in `cascade_assessment`, including its simulation designation.

It must be invoked as a separate, intentional operation.

---

## 12. Validation and expected terminal output

### Frontend validation

```bash
npm run build
```

Recorded successful build:

```text
vite v7.3.7 building client environment for production...
✓ 2106 modules transformed.
✓ built in 3.01s
```

### Backend syntax validation

```bash
node --check server/index.mjs
```

Successful execution completes without syntax diagnostics.

### API verification

```bash
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/campus
curl http://127.0.0.1:8787/api/operations
curl http://127.0.0.1:8787/api/dependencies
curl http://127.0.0.1:8787/api/telemetry
```

### Research adapter validation

```bash
node --test scripts/research_adapter.test.mjs
```

### Historical timestamp validation

```bash
python -m unittest discover -s scripts \
  -p test_lbnl_timestamps.py -v
```

### SpacetimeDB module build

```bash
spacetime build --module-path spacetimedb
```

Database publishing and ingestion are separate operations from ordinary frontend startup.

---

## 13. Git development history

The following milestones are established by recorded development work on `integration/backend-data`.

| Commit | Purpose | Verified outcome |
|---|---|---|
| `86ebae3` | Research telemetry integration and TypeScript bindings | Historical telemetry storage and frontend-compatible bindings added. |
| `b942ce7` | Research batch ingestion script | Reusable validated batch preview and development ingestion workflow. |
| `b3e4bda` | React–SpacetimeDB integration | Dashboard reads development-campus tables through reactive subscriptions. |
| `0049cf9` | Read-only AI data API | Campus, operations, dependencies, and historical telemetry endpoints implemented. |
| `616e46c` | Ask Domino AI integration | OpenAI-backed natural-language endpoint and React chat component integrated. |

### Recorded operational milestones

| Input or operation | Recorded output |
|---|---|
| Retrieve operations snapshot | 20 assets, 20 components, 3 tenants, 0 unresolved faults |
| Retrieve dependency graph | 20 edges, 20 rules |
| Query direct UPS dependencies | `MS-PDU-1`, `MS-ACS-1` |
| Retrieve historical telemetry | 20 non-live readings, four metrics |
| Ask Domino AI about UPS dependencies | Model-generated explanation citing `MS-DEP-4` and `MS-DEP-14` |
| Build the React dashboard | Successful TypeScript and Vite production compilation |
| Push AI integration | Commit `616e46c` synchronized with `origin/integration/backend-data` |

### Frontend redesign milestone

The subsequent CBRE-inspired redesign introduces:

- Tailwind CSS and project-specific color tokens
- Forest-green application navigation
- Lucide icons
- Responsive dashboard layout
- Asymmetric infrastructure and telemetry cards
- Refined AI conversation styling
- Suggested questions, loading feedback, and keyboard focus states

The redesign has been visually reviewed and production-built locally. Its next Git commit should be recorded here once committed and pushed.

### Maintaining the commit record

After an approved change:

```bash
npm run build
git diff --check
git status --short
```

Then stage the intended files and create a descriptive commit:

```bash
git add README.md
git commit -m "Document Domino Insights architecture and workflows"
git push origin integration/backend-data
```

For subsequent commits, update this section with the actual commit hash, affected functionality, tested input, and observed output. Do not record an unpushed change as a verified remote commit.

---

## 14. Security and data interpretation

- OpenAI credentials remain on the Node.js server and must never be embedded in frontend files.
- The development AI service binds to localhost and requires additional access controls before public deployment.
- The model cannot execute arbitrary SQL through the current API.
- Database retrieval is read-only; reducers that create or modify records are separate.
- Synthetic campus records must not be presented as real facility operational facts.
- Historical research measurements must not be described as current sensor values.
- Dependency edges must not be confused with calculated cascade outcomes.
- An absence of recorded faults does not guarantee equipment health.
- Fictional hourly SLA penalties are illustrative exposure assumptions.
- Evaluation reference answers and research annotations should remain separate from live model context when performing blind evaluations.

---

## 15. Project summary

Domino Insights demonstrates a connected building-intelligence workflow in which structured infrastructure data, dependency relationships, historical measurements, and AI-assisted explanations are presented through one cohesive interface.

Its core principle is **traceable intelligence**: a question entered by a user should result in an explanation supported by identifiable records, explicit data-source limitations, and a clear distinction between recorded facts and hypothetical outcomes.

The architecture supports continued expansion into deterministic cascade visualization, operational response workflows, additional telemetry analysis, and more comprehensive AI evaluation.

**HackUTD 2026 — CBRE Invisible Network Challenge**
