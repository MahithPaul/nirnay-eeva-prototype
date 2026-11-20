# EEVA unified workspace: MVP production plan

**Status:** prototype ready for client review · **Date:** 18 Nov 2026
**Prototype:** `prototype/index.html` (open in a browser; four demo roles on the login screen)

---

## 1. The rule this plan is built on

> **Nothing is shown as client data unless it was recorded.** Every number on every screen is either a recorded value or computed from recorded values by a formula written down in section 6.

What that means in practice:

| Situation | What the app does |
|---|---|
| Value recorded | Shown exactly as recorded (dates are only reformatted for reading) |
| Value missing | Shown as **"Not recorded"** and never filled with a guess |
| Value can't be mapped to the system (e.g. a status text) | Left empty **and** logged as an import issue for the client to decide |
| Screen has no source data yet (CRM pipeline) | Uses sample data, labelled **"Sample data · fictional"** on the page |
| Backend has a default (e.g. matter priority = normal) | Default used, and logged as a note so it's visible |

---

## 2. Where the prototype's data comes from

Each page carries a label: **Client data**, **Sample data**, or **Mixed**.

| Source | File | Contents | Used for |
|---|---|---|---|
| **Client legacy workbook** | `js/legacy-data.js` | Verbatim copy of all 14 sheets of `05-Eeva_Practice_Legacy_Data_Migration_With_Sample_Data.xlsx` | Accounts, contacts, matters, applications, tasks, deadlines, documents, invoices, payments, activity |
| **Import mapping** | `js/import.js` | Turns workbook rows into records through explicit mapping tables (M1–M5) and logs every problem | Reference spec for the production migration script |
| **Live system config** | `js/import.js` | Service areas and stages seeded in the database (Trademark, Patent, Copyright, Design); backend enums; roles matrix seed | Kanban columns, filing stages, permissions page |
| **Backend logic (ported exactly)** | `js/app.js` | `compute_health`, `compute_doc_completeness` from `backend/services/matter_intelligence.py` | Matter health score, document completeness |
| **Sample (fictional)** | `js/data.js` | CRM prospects, inquiries, estimates, portal orders, price list | Lead pipeline, inquiries, estimates, website portal pages only |

Sample prospects are never linked to real clients or matters.

### What was removed in this revision

These were in the earlier prototype and were not backed by data. They have been removed or replaced by formulas:

- Shifted dates. The workbook's real dates are used, so the August 2026 hearings now show as overdue.
- Invented records: extra tasks, deadlines, documents, invoices, official actions, client records for Stuffz and BaseCam, and matter contributors.
- Wrong assignments. For example, PAT-2024-001's agent is **Srinivas Maddipati** per the workbook, not Saikrishna.
- Hard-coded metrics: "Avg cycle 142 days" and "Deadline hit-rate 92%" are now computed, or show "Not enough data".
- Invented classification rules ("at risk", "protected", per-service stage lists), replaced by the backend's filing-stage enum and the seeded stage configuration.
- "Waiting for client / government" views. No field records this yet; see D11.

---

## 3. Decisions needed from the client (blocking go-live)

The import (`js/import.js`) logs 30 issues in the workbook. They reduce to these decisions:

| ID | Decision | Why it blocks |
|---|---|---|
| **D1** | Confirm each person's role (admin, sales manager, sales executive, agent). The workbook lists the same people as both "Assigned Sales" and "Assigned Agent", e.g. Raj is assigned patent task TSK-0001. | Roles decide what each user can see and edit |
| **D2** | Provide service name, team, priority and opened date for the **8 matters that are only in service sheets**: PAT-2023-007, TM-2024-014, TM-2023-022, DES-2024-003, DES-2025-011, CR-2025-003, ISO-2026-002, ISO-2025-006 | Without these, the matters have no owner and no dates |
| **D3** | Add **Stuffz Foods LLP** and **BaseCam Data Solutions Pvt Ltd** to Client Master, or name their client | Two trademarks currently have no client |
| **D4** | Resolve the possible duplicate **CL-0005 Dr. Kavya Reddy / Kavya Health Solutions** (flagged in their Migration Control sheet) | Duplicate accounts split history and billing |
| **D5** | Approve status mapping table **M2**. The judgement calls are: "FER reply filed" → *examination*, "Pending" (copyright) → *filed*, "Objected / Hearing" → *hearing*. | Drives every portfolio number |
| **D6** | The configured **Patent** pipeline has no Hearing / Opposition stage, so PAT-2014-014 (pre-grant opposition hearing) has no Kanban column. Add the stage(s)? | Patent Kanban can't place hearing matters |
| **D7** | Define service areas and stages for **ISO, Legal & Compliance, Startup** (used in the workbook, not configured) | No Kanban for these services |
| **D8** | Renewal dates are recorded on **unregistered** filings (TM-2025-031, TM-2024-014, DES-2025-011). Keep them as expected renewals or remove them? | Affects the renewals forecast |
| **D9** | Map the workbook's free-text document types ("Invention Disclosure", "Use Evidence", …) to the system's required-document types | Document completeness is 0% until they're mapped |
| **D10** | Confirm sales visibility of matters: **managers see all; executives see matters where they are the sales owner, own the lead, or own the client**. Read-only. | Implemented in the prototype; needs backend change |
| **D11** | Add a "waiting on" field (client / government / none) to matters? | Needed for the "Waiting for Client / Government" views |
| **D12** | The workbook is a **July 2026 snapshot**; the hearings on 12 and 14 Aug 2026 now show as overdue. Provide a fresh export before the final import. | Go-live data must be current |
| **D13** | Firm billing entity name(s) and the real service price list. The prototype price list is sample data. | Estimates and invoices need them |

---

## 4. Engineering work: prototype → live app

The live app is Next.js 15 + FastAPI + PostgreSQL. **Database changes are shipped as idempotent `.sql` files and run manually**; nobody applies DDL from code.

| # | Work item | Backend | Frontend |
|---|---|---|---|
| E1 | **One shell for all roles.** Replace the three layouts (`/crm`, `/agent`, `/admin`) with one layout and role-based nav (sidebar in section 2 of the prototype). Use the Agent Workspace tokens (`components/agent/workspace/tokens.ts`). | — | New shared layout; nav config per role |
| E2 | **Sales read-only matters** (D10) | Matter list/detail scope in the matters endpoints for `sales_manager` / `sales_executive`; read-only guard on every mutation; constants from `core/permissions.py` | Hide edit actions; "View only" badge |
| E3 | **Matters by service in nav + Kanban** | Existing `service_areas` / `service_stages`; "No stage" column already exists | Sidebar sub-items → `MattersCommandCenter` with the service pre-selected |
| E4 | **Legacy import job** (spec = `prototype/js/import.js`) | Script with **dry-run mode** that writes the issue report and imports nothing; idempotent upsert keyed on legacy IDs (`matter_number`, account number); renewal dates → `matter_deadlines` with `deadline_type = renewal / annuity / other` | — (issue report reviewed offline; no dedicated screen in MVP) |
| E5 | **My Portfolio (CEO)** | One aggregate endpoint: counts by `matter_applications.stage`, renewals from `matter_deadlines`, billed/collected from invoices, by client and by agent | Page as in the prototype |
| E6 | **Schema additions** (only if the client approves D6, D7, D11) | SQL files: new service stages; service areas for ISO / Legal / Startup; optional `matters.waiting_on` | — |
| E8 | **Configurable services** (section 4a) | Schema additions above as manual SQL files; stage-move endpoint enforces checks server-side; import reads the same configuration | Matter Services screen; Kanban, tables, cards, header key facts and form all built from the configuration; stage-move confirmation |
| E7 | **Remove sample data paths** | — | Prototype `data.js` is not carried into the app; every screen reads the API |

**Rollout:** build the unified shell **alongside** the current routes, behind a flag or separate route, and switch over only after the client signs off. Liking a design isn't approval to replace a live screen.

---

## 4a. Configurable matter services (stages, checks, forms) and how they drive the migration

**Decision (18 Nov 2026):** services are set up in the app, not hard-coded. In the prototype this is *Settings → Matter Services*.

| Part | What an admin sets | Existing backend piece | New backend work |
|---|---|---|---|
| Service | Name, matter-number prefix, “office filing” flag, which field is the application number and which is the registration number | `config.service_areas` | Add `is_filing`, `identity_field_key`, `registration_field_key` |
| Stages | Order, name, **filing step** (draft / filed / examination / objection / hearing / registered / rejected / abandoned) | `config.service_stages` (order, automatic deadline) | Add `phase` (enum) and `legacy_statuses` (text[]) |
| Stage checks | “Field must be filled” or “Confirmation” checks a matter must pass to enter the stage | — | New table `config.service_stage_checks`; record who ticked each confirmation and when (`matter_stage_confirmations`); admin override with a reason, audited |
| Form | Fields: name, type (text / date / number / dropdown / **file upload**), dropdown options or allowed file types, hint, required, and where it appears (*matter header / service list / Kanban card*) | `form_templates → form_sections → form_fields` (versioned); values in `matter_applications.form_data`; uploaded files in `matter_document_files` | Link a template to its service; add `is_key_fact`, `show_in_table`, `show_on_card`, `help_text`, `accept` to `form_fields`; a file field stores the document id, and the file also appears in the matter's Documents |

**Rules that keep reporting and data safe**
- Every stage of a filing service must have a filing step. Reports (portfolio, CEO view) count filing steps, so renaming or adding stages never changes the numbers.
- A field's key never changes, and a field that holds data can't be deleted. Changing a form creates a new template version, and old matters keep their values.
- Client, agent, priority and dates stay as fixed columns on the matter, not form fields, so every list and report can rely on them.

**How this drives the migration** (planned for later: the Excel-column setting is hidden from the setup screen for now; each field keeps its column in the background, so nothing needs redoing)
- Each form field records the **Excel column** it is imported from, so the import copies column → field directly.
- Each stage lists the **legacy status texts** that belong to it, so an imported matter lands on that stage and gets the stage's filing step.
- A column with no field, or a status with no stage, is reported, never guessed. The *Import mapping* tab shows this per service.
- The defaults are generated from the workbook (one field per column, with options from the recorded values) and the database's seeded stages. Phase links, status links and checks are marked **Proposed** until the client confirms them.
- Example: adding a *Hearing* stage to Patent and linking “Pre-grant opposition hearing pending” puts PAT-2014-014 on that stage and clears its import issue. This replaces client decisions D5–D7 with “the admin sets it up on screen”.
- In the prototype, saving the setup re-runs the import. In production the import is a migration step: run as a **dry run** against the approved setup, then the final run.

## 5. Phases and exit criteria

| Phase | Scope | Done when |
|---|---|---|
| **0 · Sign-off** | Client reviews the prototype; answers D1–D13 | All decisions recorded; M1–M5 mapping tables approved |
| **1 · Shell** | E1 | Every role sees the same layout and nav; all existing pages still work inside it; role-access tests pass |
| **2 · Sales sees matters** | E2, E3 | Sales manager and executive can open matters read-only; any write attempt returns 403; executive scope matches D10 |
| **3 · Migration** | E4, E6 | Dry run on a fresh export (D12) reports **0 errors**; warnings accepted by the client; the final import is repeatable with identical results |
| **4 · Portfolio** | E5 | Every figure reconciles with a SQL query documented beside it |
| **5 · Page redesigns** | One page at a time, as agreed | Per page: same data and actions as today, new design, client approval |

Durations are estimated after Phase 0, once the answers to D1–D13 are known.

---

## 6. Metric definitions (every derived number in the app)

| Metric | Formula | Source fields |
|---|---|---|
| **Matter health** | 100 − overdue deadlines (15 each, max 3) − deadlines due ≤ 7 days (5 each, max 3) − open official actions (10 each, max 2) − blocked tasks (8 each, max 3) − overdue tasks (6 each, max 3) − 12 if no activity for 14+ days − 20 × (share of required documents missing) − billing (7 if an invoice is overdue, else 3 if a balance is outstanding). Clamped 0–100. Bands: ≥ 80 Healthy, ≥ 60 Watch, ≥ 35 At Risk, else Critical. | Exact port of `compute_health` |
| **Document completeness** | Required document types present ÷ required for the IP type | `REQUIRED_DOCS` in `matter_intelligence.py`; document type codes |
| **Registered / Pending / Objection-hearing / Not filed / Refused** | Grouped from `matter_applications.stage`: registered · filed + examination · objection + hearing · draft · rejected + abandoned | Application stage (via M2 for legacy rows) |
| **Renewals** | Open deadlines of type renewal / annuity / surveillance | `matter_deadlines` |
| **Overdue** | Open deadline with due date before today | `matter_deadlines.due_date`, `is_completed` |
| **Avg cycle** | Mean of (last activity − opened) across closed matters with both dates; "Not enough data" otherwise | `matters` |
| **Deadline hit-rate** | Deadlines completed on or before their due date ÷ completed deadlines | `completed_at`, `due_date` |
| **Billed / collected / outstanding** | Σ invoice total / Σ amount paid / difference | Invoices |
| **Conversion rate** (CRM) | Converted leads ÷ all leads in scope | Leads |

---

## 7. Go-live checklist

- [ ] No sample records in production (`data.js` is not shipped)
- [ ] Final import dry run: 0 errors; every warning accepted in writing
- [ ] Every portfolio and dashboard number reconciles with its documented query
- [ ] Role tests: each of the four roles can reach only its modules, and sales can't modify matters
- [ ] Workbook re-exported after D12 and re-imported; the import is idempotent (a second run changes nothing)
- [ ] SQL migration files reviewed and run manually per environment (stag, then prod)
