/* =========================================================================
   SAMPLE DATA: fictional records for screens the legacy workbook does not
   cover (CRM pipeline, website portal, catalogue, blog).
   Rules:
     - Nothing here describes a real client. Sample prospects are fictional
       and are never linked to legacy accounts or matters.
     - Every page that shows these records is labelled "Sample data".
     - Real client data lives only in legacy-data.js (via import.js).
   Dates are relative to today so the sample pipeline stays current.
   ========================================================================= */

const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
const TODAY = isoOf(new Date());                  // real date, never fixed
const rel = (days) => { const dt = new Date(); dt.setDate(dt.getDate() + days); return isoOf(dt); };
const relAt = (days, hhmm) => `${rel(days)} ${hhmm}`;

/* People. Names match the people named in the legacy workbook.
   ROLE ASSIGNMENT IS AN ASSUMPTION: the workbook lists these people as both
   "Assigned Sales" and "Assigned Agent". Confirm each person's role with the client. */
const USERS = [
  { id: "u1", name: "Srinivas Maddipati",    role: "admin",           email: "srinivas@eeva.example",    title: "Managing Partner" },
  { id: "u2", name: "Vasantha",              role: "sales_manager",   email: "vasantha@eeva.example",    title: "Sales Manager" },
  { id: "u3", name: "Raj",                   role: "sales_executive", email: "raj@eeva.example",         title: "Sales Executive" },
  { id: "u4", name: "Saiteja",               role: "sales_executive", email: "saiteja@eeva.example",     title: "Sales Executive" },
  { id: "u5", name: "Bhramaramba Maddipati", role: "agent",           email: "bhramaramba@eeva.example", title: "Trademark Attorney" },
  { id: "u6", name: "Divya",                 role: "agent",           email: "divya@eeva.example",       title: "IP Associate" },
  { id: "u7", name: "Saikrishna",            role: "agent",           email: "saikrishna@eeva.example",  title: "Patent Agent" },
];
USERS.forEach((u) => Object.assign(u, { active: true, type: "", skillset: "", phone: "" }));

const DEMO_LOGINS = [
  { userId: "u1", role: "admin" },
  { userId: "u2", role: "sales_manager" },
  { userId: "u3", role: "sales_executive" },
  { userId: "u5", role: "agent" },
];
const ROLE_LABEL = { admin: "Admin", sales_manager: "Sales Manager", sales_executive: "Sales Executive", agent: "Agent" };

/* Sample price list: fees are placeholders until the firm's real catalogue is imported. */
const SERVICES = [
  { id: "s1", category: "Trademark", name: "Trademark Registration",         prof: 9000,  govt: 4500,  tat: "—" },
  { id: "s2", category: "Trademark", name: "Trademark Objection Reply",       prof: 6000,  govt: 0,     tat: "—" },
  { id: "s3", category: "Trademark", name: "Trademark Hearing",               prof: 12000, govt: 0,     tat: "—" },
  { id: "s4", category: "Patent",    name: "Complete Specification & Filing", prof: 75000, govt: 16000, tat: "—" },
  { id: "s5", category: "Patent",    name: "FER Response",                     prof: 35000, govt: 0,     tat: "—" },
  { id: "s6", category: "Design",    name: "Design Registration",             prof: 15000, govt: 4000,  tat: "—" },
  { id: "s7", category: "Copyright", name: "Software Copyright Registration", prof: 12000, govt: 500,   tat: "—" },
  { id: "s8", category: "Copyright", name: "Literary Work Copyright",         prof: 8000,  govt: 500,   tat: "—" },
];

/* ---- CRM pipeline (fictional prospects only) ---- */
const INQUIRIES = [
  { id: "INQ-1042", name: "Prakash Naidu", company: "Naidu Spices",   email: "prakash@naidu.example",  phone: "+91 90000 91001", service: "Trademark Registration",          message: "Want to register our spice brand logo.",       source: "Website",    status: "new",       assignedTo: null, created: rel(-2) },
  { id: "INQ-1041", name: "Harini S",      company: "Lumen Robotics", email: "harini@lumen.example",   phone: "+91 90000 91002", service: "Complete Specification & Filing", message: "Patent for a warehouse robot gripper.",       source: "Website",    status: "new",       assignedTo: null, created: rel(-3) },
  { id: "INQ-1039", name: "Ramesh Gupta",  company: "Gupta Textiles", email: "ramesh@gupta.example",   phone: "+91 90000 91003", service: "Design Registration",             message: "Saree border design protection.",            source: "Google Ads", status: "contacted", assignedTo: "u3", created: rel(-6) },
  { id: "INQ-1036", name: "Ayesha Khan",   company: "Brewhouse 9",    email: "ayesha@brewhouse.example", phone: "+91 90000 91004", service: "Trademark Registration",        message: "Cafe name check and filing.",                source: "Website",    status: "contacted", assignedTo: "u4", created: rel(-10) },
];

const LEAD_STAGES = [
  { key: "cold", label: "Cold" }, { key: "warm", label: "Warm" }, { key: "hot", label: "Hot" },
  { key: "converted", label: "Converted" }, { key: "lost", label: "Lost" },
];

const LEADS = [
  { id: "LD-S-001", title: "Patent: robotic gripper",   account: null, contactName: "Harini S",     company: "Lumen Robotics", phone: "+91 90000 91002", email: "harini@lumen.example",     service: "Complete Specification & Filing", category: "Patent",    status: "hot",       urgency: "time_bound", value: 107380, owner: "u3", createdBy: "u3", contributors: ["u7"], source: "Website",    nextFollowUp: rel(1),  created: rel(-16), matterId: null },
  { id: "LD-S-002", title: "Design: saree border set",  account: null, contactName: "Ramesh Gupta", company: "Gupta Textiles", phone: "+91 90000 91003", email: "ramesh@gupta.example",     service: "Design Registration",             category: "Design",    status: "warm",      urgency: "normal",     value: 22420,  owner: "u3", createdBy: "u3", contributors: [],     source: "Google Ads", nextFollowUp: rel(-3), created: rel(-6),  matterId: null },
  { id: "LD-S-003", title: "Brewhouse 9 wordmark",      account: null, contactName: "Ayesha Khan",  company: "Brewhouse 9",    phone: "+91 90000 91004", email: "ayesha@brewhouse.example", service: "Trademark Registration",          category: "Trademark", status: "warm",      urgency: "normal",     value: 15930,  owner: "u4", createdBy: "u4", contributors: ["u5"], source: "Website",    nextFollowUp: rel(2),  created: rel(-10), matterId: null },
  { id: "LD-S-004", title: "Orbit Labs software copyright", account: null, contactName: "Neha Iyer", company: "Orbit Labs",     phone: "+91 90000 91005", email: "neha@orbit.example",       service: "Software Copyright Registration", category: "Copyright", status: "cold",      urgency: "normal",     value: 14750,  owner: "u4", createdBy: "u4", contributors: [],     source: "Referral",   nextFollowUp: rel(7),  created: rel(-8),  matterId: null },
  { id: "LD-S-005", title: "Kavach Foods brand filing", account: null, contactName: "Arun Pillai",  company: "Kavach Foods",   phone: "+91 90000 91006", email: "arun@kavach.example",      service: "Trademark Registration",          category: "Trademark", status: "converted", urgency: "normal",     value: 15930,  owner: "u3", createdBy: "u3", contributors: ["u5"], source: "Referral",   nextFollowUp: null,    created: rel(-30), matterId: null },
  { id: "LD-S-006", title: "Vela Motors design pack",   account: null, contactName: "Kiran Rao",    company: "Vela Motors",    phone: "+91 90000 91007", email: "kiran@vela.example",       service: "Design Registration",             category: "Design",    status: "lost",      urgency: "normal",     value: 22420,  owner: "u3", createdBy: "u3", contributors: [],     source: "Website",    nextFollowUp: null,    created: rel(-40), matterId: null },
];
LEADS.forEach((l) => { l.entityType = "Private Limited"; });

const LEAD_ACTIVITIES = [
  { id: "LA1", lead: "LD-S-001", type: "call",     text: "Discovery call. Inventor wants filing before a trade show.", by: "u3", at: relAt(-15, "11:20") },
  { id: "LA2", lead: "LD-S-001", type: "meeting",  text: "Technical walkthrough with the patent agent.",               by: "u7", at: relAt(-9, "15:00") },
  { id: "LA3", lead: "LD-S-002", type: "whatsapp", text: "Shared sample design images; awaiting more variants.",      by: "u3", at: relAt(-5, "17:40") },
  { id: "LA4", lead: "LD-S-003", type: "call",     text: "Search report shared; one similar mark found.",              by: "u5", at: relAt(-4, "12:15") },
  { id: "LA5", lead: "LD-S-005", type: "meeting",  text: "Client accepted the estimate.",                               by: "u3", at: relAt(-2, "11:00") },
];

const ESTIMATES = [
  { id: "EST-S-003", lead: "LD-S-001", version: 2, status: "sent",      preparedBy: "u7", date: rel(-6),  items: [{ service: "Complete Specification & Filing", prof: 75000, govt: 16000 }, { service: "Prior-art search", prof: 12000, govt: 0 }] },
  { id: "EST-S-002", lead: "LD-S-001", version: 1, status: "revised",   preparedBy: "u3", date: rel(-12), items: [{ service: "Complete Specification & Filing", prof: 75000, govt: 16000 }] },
  { id: "EST-S-004", lead: "LD-S-003", version: 1, status: "draft",     preparedBy: "u5", date: rel(-4),  items: [{ service: "Trademark Registration", prof: 9000, govt: 4500 }] },
  { id: "EST-S-001", lead: "LD-S-005", version: 1, status: "converted", preparedBy: "u3", date: rel(-20), items: [{ service: "Trademark Registration", prof: 9000, govt: 4500 }] },
];
const FIRM = "Eeva (firm entity: confirm)";
ESTIMATES.forEach((e) => { e.firm = FIRM; const dt = new Date(e.date); dt.setDate(dt.getDate() + 30); e.validUntil = isoOf(dt); });

const REASSIGN_REQUESTS = [
  { id: "RR-S-1", lead: "LD-S-004", from: "u4", to: "u3", reason: "Raj handles software clients.", requestedBy: "u4", at: rel(-1), status: "pending" },
];

/* ---- Website portal (sample) ---- */
const APPLICATIONS = [
  { id: "APP-S-1", ref: "TMR-S-1", service: "Trademark Registration", variant: "Word mark · 1 class", customer: "Sample Customer A", email: "a@customer.example", agent: "u5", status: "under_review",      amount: 15930, date: rel(-6) },
  { id: "APP-S-2", ref: "CPR-S-2", service: "Copyright Registration", variant: "Literary work",       customer: "Sample Customer B", email: "b@customer.example", agent: "u6", status: "payment_submitted", amount: 10030, date: rel(-8) },
];
const CUSTOMERS = [
  { id: "c1", name: "Sample Customer A", email: "a@customer.example", apps: 1, spent: 15930, registered: rel(-7), active: true },
  { id: "c2", name: "Sample Customer B", email: "b@customer.example", apps: 1, spent: 0,     registered: rel(-9), active: true },
];
const PORTAL_PAYMENTS = [
  { id: "TXN-S-2", app: "APP-S-2", customer: "Sample Customer B", amount: 10030, method: "UPI", status: "pending_verification", date: rel(-8) },
  { id: "TXN-S-1", app: "APP-S-1", customer: "Sample Customer A", amount: 15930, method: "UPI", status: "verified",             date: rel(-6) },
];
const QR_CODES = [];
const BLOG_POSTS = [];
const DISCOUNTS = [];

/* Real: copied from app/(admin)/admin/roles/page.tsx SEED_PERMISSIONS (V=view C=create E=edit D=delete). */
const ROLE_PERMS = {
  "Dashboard":           { admin: "VCED", sales_manager: "V",    sales_executive: "V",   agent: "V" },
  "Team Members":        { admin: "VCED", sales_manager: "",     sales_executive: "",    agent: "" },
  "Customer Users":      { admin: "VCED", sales_manager: "V",    sales_executive: "V",   agent: "" },
  "CRM Leads":           { admin: "VCED", sales_manager: "VCED", sales_executive: "VCE", agent: "VE" },
  "Estimates":           { admin: "VCED", sales_manager: "VCED", sales_executive: "VCE", agent: "VCE" },
  "Services":            { admin: "VCED", sales_manager: "V",    sales_executive: "V",   agent: "V" },
  "Payments":            { admin: "VCED", sales_manager: "V",    sales_executive: "",    agent: "V" },
  "Discounts":           { admin: "VCED", sales_manager: "VCE",  sales_executive: "",    agent: "" },
  "Configuration":       { admin: "VCED", sales_manager: "",     sales_executive: "",    agent: "" },
  "Roles & Permissions": { admin: "VCED", sales_manager: "",     sales_executive: "",    agent: "" },
};

/* Real: backend enums */
const TASK_STATUSES = [
  { key: "todo", label: "To Do" }, { key: "in_progress", label: "In Progress" },
  { key: "waiting_review", label: "Waiting Review" }, { key: "completed", label: "Completed" },
];

/* Actions taken in this prototype are logged here (starts empty: no invented history). */
const AUDIT = [];
const CONFIG_ITEMS = [];
