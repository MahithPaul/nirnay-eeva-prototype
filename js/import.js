/* =========================================================================
   SERVICE CONFIGURATION + LEGACY IMPORT
   One configuration drives both the app and the migration:
     service → stages (each tied to a fixed filing phase, with checks to enter it
               and the legacy status texts that belong to it)
             → form fields (each tied to the Excel column it is imported from)
   Admins edit it in Settings → Matter Services. Saving re-runs the import, so
   the mapping is fixed in one place and the import uses that same mapping.

   Import principles
     1. Copy recorded values exactly. Never invent a value.
     2. Every conversion is defined in the configuration (or the small tables below).
     3. Anything that cannot be mapped is left empty AND logged in IMPORT_ISSUES.
   ========================================================================= */

/* Backend enum config.matter_applications.stage: the fixed "filing phase".
   Stages are free to rename/add; reports count phases, so they never break. */
const APP_STAGES = ["draft", "filed", "examination", "objection", "hearing", "registered", "rejected", "abandoned"];

/* ---- Building the default configuration ---------------------------------- */
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Columns that are choices rather than free text; options = the values recorded in the workbook.
const CHOICE_COLUMNS = ["Mark Type", "Specification Type", "Filing Route", "Priority Country", "Work Type"];
// Columns the service sheets use for identity / status (not form fields).
const NON_FIELD_COLUMNS = ["Matter ID", "Client ID"];

function fieldsFromSheet(sheet, statusColumn, flags) {
  const rows = LEGACY[sheet] || [];
  const cols = rows.length ? Object.keys(rows[0]) : [];
  return cols.filter((c) => !NON_FIELD_COLUMNS.includes(c) && c !== statusColumn).map((c) => {
    const vals = rows.map((r) => r[c]).filter((v) => v != null && v !== "");
    const type = CHOICE_COLUMNS.includes(c) ? "choice" : vals.length && vals.every((v) => ISO_DATE.test(String(v))) ? "date" : /Date|Due$/.test(c) && !vals.length ? "date" : "text";
    return {
      key: slug(c), label: c, excelColumn: c, type,
      options: type === "choice" ? [...new Set(vals.map(String))] : [],
      required: false,
      keyFact: (flags.keyFacts || []).includes(c), card: (flags.card || []).includes(c), table: (flags.keyFacts || []).includes(c),
    };
  });
}
const stage = (name, phase, legacyStatuses = [], checks = []) => ({ key: slug(name), name, phase, legacyStatuses, checks, autoDeadline: null });
const fieldCheck = (fieldKey, label) => ({ type: "field", field: fieldKey, label, proposed: true });

/* Stages = the service stages seeded in the database (config.service_stages, old_stg_DB.sql).
   Phase links, legacy-status links and checks are PROPOSED defaults for client sign-off. */
function defaultServiceConfig() {
  return { version: 1, services: [
    { name: "Trademark", prefix: "TM", isFiling: true, sheet: "Trademark", statusColumn: "Current Status", noField: "application_no", regField: "registration_no",
      stages: [
        stage("Draft", "draft"),
        stage("Filed", "filed", [], [fieldCheck("application_no", "Application No. is recorded"), fieldCheck("filing_date", "Filing Date is recorded")]),
        stage("Examination", "examination"),
        stage("Objection", "objection", ["Objected"], [fieldCheck("examination_report_date", "Examination Report Date is recorded")]),
        stage("Hearing", "hearing", ["Objected / Hearing"], [fieldCheck("hearing_date", "Hearing Date is recorded")]),
        stage("Registered", "registered", ["Registered"], [fieldCheck("registration_no", "Registration No. is recorded")]),
      ],
      fields: fieldsFromSheet("Trademark", "Current Status", { keyFacts: ["Application No.", "Mark", "Class", "Mark Type", "Filing Date", "Hearing Date", "Renewal Due"], card: ["Class", "Hearing Date"] }) },
    { name: "Patent", prefix: "PAT", isFiling: true, sheet: "Patent", statusColumn: "Current Status", noField: "application_no", regField: "patent_no",
      stages: [
        stage("Draft", "draft", ["Drafting / Filing Preparation"]),
        stage("Provisional Filed", "filed", [], [fieldCheck("application_no", "Application No. is recorded")]),
        stage("Complete Filed", "filed", [], [fieldCheck("application_no", "Application No. is recorded"), fieldCheck("filing_date", "Filing Date is recorded")]),
        stage("Publication", "filed", [], [fieldCheck("publication_no", "Publication No. is recorded")]),
        stage("Examination", "examination", ["FER reply filed"]),
        stage("Granted", "registered", [], [fieldCheck("patent_no", "Patent No. is recorded"), fieldCheck("grant_date", "Grant Date is recorded")]),
      ],
      fields: fieldsFromSheet("Patent", "Current Status", { keyFacts: ["Application No.", "Filing Date", "Publication No.", "FER Date", "FER Reply Date", "Hearing Date", "Grant Date"], card: ["FER Date", "Hearing Date"] }) },
    { name: "Design", prefix: "DES", isFiling: true, sheet: "Design", statusColumn: "Status", noField: "application_no", regField: "registration_no",
      stages: [
        stage("Draft", "draft"),
        stage("Filed", "filed", [], [fieldCheck("application_no", "Application No. is recorded")]),
        stage("Examination", "examination", ["Under examination"]),
        stage("Registered", "registered", ["Registered"], [fieldCheck("registration_no", "Registration No. is recorded")]),
      ],
      fields: fieldsFromSheet("Design", "Status", { keyFacts: ["Application No.", "Article Name", "Locarno Class", "Filing Date", "Registration Date", "Renewal Due"], card: ["Locarno Class", "Renewal Due"] }) },
    { name: "Copyright", prefix: "CR", isFiling: true, sheet: "Copyright", statusColumn: "Status", noField: "diary_no", regField: "registration_no",
      stages: [
        stage("Draft", "draft"),
        stage("Filed", "filed", ["Pending"], [fieldCheck("diary_no", "Diary No. is recorded")]),
        stage("Examination", "examination"),
        stage("Registered", "registered", ["Registered"], [fieldCheck("registration_no", "Registration No. is recorded")]),
      ],
      fields: fieldsFromSheet("Copyright", "Status", { keyFacts: ["Diary No.", "Work Type", "Author", "Owner", "Filing Date", "Registration Date"], card: ["Work Type", "Filing Date"] }) },
    // In the workbook but not configured in the database: form comes from the sheet, stages are left for the admin.
    { name: "ISO", prefix: "ISO", isFiling: false, sheet: "ISO", statusColumn: "Current Stage", noField: "certificate_no", regField: null, stages: [],
      fields: fieldsFromSheet("ISO", "Current Stage", { keyFacts: ["Standard", "Certification Body", "Certificate No.", "Initial Audit Date", "Expiry/Surveillance Due"], card: ["Standard", "Expiry/Surveillance Due"] }) },
    { name: "Legal & Compliance", prefix: "LEG", isFiling: false, sheet: null, statusColumn: null, noField: null, regField: null, stages: [], fields: [] },
    { name: "Startup", prefix: "DPIIT", isFiling: false, sheet: null, statusColumn: null, noField: null, regField: null, stages: [], fields: [] },
  ] };
}

const CONFIG_KEY = "eeva_service_config_v1";
let SERVICE_CONFIG;
try { SERVICE_CONFIG = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null"); } catch (e) { SERVICE_CONFIG = null; }
if (!SERVICE_CONFIG || !Array.isArray(SERVICE_CONFIG.services)) SERVICE_CONFIG = defaultServiceConfig();

const svcOf = (name) => SERVICE_CONFIG.services.find((s) => s.name === name) || null;
const SERVICE_STAGES = {};
SERVICE_CONFIG.services.forEach((s) => { if (s.stages.length) SERVICE_STAGES[s.name] = s.stages.map((x) => x.name); });
const UNCONFIGURED_SERVICES = SERVICE_CONFIG.services.filter((s) => !s.stages.length).map((s) => s.name);
const FILING_SERVICES = SERVICE_CONFIG.services.filter((s) => s.isFiling).map((s) => s.name);
const stageCfg = (service, stageName) => { const s = svcOf(service); return s ? s.stages.find((x) => x.name === stageName) || null : null; };

/* ---- Small mapping tables (need client sign-off) ------------------------- */
const PERSON_MAP = {
  "Srinivas Maddipati": "u1", "Vasantha": "u2", "Raj": "u3", "Saiteja": "u4",
  "Bhramaramba Maddipati": "u5", "Bhramaramba": "u5", "Divya": "u6", "Saikrishna": "u7",
};
const MATTER_STATUS_MAP = { "Active": "open", "Closed": "closed" };
const PRIORITY_MAP = { "Critical": "urgent", "High": "high", "Medium": "normal", "Low": "low" };
const TASK_STATUS_MAP = { "Not Started": "todo", "In Progress": "in_progress", "Completed": "completed" };
const INVOICE_STATUS_MAP = { "Paid": "PAID", "Part Paid": "PARTIALLY_PAID" };
const YES = (v) => String(v || "").trim().toLowerCase() === "yes";

/* Required document codes (REQUIRED_DOCS in backend services/matter_intelligence.py). */
const REQUIRED_DOCS = {
  Trademark: ["application_form", "power_of_attorney", "logo", "user_affidavit"],
  Patent: ["specification", "claims", "drawings", "form_1", "form_5"],
  Copyright: ["application_form", "work_copy", "noc"],
  Design: ["application_form", "representation_sheet", "power_of_attorney"],
};
const DOC_TYPE_MAP = {};

/* ---- Import ------------------------------------------------------------- */
const IMPORT_ISSUES = [];
const issue = (sheet, record, field, text, severity = "warning") => IMPORT_ISSUES.push({ sheet, record, field, text, severity });
const person = (name, sheet, rec, field) => {
  if (name == null || name === "") return null;
  if (PERSON_MAP[name]) return PERSON_MAP[name];
  issue(sheet, rec, field, `No user account for "${name}"`); return null;
};
const mapVal = (map, v, sheet, rec, field) => {
  if (v == null || v === "") return null;
  if (map[v] !== undefined) return map[v];
  issue(sheet, rec, field, `Value "${v}" has no mapping`); return null;
};

const L = LEGACY;
const entityToClient = {};
L["Client Master"].forEach((c) => { entityToClient[c["Legal Entity Name"]] = c["Client ID"]; });

const ACCOUNTS = L["Client Master"].map((c) => ({
  id: c["Client ID"], name: c["Legal Entity Name"], display: c["Display Name"] || c["Legal Entity Name"],
  group: c["Client Group"], type: c["Client Type"], industry: c["Industry"], cin: c["CIN/LLPIN"], gstin: c["GSTIN"],
  pan: c["PAN"], dpiit: c["DPIIT Recognition No."], udyam: c["MSME/Udyam No."], website: c["Website"],
  status: c["Status"], since: c["Client Since"], owner: person(c["Relationship Manager"], "Client Master", c["Client ID"], "Relationship Manager"),
  source: c["Lead Source"], notes: c["Notes"], portal: null, lastActivity: null, src: "legacy",
}));

const CONTACTS = L["Contact Master"].map((c) => ({
  id: c["Contact ID"], account: c["Client ID"], name: c["Name"], designation: c["Designation"], email: c["Email"],
  mobile: c["Mobile"], whatsapp: c["WhatsApp"], primary: YES(c["Primary Contact"]), billing: YES(c["Billing Contact"]),
  technical: YES(c["Technical Contact"]), remarks: c["Remarks"], src: "legacy",
}));

/* Matters = Matter Master ∪ every configured service sheet. */
const serviceRow = {};
SERVICE_CONFIG.services.filter((s) => s.sheet && L[s.sheet]).forEach((s) => L[s.sheet].forEach((r) => { serviceRow[r["Matter ID"]] = { svc: s, r }; }));
const masterRow = {};
L["Matter Master"].forEach((r) => { masterRow[r["Matter ID"]] = r; });
const matterIds = [...new Set([...Object.keys(masterRow), ...Object.keys(serviceRow)])];
const APPLICANT_COLUMNS = ["Applicant/Proprietor", "Applicant", "Owner"];

const MATTERS = matterIds.map((id) => {
  const mr = masterRow[id], sr = serviceRow[id];
  const category = mr ? mr["Service Category"] : sr.svc.name;
  const svc = svcOf(category);
  const sheet = sr ? sr.svc.sheet : "Matter Master";

  // Form data: every configured field, read from its Excel column. Unknown columns are logged.
  const app = {};
  if (sr) {
    const known = new Set(sr.svc.fields.map((f) => f.excelColumn).concat(NON_FIELD_COLUMNS, [sr.svc.statusColumn]));
    sr.svc.fields.forEach((f) => { const v = sr.r[f.excelColumn]; if (v != null && v !== "") app[f.key] = v; });
    Object.keys(sr.r).forEach((col) => { if (!known.has(col) && sr.r[col] != null && sr.r[col] !== "") issue(sheet, id, col, `Column "${col}" is not mapped to any ${sr.svc.name} form field, so its value was not imported`); });
  }

  // Client: Matter Master → sheet Client ID → exact legal-name match on the applicant column.
  let account = mr ? mr["Client ID"] : (sr && sr.r["Client ID"]) || null;
  if (!account && sr) {
    const col = APPLICANT_COLUMNS.find((c) => sr.r[c]);
    const applicant = col ? sr.r[col] : null;
    account = applicant ? entityToClient[applicant] || null : null;
    if (!account) issue(sheet, id, col || "Applicant", `Applicant "${applicant || "—"}" is not in Client Master, so the matter has no client`, "error");
  }
  if (!mr) issue(sheet, id, "Matter Master", "Matter is missing from Matter Master: no service name, team, priority or dates", "error");

  // Stage: the legacy status (service sheet, else Matter Master "Current Stage") is matched
  // against each configured stage's legacy-status list; the stage's phase becomes the filing phase.
  const legacyStatus = sr && sr.svc.statusColumn ? sr.r[sr.svc.statusColumn] : mr ? mr["Current Stage"] : null;
  let stageName = null, appStage = null;
  if (svc && legacyStatus) {
    const hit = svc.stages.find((s) => (s.legacyStatuses || []).includes(legacyStatus));
    if (hit) { stageName = hit.name; appStage = hit.phase || null; }
    else issue(sheet, id, sr ? sr.svc.statusColumn : "Current Stage", svc.stages.length
      ? `Status "${legacyStatus}" is not linked to any ${svc.name} stage (set it in Settings → Matter Services)`
      : `${svc.name} has no stages configured yet; recorded stage "${legacyStatus}" kept as text`, svc.stages.length ? "warning" : "info");
  }

  let status = mr ? mapVal(MATTER_STATUS_MAP, mr["Status"], "Matter Master", id, "Status") : appStage === "registered" ? "closed" : "open";
  if (!mr) issue(sheet, id, "status", `Status not recorded; set to "${status}" by import rule`, "info");

  return {
    id, src: "legacy", category, account,
    service: mr ? mr["Service Name"] : null,
    title: mr ? mr["Matter Title"] : (sr && (sr.r["Mark"] || sr.r["Title"] || sr.r["Article Name"] || sr.r["Standard"])) || id,
    status, appStage, legacyStatus, stage: stageName, legacyStage: legacyStatus, stageChecks: {},
    priority: mr ? mapVal(PRIORITY_MAP, mr["Priority"], "Matter Master", id, "Priority") || "normal" : "normal",
    owner: mr ? person(mr["Assigned Agent"], "Matter Master", id, "Assigned Agent") : null,
    sales: mr ? person(mr["Assigned Sales"], "Matter Master", id, "Assigned Sales") : null,
    reviewer: mr ? person(mr["Reviewer"], "Matter Master", id, "Reviewer") : null,
    opened: mr ? mr["Date Opened"] : null, due: mr ? mr["Due Date"] : null,
    lastActivity: mr ? mr["Last Activity"] : null, nextAction: mr ? mr["Next Action"] : null,
    billing: mr ? mr["Billing Status"] : null, remarks: mr ? mr["Remarks"] : null,
    lead: null, contributors: [], waitingClient: null, waitingGov: null, app,
  };
});

/* Deadlines: Deadlines sheet + renewal / surveillance dates recorded in the service sheets. */
const DEADLINES = L["Deadlines"].map((d) => ({
  id: d["Deadline ID"], matter: d["Matter ID"], type: d["Deadline Type"], kind: "other", due: d["Due Date"],
  reminders: [d["Reminder 1"], d["Reminder 2"], d["Reminder 3"]].filter(Boolean), done: YES(d["Completed"]),
  completedDate: d["Completed Date"], priority: PRIORITY_MAP[d["Priority"]] || "normal", remarks: d["Remarks"], src: "legacy",
}));
const RENEWAL_FIELDS = [["Trademark", "Renewal Due", "renewal"], ["Design", "Renewal Due", "renewal"], ["Patent", "Next Renewal Due", "annuity"], ["ISO", "Expiry/Surveillance Due", "surveillance"]];
RENEWAL_FIELDS.forEach(([sheet, field, kind]) => (L[sheet] || []).forEach((r) => {
  if (!r[field]) return;
  const m = MATTERS.find((x) => x.id === r["Matter ID"]);
  if (kind === "renewal" && m && m.appStage !== "registered") issue(sheet, r["Matter ID"], field, `${field} ${r[field]} is recorded but the application is not registered`);
  DEADLINES.push({ id: `${r["Matter ID"]}-${kind}`, matter: r["Matter ID"], type: kind === "surveillance" ? "Certificate expiry / surveillance" : kind === "annuity" ? "Patent annuity" : `${sheet} renewal`, kind, due: r[field], reminders: [], done: false, completedDate: null, priority: "normal", remarks: `From ${sheet} sheet, "${field}"`, src: "legacy" });
}));

const TASKS = L["Tasks"].map((t) => ({
  id: t["Task ID"], matter: t["Matter ID"], title: t["Task Name"], assignee: person(t["Assigned To"], "Tasks", t["Task ID"], "Assigned To"),
  createdBy: person(t["Created By"], "Tasks", t["Task ID"], "Created By"), priority: PRIORITY_MAP[t["Priority"]] || "normal",
  due: t["Due Date"], status: mapVal(TASK_STATUS_MAP, t["Status"], "Tasks", t["Task ID"], "Status") || "todo",
  completedDate: t["Completed Date"], hours: t["Hours Spent"] || 0, remarks: t["Remarks"], src: "legacy",
}));

const DOCUMENTS = L["Documents"].map((d) => {
  const code = DOC_TYPE_MAP[d["Document Type"]] || null;
  if (!code) issue("Documents", d["Document ID"], "Document Type", `"${d["Document Type"]}" does not match a system document type, so it doesn't count towards completeness`, "info");
  return { id: d["Document ID"], matter: d["Matter ID"], type: d["Document Type"], code, file: d["File Name"], version: d["Version"], path: d["Storage Path"], by: person(d["Uploaded By"], "Documents", d["Document ID"], "Uploaded By"), date: d["Upload Date"], ocr: YES(d["OCR Completed"]), ai: YES(d["AI Indexed"]), remarks: d["Remarks"], src: "legacy" };
});

const MATTER_ACTIVITIES = L["Activity Log"].map((a) => ({
  id: a["Activity ID"], matter: a["Matter ID"], date: a["Activity Date"], type: a["Activity Type"], text: a["Description"],
  by: person(a["Performed By"], "Activity Log", a["Activity ID"], "Performed By"), refs: a["Documents/References"],
  clientUpdated: YES(a["Client Updated"]), external: a["External Status"], nextAction: a["Next Action"], nextDue: a["Next Due Date"], src: "legacy",
}));

const INVOICES = L["Billing"].map((b) => ({
  id: b["Invoice No."], account: b["Client ID"], matter: b["Matter ID"], date: b["Invoice Date"], prof: b["Professional Fee"], govt: b["Government Fee"],
  gst: b["GST"], total: b["Invoice Total"], paid: b["Amount Paid"], status: mapVal(INVOICE_STATUS_MAP, b["Payment Status"], "Billing", b["Invoice No."], "Payment Status"),
  due: null, source: "Legacy import", firm: null, src: "legacy",
}));
const PAYMENTS = L["Billing"].filter((b) => b["Receipt No."]).map((b) => ({
  id: b["Receipt No."], invoice: b["Invoice No."], date: b["Payment Date"], amount: b["Amount Paid"], mode: b["Payment Mode"], verified: true, by: null, src: "legacy",
}));

ACCOUNTS.forEach((a) => {
  const dates = MATTERS.filter((m) => m.account === a.id && m.lastActivity).map((m) => m.lastActivity).sort();
  a.lastActivity = dates.length ? dates[dates.length - 1] : null;
});

const known = new Set(MATTERS.map((m) => m.id));
[["Tasks", TASKS], ["Documents", DOCUMENTS], ["Deadlines", DEADLINES], ["Activity Log", MATTER_ACTIVITIES], ["Billing", INVOICES]].forEach(([sheet, rows]) =>
  rows.forEach((r) => { if (!known.has(r.matter)) issue(sheet, r.id, "Matter ID", `Refers to matter ${r.matter}, which is not in Matter Master or any service sheet`, "error"); }));
L["Migration Control"].forEach((r) => {
  if (YES(r["Duplicate Flag"])) issue("Migration Control", r["Record ID"], "Duplicate Flag", `Flagged as possible duplicate: ${r["Remarks"]}`, "error");
  if (YES(r["Missing Data Flag"])) issue("Migration Control", r["Record ID"], "Missing Data Flag", `Flagged as missing data: ${r["Remarks"]}`);
});
ACCOUNTS.forEach((a) => { if (!CONTACTS.some((c) => c.account === a.id)) issue("Contact Master", a.id, "Client ID", `${a.display} has no contact`, "info"); });

const OFFICIAL_ACTIONS = [];
