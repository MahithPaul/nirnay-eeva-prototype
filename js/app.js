/* =========================================================================
   EEVA ERP: unified workspace prototype
   One shell, one design system, one navigation model for every role.
   Every screen mirrors a screen in the existing application:
     CRM   (/crm/*)    : Dashboard, Accounts, Leads, Inquiry Leads, Inbox, Estimates, Invoices, Reports
     Agent (/agent/*)  : Agent Workspace, Related Accounts, Leads, Matters, Deadlines, Tasks,
                         My Applications, Payments, Matter Settings
     Admin (/admin/*)  : Dashboard, Matters, Invoices, Finance & Payments, Service Management,
                         Discounts, Configuration, Blog Posts, Team Members, Roles & Permissions,
                         Customer Users
   Access follows the CURRENT rules (ROLE_ACCESS_PPT_CONTEXT.md):
     gate  = which modules a role can open (NAV)
     scope = which records it sees inside a module (S.*)
   ========================================================================= */
(function () {
  "use strict";

  /* ================================================================ helpers */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Missing dates stay missing: NaN makes every "is it overdue / soon" comparison false.
  const toUTC = (d) => { if (!d) return NaN; const [y, m, dd] = String(d).slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, dd); };
  const byDate = (a, b) => (isNaN(a) ? 1 : isNaN(b) ? -1 : a - b);
  const fmtDate = (d) => { if (!d) return "—"; const [y, m, dd] = d.slice(0, 10).split("-"); return `${+dd} ${MONTHS[+m - 1]} ${y}`; };
  const daysFrom = (d) => Math.round((byDate(toUTC(d), toUTC(TODAY))) / 864e5);
  const addDays = (d, n) => new Date(toUTC(d) + n * 864e5).toISOString().slice(0, 10);
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  // Same rules as formatINR in components/agent/workspace/tokens.ts.
  const inrShort = (n) => { n = Number(n) || 0; const a = Math.abs(n); if (!a) return "₹0"; if (a >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`; if (a >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`; if (a >= 1e3) return `₹${Math.round(n / 1e3)}K`; return `₹${Math.round(n)}`; };
  const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const user = (id) => USERS.find((u) => u.id === id);
  const uname = (id) => (user(id) ? user(id).name : "Unassigned");
  // A matter whose applicant is not in Client Master has no account: say so, don't hide it.
  const acct = (id) => ACCOUNTS.find((a) => a.id === id) || { id: null, name: "Unlinked client", display: "Unlinked client", type: "", industry: "", owner: null, missing: true };
  const lead = (id) => LEADS.find((l) => l.id === id);
  const matter = (id) => MATTERS.find((m) => m.id === id);
  const nowStamp = () => TODAY + " " + new Date().toTimeString().slice(0, 5);
  const nextId = (prefix, list, pad = 4) => {
    const n = list.reduce((mx, x) => { const m = String(x.id).match(/(\d+)$/); return m ? Math.max(mx, +m[1]) : mx; }, 0) + 1;
    return prefix + String(n).padStart(pad, "0");
  };
  const opts = (items, sel) => items.map((i) => `<option value="${esc(i.value)}"${String(i.value) === String(sel) ? " selected" : ""}>${esc(i.label)}</option>`).join("");
  const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
  const cap = (s) => String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const OPEN = (l) => !["converted", "lost"].includes(l.status);

  /* ------------------------------------------------------------------ icons */
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    accounts: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    leads: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    inquiries: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    estimates: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    invoices: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M16 8H8M16 12H8M13 16H8"/>',
    matters: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    deadlines: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v3l2 1"/>',
    tasks: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    applications: '<path d="M15 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M15 2v5h5M4 8v12a2 2 0 0 0 2 2h10"/>',
    payments: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>',
    pipeline: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
    conversion: '<path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    services: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    discounts: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    config: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    blog: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/><path d="M20 22H6.5A2.5 2.5 0 0 1 4 19.5"/>',
    team: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    roles: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    users: '<circle cx="12" cy="7" r="4"/><path d="M5.5 21a7.5 7.5 0 0 1 13 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    rupee: '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    note: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    kanban: '<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="8" rx="1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    setup: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    portfolio: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    "chev-l": '<path d="M15 18l-6-6 6-6"/>',
    "chev-r": '<path d="M9 18l6-6-6-6"/>',
    migration: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
  };
  const ic = (k, size = 16) => `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[k] || ""}</svg>`;

  /* ============================================================ persistence */
  // Every change is saved to localStorage, so the demo survives a reload.
  // Arrays from data.js are updated in place, so every reference stays valid.
  const STORE_KEY = "eeva_mvp_v3"; // v3 = legacy-workbook import; older saves held invented demo data and are ignored
  const TABLES = { USERS, ACCOUNTS, CONTACTS, INQUIRIES, LEADS, LEAD_ACTIVITIES, ESTIMATES, MATTERS, TASKS, DEADLINES, DOCUMENTS, MATTER_ACTIVITIES, INVOICES, PAYMENTS, REASSIGN_REQUESTS, DISCOUNTS, AUDIT, OFFICIAL_ACTIONS, APPLICATIONS, CUSTOMERS, PORTAL_PAYMENTS, QR_CODES, BLOG_POSTS };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved) Object.keys(TABLES).forEach((k) => { if (Array.isArray(saved[k])) TABLES[k].splice(0, TABLES[k].length, ...saved[k]); });
  } catch (e) { /* storage blocked or corrupt: use sample data */ }
  const saveData = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(TABLES)); } catch (e) { /* ignore */ } };
  const resetData = () => { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } location.reload(); };

  /* ================================================================ session */
  const state = { me: null, ui: {} };
  try { const s = localStorage.getItem("eeva_proto_user"); if (s && user(s)) state.me = user(s); } catch (e) { /* ignore */ }
  // Demo shortcut: index.html?as=u5#/matters opens straight into a role.
  try { const as = new URLSearchParams(location.search).get("as"); if (as && user(as)) state.me = user(as); } catch (e) { /* ignore */ }
  const saveSession = () => { try { state.me ? localStorage.setItem("eeva_proto_user", state.me.id) : localStorage.removeItem("eeva_proto_user"); } catch (e) { /* ignore */ } };
  const ui = (page) => (state.ui[page] = state.ui[page] || {});
  const is = (...roles) => roles.includes(state.me.role);
  const audit = (action, target) => AUDIT.unshift({ at: nowStamp(), actor: state.me.id, action, target });

  /* =================================================== gate: navigation */
  // One sidebar for every role (client ask: CRM and agent staff share the same UI).
  // Groups always appear in the same order, following the work: Sales → Matters → Finance → Admin.
  // "matters" also expands into per-service pipelines (see SERVICE_NAV).
  const NAV = {
    sales_executive: [
      { label: null, items: ["dashboard"] },
      { label: "Sales", items: ["inquiries", "leads", "accounts", "estimates"] },
      { label: "Matters", items: ["matters"] },
      { label: "Finance", items: ["invoices"] },
    ],
    sales_manager: [
      { label: null, items: ["dashboard"] },
      { label: "Sales", items: ["inquiries", "leads", "accounts", "estimates", "inbox"] },
      { label: "Matters", items: ["matters"] },
      { label: "Finance", items: ["invoices"] },
    ],
    agent: [
      { label: null, items: ["dashboard"] },
      { label: "Sales", items: ["leads", "accounts"] },
      { label: "Matters", items: ["matters", "deadlines", "tasks", "applications"] },
      { label: "Finance", items: ["payments"] },
      { label: "Settings", items: ["setup", "settings"] },
    ],
    admin: [
      { label: null, items: ["dashboard", "portfolio"] },
      { label: "Sales", items: ["inquiries", "leads", "accounts", "estimates", "inbox"] },
      { label: "Matters", items: ["matters", "deadlines", "tasks", "applications"] },
      { label: "Finance", items: ["invoices", "payments"] },
      { label: "Reports", items: ["pipeline", "conversion"] },
      { label: "Firm Setup", items: ["setup", "services", "discounts", "config", "blog"] },
      { label: "Access Control", items: ["team", "roles", "users"] },
    ],
  };
  // The client's core services always show under Matters; other service areas appear when they have matters.
  const SERVICE_NAV = ["Trademark", "Patent", "Design", "Copyright", "ISO"];
  const LABEL = {
    dashboard: "Dashboard", accounts: "Accounts", leads: "Leads", inquiries: "Inquiry Leads", inbox: "Inbox",
    estimates: "Estimates", invoices: "Invoices", matters: "Matters", deadlines: "Deadlines", tasks: "Tasks",
    applications: "Applications", payments: "Payments", settings: "Matter Settings", pipeline: "Pipeline Report",
    conversion: "Conversion Stats", services: "Service Management", discounts: "Discounts", config: "Configuration",
    blog: "Blog Posts", team: "Team Members", roles: "Roles & Permissions", users: "Customer Users",
    migration: "Data Migration", portfolio: "My Portfolio", setup: "Matter Services",
  };
  const label = (k) => {
    if (k === "accounts" && is("agent")) return "Related Accounts";
    if (k === "applications" && is("agent")) return "My Applications";
    if (k === "payments" && is("admin")) return "Finance & Payments";
    if (k === "matters") return "All Matters";
    return LABEL[k] || k;
  };
  const SECTION_OF = (k) => { for (const g of NAV[state.me.role]) if (g.items.includes(k)) return g.label || ""; return ""; };
  const DETAIL_PARENT = { lead: "leads", account: "accounts", matter: "matters", estimate: "estimates" };
  // Agents have no Estimates menu (same as today) but open estimates from a lead.
  const canOpen = (page) => (page === "estimate" && is("agent")) || NAV[state.me.role].some((g) => g.items.includes(DETAIL_PARENT[page] || page));

  /* ======================================================= scope: records */
  const S = {
    leads() {
      const me = state.me.id;
      if (is("admin", "sales_manager")) return LEADS;
      if (is("sales_executive")) return LEADS.filter((l) => l.owner === me || l.createdBy === me || l.contributors.includes(me));
      return LEADS.filter((l) => l.contributors.includes(me) || l.createdBy === me);
    },
    matters() {
      if (is("admin")) return MATTERS;
      if (is("agent")) { const me = state.me.id; return MATTERS.filter((m) => m.owner === me || m.reviewer === me || m.contributors.includes(me) || TASKS.some((t) => t.matter === m.id && t.assignee === me)); }
      // Client ask: sales must be able to answer "what's the status?" calls.
      // Read-only: managers see every matter; executives see matters from their accounts/leads.
      if (is("sales_manager")) return MATTERS;
      if (is("sales_executive")) { const me = state.me.id; return MATTERS.filter((m) => m.sales === me || (m.lead && lead(m.lead) && lead(m.lead).owner === me) || acct(m.account).owner === me); }
      return [];
    },
    accounts() {
      if (is("admin", "sales_manager")) return ACCOUNTS;
      const ids = new Set();
      S.leads().forEach((l) => l.account && ids.add(l.account));
      if (is("sales_executive")) ACCOUNTS.filter((a) => a.owner === state.me.id).forEach((a) => ids.add(a.id));
      if (is("agent", "sales_executive")) S.matters().forEach((m) => m.account && ids.add(m.account));
      return ACCOUNTS.filter((a) => ids.has(a.id));
    },
    inquiries() {
      if (is("admin", "sales_manager")) return INQUIRIES;
      if (is("sales_executive")) return INQUIRIES.filter((i) => i.assignedTo === state.me.id);
      return [];
    },
    estimates() {
      if (is("admin", "sales_manager")) return ESTIMATES;
      const mine = new Set(S.leads().map((l) => l.id));
      return ESTIMATES.filter((e) => e.preparedBy === state.me.id || mine.has(e.lead));
    },
    invoices() {
      if (is("admin", "sales_manager")) return INVOICES;
      if (is("sales_executive")) { const a = new Set(ACCOUNTS.filter((x) => x.owner === state.me.id).map((x) => x.id)); return INVOICES.filter((i) => a.has(i.account)); }
      const m = new Set(S.matters().map((x) => x.id)); return INVOICES.filter((i) => m.has(i.matter));
    },
    tasks() { if (is("admin")) return TASKS; const m = new Set(S.matters().map((x) => x.id)); return TASKS.filter((t) => t.assignee === state.me.id || m.has(t.matter) || !t.assignee); },
    deadlines() { const m = new Set(S.matters().map((x) => x.id)); return DEADLINES.filter((d) => m.has(d.matter)); },
    applications() { return is("admin") ? APPLICATIONS : APPLICATIONS.filter((a) => a.agent === state.me.id); },
  };

  const can = {
    editLead: (l) => is("admin", "sales_manager") || (is("sales_executive") && (l.owner === state.me.id || l.contributors.includes(state.me.id))) || (is("agent") && l.contributors.includes(state.me.id)),
    moveLead: (l) => is("admin", "sales_manager") || (is("sales_executive") && (l.owner === state.me.id || l.contributors.includes(state.me.id))),
    deleteLead: () => is("admin", "sales_manager"),
    assign: () => is("admin", "sales_manager"),
    addAgent: (l) => is("admin", "sales_manager") || (is("sales_executive") && l.owner === state.me.id),
    createMatter: () => is("admin", "agent"),
    workMatter: (m) => is("admin") || (is("agent") && (m.owner === state.me.id || m.reviewer === state.me.id || m.contributors.includes(state.me.id))),
    verifyPayment: () => is("admin"),
  };

  /* ===================================================== status badges */
  const TONE = { "d-rust": "red", "d-ink": "blue", "d-g1": "amber", "d-g2": "green", "d-g3": "gray", "d-hollow": "slate" };
  const badge = (tone, text) => `<span class="status tone-${TONE[tone] || tone}"><i class="dot"></i>${esc(text)}</span>`;
  const LEAD_STAGES_UI = LEAD_STAGES;
  const leadStatus = (s) => ({ hot: badge("red", "Hot"), warm: badge("orange", "Warm"), cold: badge("blue", "Cold"), converted: badge("green", "Converted"), lost: badge("gray", "Lost") }[s] || esc(s));
  const urgency = (u) => ({ normal: badge("slate", "Normal"), time_bound: badge("amber", "Time-bound"), litigation_urgent: badge("red", "Litigation Urgent") }[u] || badge("gray", "Not set"));
  const priority = (p) => ({ urgent: badge("red", "Urgent"), high: badge("orange", "High"), normal: badge("blue", "Normal"), low: badge("slate", "Low") }[p] || esc(p));
  const matterStatus = (s) => ({ open: badge("teal", "Open"), in_progress: badge("blue", "In Progress"), on_hold: badge("amber", "On Hold"), closed: badge("green", "Closed"), archived: badge("gray", "Archived") }[s] || esc(s));
  const taskStatus = (s) => ({ todo: badge("slate", "To Do"), in_progress: badge("blue", "In Progress"), waiting_review: badge("purple", "Waiting Review"), blocked: badge("red", "Blocked"), completed: badge("green", "Completed"), cancelled: badge("gray", "Cancelled") }[s] || esc(s));
  const inqStatus = (i) => (i.notRelevant ? badge("gray", "Not Relevant") : ({ new: badge("blue", "New"), contacted: badge("amber", "Contacted"), converted: badge("green", "Converted"), not_interested: badge("gray", "Not Interested") }[i.status] || esc(i.status)));
  const estStatus = (s) => ({ draft: badge("slate", "Draft"), sent: badge("blue", "Sent"), viewed: badge("purple", "Viewed"), approved: badge("teal", "Approved"), converted: badge("green", "Converted"), expired: badge("gray", "Expired"), revised: badge("gray", "Revised") }[s] || esc(s));
  const invStatus = (s) => ({ GENERATED: badge("slate", "Draft"), SENT: badge("blue", "Sent"), UNDER_VERIFICATION: badge("purple", "Under Verification"), PARTIALLY_PAID: badge("amber", "Partially Paid"), PAID: badge("green", "Paid"), OVERDUE: badge("red", "Overdue"), CANCELLED: badge("gray", "Cancelled") }[s] || esc(s));
  const appStatus = (s) => ({ draft: badge("slate", "Draft"), payment_pending: badge("amber", "Payment Pending"), payment_submitted: badge("purple", "Payment Submitted"), submitted: badge("blue", "Submitted"), under_review: badge("teal", "Under Review"), approved: badge("green", "Approved"), payment_rejected: badge("red", "Payment Rejected"), completed: badge("green", "Completed") }[s] || esc(s));
  const payStatus = (s) => ({ pending_user: badge("amber", "Pending (User)"), pending_verification: badge("purple", "Pending Verification"), verified: badge("green", "Verified"), rejected: badge("red", "Rejected") }[s] || esc(s));
  const oaStatus = (s) => ({ pending: badge("amber", "Pending"), response_filed: badge("blue", "Response Filed"), hearing_scheduled: badge("purple", "Hearing Scheduled"), resolved: badge("green", "Resolved"), abandoned: badge("gray", "Abandoned") }[s] || esc(s));
  const severity = (s) => ({ info: badge("slate", "Info"), routine: badge("blue", "Routine"), elevated: badge("orange", "Elevated"), critical: badge("red", "Critical") }[s] || esc(s));
  const dueStatus = (d, done) => {
    if (done) return badge("green", "Done");
    if (!d) return badge("gray", "No due date");
    const n = daysFrom(d);
    if (n < 0) return badge("red", `Overdue ${-n}d`);
    if (n === 0) return badge("red", "Due today");
    if (n === 1) return badge("orange", "Tomorrow");
    if (n <= 7) return badge("orange", `In ${n}d`);
    return badge("slate", fmtDate(d));
  };
  const avatar = (id, sm) => (id && user(id) ? `<span class="avatar${sm ? " sm" : ""}" title="${esc(uname(id))}">${esc(initials(uname(id)))}</span>` : `<span class="avatar sm light" title="Unassigned">?</span>`);
  const person = (id) => (id ? `<span class="person">${avatar(id, true)}<span>${esc(uname(id))}</span></span>` : '<span class="muted">Unassigned</span>');
  // Deadline row: calendar tile · title + meta · how far off it is · owner.
  // Colour lives in the tile's month band and the countdown only, so a run of
  // overdue rows reads as "late" without turning into a wall of red.
  // `meta` items are already-escaped HTML; empty ones are dropped.
  const dlRelative = (n) => {
    if (n < -59) return `${Math.round(-n / 30)} mo overdue`;
    if (n < 0) return `${-n}d overdue`;
    if (n === 0) return "Due today";
    if (n === 1) return "Tomorrow";
    return `In ${n}d`;
  };
  const dlRow = ({ href, due, title, meta = [], owner, showOwner = true }) => {
    const n = daysFrom(due);
    const tone = n < 0 ? "over" : n === 0 ? "today" : n <= 7 ? "soon" : "";
    const [y, mo, dd] = String(due || "").slice(0, 10).split("-");
    const band = due ? `${MONTHS[+mo - 1]}${y !== TODAY.slice(0, 4) ? ` ’${y.slice(2)}` : ""}` : "—";
    const who = !showOwner ? "" : owner && user(owner) ? avatar(owner, true) : '<span class="avatar sm none" title="Unassigned">?</span>';
    return `<a class="dl-row" href="${href}">
      <span class="dl-date ${tone}" title="${esc(fmtDate(due))}"><small>${esc(band)}</small><b>${due ? +dd : "—"}</b></span>
      <span class="grow"><span class="t">${esc(title)}</span><small class="dl-meta">${meta.filter(Boolean).map((p) => `<span>${p}</span>`).join("")}</small></span>
      <span class="dl-when ${tone}">${due ? dlRelative(n) : "No date"}</span>${who}
    </a>`;
  };
  const estTotal = (e) => { const sub = sum(e.items, (i) => i.prof + i.govt); const gst = Math.round(sum(e.items, (i) => i.prof) * 0.18); return { sub, gst, total: sub + gst }; };
  const lockedMatter = (id) => `<span class="locked" title="Matters are visible to the delivery team only">${ic("lock", 12)}<span class="mono">${esc(id)}</span></span>`;
  const matterLink = (id) => (canOpen("matter") && S.matters().some((m) => m.id === id) ? `<a class="mono" href="#/matter/${esc(id)}">${esc(id)}</a>` : lockedMatter(id));
  const stagesOf = (m) => SERVICE_STAGES[m.category] || [];
  // Values from the workbook keep their wording; ISO dates are just formatted for reading.
  const showVal = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDate(v) : esc(v));
  // Stage colour by meaning (keyword match on the stage name); unmatched stages cycle the palette by position.
  const STAGE_TONES = [
    [/regist|grant|issu|complet|clos|certif|renew/i, "green"],
    [/object|oppos|refus|reject|office action|cancel/i, "red"],
    [/hearing|respon|reply|appeal/i, "orange"],
    [/exam|review|search|scrutin/i, "purple"],
    [/publi|advert|journal/i, "amber"],
    [/draft|prepar/i, "teal"],
    [/fil|appl|intake|submit/i, "blue"],
  ];
  const TONE_CYCLE = ["blue", "teal", "purple", "amber", "orange", "green"];
  const stageTone = (s, i) => (STAGE_TONES.find(([re]) => re.test(s)) || [null, TONE_CYCLE[i % TONE_CYCLE.length]])[1];

  const statusbar = (steps, current, opt = {}) => {
    const idx = steps.indexOf(current);
    return `<div class="statusbar${opt.line ? " lined" : ""}${opt.tones ? " toned" : ""}">${steps.map((s, i) => {
      const tone = opt.tones ? ` tone-${stageTone(s, i)}` : "";
      const cls = (opt.lost ? "lost" : i < idx ? "done" : i === idx ? "current" : "") + tone;
      // Connector line before each step after the first; filled up to and including the current step.
      const link = opt.line && i > 0 ? `<span class="sb-line${!opt.lost && i <= idx ? " done" : ""}${tone}" aria-hidden="true"></span>` : "";
      return link + (opt.act ? `<button class="step ${cls}" title="${esc(s)}" data-act="${opt.act}" data-id="${esc(opt.id)}" data-val="${esc(s)}">${esc(s)}</button>` : `<div class="step ${cls}" title="${esc(s)}">${esc(s)}</div>`);
    }).join("")}</div>`;
  };

  // Document completeness: exact port of compute_doc_completeness
  // (backend/services/matter_intelligence.py): required codes per IP type vs. typed documents present.
  function docCompleteness(m) {
    const req = REQUIRED_DOCS[m.category] || [];
    const present = new Set(DOCUMENTS.filter((d) => d.matter === m.id && d.code).map((d) => d.code));
    const missing = req.filter((c) => !present.has(c));
    return { required: req.length, present: req.length - missing.length, pct: req.length ? Math.round((100 * (req.length - missing.length)) / req.length) : 100, missing };
  }

  // Health score: exact port of compute_health (backend/services/matter_intelligence.py).
  // Starts at 100; each rule below is the backend's rule and weight. Nothing else is added.
  function matterHealth(m) {
    let score = 100; const factors = [];
    const hit = (t, delta, sev) => { score += delta; factors.push({ t, delta, sev }); };
    const dls = DEADLINES.filter((d) => d.matter === m.id && !d.done);
    const overdue = dls.filter((d) => daysFrom(d.due) < 0);
    const soon = dls.filter((d) => { const n = daysFrom(d.due); return n >= 0 && n <= 7; });
    const oas = OFFICIAL_ACTIONS.filter((o) => o.matter === m.id && ["pending", "hearing_scheduled"].includes(o.status));
    const blocked = TASKS.filter((t) => t.matter === m.id && t.status === "blocked");
    const lateTasks = TASKS.filter((t) => t.matter === m.id && t.due && !["completed", "cancelled"].includes(t.status) && daysFrom(t.due) < 0);
    if (overdue.length) hit(`${overdue.length} overdue deadline${overdue.length > 1 ? "s" : ""}`, -15 * Math.min(overdue.length, 3), "critical");
    if (soon.length) hit(`${soon.length} due within 7 days`, -5 * Math.min(soon.length, 3), "elevated");
    if (oas.length) hit(`${oas.length} open official action${oas.length > 1 ? "s" : ""}`, -10 * Math.min(oas.length, 2), "elevated");
    if (blocked.length) hit(`${blocked.length} blocked task${blocked.length > 1 ? "s" : ""}`, -8 * Math.min(blocked.length, 3), "routine");
    if (lateTasks.length) hit(`${lateTasks.length} task(s) past due`, -6 * Math.min(lateTasks.length, 3), "elevated");
    if (m.lastActivity && daysFrom(m.lastActivity) < -14) hit(`No activity for ${-daysFrom(m.lastActivity)} days`, -12, "routine");
    const dc = docCompleteness(m);
    if (dc.required && dc.present < dc.required) hit(`${dc.present}/${dc.required} required docs present`, -Math.round(20 * (1 - dc.present / dc.required)), "routine");
    const invs = INVOICES.filter((i) => i.matter === m.id);
    if (invs.length) {
      const overdueInv = invs.filter((i) => i.due && i.total > i.paid && daysFrom(i.due) < 0);
      if (overdueInv.length) hit(`${overdueInv.length} invoice(s) overdue`, -7, "routine");
      else if (sum(invs, (i) => i.total - i.paid) > 0) hit("Client payment pending", -3, "info");
    }
    score = Math.max(0, Math.min(100, score));
    const band = score >= 80 ? "Healthy" : score >= 60 ? "Watch" : score >= 35 ? "At Risk" : "Critical";
    return { score, band, factors };
  }

  /* ================================================================ router */
  function parseHash() {
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
    return { page: parts[0] || (state.me ? "dashboard" : "login"), id: parts[1] ? decodeURIComponent(parts[1]) : null };
  }
  const go = (path) => { if (location.hash === "#/" + path) render(); else location.hash = "#/" + path; };

  function render() {
    saveData(); // every mutation ends in render(), so this persists all changes
    const { page, id } = parseHash();
    closeLayer();
    if (!state.me) { renderLogin(); return; }
    if (page === "login") { go("dashboard"); return; }
    let view;
    if (!PAGES[page]) view = notFound("This page doesn't exist.");
    else if (!canOpen(page)) view = noAccess(page);
    else { try { view = PAGES[page](id); } catch (err) { console.error(err); view = notFound("Something went wrong rendering this page."); } }
    // Entrance animation plays on navigation only, not on every in-page re-render.
    const path = location.hash;
    state.samePage = state.lastPath === path;
    const y = window.scrollY;
    renderShell(page, view);
    if (view.after) view.after();
    window.scrollTo(0, state.samePage ? y : 0);
    state.lastPath = path;
  }
  const notFound = (msg) => ({ crumbs: ["Not found"], html: `<div class="panel"><div class="empty">${esc(msg)} <a href="#/dashboard">Back to dashboard</a></div></div>` });
  const noAccess = (page) => ({ crumbs: [LABEL[DETAIL_PARENT[page] || page] || page], html: `<div class="panel"><div class="empty">${ic("lock")} Your role (${esc(ROLE_LABEL[state.me.role])}) doesn't have access to this module.</div></div>` });

  /* ================================================================= login */
  function renderLogin() {
    const L = ui("login");
    $("#app").innerHTML = `
      <div class="login-wrap">
        <section class="login-brand">
          <div class="brand-mark"><span class="seal">E</span>EEVA <small>Workspace</small></div>
          <div>
            <h1>One workspace for sales, legal delivery and billing.</h1>
            <p>Accounts, leads, estimates, matters, deadlines and invoices for the whole firm, with access set by role.</p>
            <div class="login-flow"><span class="step">Inquiry</span>→<span class="step">Lead</span>→<span class="step">Estimate</span>→<span class="step">Converted</span>→<span class="step">Matter</span>→<span class="step">Registered</span></div>
          </div>
          <div class="small" style="color:#7F98B8">Prototype · sample data from the legacy migration workbook</div>
        </section>
        <section class="login-panel">
          <form class="login-card" data-form="login" autocomplete="off">
            <h2>Sign in</h2>
            <p class="sub" style="margin:0 0 22px">Use your work email to continue.</p>
            <div class="field"><label for="lg-email">Email</label><input id="lg-email" class="input" name="email" type="email" placeholder="name@eeva.in" value="${esc(L.email || "")}" /></div>
            <div class="field"><label for="lg-pass">Password</label><input id="lg-pass" class="input" name="password" type="password" placeholder="Any password works in the prototype" /></div>
            ${L.err ? `<div class="error-text">${esc(L.err)}</div>` : ""}
            <button class="btn btn-primary" type="submit">Sign in</button>
            <div class="demo-title">Demo accounts: one per role</div>
            <div class="demo-list">${DEMO_LOGINS.map((d) => { const u = user(d.userId); return `
              <button type="button" class="demo-item" data-act="demo-login" data-id="${u.id}">
                <span style="display:flex;gap:10px;align-items:center">${avatar(u.id)}<span><span class="who">${esc(ROLE_LABEL[d.role])}</span><br><span class="what">${esc(u.name)} · ${esc(u.email)}</span></span></span>
                <span class="muted">→</span>
              </button>`; }).join("")}</div>
          </form>
        </section>
      </div>`;
  }
  function login(u) { state.me = u; state.ui = {}; saveSession(); go("dashboard"); }

  /* ================================================================= shell */
  function navCount(k) {
    switch (k) {
      case "inquiries": return S.inquiries().filter((i) => i.status === "new" && (is("sales_executive") || !i.assignedTo)).length;
      case "inbox": return REASSIGN_REQUESTS.filter((r) => r.status === "pending").length;
      case "tasks": return S.tasks().filter((t) => t.assignee === state.me.id && t.due && t.status !== "completed" && daysFrom(t.due) < 0).length;
      case "leads": return is("agent") ? S.leads().filter((l) => OPEN(l) && daysFrom(l.created) >= -7).length : 0;
      default: return 0;
    }
  }
  // Every page says where its data comes from, so sample records are never mistaken for client data.
  const SOURCE = {
    legacy: ["matters", "matter", "deadlines", "tasks", "accounts", "account", "invoices", "portfolio", "migration"],
    sample: ["inquiries", "leads", "lead", "estimates", "estimate", "inbox", "applications", "users", "blog", "discounts", "services", "pipeline", "conversion"],
    mixed: ["dashboard", "payments"],
  };
  function sourceTag(page) {
    const k = Object.keys(SOURCE).find((s) => SOURCE[s].includes(page));
    if (!k) return "";
    const t = { legacy: ["green", "Client data · legacy workbook"], sample: ["amber", "Sample data · fictional, for layout only"], mixed: ["purple", "Client data (matters, billing) + sample data (CRM pipeline)"] }[k];
    return `<div class="source-tag">${badge(t[0], t[1])}</div>`;
  }

  function renderShell(page, view) {
    const active = DETAIL_PARENT[page] || page;
    const me = state.me;
    const notif = navCount("inbox") * (is("admin", "sales_manager") ? 1 : 0) + navCount("inquiries") + S.deadlines().filter((d) => !d.done && daysFrom(d.due) < 0).length;
    const curId = parseHash().id;
    const servicePipe = page === "matters" && curId ? curId : page === "matter" && matter(curId) ? matter(curId).category : null;
    const svcLinks = () => {
      const ms = S.matters();
      const cats = SERVICE_CONFIG.services.map((x) => x.name).filter((c) => SERVICE_NAV.includes(c) || SERVICE_STAGES[c] || ms.some((m) => m.category === c));
      return `<div class="nav-sub">${cats.map((c) => { const n = ms.filter((m) => m.category === c && m.status !== "closed").length; return `<a href="#/matters/${encodeURIComponent(c)}" class="sub${servicePipe === c ? " active" : ""}"><span class="lbl">${esc(c)}</span>${n ? `<span class="n">${n}</span>` : ""}</a>`; }).join("")}</div>`;
    };
    const nav = NAV[me.role].map((g) => `<div class="nav-group">${g.label ? `<div class="nav-label">${esc(g.label)}</div>` : ""}${g.items.map((k) => {
      const c = navCount(k);
      const on = k === active && !(k === "matters" && servicePipe);
      return `<a href="#/${k}" class="${on ? "active" : ""}">${ic(k)}<span class="lbl">${esc(label(k))}</span>${c ? `<span class="count">${c}</span>` : ""}</a>${k === "matters" ? svcLinks() : ""}`;
    }).join("")}</div>`).join("");
    const crumbs = (view.crumbs || []).filter(Boolean);
    const crumbHtml = crumbs.length > 1 ? `<div class="crumbs">${crumbs.map((c, i, a) => (i === a.length - 1 ? `<b>${c}</b>` : `<span>${c}</span><span>›</span>`)).join("")}</div>` : "";
    $("#app").innerHTML = `
      <div class="shell">
        <aside class="sidebar" id="sidebar">
          <div class="side-brand"><span class="logo">${ic("roles", 17)}</span><div><p>EEVA Workspace</p><small>${esc(ROLE_LABEL[me.role])}</small></div></div>
          <nav class="nav">${nav}</nav>
          <div class="side-user">${avatar(me.id)}<div><div class="n">${esc(me.name)}</div><div class="e">${esc(me.email)}</div></div><button class="icon-btn" data-act="logout" title="Sign out" aria-label="Sign out"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button></div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn menu-btn" data-act="toggle-menu" aria-label="Menu">${ic("menu", 18)}</button>
            <div class="top-search">${ic("search", 14)}<input class="input" id="global-search" placeholder="Search ${S.matters().length ? "matters, " : ""}leads, accounts…" autocomplete="off" /><kbd>Ctrl K</kbd><div class="search-results hidden" id="search-results"></div></div>
            <span class="spacer"></span>
            <button class="icon-btn" data-act="reset-data" title="Reset demo data" aria-label="Reset demo data"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg></button>
            <button class="icon-btn" data-act="notifications" title="Notifications" aria-label="Notifications">${ic("bell", 17)}${notif ? `<span class="badge-n">${notif}</span>` : ""}</button>
            <span class="vsep"></span>
            <div class="user-chip" title="${esc(me.name)} · ${esc(ROLE_LABEL[me.role])}">${avatar(me.id)}</div>
          </header>
          <main class="content${state.samePage ? " no-anim" : ""}">${crumbHtml}${sourceTag(page)}${view.html}</main>
        </div>
      </div>`;
  }

  /* ========================================================= shared pieces */
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
  const longDate = () => { const [y, m, d] = TODAY.split("-").map(Number); return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`; };
  const hero = (kicker, actions) => `<div class="page-head hero"><div><h1>${greeting()}, ${esc(state.me.name.split(" ")[0])} <span aria-hidden="true">👋</span></h1><p class="desc">${esc(kicker)} · ${longDate()}</p></div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
  const head = (title, desc, actions) => `<div class="page-head"><div><h1>${esc(title)}</h1>${desc ? `<p class="desc">${desc}</p>` : ""}</div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
  // KPI values use the compact rupee form (₹2.7L) like the workspace; the exact figure is in the tooltip.
  const tile = (lbl, value, hint, href, icon, urgent) => {
    const money = typeof value === "string" && value[0] === "₹";
    const shown = money ? inrShort(+value.replace(/[^\d]/g, "")) : value;
    return `<a class="stat${urgent ? " urgent" : ""}" href="${href || "javascript:void 0"}"${money ? ` title="${esc(value)}"` : ""}><span class="ic">${ic(icon || "activity", 18)}</span><span><div class="lbl">${esc(lbl)}</div><div class="val">${shown}</div>${hint ? `<div class="hint">${esc(hint)}</div>` : ""}</span></a>`;
  };
  const stats = (tiles) => `<div class="stats">${tiles.join("")}</div>`;
  const quiet = (pairs) => `<div class="quiet">${pairs.map(([v, l, red]) => `<span${red ? ' style="color:var(--red)"' : ""}><b${red ? ' style="color:var(--red)"' : ""}>${v}</b>${esc(l)}</span>`).join("")}</div>`;
  const panel = (title, count, body, action) => `<section class="panel"><div class="panel-head"><h3>${esc(title)}${count != null ? `<span class="mono">${count}</span>` : ""}</h3>${action || ""}</div>${body}</section>`;
  const table = (cols, rows, o = {}) => {
    if (!rows.length) return `<div class="empty">${esc(o.empty || "No records found.")}</div>`;
    return `<div class="table-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th class="${c.num ? "right" : ""}">${esc(c.h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr${o.href ? ` class="click" data-href="${esc(o.href(r))}"` : o.act ? ` class="click" data-act="${o.act}" data-id="${esc(r.id)}"` : ""}>${cols.map((c) => `<td class="${c.num ? "num" : ""}">${c.r(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  };
  const seg = (name, value, choices) => `<div class="seg">${choices.map((c) => `<button data-act="seg" data-name="${name}" data-val="${esc(c.value)}" class="${String(c.value) === String(value) ? "on" : ""}">${c.icon ? ic(c.icon, 14) + " " : ""}${esc(c.label)}${c.n != null ? ` <span style="opacity:.7">(${c.n})</span>` : ""}</button>`).join("")}</div>`;
  const tabs = (name, value, choices) => `<div class="tabs">${choices.map((c) => `<button data-act="seg" data-name="${name}" data-val="${esc(c.value)}" class="${c.value === value ? "on" : ""}">${esc(c.label)}${c.n ? `<span class="mono">${c.n}</span>` : ""}</button>`).join("")}</div>`;
  const search = (key, value, ph) => `<input class="input" placeholder="${esc(ph)}" data-input="${key}" value="${esc(value || "")}" />`;
  const sel = (key, value, choices) => `<select class="select" data-change="ui" data-key="${key}">${opts(choices, value)}</select>`;
  const kv = (pairs) => `<div class="kv">${pairs.map(([k, v]) => `<div class="k">${esc(k)}</div><div class="v">${v == null || v === "" ? '<span class="muted">—</span>' : v}</div>`).join("")}</div>`;
  const contactActions = (phone, email) => `<span style="display:inline-flex;gap:4px"><a class="btn btn-sm btn-ghost" title="Call" href="tel:${esc(phone)}">${ic("phone", 14)}</a><a class="btn btn-sm btn-ghost" title="WhatsApp" href="https://wa.me/${esc(String(phone).replace(/\D/g, ""))}" target="_blank" rel="noopener">${ic("chat", 14)}</a>${email ? `<a class="btn btn-sm btn-ghost" title="Email" href="mailto:${esc(email)}">${ic("mail", 14)}</a>` : ""}</span>`;
  const bars = (rows, fmt) => { const mx = Math.max(1, ...rows.map((r) => r.v)); return rows.map((r) => `<div class="bar-row"><span>${esc(r.l)}${r.n != null ? ` <span class="muted">(${r.n})</span>` : ""}</span><div class="bar"><i style="width:${(r.v / mx) * 100}%;${r.c ? `background:var(--${r.c})` : ""}"></i></div><span class="mono right">${fmt ? fmt(r.v) : r.v}</span></div>`).join(""); };

  function kanban(columns, items, colOf, card, o = {}) {
    return `<div class="kanban">${columns.map((col) => {
      const list = items.filter((i) => colOf(i) === col.key);
      return `<div class="k-col" data-col="${esc(col.key)}" data-board="${o.board || ""}">
        <div class="k-head"><span>${esc(col.label)}</span><span class="mono">${list.length}</span></div>
        ${o.sum ? `<div class="k-sum">${o.sum(list)}</div>` : ""}
        <div class="k-list">${list.length ? list.map(card).join("") : '<div class="k-empty">No items</div>'}</div></div>`;
    }).join("")}</div>`;
  }
  function bindKanban(board, onDrop) {
    let dragId = null;
    $$(`.k-card[data-board="${board}"][draggable="true"]`).forEach((c) => {
      c.addEventListener("dragstart", (e) => { dragId = c.dataset.id; c.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", dragId); } catch (x) { /* ignore */ } });
      c.addEventListener("dragend", () => c.classList.remove("dragging"));
    });
    $$(`.k-col[data-board="${board}"]`).forEach((col) => {
      col.addEventListener("dragover", (e) => { if (dragId) { e.preventDefault(); col.classList.add("drop-over"); } });
      col.addEventListener("dragleave", () => col.classList.remove("drop-over"));
      col.addEventListener("drop", (e) => { e.preventDefault(); col.classList.remove("drop-over"); if (dragId) onDrop(dragId, col.dataset.col); dragId = null; });
    });
  }

  /* ================================================================ PAGES */
  const PAGES = {};

  /* ---------------------------------------------------------- dashboards */
  PAGES.dashboard = function () {
    if (is("agent")) return agentDashboard();
    if (is("admin")) return adminDashboard();
    return crmDashboard();
  };

  // CRM Dashboard (components/crm/CrmDashboard.tsx)
  function crmDashboard() {
    const leads = S.leads(), accs = S.accounts(), ests = S.estimates(), inq = S.inquiries();
    const active = leads.filter(OPEN);
    const overdue = active.filter((l) => l.nextFollowUp && daysFrom(l.nextFollowUp) < 0);
    const health = (a) => (a.status !== "Active" || daysFrom(a.lastActivity) < -180 ? "Inactive" : daysFrom(a.lastActivity) < -30 ? "Needs Attention" : "Healthy");
    const followups = active.filter((l) => l.nextFollowUp && daysFrom(l.nextFollowUp) <= 3).sort((a, b) => byDate(toUTC(a.nextFollowUp), toUTC(b.nextFollowUp)));
    const myLeadIds = new Set(leads.map((l) => l.id));
    const acts = LEAD_ACTIVITIES.filter((a) => myLeadIds.has(a.lead)).slice(0, 7);
    const estCount = (s) => ests.filter((e) => e.status === s).length;
    return {
      crumbs: ["CRM Dashboard"],
      html: hero(`CRM Dashboard · ${is("sales_manager") ? "Team view" : "Your book"}`, `<button class="btn" data-act="new-account">${ic("plus", 14)} New Account</button><button class="btn btn-primary" data-act="new-lead">${ic("plus", 14)} New Lead</button>`)
        // Primary row = numbers that trigger an action today; reference counts go in the chip strip below.
        + stats([
          tile("Overdue", overdue.length, "Follow-ups past due", "#/leads", "alert", overdue.length > 0),
          tile("Hot Leads", active.filter((l) => l.status === "hot").length, "Close this week", "#/leads", "flame"),
          tile("Inquiry Leads", inq.filter((i) => ["new", "contacted"].includes(i.status)).length, `${inq.filter((i) => i.status === "new").length} new`, "#/inquiries", "inquiries"),
          tile("Active Leads", active.length, inr(sum(active, (l) => l.value)) + " pipeline", "#/leads", "leads"),
          tile("Converted", leads.filter((l) => l.status === "converted").length, `${leads.length ? Math.round((leads.filter((l) => l.status === "converted").length / leads.length) * 100) : 0}% conversion`, "#/leads", "check"),
        ])
        + quiet([[accs.length, "Total Accounts"], [accs.filter((a) => a.status === "Active").length, "Active Accounts"], [ests.length, "Estimations"], [estCount("sent") + estCount("viewed"), "Awaiting client reply"]])
        + `<div class="grid-even">
            ${panel("Pipeline Overview", null, `<div class="panel-body">${bars(LEAD_STAGES_UI.map((s, i) => { const l = leads.filter((x) => x.status === s.key); return { l: s.label, n: l.length, v: sum(l, (x) => x.value), c: ["blue", "orange", "red", "green", "slate"][i] }; }), inr)}</div>`, `<a class="btn btn-sm" href="#/leads">Open pipeline</a>`)}
            ${panel("Estimates", ests.length, `<div class="panel-body">${bars([["Draft", "draft", "slate"], ["Sent", "sent", "blue"], ["Approved", "approved", "teal"], ["Converted", "converted", "green"], ["Expired", "expired", "gray"]].map(([l, k, c]) => ({ l, v: estCount(k), c })))}</div>`, `<a class="btn btn-sm" href="#/estimates">View all</a>`)}
          </div>
          <div class="grid-2"><div>
            ${panel("Tasks & Follow-ups", followups.length, table([
              { h: "Due", r: (l) => dueStatus(l.nextFollowUp) },
              { h: "Lead", r: (l) => `<a class="t" href="#/lead/${l.id}">${esc(l.title)}</a><div class="small muted">${esc(l.company)} · ${esc(l.contactName)}</div>` },
              { h: "Status", r: (l) => leadStatus(l.status) },
              ...(is("sales_manager") ? [{ h: "Owner", r: (l) => person(l.owner) }] : []),
              { h: "", r: (l) => contactActions(l.phone, l.email) },
            ], followups, { empty: "No follow-ups due in the next 3 days." }))}
            ${panel("Inquiry Leads", inq.filter((i) => ["new", "contacted"].includes(i.status)).length, `<div class="panel-body" style="padding-bottom:4px">${quiet([[inq.filter((i) => i.status === "new").length, "New"], [inq.filter((i) => i.status === "contacted").length, "Contacted"], [inq.filter((i) => i.status === "converted").length, "Converted"], [inq.filter((i) => i.status === "not_interested").length, "Not Interested"]])}</div>`
              + table([
                { h: "Inquiry", r: (i) => `<span class="t">${esc(i.name)}</span><div class="small muted">${esc(i.service)}</div>` },
                { h: "Status", r: inqStatus },
                { h: "Age", r: (i) => `${-daysFrom(i.created)}d` },
                { h: "", r: (i) => `<span style="display:inline-flex;gap:4px;justify-content:flex-end;width:100%"><a class="btn btn-sm btn-ghost" href="tel:${esc(i.phone)}" title="Call">${ic("phone", 14)}</a>${i.status === "new" && (i.assignedTo === state.me.id || can.assign()) ? `<button class="btn btn-sm" data-act="inq-contacted" data-id="${i.id}">Mark contacted</button>` : ""}${["new", "contacted"].includes(i.status) && i.assignedTo ? `<button class="btn btn-sm" data-act="inq-convert" data-id="${i.id}">Convert to lead</button>` : ""}</span>` },
              ], inq.filter((i) => ["new", "contacted"].includes(i.status)).slice(0, 5), { empty: "No open inquiries." }), `<a class="btn btn-sm" href="#/inquiries">View all</a>`)}
          </div><div>
            ${panel("Account Health Snapshot", accs.length, `<div class="panel-body">${bars([["Healthy", "green"], ["Needs Attention", "amber"], ["Inactive", "slate"]].map(([l, c]) => ({ l, v: accs.filter((a) => health(a) === l).length, c })))}</div>`)}
            ${panel("Activity Timeline", acts.length, acts.length ? `<div class="timeline">${acts.map((x) => `<div class="tl-item">${avatar(x.by, true)}<div><div class="head"><b>${esc(uname(x.by))}</b><span class="tag">${esc(cap(x.type))}</span><span class="muted small">${esc(x.at)}</span></div><p><a href="#/lead/${x.lead}">${esc(lead(x.lead) ? lead(x.lead).title : x.lead)}</a>: ${esc(x.text)}</p></div></div>`).join("")}</div>` : '<div class="empty">No activity yet.</div>')}
          </div></div>`,
    };
  }

  // Agent Workspace Command Center (app/(agent)/agent/dashboard/components/CommandCenter.tsx)
  function agentDashboard() {
    const ms = S.matters(), dls = S.deadlines().filter((d) => !d.done), me = state.me.id;
    const overdueDl = dls.filter((d) => daysFrom(d.due) < 0);
    const myLeads = S.leads();
    const stale = myLeads.filter((l) => OPEN(l) && l.nextFollowUp && daysFrom(l.nextFollowUp) < 0);
    const stuck = ms.filter((m) => m.status !== "closed" && daysFrom(m.lastActivity) < -14);
    const unpaid = S.invoices().filter((i) => i.total > i.paid && i.status !== "CANCELLED");
    const unclaimed = TASKS.filter((t) => !t.assignee && t.status !== "completed");
    // Sort: overdue first (most overdue first), then by due date; deadlines before tasks on the same day.
    const queue = [
      ...dls.map((d) => ({ kind: "Deadline", due: d.due, title: d.type, matter: d.matter, rank: 0 })),
      ...TASKS.filter((t) => t.assignee === me && t.due && t.status !== "completed").map((t) => ({ kind: "Task", due: t.due, title: t.title, matter: t.matter, rank: 1, status: t.status })),
    ].filter((w) => daysFrom(w.due) <= 7).sort((a, b) => byDate(toUTC(a.due), toUTC(b.due)) || a.rank - b.rank);
    const risk = ms.filter((m) => m.status !== "closed").map((m) => ({ m, h: matterHealth(m) })).filter((x) => x.h.score < 90).sort((a, b) => a.h.score - b.h.score);
    const opened = ms.filter((m) => daysFrom(m.opened) >= -7).length;
    const converted = myLeads.filter((l) => l.status === "converted" && l.matterId && daysFrom(matter(l.matterId) ? matter(l.matterId).opened : "2000-01-01") >= -30).length;
    const toOpen = myLeads.filter((l) => l.status === "converted" && !l.matterId);
    return {
      crumbs: ["Agent Workspace"],
      html: hero("Agent Workspace",`<a class="btn" href="#/matters">${ic("kanban", 14)} Matter pipeline</a>${can.createMatter() ? `<button class="btn btn-primary" data-act="new-matter">${ic("plus", 14)} New Matter</button>` : ""}`)
        + stats([
          tile("Overdue deadlines", overdueDl.length, "Act today", "#/deadlines", "deadlines", overdueDl.length > 0),
          tile("Stale leads", stale.length, "Follow-up missed", "#/leads", "leads"),
          tile("Stuck matters", stuck.length, "No activity 14+ days", "#/matters", "matters"),
          tile("Unpaid invoices", unpaid.length, inr(sum(unpaid, (i) => i.total - i.paid)), "#/payments", "rupee"),
          tile("Unclaimed team tasks", unclaimed.length, "Pick one up", "#/tasks", "tasks"),
        ])
        + (toOpen.length ? `<div class="banner">${ic("alert", 16)}<span><b>${toOpen.length}</b> converted lead${toOpen.length > 1 ? "s are" : " is"} waiting for a matter to be opened.</span><span class="spacer"></span>${toOpen.map((l) => `<a class="btn btn-sm" href="#/lead/${l.id}">${esc(l.id)}</a>`).join("")}</div>` : "")
        + `<div class="grid-2"><div>
            ${panel("Today's action queue", queue.length, table([
              { h: "Due", r: (w) => dueStatus(w.due) },
              { h: "Type", r: (w) => `<span class="tag">${w.kind}</span>` },
              { h: "Item", r: (w) => `<span class="t">${esc(w.title)}</span>` },
              { h: "Matter", r: (w) => `<a class="mono" href="#/matter/${w.matter}">${esc(w.matter)}</a><div class="small muted">${esc(acct(matter(w.matter).account).display)}</div>` },
            ], queue, { empty: "Nothing due in the next 7 days." }))}
            ${panel("Team queue", unclaimed.length, table([
              { h: "Task", r: (t) => `<span class="t">${esc(t.title)}</span>` },
              { h: "Matter", r: (t) => `<a class="mono" href="#/matter/${t.matter}">${esc(t.matter)}</a>` },
              { h: "Priority", r: (t) => priority(t.priority) },
              { h: "", r: (t) => `<button class="btn btn-sm btn-primary" data-act="claim-task" data-id="${t.id}">Claim</button>` },
            ], unclaimed, { empty: "No unclaimed tasks." }))}
          </div><div>
            ${panel("Risk radar", risk.length, risk.length ? `<div class="rows">${risk.map(({ m, h }) => `<a class="row-item" href="#/matter/${m.id}"><div class="grow"><div class="t">${esc(m.title)}</div><div class="s">${esc(m.id)} · ${esc(h.factors.map((f) => f.t).join(", "))}</div></div><span class="mono" style="font-weight:700;color:var(--${h.score < 60 ? "red" : h.score < 80 ? "amber" : "green"})">${h.score}</span></a>`).join("")}</div>` : '<div class="empty">No matters at risk.</div>')}
            ${panel("Pipeline snapshot", null, `<div class="panel-body">${bars([...new Set(ms.map((m) => m.category))].map((c) => ({ l: c, v: ms.filter((m) => m.category === c && m.status !== "closed").length })).filter((r) => r.v)) || '<div class="empty">No open matters.</div>'}</div>`)}
            ${panel("This week", null, `<div class="panel-body">${kv([["Leads converted", `<b>${converted}</b>`], ["Matters opened", `<b>${opened}</b>`], ["Avg cycle", (() => { const done = ms.filter((m) => m.status === "closed" && m.opened && m.lastActivity); return done.length ? `<b>${Math.round(sum(done, (m) => toUTC(m.lastActivity) - toUTC(m.opened)) / done.length / 864e5)} days</b> <span class="small muted" title="Opened date to last activity, across closed matters that have both dates">(${done.length} closed)</span>` : '<span class="muted" title="Needs closed matters with an opened date">Not enough data</span>'; })()], ["Billed", `<b>${inr(sum(S.invoices().filter((i) => daysFrom(i.date) >= -7), (i) => i.total))}</b>`]])}</div>`)}
          </div></div>`,
    };
  }

  // Admin Dashboard (app/(admin)/admin/page.tsx), rebuilt on five published design approaches:
  //  - Stripe Home: an overview plus the "actions needed" list first.
  //  - Stephen Few: one screen, summarise and show exceptions only.
  //  - Edward Tufte: word-sized charts and small multiples on one shared scale, no chart junk.
  //  - Linear (Karri Saarinen): neutral canvas; colour only where it carries meaning (red = overdue).
  //  - Refactoring UI (Schoger/Wathan): values loud, labels quiet, one primary action.
  // Every number below is computed from a record; nothing is estimated.
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const lastMonths = (n) => { const [y, m] = TODAY.split("-").map(Number); return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1)); return { key: d.toISOString().slice(0, 7), label: MONTHS_SHORT[d.getUTCMonth()] }; }); };
  // Word-sized column chart (Tufte): bars only, the last value labelled, every bar has a tooltip.
  const microCols = (rows, fmt) => { const mx = Math.max(1, ...rows.map((r) => r.v)); return `<div class="mcols">${rows.map((r, i) => `<span class="mc${r.over ? " over" : i === rows.length - 1 ? " now" : ""}" title="${esc(r.label)}: ${esc(fmt ? fmt(r.v) : String(r.v))}"><i style="height:${r.v ? Math.max(8, (r.v / mx) * 100) : 0}%"></i></span>`).join("")}</div><div class="mcols-axis"><span>${esc(rows[0].label)}</span><span>${esc(rows[rows.length - 1].label)}</span></div>`; };
  // Stacked bar of filing groups on a shared scale, so rows can be compared (small multiples).
  const stackBar = (ms, scale) => { const groups = BUCKETS.concat([{ key: "unknown", label: "Stage unknown", color: "var(--ghost)" }]).map((b) => ({ ...b, v: ms.filter((m) => bucketOf(m).key === b.key).length })).filter((g) => g.v); return `<div class="sbar" style="width:${scale ? Math.max(6, (ms.length / scale) * 100) : 100}%">${groups.map((g) => `<i style="flex:${g.v};background:${g.color}" title="${esc(g.label)}: ${g.v}"></i>`).join("")}</div>`; };
  const metric = (label, value, sub, viz, href, tone) => `<a class="metric${tone ? " " + tone : ""}" href="${href || "javascript:void 0"}"><span class="m-l">${esc(label)}</span><span class="m-v">${value}</span>${sub ? `<span class="m-s">${sub}</span>` : ""}${viz ? `<span class="m-viz">${viz}</span>` : ""}</a>`;

  function adminDashboard() {
    const open = MATTERS.filter((m) => m.status !== "closed");
    const dlOpen = DEADLINES.filter((d) => !d.done);
    const dlOver = dlOpen.filter((d) => daysFrom(d.due) < 0);
    const dl30 = dlOpen.filter((d) => daysFrom(d.due) >= 0 && daysFrom(d.due) <= 30).sort((a, b) => byDate(toUTC(a.due), toUTC(b.due)));
    const dlShow = dlOver.slice().sort((a, b) => byDate(toUTC(a.due), toUTC(b.due))).concat(dl30);
    const taskOver = TASKS.filter((t) => t.due && t.status !== "completed" && daysFrom(t.due) < 0);
    const contested = MATTERS.filter((m) => ["objection", "hearing"].includes(m.appStage));
    const unpaid = INVOICES.filter((i) => i.total > i.paid && i.status !== "CANCELLED");
    const toOpen = LEADS.filter((l) => l.status === "converted" && !l.matterId);
    const missed = LEADS.filter((l) => OPEN(l) && l.nextFollowUp && daysFrom(l.nextFollowUp) < 0);
    const rr = REASSIGN_REQUESTS.filter((r) => r.status === "pending");

    // 1. Actions needed (exceptions only; an item appears only when its count is above zero).
    const actions = [
      [dlOver.length, "red", `deadline${dlOver.length === 1 ? " is" : "s are"} overdue`, "Legal dates. Act today.", "#/deadlines"],
      [contested.length, "red", `filing${contested.length === 1 ? " is" : "s are"} at objection or hearing`, "The office or a third party is waiting on a response.", "#/portfolio"],
      [taskOver.length, "amber", `task${taskOver.length === 1 ? " is" : "s are"} past due`, "Across all matters.", "#/tasks"],
      [unpaid.length, "amber", `invoice${unpaid.length === 1 ? " has" : "s have"} money outstanding`, `${inr(sum(unpaid, (i) => i.total - i.paid))} to collect.`, "#/invoices"],
      [toOpen.length, "amber", `converted lead${toOpen.length === 1 ? " has" : "s have"} no matter yet`, "An agent needs to open the matter.", "#/leads"],
      [rr.length, "amber", `lead reassignment${rr.length === 1 ? " is" : "s are"} waiting for approval`, "Requested by sales.", "#/leads"],
      [missed.length, "amber", `lead follow-up${missed.length === 1 ? " was" : "s were"} missed`, "Sales pipeline.", "#/leads"],
    ].filter((a) => a[0] > 0);
    const actionList = actions.length ? `<div class="attn">${actions.map(([n, tone, what, why, href]) => `<a class="attn-row" href="${href}"><span class="attn-dot ${tone}"></span><span class="attn-n">${n}</span><span class="attn-t"><b>${what}</b><small>${esc(why)}</small></span><span class="attn-go">Review ${ic("chev-r", 14)}</span></a>`).join("")}</div>`
      : `<div class="attn-clear">${ic("check", 16)} Nothing needs your decision today.</div>`;

    // 2. Four headline numbers, each with its own small, real chart.
    const months = lastMonths(12);
    const paidBy = months.map((m) => ({ label: `${m.label} ${m.key.slice(0, 4)}`, v: sum(PAYMENTS.filter((p) => (p.date || "").slice(0, 7) === m.key), (p) => p.amount) }));
    const paid12 = sum(paidBy, (r) => r.v), paidNow = paidBy[paidBy.length - 1].v;
    const weeks = [{ label: "Overdue", v: dlOver.length, over: 1 }].concat([0, 1, 2, 3].map((w) => ({ label: w === 0 ? "This week" : `Week ${w + 1}`, v: dlOpen.filter((d) => daysFrom(d.due) >= w * 7 && daysFrom(d.due) < (w + 1) * 7 + (w === 3 ? 3 : 0)).length })));
    const svcCounts = [...new Set(open.map((m) => m.category))].map((c) => [c, open.filter((m) => m.category === c).length]).sort((a, b) => b[1] - a[1]);
    const pipe = LEADS.filter(OPEN);
    const metrics = `<div class="metrics">
        ${metric("Collected, last 12 months", inrShort(paid12), `This month ${inrShort(paidNow)} · from recorded receipts`, microCols(paidBy, inr), "#/payments")}
        ${metric("Deadlines to act on", dlOver.length + dl30.length, `${dlOver.length ? `<b class="red">${dlOver.length} overdue</b>` : "None overdue"} · ${dl30.length} due in 30 days`, microCols(weeks), "#/deadlines", dlOver.length ? "alert" : "")}
        ${metric("Open matters", open.length, svcCounts.slice(0, 3).map(([c, n]) => `${esc(c)} ${n}`).join(" · ") + (svcCounts.length > 3 ? ` · +${svcCounts.length - 3} more` : ""), "", "#/matters")}
        ${metric("Sales pipeline", inrShort(sum(pipe, (l) => l.value)), `${pipe.length} open lead${pipe.length === 1 ? "" : "s"} · ${pipe.filter((l) => l.status === "hot").length} hot`, "", "#/leads")}
      </div>`;

    // 3. Matters by service: small multiples on one shared scale.
    const svcs = SERVICE_CONFIG.services.map((x) => x.name).filter((n) => MATTERS.some((m) => m.category === n));
    const smax = Math.max(1, ...svcs.map((n) => MATTERS.filter((m) => m.category === n).length));
    const bySvc = `<div class="sm-rows">${svcs.map((n) => { const ms = MATTERS.filter((m) => m.category === n); const filing = FILING_SERVICES.includes(n); return `<a class="sm-row" href="#/matters/${encodeURIComponent(n)}"><span class="sm-l">${esc(n)}</span><span class="sm-bar">${filing ? stackBar(ms, smax) : `<div class="sbar" style="width:${Math.max(6, (ms.length / smax) * 100)}%"><i style="flex:1;background:var(--slate-mark)" title="Advisory: ${ms.length}"></i></div>`}</span><b class="sm-n">${ms.length}</b></a>`; }).join("")}</div>
      <div class="legend" style="margin-top:12px">${BUCKETS.map((b) => `<span><i style="background:${b.color}"></i>${b.label}</span>`).join("")}${MATTERS.some((m) => FILING_SERVICES.includes(m.category) && bucketOf(m).key === "unknown") ? '<span><i style="background:var(--ghost)"></i>Stage unknown</span>' : ""}<span><i style="background:var(--slate-mark)"></i>Advisory</span></div>`;

    // 4. Next 30 days, grouped by when.
    const when = (d) => { const n = daysFrom(d.due); return n < 0 ? "Overdue" : n === 0 ? "Today" : n <= 7 ? "This week" : "Later this month"; };
    const dlList = dlShow.length ? ["Overdue", "Today", "This week", "Later this month"].map((g) => { const list = dlShow.filter((d) => when(d) === g); return list.length ? `<div class="dl-group"><div class="dl-g${g === "Overdue" ? " over" : ""}">${g}<span class="dl-gn">${list.length}</span></div>${list.map((d) => { const m = matter(d.matter) || {}; return dlRow({ href: `#/matter/${d.matter}`, due: d.due, title: d.type, owner: m.owner, meta: [esc(m.category || ""), `<span class="mono">${esc(appNoOf(m) || d.matter)}</span>`, esc(acct(m.account).display)] }); }).join("")}</div>` : ""; }).join("")
      : '<div class="empty">Nothing overdue and nothing due in the next 30 days.</div>';

    // 5. Team: who is carrying what.
    const people = USERS.filter((u) => ["agent", "admin"].includes(u.role) && MATTERS.some((m) => m.owner === u.id));
    const team = table([
      { h: "Person", r: (u) => person(u.id) },
      { h: "Open matters", num: 1, r: (u) => open.filter((m) => m.owner === u.id).length },
      { h: "Overdue tasks", num: 1, r: (u) => { const n = taskOver.filter((t) => t.assignee === u.id).length; return n ? `<b class="red">${n}</b>` : '<span class="muted">0</span>'; } },
      { h: "Deadlines ≤30d", num: 1, r: (u) => dl30.filter((d) => (matter(d.matter) || {}).owner === u.id).length },
    ], people, { empty: "No matters have an owner recorded." });

    return {
      crumbs: ["Dashboard"],
      html: `<div class="page-head calm"><div><p class="kicker">${longDate()}</p><h1>${greeting()}, ${esc(state.me.name.split(" ")[0])}</h1></div><div class="actions"><a class="btn" href="#/portfolio">${ic("portfolio", 14)} My Portfolio</a><a class="btn" href="#/pipeline">${ic("pipeline", 14)} Reports</a></div></div>`
        + `<section class="panel calm-panel"><div class="calm-head"><h3>Needs your decision</h3><span class="muted small">${actions.length ? `${actions.length} item${actions.length === 1 ? "" : "s"}` : ""}</span></div>${actionList}</section>`
        + metrics
        + `<div class="grid-2">
            <div>${panel("Deadlines: overdue and next 30 days", dlShow.length, `<div class="panel-body" style="padding-top:4px">${dlList}</div>`, `<a class="btn btn-sm btn-ghost" href="#/deadlines">All deadlines</a>`)}
            ${panel("Team", people.length, team)}</div>
            <div>${panel("Matters by service", MATTERS.length, `<div class="panel-body">${bySvc}</div>`, `<a class="btn btn-sm btn-ghost" href="#/matters">All matters</a>`)}
            </div>
          </div>`,
    };
  }

  /* ---------------------------------------------------------------- leads */
  // CRM Leads (app/(crm)/crm/leads/page.tsx + LeadsSummaryBar, LeadsFilterBar, LeadKanban, LeadTable)
  // Agent Leads (app/(agent)/agent/leads/page.tsx: All / Converted / Hot / Warm / Cold / My Follow-ups)
  PAGES.leads = function () {
    const st = ui("leads"); st.view = st.view || (is("agent") ? "table" : "kanban"); st.date = st.date || "all"; st.urg = st.urg || "all"; st.quick = st.quick || ""; st.owner = st.owner || ""; st.tab = st.tab || "all";
    const all = S.leads();
    let list = all;
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter((l) => [l.id, l.title, l.company, l.contactName, l.phone, l.email].join(" ").toLowerCase().includes(q)); }
    if (st.date !== "all") list = list.filter((l) => daysFrom(l.created) >= -({ today: 0, d7: 7, d30: 30 }[st.date]));
    if (st.urg !== "all") list = list.filter((l) => l.urgency === st.urg);
    if (st.quick === "overdue") list = list.filter((l) => OPEN(l) && l.nextFollowUp && daysFrom(l.nextFollowUp) < 0);
    if (st.quick === "today") list = list.filter((l) => l.nextFollowUp && daysFrom(l.nextFollowUp) === 0);
    if (st.owner) list = list.filter((l) => l.owner === st.owner);
    if (is("agent") && st.tab !== "all") list = st.tab === "follow" ? list.filter((l) => OPEN(l) && l.nextFollowUp && daysFrom(l.nextFollowUp) <= 0) : list.filter((l) => l.status === st.tab);
    const active = all.filter(OPEN);
    const card = (l) => `<div class="k-card" data-board="leads" data-id="${l.id}" draggable="${can.moveLead(l)}" data-href="#/lead/${l.id}">
        <div class="id">${esc(l.id)}</div>
        <div class="t">${esc(l.company)}</div>
        <div class="small muted" style="margin:-4px 0 6px">${esc(l.contactName)} · ${esc(l.service)}</div>
        <div class="meta">${urgency(l.urgency)}<span class="mono" style="color:var(--ink);font-weight:600">${inr(l.value)}</span></div>
        <div class="foot"><span>${l.nextFollowUp ? dueStatus(l.nextFollowUp) : l.matterId ? `Matter ${esc(l.matterId)}` : "—"}</span><span style="display:flex;gap:3px">${avatar(l.owner, true)}${l.contributors.map((c) => `<span class="avatar sm light" title="${esc(uname(c))} (agent)">${esc(initials(uname(c)))}</span>`).join("")}</span></div>
      </div>`;
    const body = st.view === "kanban"
      ? kanban(LEAD_STAGES_UI, list, (l) => l.status, card, { board: "leads", sum: (ls) => inr(sum(ls, (l) => l.value)) })
      : panel("Leads", list.length, table([
          { h: "Company & Contact", r: (l) => `<span class="t">${esc(l.company)}</span><div class="small muted">${esc(l.contactName)} · <span class="mono">${esc(l.id)}</span></div>` },
          { h: "Status", r: (l) => leadStatus(l.status) },
          { h: "Urgency", r: (l) => urgency(l.urgency) },
          { h: "Services", r: (l) => `${esc(l.service)}<div class="small muted">${esc(l.category)}</div>` },
          { h: "Assigned", r: (l) => `${person(l.owner)}${l.contributors.length ? `<div class="small muted" style="margin-top:3px">Agent: ${esc(l.contributors.map(uname).join(", "))}</div>` : ""}` },
          { h: "Follow-up", r: (l) => (l.nextFollowUp ? dueStatus(l.nextFollowUp) : '<span class="muted">Not set</span>') },
          { h: "Value", num: 1, r: (l) => inr(l.value) },
          { h: "Actions", r: (l) => contactActions(l.phone, l.email) },
        ], list, { href: (l) => "#/lead/" + l.id, empty: "No leads match these filters." }));
    return {
      crumbs: [SECTION_OF("leads"), "Leads"],
      html: head("Leads", is("agent") ? "Leads you've been assigned to as the agent. Ownership stays with the sales executive." : "Your sales pipeline. Drag a card to move it to the next stage.", `<button class="btn btn-primary" data-act="new-lead">${ic("plus", 14)} New Lead</button>`)
        + (is("agent") ? tabs("leads.tab", st.tab, [{ value: "all", label: "All Leads", n: all.length }, { value: "converted", label: "Converted", n: all.filter((l) => l.status === "converted").length }, { value: "hot", label: "Hot", n: all.filter((l) => l.status === "hot").length }, { value: "warm", label: "Warm", n: all.filter((l) => l.status === "warm").length }, { value: "cold", label: "Cold", n: all.filter((l) => l.status === "cold").length }, { value: "follow", label: "My Follow-ups", n: all.filter((l) => OPEN(l) && l.nextFollowUp && daysFrom(l.nextFollowUp) <= 0).length }])
          : stats([
            tile("Total Leads", all.length, "", "javascript:void 0", "leads"),
            tile("Total Active", active.length, inr(sum(active, (l) => l.value)), "javascript:void 0", "activity"),
            tile("Hot Leads", all.filter((l) => l.status === "hot").length, "", "javascript:void 0", "flame"),
            tile("Overdue Follow-ups", active.filter((l) => l.nextFollowUp && daysFrom(l.nextFollowUp) < 0).length, "", "javascript:void 0", "alert", active.some((l) => l.nextFollowUp && daysFrom(l.nextFollowUp) < 0)),
            tile("Conversion Rate", `${all.length ? Math.round((all.filter((l) => l.status === "converted").length / all.length) * 100) : 0}%`, "", "javascript:void 0", "conversion"),
            tile("This Month", all.filter((l) => l.created.slice(0, 7) === TODAY.slice(0, 7)).length, "New leads", "javascript:void 0", "deadlines"),
          ]))
        + `<div class="toolbar">${is("agent") ? "" : seg("leads.view", st.view, [{ value: "kanban", label: "Kanban", icon: "kanban" }, { value: "table", label: "Table", icon: "list" }])}
            ${search("leads.q", st.q, "Search by name, company, phone, email...")}
            ${seg("leads.date", st.date, [{ value: "all", label: "All time" }, { value: "today", label: "Today" }, { value: "d7", label: "Last 7 days" }, { value: "d30", label: "Last 30 days" }])}
            ${is("agent") ? "" : sel("leads.urg", st.urg, [{ value: "all", label: "All Urgency" }, { value: "normal", label: "Normal" }, { value: "time_bound", label: "Time-bound" }, { value: "litigation_urgent", label: "Litigation Urgent" }])}
            ${is("agent") ? "" : seg("leads.quick", st.quick, [{ value: "", label: "All" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Today Follow-ups" }])}
            ${is("admin", "sales_manager") ? sel("leads.owner", st.owner, [{ value: "", label: "All sales executives" }, ...USERS.filter((u) => u.role === "sales_executive").map((u) => ({ value: u.id, label: u.name }))]) : ""}
          </div>` + body,
      after() {
        bindKanban("leads", (id, col) => {
          const l = lead(id); if (!l || l.status === col) return;
          if (l.status === "converted") { toast("Converted leads can't be moved back."); return; }
          if (col === "lost") { markLostDrawer(l); return; }
          setLeadStatus(l, col);
        });
      },
    };
  };

  function setLeadStatus(l, status, reason) {
    const prev = l.status;
    l.status = status;
    if (["converted", "lost"].includes(status)) l.nextFollowUp = null;
    LEAD_ACTIVITIES.unshift({ id: "LA" + Date.now(), lead: l.id, type: "system", text: `Status changed: ${cap(prev)} → ${cap(status)}${reason ? `. Reason: ${reason}` : ""}`, by: state.me.id, at: nowStamp() });
    audit("Lead status changed", `${l.id}: ${prev} → ${status}`);
    render();
    if (status === "converted") stamp(l.id);
  }
  function markLostDrawer(l) {
    drawer("Mark Lead as Lost", `<p class="sub" style="margin-top:0">${esc(l.title)} · ${esc(l.company)}</p>${field("Reason", '<textarea class="textarea" name="reason" required placeholder="Reason for loss"></textarea>')}`, "Mark as Lost", (d) => { closeLayer(); setLeadStatus(l, "lost", d.reason); });
  }

  // Lead detail (app/(crm)/crm/leads/[id]/page.tsx + LeadHeader, OwnershipCard, LeadRightPanel)
  PAGES.lead = function (id) {
    const l = S.leads().find((x) => x.id === id);
    if (!l) return notFound("Lead not found, or it's outside your access.");
    const st = ui("lead:" + id); st.tab = st.tab || "activity"; st.af = st.af || "all";
    const a = l.account ? acct(l.account) : null;
    const editable = can.editLead(l);
    const pendingReq = REASSIGN_REQUESTS.find((r) => r.lead === l.id && r.status === "pending");
    let acts = LEAD_ACTIVITIES.filter((x) => x.lead === l.id);
    if (st.af !== "all") acts = acts.filter((x) => x.type === st.af);
    const ests = ESTIMATES.filter((e) => e.lead === l.id).sort((x, y) => y.version - x.version);
    const steps = ["Cold", "Warm", "Hot", "Converted"];

    let actions = "";
    if (editable) actions += `<button class="btn btn-primary" data-act="log-activity" data-id="${l.id}">${ic("note", 14)} Log Activity</button>`;
    if (editable && l.status !== "lost") actions += `<button class="btn" data-act="new-estimate" data-lead="${l.id}">${ic("estimates", 14)} Create Estimate</button>`;
    if (l.status === "converted" && !l.matterId && can.createMatter()) actions += `<button class="btn btn-primary" data-act="new-matter" data-lead="${l.id}">${ic("matters", 14)} Create Matter</button>`;
    if (can.moveLead(l) && OPEN(l)) actions += `<button class="btn" data-act="mark-lost" data-id="${l.id}">Mark Lost</button>`;
    if (can.deleteLead()) actions += `<button class="btn btn-ghost" data-act="delete-lead" data-id="${l.id}">Delete</button>`;

    const tabBody = {
      activity: `${tabs(`lead:${id}.af`, st.af, [{ value: "all", label: "All" }, { value: "call", label: "Calls" }, { value: "meeting", label: "Meetings" }, { value: "note", label: "Notes" }])}
        ${acts.length ? `<div class="timeline">${acts.map((x) => `<div class="tl-item">${avatar(x.by, true)}<div><div class="head"><b>${esc(uname(x.by))}</b>${badge(x.type === "system" ? "gray" : "blue", cap(x.type))}<span class="muted small">${esc(x.at)}</span></div><p>${esc(x.text)}</p></div></div>`).join("")}</div>` : '<div class="empty">No activity logged yet.</div>'}`,
      estimates: table([
        { h: "Estimate No", r: (e) => `<a class="mono" href="#/estimate/${e.id}">${esc(e.id)}</a>` },
        { h: "Version", r: (e) => `<span class="tag">v${e.version}</span>` },
        { h: "Amount", num: 1, r: (e) => inr(estTotal(e).total) },
        { h: "Status", r: (e) => estStatus(e.status) },
        { h: "Valid Until", r: (e) => fmtDate(e.validUntil) },
        { h: "Owner", r: (e) => person(e.preparedBy) },
      ], ests, { empty: "No estimate yet. Use Create Estimate." }),
      documents: `<div class="empty">No documents uploaded at this stage.<br><br>${editable ? `<button class="btn btn-sm" data-act="soon">${ic("upload", 14)} Upload document</button>` : ""}</div>`,
      qual: `<div class="empty">No qualification task for this lead.<br><br>${editable ? `<button class="btn btn-sm" data-act="soon">Create Qual Task</button>` : ""}</div>`,
    }[st.tab];

    return {
      crumbs: [`<a href="#/leads">Leads</a>`, esc(l.id)],
      html: `
        ${pendingReq ? `<div class="banner">${ic("alert", 16)}<span>Reassignment to <b>${esc(uname(pendingReq.to))}</b> was requested on ${fmtDate(pendingReq.at)} and is waiting for manager approval.</span>${can.assign() ? `<span class="spacer"></span><button class="btn btn-sm" data-act="reject-req" data-id="${pendingReq.id}">Reject</button><button class="btn btn-sm btn-primary" data-act="approve-req" data-id="${pendingReq.id}">Approve</button>` : ""}</div>` : ""}
        <div class="detail-head">
          <div>
            <div class="id">${esc(l.id)} · Created ${fmtDate(l.created)} by ${esc(uname(l.createdBy))}</div>
            <h1>${esc(l.title)}</h1>
            <div class="facts">${leadStatus(l.status)}${urgency(l.urgency)}<span>${esc(l.company)}</span><span class="mono">${inr(l.value)}</span><span>Follow-up: ${l.nextFollowUp ? dueStatus(l.nextFollowUp) : "Not set"}</span></div>
          </div>
          <div class="page-head"><div class="actions">${actions}</div></div>
        </div>
        ${statusbar(steps, cap(l.status), { lost: l.status === "lost", act: can.moveLead(l) && l.status !== "converted" ? "lead-step" : null, id: l.id })}
        <div class="grid-2" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">
          <div>
            ${panel("Entity", null, `<div class="panel-body">${kv([["Name", esc(l.company)], ["Entity type", esc(l.entityType)], ["Contact", esc(l.contactName)], ["Phone", `<span class="mono">${esc(l.phone)}</span>`], ["Email", esc(l.email)]])}</div>`)}
            ${panel("Account", null, `<div class="panel-body">${a ? kv([["Account", `<a href="#/account/${a.id}">${esc(a.display)}</a>`], ["Account no.", `<span class="mono">${esc(a.id)}</span>`], ["Industry", esc(a.industry)], ["Owner", esc(uname(a.owner))]]) : '<span class="muted">New client. An account is created on conversion.</span>'}</div>`)}
            ${panel("IP Services", null, `<div class="panel-body">${kv([["Service", esc(l.service)], ["Category", esc(l.category)], ["Expected value", `<b>${inr(l.value)}</b>`]])}</div>`)}
            ${panel("Pipeline Info", null, `<div class="panel-body">${kv([["Status", leadStatus(l.status)], ["Urgency", urgency(l.urgency)], ["Source", esc(l.source)], ["Next follow-up", l.nextFollowUp ? dueStatus(l.nextFollowUp) : "Not set"], ["Matter", l.matterId ? matterLink(l.matterId) : '<span class="muted">Opened after conversion</span>']])}</div>`)}
            ${panel("Ownership", null, `<div class="rows">
                <div class="row-item">${avatar(l.owner, true)}<div class="grow"><div class="t">${esc(uname(l.owner))}</div><div class="s">Sales Executive</div></div>${can.assign() ? `<button class="btn btn-sm" data-act="reassign" data-id="${l.id}">Reassign</button>` : is("sales_executive") && l.owner === state.me.id && !pendingReq ? `<button class="btn btn-sm" data-act="request-reassign" data-id="${l.id}">Request Reassign</button>` : ""}</div>
                ${l.contributors.map((c) => `<div class="row-item">${avatar(c, true)}<div class="grow"><div class="t">${esc(uname(c))}</div><div class="s">Agent · ${esc(user(c) ? user(c).title : "")}</div></div></div>`).join("") || `<div class="row-item"><span class="avatar sm light">?</span><div class="grow"><div class="t muted">No agent assigned</div><div class="s">Assign an agent to follow up together</div></div></div>`}
              </div>`, can.addAgent(l) ? `<button class="btn btn-sm" data-act="add-agent" data-id="${l.id}">Assign Agent</button>` : "")}
            ${panel("Quick Actions", null, `<div class="panel-body" style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="tel:${esc(l.phone)}">${ic("phone", 14)} Call</a><a class="btn" href="https://wa.me/${esc(l.phone.replace(/\D/g, ""))}" target="_blank" rel="noopener">${ic("chat", 14)} WhatsApp</a><a class="btn" href="mailto:${esc(l.email)}">${ic("mail", 14)} Email</a></div>`)}
          </div>
          <div>
            <section class="panel">
              ${tabs(`lead:${id}.tab`, st.tab, [{ value: "activity", label: "Activity", n: LEAD_ACTIVITIES.filter((x) => x.lead === l.id).length }, { value: "estimates", label: "Estimates", n: ests.length }, { value: "documents", label: "Documents" }, { value: "qual", label: "Qual Task" }])}
              ${tabBody}
            </section>
          </div>
        </div>`,
    };
  };

  /* ---------------------------------------------------------- inquiry leads */
  // components/crm/inquiry-leads/WebsiteLeadsWorkbench.tsx + InquiryDetailDrawer
  PAGES.inquiries = function () {
    const st = ui("inquiries"); st.status = st.status || "open"; st.source = st.source || "";
    let list = S.inquiries();
    if (st.status === "open") list = list.filter((i) => ["new", "contacted"].includes(i.status));
    else if (st.status !== "all") list = list.filter((i) => i.status === st.status);
    if (st.source) list = list.filter((i) => i.source === st.source);
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter((i) => [i.name, i.email, i.phone, i.company].join(" ").toLowerCase().includes(q)); }
    const sources = [...new Set(INQUIRIES.map((i) => i.source))];
    return {
      crumbs: ["Sales", "Inquiry Leads"],
      html: head("Inquiry Leads", can.assign() ? "Website and campaign enquiries. Assign each one to a sales executive." : "Enquiries assigned to you. Call them, then convert to a lead.")
        + `<div class="toolbar">${search("inquiries.q", st.q, "Search by name, email, or phone...")}
            ${sel("inquiries.status", st.status, [{ value: "open", label: "Status: Open" }, { value: "all", label: "Status: All" }, { value: "new", label: "New" }, { value: "contacted", label: "Contacted" }, { value: "converted", label: "Converted" }, { value: "not_interested", label: "Not Interested" }])}
            ${sel("inquiries.source", st.source, [{ value: "", label: "Source: All" }, ...sources.map((s) => ({ value: s, label: s }))])}
            ${st.q || st.source || st.status !== "open" ? `<button class="btn btn-sm btn-ghost" data-act="clear-filters" data-page="inquiries">Clear Filters</button>` : ""}</div>`
        + panel("Inquiries", list.length, table([
          { h: "Inquiry", r: (i) => `<span class="mono small muted">${esc(i.id)}</span><div class="t">${esc(i.name)}${i.company ? ` <span class="muted" style="font-weight:400">· ${esc(i.company)}</span>` : ""}</div>` },
          { h: "Contact", r: (i) => `<div class="small mono">${esc(i.phone)}</div><div class="small muted">${esc(i.email)}</div>` },
          { h: "Service", r: (i) => esc(i.service) },
          { h: "Source", r: (i) => `<span class="tag">${esc(i.source)}</span>` },
          { h: "Status", r: inqStatus },
          { h: "Assigned To", r: (i) => person(i.assignedTo) },
          { h: "Age", r: (i) => `${-daysFrom(i.created)}d` },
          { h: "Actions", r: (i) => `<span style="display:inline-flex;gap:4px">${can.assign() && ["new", "contacted"].includes(i.status) ? `<button class="btn btn-sm" data-act="assign-inquiry" data-id="${i.id}">${i.assignedTo ? "Reassign" : "Assign"}</button>` : ""}${["new", "contacted"].includes(i.status) && i.assignedTo && (i.assignedTo === state.me.id || can.assign()) ? `<button class="btn btn-sm btn-primary" data-act="inq-convert" data-id="${i.id}">Convert</button>` : ""}</span>` },
        ], list, { act: "open-inquiry", empty: "No inquiries match these filters." })),
    };
  };

  /* ----------------------------------------------------------------- inbox */
  // app/(crm)/crm/inbox/page.tsx: Type, Entity, Requested By, Status, Created At
  PAGES.inbox = function () {
    const list = REASSIGN_REQUESTS.slice().sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1));
    return {
      crumbs: ["Sales", "Inbox"],
      html: head("Inbox", "Reassignment requests from sales executives. Ownership only changes when you approve.")
        + panel("Requests", list.length, table([
          { h: "Type", r: () => `<span class="tag">Lead reassignment</span>` },
          { h: "Entity", r: (r) => `<a class="t" href="#/lead/${r.lead}">${esc(lead(r.lead) ? lead(r.lead).title : r.lead)}</a><div class="small muted">${esc(uname(r.from))} → <b>${esc(uname(r.to))}</b> · “${esc(r.reason)}”</div>` },
          { h: "Requested By", r: (r) => person(r.requestedBy) },
          { h: "Status", r: (r) => ({ pending: badge("amber", "Pending"), approved: badge("green", "Approved"), rejected: badge("red", "Rejected") }[r.status]) },
          { h: "Created At", r: (r) => fmtDate(r.at) },
          { h: "", r: (r) => (r.status === "pending" ? `<span style="display:inline-flex;gap:6px"><button class="btn btn-sm" data-act="reject-req" data-id="${r.id}">Reject</button><button class="btn btn-sm btn-primary" data-act="approve-req" data-id="${r.id}">Approve</button></span>` : "") },
        ], list, { empty: "No requests." })),
    };
  };

  /* -------------------------------------------------------------- accounts */
  // CRM: app/(crm)/crm/accounts/page.tsx + AccountTable (Account, Contact, Revenue, Leads, Last Activity, Actions)
  // Agent: app/(agent)/agent/accounts/page.tsx "Related Accounts"
  PAGES.accounts = function () {
    const st = ui("accounts"); st.f = st.f || "all";
    let list = S.accounts();
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter((a) => [a.id, a.name, a.display, a.industry, primaryContact(a).name, primaryContact(a).mobile, primaryContact(a).email].join(" ").toLowerCase().includes(q)); }
    const revenue = (a) => sum(INVOICES.filter((i) => i.account === a.id), (i) => i.paid);
    if (is("agent")) {
      const withMatters = (a) => MATTERS.some((m) => m.account === a.id && m.status !== "closed");
      const activeLeads = (a) => LEADS.filter((l) => l.account === a.id && OPEN(l)).length;
      if (st.f === "Invited" || st.f === "Portal") list = list.filter((a) => a.portal === st.f);
      const all = S.accounts();
      return {
        crumbs: ["Sales", "Related Accounts"],
        html: head("Related Accounts", "Clients connected to your matters and leads.", `<button class="btn btn-primary" data-act="new-account">${ic("plus", 14)} New Account</button>`)
          + stats([tile("Client Accounts", all.length, "", "javascript:void 0", "accounts"), tile("Active Leads", sum(all, activeLeads), "", "javascript:void 0", "leads"), tile("With Matters", all.filter(withMatters).length, "", "javascript:void 0", "matters"), tile("No Active Work", all.filter((a) => !withMatters(a) && !activeLeads(a)).length, "", "javascript:void 0", "clock")])
          + `<div class="toolbar">${search("accounts.q", st.q, "Search name, account #, contact, phone, email…")}${seg("accounts.f", st.f, [{ value: "all", label: "All" }, { value: "Invited", label: "Invited" }, { value: "Portal", label: "Portal" }])}</div>`
          + panel("Accounts", list.length, table([
            { h: "Account", r: (a) => `<span class="t">${esc(a.display)}</span><div class="small muted mono">${esc(a.id)}</div>` },
            { h: "Type", r: (a) => esc(a.type) },
            { h: "Contact", r: (a) => { const c = primaryContact(a); return `${esc(c.name || "—")}<div class="small muted">${esc(c.mobile || "")}</div>`; } },
            { h: "Leads", num: 1, r: (a) => LEADS.filter((l) => l.account === a.id).length },
            { h: "Matters", num: 1, r: (a) => MATTERS.filter((m) => m.account === a.id).length },
            { h: "Billing", num: 1, r: (a) => inr(sum(INVOICES.filter((i) => i.account === a.id), (i) => i.total - i.paid)) + '<div class="small muted">outstanding</div>' },
            { h: "Last Activity", r: (a) => fmtDate(a.lastActivity) },
          ], list, { href: (a) => "#/account/" + a.id })),
      };
    }
    const all = S.accounts();
    if (st.f === "active") list = list.filter((a) => a.status === "Active"); else if (st.f === "inactive") list = list.filter((a) => a.status !== "Active");
    return {
      crumbs: ["Sales", "Accounts"],
      html: head("Accounts", "Client companies and individuals.", `<button class="btn" data-act="soon">${ic("upload", 14)} Bulk Import</button><button class="btn btn-primary" data-act="new-account">${ic("plus", 14)} New Account</button>`)
        + stats([tile("Total Accounts", all.length, "", "javascript:void 0", "accounts"), tile("Active", all.filter((a) => a.status === "Active").length, "", "javascript:void 0", "check"), tile("With Open Leads", all.filter((a) => LEADS.some((l) => l.account === a.id && OPEN(l))).length, "", "javascript:void 0", "leads"), tile("Revenue Collected", inr(sum(all, revenue)), "", "javascript:void 0", "rupee")])
        + `<div class="toolbar">${search("accounts.q", st.q, "Search accounts, contacts, phone, email…")}${seg("accounts.f", st.f, [{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }])}${st.q || st.f !== "all" ? `<button class="btn btn-sm btn-ghost" data-act="clear-filters" data-page="accounts">Clear filters</button>` : ""}</div>`
        + panel("Accounts", list.length, table([
          { h: "Account", r: (a) => `<span class="t">${esc(a.display)}</span><div class="small muted"><span class="mono">${esc(a.id)}</span> · ${esc(a.type)} · ${esc(a.industry)}</div>` },
          { h: "Contact", r: (a) => { const c = primaryContact(a); return `${esc(c.name || "—")}<div class="small muted">${esc(c.mobile || "")}</div>`; } },
          { h: "Revenue", num: 1, r: (a) => inr(revenue(a)) },
          { h: "Leads", num: 1, r: (a) => LEADS.filter((l) => l.account === a.id).length },
          { h: "Last Activity", r: (a) => fmtDate(a.lastActivity) },
          { h: "Owner", r: (a) => person(a.owner) },
          { h: "Actions", r: (a) => { const c = primaryContact(a); return c.mobile ? contactActions(c.mobile, c.email) : ""; } },
        ], list, { href: (a) => "#/account/" + a.id, empty: "No accounts yet." })),
    };
  };
  const primaryContact = (a) => CONTACTS.find((c) => c.account === a.id && c.primary) || CONTACTS.find((c) => c.account === a.id) || {};

  // Account workspace (components/accounts/workspace/*)
  PAGES.account = function (id) {
    const a = S.accounts().find((x) => x.id === id);
    if (!a) return notFound("Account not found, or it's outside your access.");
    const st = ui("account:" + id); st.tab = st.tab || "overview";
    if (st.tab === "filings" || (st.tab === "matters" && !canOpen("matters"))) st.tab = st.tab === "filings" ? "matters" : "overview";
    const contacts = CONTACTS.filter((c) => c.account === a.id);
    const leads = LEADS.filter((l) => l.account === a.id);
    const visible = new Set(S.leads().map((l) => l.id));
    const ests = ESTIMATES.filter((e) => leads.some((l) => l.id === e.lead));
    const invs = INVOICES.filter((i) => i.account === a.id);
    const matters = MATTERS.filter((m) => m.account === a.id);
    const pc = primaryContact(a);
    const pipeline = sum(leads.filter(OPEN), (l) => l.value);
    const estimated = sum(ests.filter((e) => e.status !== "revised"), (e) => estTotal(e).total);
    const invoiced = sum(invs, (i) => i.total), collected = sum(invs, (i) => i.paid);
    const leadRow = (l) => (visible.has(l.id) ? `<a href="#/lead/${l.id}" class="t">${esc(l.title)}</a>` : `<span class="t muted" title="You are not assigned or a contributor on this lead">${ic("lock", 12)} ${esc(l.title)}</span>`);
    const leadsTable = table([{ h: "Lead", r: (l) => `${leadRow(l)}<div class="small muted mono">${esc(l.id)}</div>` }, { h: "Status", r: (l) => leadStatus(l.status) }, { h: "Owner", r: (l) => person(l.owner) }, { h: "Value", num: 1, r: (l) => inr(l.value) }], leads, { empty: "No leads." });
    const contactsList = contacts.length ? `<div class="rows">${contacts.map((c) => `<div class="row-item"><span class="avatar sm light">${esc(initials(c.name))}</span><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.designation)} · ${esc(c.mobile)} · ${esc(c.email)}</div></div><span style="display:inline-flex;gap:4px">${c.primary ? badge("blue", "Primary") : ""}${c.billing ? badge("teal", "Billing") : ""}${c.technical ? badge("purple", "Technical") : ""}</span></div>`).join("")}</div>` : '<div class="empty">No contacts recorded</div>';
    const actIds = new Set(leads.map((l) => l.id));
    const acts = LEAD_ACTIVITIES.filter((x) => actIds.has(x.lead));
    const timeline = acts.length ? `<div class="timeline">${acts.map((x) => `<div class="tl-item">${avatar(x.by, true)}<div><div class="head"><b>${esc(uname(x.by))}</b>${badge("blue", cap(x.type))}<span class="muted small">${esc(x.at)}</span></div><p>${esc(x.text)}</p></div></div>`).join("")}</div>` : '<div class="empty">No activity logged yet</div>';
    const docs = DOCUMENTS.filter((d) => matters.some((m) => m.id === d.matter));

    // Matters under this client, filterable by service and by stage.
    const seeMatters = canOpen("matters");
    const myMatters = new Set(S.matters().map((m) => m.id));
    const nextDate = (m) => DEADLINES.filter((x) => x.matter === m.id && !x.done).sort((p, q) => byDate(toUTC(p.due), toUTC(q.due)))[0] || null;
    const svcList = [...new Set(matters.map((m) => m.category))].sort((x, y) => ((SERVICE_NAV.indexOf(x) + 1) || 99) - ((SERVICE_NAV.indexOf(y) + 1) || 99) || x.localeCompare(y));
    const stagePill = (m) => {
      if (!m.stage) return `<span class="stage-pill none" title="Recorded: ${esc(m.legacyStage || "not recorded")}">Not recorded</span>`;
      const steps = stagesOf(m), i = steps.indexOf(m.stage);
      return `<span class="stage-pill tone-${stageTone(m.stage, Math.max(0, i))}">${esc(m.stage)}</span>${i >= 0 ? `<span class="small muted" style="margin-left:6px">${i + 1}/${steps.length}</span>` : ""}`;
    };
    const matterTitle = (m) => (myMatters.has(m.id) ? `<a class="t" href="#/matter/${m.id}">${esc(m.title)}</a>` : `<span class="t muted" title="You are not on this matter's team">${ic("lock", 12)} ${esc(m.title)}</span>`)
      + `<div class="m-sub"><span class="tag">${esc(m.category)}</span><span class="mono">${esc(appNoOf(m) || m.id)}</span>${m.status === "closed" ? matterStatus(m.status) : ""}</div>`;
    const mattersTab = () => {
      let svc = st.msvc || "all"; if (svc !== "all" && !svcList.includes(svc)) svc = "all";
      const bySvc = svc === "all" ? matters : matters.filter((m) => m.category === svc);
      // Stage choices: the selected service's stages in order (all of them, with counts);
      // for "All services", every stage that at least one of this client's matters is at.
      const order = [...new Set((svc === "all" ? svcList : [svc]).flatMap((c) => SERVICE_STAGES[c] || []))];
      const stageChoices = order.filter((s) => svc !== "all" || bySvc.some((m) => m.stage === s)).map((s) => ({ value: s, label: `${s} (${bySvc.filter((m) => m.stage === s).length})` }));
      const unrec = bySvc.filter((m) => !m.stage).length;
      if (unrec) stageChoices.push({ value: "__none", label: `Stage not recorded (${unrec})` });
      let stage = st.mstage || "all"; if (stage !== "all" && !stageChoices.some((c) => c.value === stage)) stage = "all";
      const q = (st.mq || "").trim().toLowerCase();
      const list = bySvc
        .filter((m) => stage === "all" || (stage === "__none" ? !m.stage : m.stage === stage))
        .filter((m) => !q || [m.title, m.id, appNoOf(m), m.category, m.stage, uname(m.owner)].join(" ").toLowerCase().includes(q))
        .map((m) => ({ m, nd: nextDate(m) }))
        .sort((x, y) => (x.m.status === "closed" ? 1 : 0) - (y.m.status === "closed" ? 1 : 0) || (x.nd ? 0 : 1) - (y.nd ? 0 : 1) || (x.nd && y.nd ? byDate(toUTC(x.nd.due), toUTC(y.nd.due)) : 0));
      const filtered = svc !== "all" || stage !== "all" || q;
      return `<div class="m-filters">
          ${seg(`account:${id}.msvc`, svc, [{ value: "all", label: "All services", n: matters.length }, ...svcList.map((c) => ({ value: c, label: c, n: matters.filter((m) => m.category === c).length }))])}
          <div class="toolbar" style="margin:10px 0 0">${search(`account:${id}.mq`, st.mq, "Search title, application no., agent…")}${sel(`account:${id}.mstage`, stage, [{ value: "all", label: svc === "all" ? "All stages" : `All ${svc} stages` }, ...stageChoices])}<span class="spacer"></span>${filtered ? `<span class="small sub">Showing <b>${list.length}</b> of ${matters.length}</span><button class="btn btn-sm btn-ghost" data-act="acct-matter-clear" data-id="${a.id}">Clear</button>` : `<span class="small sub"><b>${matters.filter((m) => m.status !== "closed").length}</b> open · ${matters.filter((m) => m.status === "closed").length} closed</span>`}</div>
        </div>`
        + panel("Matters", list.length, table([
          { h: "Matter", r: ({ m }) => matterTitle(m) },
          { h: "Stage", r: ({ m }) => stagePill(m) },
          { h: "Agent", r: ({ m }) => (m.owner ? `<span style="display:inline-flex;gap:8px;align-items:center;white-space:nowrap">${avatar(m.owner, true)}<span class="small">${esc(uname(m.owner).split(" ")[0])}</span></span>` : '<span class="muted small">Unassigned</span>') },
          { h: "Next date", r: ({ nd }) => (nd ? `${dueStatus(nd.due)}<div class="small muted m-dtype" title="${esc(nd.type)}">${esc(nd.type)}</div>` : '<span class="muted small">None open</span>') },
        ], list, { empty: matters.length ? "No matters match these filters." : "No matters on record for this client." }));
    };
    // Overview card: the client's open matters, nearest date first.
    const openMatters = matters.filter((m) => m.status !== "closed").map((m) => ({ m, nd: nextDate(m) })).sort((x, y) => (x.nd ? 0 : 1) - (y.nd ? 0 : 1) || (x.nd && y.nd ? byDate(toUTC(x.nd.due), toUTC(y.nd.due)) : 0));
    const mattersCard = seeMatters ? panel("Open Matters", openMatters.length, table([
      { h: "Matter", r: ({ m }) => matterTitle(m) },
      { h: "Stage", r: ({ m }) => stagePill(m) },
      { h: "Next date", r: ({ nd }) => (nd ? dueStatus(nd.due) : '<span class="muted small">None open</span>') },
    ], openMatters.slice(0, 5), { empty: "No open matters for this client." }), matters.length ? `<button class="btn btn-sm" data-act="seg" data-name="account:${id}.tab" data-val="matters">View all ${matters.length}</button>` : "") : "";

    const tabBody = {
      overview: `<div class="grid-even">${panel("Open Leads", leads.filter(OPEN).length, table([{ h: "Lead", r: leadRow }, { h: "Status", r: (l) => leadStatus(l.status) }, { h: "Value", num: 1, r: (l) => inr(l.value) }], leads.filter(OPEN), { empty: "No open leads." }))}${panel("Revenue Snapshot", null, `<div class="panel-body">${bars([{ l: "Pipeline", v: pipeline, c: "blue" }, { l: "Estimated", v: estimated, c: "purple" }, { l: "Invoiced", v: invoiced, c: "amber" }, { l: "Collected", v: collected, c: "green" }], inr)}</div>`)}</div>
        ${mattersCard}
        <div class="grid-even">${panel("Recent Activity", acts.length, acts.length ? timeline : '<div class="empty">No activity logged yet</div>')}${panel("Contacts", contacts.length, contactsList)}</div>`,
      leads: panel("Leads", leads.length, leadsTable) + panel("Contacts", contacts.length, contactsList, `<button class="btn btn-sm" data-act="soon">${ic("plus", 14)} Add Contact</button>`),
      revenue: panel("Revenue Summary", null, `<div class="panel-body">${quiet([[inr(pipeline), "Pipeline"], [inr(estimated), "Estimated"], [inr(invoiced), "Invoiced"], [inr(collected), "Paid"], [inr(invoiced - collected), "Outstanding", invoiced - collected > 0]])}</div>`)
        + panel("Estimates", ests.length, table([{ h: "Estimate No", r: (e) => `<a class="mono" href="#/estimate/${e.id}">${esc(e.id)}</a>` }, { h: "Lead", r: (e) => esc(lead(e.lead).title) }, { h: "Status", r: (e) => estStatus(e.status) }, { h: "Amount", num: 1, r: (e) => inr(estTotal(e).total) }], ests, { empty: "No estimates yet" }))
        + panel("Invoices", invs.length, table([{ h: "Invoice", r: (i) => `<span class="mono">${esc(i.id)}</span>` }, { h: "Matter", r: (i) => matterLink(i.matter) }, { h: "Date", r: (i) => fmtDate(i.date) }, { h: "Status", r: (i) => invStatus(i.status) }, { h: "Total", num: 1, r: (i) => inr(i.total) }, { h: "Balance", num: 1, r: (i) => inr(i.total - i.paid) }], invs, { empty: "No invoices raised" })),
      documents: panel("Documents", docs.length, table([{ h: "File", r: (d) => `<span class="t">${esc(d.file)}</span><div class="small muted">${esc(d.type)}</div>` }, { h: "Linked to", r: (d) => `Matter ${matterLink(d.matter)}` }, { h: "Uploaded", r: (d) => `${fmtDate(d.date)} · ${esc(uname(d.by))}` }], canOpen("matters") ? docs : [], { empty: canOpen("matters") ? "No documents." : "Matter documents are visible to the delivery team." }), `<button class="btn btn-sm" data-act="soon">${ic("upload", 14)} Upload Document</button>`),
      activities: panel("Activity Timeline", acts.length, timeline),
      notes: panel("Account Note", null, `<div class="panel-body"><textarea class="textarea" style="min-height:140px" data-change="account-note" data-id="${a.id}" placeholder="Any notes about this account...">${esc(a.notes)}</textarea><div class="help" style="margin:6px 0 0">Saved automatically.</div></div>`),
      matters: mattersTab(),
    }[st.tab];

    // CEO (admin) view: the client relationship at a glance, using the same rules as My Portfolio.
    // Every number comes from a recorded field: matter stage, deadlines, invoices, open leads.
    const ceo = is("admin") ? (() => {
      const filings = matters.filter((m) => IP_TYPES.includes(m.category));
      const fids = new Set(filings.map((m) => m.id)), mids = new Set(matters.map((m) => m.id));
      const inB = (k) => filings.filter((m) => bucketOf(m).key === k);
      const pct = (n, of) => (of ? Math.round((100 * n) / of) : 0);
      const openDls = DEADLINES.filter((d) => mids.has(d.matter) && !d.done);
      const overdue = openDls.filter((d) => daysFrom(d.due) < 0);
      const renewals = DEADLINES.filter((d) => fids.has(d.matter) && RENEWAL_KINDS[d.kind] && !d.done).sort((x, y) => byDate(toUTC(x.due), toUTC(y.due)));
      const outstanding = invoiced - collected;
      const unpaid = invs.filter((i) => i.total - i.paid > 0).sort((x, y) => (y.total - y.paid) - (x.total - x.paid));
      const groups = BUCKETS.concat([{ key: "unknown", label: "Stage unknown", color: "var(--ghost)" }]).map((b) => ({ ...b, ms: inB(b.key) })).filter((g) => g.ms.length || g.key !== "unknown");
      const lastInv = invs.slice().sort((x, y) => byDate(toUTC(y.date), toUTC(x.date)))[0];

      const sentence = `${a.since ? `Client since <b>${esc(fmtDate(a.since))}</b>. ` : ""}`
        + (filings.length ? `<b>${filings.length}</b> IP filing${filings.length === 1 ? "" : "s"} with us: <b>${inB("registered").length}</b> registered or granted (${pct(inB("registered").length, filings.length)}%), <b>${inB("pending").length}</b> pending at the office, and ${inB("contested").length ? `<b class="red">${inB("contested").length} at objection or hearing</b>` : "none at objection or hearing"}. ` : "No IP filings on record. ")
        + (invoiced ? `Billed <b>${inrShort(invoiced)}</b>, collected <b>${inrShort(collected)}</b> (${pct(collected, invoiced)}%)${outstanding > 0 ? `, <b class="red">${inrShort(outstanding)} outstanding</b>` : ", nothing outstanding"}. ` : "Nothing invoiced yet. ")
        + (pipeline ? `<b>${inrShort(pipeline)}</b> in open leads.` : "No open leads.");

      const bar = filings.length ? `<div class="book-bar">${groups.filter((g) => g.ms.length).map((g) => `<i style="flex:${g.ms.length};background:${g.color}" title="${esc(g.label)}: ${g.ms.length}"></i>`).join("")}</div>
        <div class="book-keys">${groups.map((g) => `<div class="bk${g.key === "contested" && g.ms.length ? " alert" : ""}"><span class="bk-sw" style="background:${g.color}"></span><span class="bk-v">${g.ms.length}</span><span class="bk-l">${esc(g.label)}</span><span class="bk-p">${pct(g.ms.length, filings.length)}%</span></div>`).join("")}</div>` : "";
      const money = `<div class="money m5">
          <div><span>Lifetime billed</span><b>${inrShort(invoiced)}</b></div>
          <div><span>Collected</span><b>${inrShort(collected)}</b></div>
          <div><span>Outstanding</span><b class="${outstanding > 0 ? "red" : ""}">${inrShort(outstanding)}</b></div>
          <div><span>Open pipeline</span><b>${inrShort(pipeline)}</b></div>
          <div><span>Overdue deadlines</span><b class="${overdue.length ? "red" : ""}">${overdue.length}</b></div>
        </div>`;

      // Exceptions on this client: contested filings, overdue official dates, unpaid balances.
      const attn = [
        ...inB("contested").map((m) => ({ href: `#/matter/${m.id}`, t: m.title, s: `${appNoOf(m) || m.id} · ${m.category} · ${uname(m.owner)}`, why: `At ${m.appStage}` })),
        ...overdue.map((d) => { const m = matter(d.matter) || {}; return { href: `#/matter/${d.matter}`, t: m.title || d.matter, s: `${m.category || ""} · ${uname(m.owner)}`, why: `${d.type} overdue since ${fmtDate(d.due)}` }; }),
        ...unpaid.slice(0, 3).map((i) => ({ href: `#/matter/${i.matter}`, t: `Invoice ${i.id}`, s: `Raised ${fmtDate(i.date)}`, why: `${inr(i.total - i.paid)} unpaid` })),
      ];
      const attnHtml = attn.length ? `<div class="attn">${attn.map((x) => `<a class="attn-row" href="${x.href}"><span class="attn-dot red"></span><span class="attn-t"><b>${esc(x.t)}</b><small>${esc(x.s)}</small><span class="attn-why left"><span class="why">${esc(x.why)}</span></span></span><span class="attn-go">${ic("chev-r", 14)}</span></a>`).join("")}${unpaid.length > 3 ? `<div class="small muted" style="padding:8px 0 0">+ ${unpaid.length - 3} more unpaid invoice${unpaid.length - 3 === 1 ? "" : "s"} on the Revenue tab</div>` : ""}</div>`
        : `<div class="attn-clear">${ic("check", 16)} Nothing at objection or hearing, no overdue dates, and no unpaid invoices.</div>`;
      const renHtml = `<div class="panel-body">${renewals.length ? `<div class="ren-list">${renewals.slice(0, 5).map((d) => { const m = matter(d.matter) || {}; return dlRow({ href: `#/matter/${d.matter}`, due: d.due, title: m.title || d.matter, showOwner: false, meta: [esc(RENEWAL_KINDS[d.kind]), m.appStage !== "registered" && d.kind === "renewal" ? '<span class="amber">not registered yet</span>' : ""] }); }).join("")}${renewals.length > 5 ? `<div class="small muted" style="padding:8px 0 0">+ ${renewals.length - 5} more on the Matters tab</div>` : ""}</div>` : '<div class="empty">No renewal dates recorded for this client.</div>'}
          <div class="kv-foot small muted" style="margin-top:10px">Last invoice: ${lastInv ? `<b style="color:var(--ink)">${esc(fmtDate(lastInv.date))}</b> · ${inr(lastInv.total)}` : "none"} · Last activity: ${a.lastActivity ? `<b style="color:var(--ink)">${esc(fmtDate(a.lastActivity))}</b>` : "not recorded"}</div></div>`;

      return `<section class="panel book"><p class="kicker" style="margin:0 0 6px">Client at a glance · CEO view</p><p class="sentence">${sentence}</p>${bar}${money}</section>
        <div class="grid-2">${panel("Needs attention", attn.length, attnHtml)}${panel("Renewals & relationship", renewals.length, renHtml)}</div>`;
    })() : "";
    return {
      crumbs: [`<a href="#/accounts">${esc(label("accounts"))}</a>`, esc(a.display)],
      html: `<div class="detail-head"><div><div class="id">${esc(a.id)} · ${esc(a.type)}</div><h1>${esc(a.display)}</h1>
          <div class="facts"><span>${esc(a.name)}</span>${pc.name ? `<span>${ic("users", 13)} ${esc(pc.name)}</span><span class="mono">${esc(pc.mobile)}</span><span>${esc(pc.email)}</span>` : ""}${a.website ? `<span>${esc(a.website)}</span>` : ""}${a.status === "Active" ? badge("green", "Active") : badge("gray", "Inactive")}</div></div>
          <div class="page-head"><div class="actions">${can.editLead({ owner: a.owner, contributors: [] }) || is("admin", "sales_manager") ? `<button class="btn" data-act="log-account-activity" data-id="${a.id}">${ic("note", 14)} Log Activity</button>` : ""}${!is("agent") ? `<button class="btn btn-primary" data-act="new-lead" data-account="${a.id}">${ic("plus", 14)} New Lead</button>` : ""}</div></div></div>
        ${ceo}
        ${quiet([...(seeMatters ? [[matters.length, "Matters"]] : []), [leads.length, "Leads"], [contacts.length, "Contacts"], [inr(pipeline), "Pipeline Value"], [inr(collected), "Revenue Collected"], [leads.filter(OPEN).length, "Open Leads"], [leads.filter((l) => l.status === "converted").length, "Won Leads"], [ests.length, "Estimates"], [invs.length, "Invoices"]])}
        <div class="grid-2"><div>
          ${tabs(`account:${id}.tab`, st.tab, [{ value: "overview", label: "Overview" }, { value: "leads", label: "Leads & Contacts", n: leads.length + contacts.length }, ...(seeMatters ? [{ value: "matters", label: "Matters", n: matters.length }] : []), { value: "revenue", label: "Revenue" }, { value: "documents", label: "Documents" }, { value: "activities", label: "Activities", n: acts.length }, { value: "notes", label: "Notes" }])}
          ${tabBody}
        </div><div>
          ${panel("Account Owner", null, `<div class="row-item">${avatar(a.owner, true)}<div class="grow"><div class="t">${esc(uname(a.owner))}</div><div class="s">Relationship manager</div></div></div>`)}
          ${panel("Primary Contact", null, pc.name ? `<div class="row-item"><span class="avatar sm light">${esc(initials(pc.name))}</span><div class="grow"><div class="t">${esc(pc.name)}</div><div class="s">${esc(pc.designation)}</div></div>${contactActions(pc.mobile, pc.email)}</div>` : '<div class="empty">No contacts recorded</div>')}
          ${panel("Company Profile", null, `<div class="panel-body">${kv([["Industry", esc(a.industry)], ["Entity Type", esc(a.type)], ["Client Group", esc(a.group)], ["CIN / LLPIN", a.cin ? `<span class="mono">${esc(a.cin)}</span>` : ""], ["Website", esc(a.website)], ["Matters on record", String(matters.length)]])}</div>`)}
          ${panel("Compliance", null, `<div class="panel-body">${kv([["PAN", a.pan ? `<span class="mono">${esc(a.pan)}</span>` : ""], ["GSTIN", a.gstin ? `<span class="mono">${esc(a.gstin)}</span>` : ""], ["Udyam No.", a.udyam ? `<span class="mono">${esc(a.udyam)}</span>` : ""], ["DPIIT", a.dpiit ? `<span class="mono">${esc(a.dpiit)}</span>` : ""]])}</div>`)}
          ${panel("Portal Access", null, `<div class="panel-body" style="display:flex;justify-content:space-between;align-items:center">${({ Portal: badge("green", "Active on portal"), Invited: badge("amber", "Invited"), None: badge("gray", "Not invited") }[a.portal] || '<span class="muted">Not recorded</span>')}<button class="btn btn-sm" data-act="soon">View as Client</button></div>`)}
          ${panel("Account Info", null, `<div class="panel-body">${kv([["Account Number", `<span class="mono">${esc(a.id)}</span>`], ["Created", fmtDate(a.since)], ["Last Updated", fmtDate(a.lastActivity)], ["Lead Source", esc(a.source)]])}</div>`)}
        </div></div>`,
    };
  };

  /* ------------------------------------------------------------- estimates */
  // components/crm/EstimatesList.tsx
  PAGES.estimates = function () {
    const st = ui("estimates"); st.f = st.f || "all"; st.sort = st.sort || "new";
    const all = S.estimates().filter((e) => e.status !== "revised" || st.f === "all");
    let list = st.f === "all" ? all : all.filter((e) => e.status === st.f);
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter((e) => [e.id, lead(e.lead).title, lead(e.lead).company, uname(e.preparedBy)].join(" ").toLowerCase().includes(q)); }
    const sorters = { new: (a, b) => byDate(toUTC(b.date), toUTC(a.date)), old: (a, b) => byDate(toUTC(a.date), toUTC(b.date)), hi: (a, b) => estTotal(b).total - estTotal(a).total, lo: (a, b) => estTotal(a).total - estTotal(b).total, exp: (a, b) => byDate(toUTC(a.validUntil), toUTC(b.validUntil)) };
    list = list.slice().sort(sorters[st.sort]);
    const n = (s) => S.estimates().filter((e) => e.status === s).length;
    return {
      crumbs: [SECTION_OF("estimates"), "Estimates"],
      html: head("Estimates", "Quotes prepared for leads. Each revision is kept as a new version.", `<button class="btn btn-primary" data-act="pick-lead-estimate">${ic("plus", 14)} New Estimate</button>`)
        + tabs("estimates.f", st.f, [{ value: "all", label: "All", n: S.estimates().length }, { value: "draft", label: "Draft", n: n("draft") }, { value: "sent", label: "Sent", n: n("sent") }, { value: "viewed", label: "Viewed", n: n("viewed") }, { value: "approved", label: "Approved", n: n("approved") }, { value: "converted", label: "Converted", n: n("converted") }, { value: "expired", label: "Expired", n: n("expired") }])
        + `<div class="toolbar">${search("estimates.q", st.q, "Search estimates, leads, owners…")}${sel("estimates.sort", st.sort, [{ value: "new", label: "Newest first" }, { value: "old", label: "Oldest first" }, { value: "hi", label: "Amount: High → Low" }, { value: "lo", label: "Amount: Low → High" }, { value: "exp", label: "Expiring soonest" }])}<span class="spacer"></span><span class="small sub">Total <b>${inr(sum(list, (e) => estTotal(e).total))}</b></span></div>`
        + panel("Estimates", list.length, table([
          { h: "Estimate No", r: (e) => `<span class="mono">${esc(e.id)}</span>` },
          { h: "Version", r: (e) => `<span class="tag">v${e.version}</span>` },
          { h: "Lead", r: (e) => `<span class="t">${esc(lead(e.lead).title)}</span><div class="small muted">${esc(lead(e.lead).company)}</div>` },
          { h: "Amount", num: 1, r: (e) => inr(estTotal(e).total) },
          { h: "Status", r: (e) => estStatus(e.status) },
          { h: "Valid Until", r: (e) => (["draft", "sent", "viewed"].includes(e.status) ? dueStatus(e.validUntil) : fmtDate(e.validUntil)) },
          { h: "Owner", r: (e) => person(e.preparedBy) },
          { h: "Firm", r: (e) => `<span class="small">${esc(e.firm)}</span>` },
          { h: "Services", r: (e) => `<span class="small">${esc(e.items.map((i) => i.service).join(", "))}</span>` },
        ], list, { href: (e) => "#/estimate/" + e.id, empty: "No estimates in this view." })),
    };
  };

  PAGES.estimate = function (id) {
    const e = S.estimates().find((x) => x.id === id);
    if (!e) return notFound("Estimate not found, or it's outside your access.");
    const l = lead(e.lead), t = estTotal(e), a = l.account ? acct(l.account) : null;
    const editable = can.editLead(l) || is("admin", "sales_manager");
    const actions = [
      editable && e.status === "draft" ? `<button class="btn btn-primary" data-act="est-status" data-id="${e.id}" data-to="sent">Send to Client</button>` : "",
      editable && ["sent", "viewed"].includes(e.status) ? `<button class="btn btn-primary" data-act="est-status" data-id="${e.id}" data-to="approved">Mark Approved</button>` : "",
      editable && ["draft", "sent", "viewed"].includes(e.status) ? `<button class="btn" data-act="new-estimate" data-lead="${l.id}">Revise</button>` : "",
      `<button class="btn" data-act="print">Download PDF</button>`,
    ].join("");
    return {
      crumbs: [`<a href="#/estimates">Estimates</a>`, esc(e.id)],
      html: `<div class="detail-head"><div><div class="id">${esc(e.id)} · Version ${e.version}</div><h1>${esc(l.title)}</h1><div class="facts">${estStatus(e.status)}<a href="#/lead/${l.id}">${esc(l.id)}</a><span>${esc(l.company)}</span><span>Prepared by ${esc(uname(e.preparedBy))} on ${fmtDate(e.date)}</span><span>Valid until ${fmtDate(e.validUntil)}</span></div></div><div class="page-head"><div class="actions">${actions}</div></div></div>
        <div class="grid-2"><div>
          ${panel("PDF Preview", null, `<div class="panel-body" style="background:var(--gray-4)"><div style="background:#fff;border:1px solid var(--gray-3);padding:28px 32px;max-width:720px;margin:0 auto">
            <div style="display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid var(--navy);padding-bottom:12px;margin-bottom:16px"><div><div class="brand-mark" style="color:var(--navy)"><span class="seal">E</span>EEVA</div><div class="small muted" style="margin-top:4px">${esc(e.firm)}</div></div><div class="right"><div style="font-size:18px;font-weight:800;color:var(--navy)">ESTIMATE</div><div class="mono">${esc(e.id)} · v${e.version}</div><div class="small muted">${fmtDate(e.date)}</div></div></div>
            <div class="small" style="margin-bottom:14px"><b>Billed to</b><br>${esc(a ? a.name : l.company)}<br>${esc(l.contactName)} · ${esc(l.email)}${a && a.gstin ? `<br>GSTIN ${esc(a.gstin)}` : ""}</div>
            ${table([{ h: "Service", r: (i) => `<span class="t">${esc(i.service)}</span>` }, { h: "Professional Fee", num: 1, r: (i) => inr(i.prof) }, { h: "Government Fee", num: 1, r: (i) => inr(i.govt) }, { h: "Amount", num: 1, r: (i) => inr(i.prof + i.govt) }], e.items)}
            <div style="max-width:300px;margin:14px 0 0 auto">${kv([["Subtotal", `<span class="mono">${inr(t.sub)}</span>`], ["GST 18% (prof. fee)", `<span class="mono">${inr(t.gst)}</span>`], ["Total", `<b class="mono">${inr(t.total)}</b>`]])}</div>
          </div></div>`)}
        </div><div>
          ${panel("Versions", null, table([{ h: "Version", r: (x) => (x.id === e.id ? `<b>v${x.version}</b> (this)` : `<a href="#/estimate/${x.id}">v${x.version}</a>`) }, { h: "Status", r: (x) => estStatus(x.status) }, { h: "Total", num: 1, r: (x) => inr(estTotal(x).total) }], ESTIMATES.filter((x) => x.lead === e.lead).sort((p, q) => q.version - p.version)))}
          ${panel("Source", null, `<div class="panel-body">${kv([["Lead", `<a href="#/lead/${l.id}">${esc(l.id)}</a>`], ["Account", a ? `<a href="#/account/${a.id}">${esc(a.display)}</a>` : "New client"], ["Sales executive", esc(uname(l.owner))], ["Matter", l.matterId ? matterLink(l.matterId) : ""]])}</div>`)}
        </div></div>`,
    };
  };

  /* -------------------------------------------------------------- invoices */
  // components/crm/InvoicesList.tsx (CRM) and components/invoices/InvoicesList (Admin)
  PAGES.invoices = function () {
    const st = ui("invoices"); st.f = st.f || "all"; st.sort = st.sort || "new";
    const all = S.invoices();
    let list = st.f === "all" ? all : st.f === "outstanding" ? all.filter((i) => i.total > i.paid && i.status !== "CANCELLED") : all.filter((i) => i.status === st.f);
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter((i) => [i.id, acct(i.account).display, i.matter, i.source].join(" ").toLowerCase().includes(q)); }
    const sorters = { new: (a, b) => byDate(toUTC(b.date), toUTC(a.date)), old: (a, b) => byDate(toUTC(a.date), toUTC(b.date)), hi: (a, b) => b.total - a.total, lo: (a, b) => a.total - b.total, due: (a, b) => byDate(toUTC(a.due), toUTC(b.due)) };
    list = list.slice().sort(sorters[st.sort]);
    const n = (s) => all.filter((i) => i.status === s).length;
    const outstanding = sum(all.filter((i) => i.status !== "CANCELLED"), (i) => i.total - i.paid);
    return {
      crumbs: [SECTION_OF("invoices"), "Invoices"],
      html: head("Invoices", is("sales_executive") ? "Invoices for the accounts you own." : "Invoices raised against matters.")
        + tabs("invoices.f", st.f, [{ value: "all", label: "Total Invoices", n: all.length }, { value: "GENERATED", label: "Draft", n: n("GENERATED") }, { value: "SENT", label: "Sent", n: n("SENT") }, { value: "PAID", label: "Paid", n: n("PAID") }, { value: "PARTIALLY_PAID", label: "Partially Paid", n: n("PARTIALLY_PAID") }, { value: "OVERDUE", label: "Overdue", n: n("OVERDUE") }, { value: "CANCELLED", label: "Cancelled", n: n("CANCELLED") }, { value: "outstanding", label: `Outstanding ${inr(outstanding)}` }])
        + `<div class="toolbar">${search("invoices.q", st.q, "Search invoice, account, matter…")}${sel("invoices.sort", st.sort, [{ value: "new", label: "Newest first" }, { value: "old", label: "Oldest first" }, { value: "hi", label: "Amount: High → Low" }, { value: "lo", label: "Amount: Low → High" }, { value: "due", label: "Due soonest" }])}</div>`
        + panel("Invoices", list.length, table([
          { h: "Invoice", r: (i) => `<span class="mono t">${esc(i.id)}</span><div class="small muted">${fmtDate(i.date)}</div>` },
          { h: "Account", r: (i) => esc(acct(i.account).display) },
          { h: "Source", r: (i) => `<span class="small">${esc(i.source)}</span><div class="small">${matterLink(i.matter)}</div>` },
          { h: "Firm", r: (i) => `<span class="small">${esc(i.firm)}</span>` },
          { h: "Amount", num: 1, r: (i) => inr(i.total) },
          { h: "Due", r: (i) => (i.total > i.paid && i.status !== "CANCELLED" ? dueStatus(i.due) : fmtDate(i.due)) },
          { h: "Payment", r: (i) => `<div class="progress ${i.paid >= i.total ? "" : i.paid > 0 ? "warn" : "bad"}" style="width:90px"><i style="width:${Math.min(100, (i.paid / i.total) * 100)}%"></i></div><div class="small muted">${inr(i.paid)} paid</div>` },
          { h: "Status", r: (i) => invStatus(i.status) },
          { h: "Sales Exec", r: (i) => person(acct(i.account).owner) },
        ], list, { empty: "No invoices in this view." })),
    };
  };

  /* ------------------------------------------------- service key facts */
  // What the CEO looks at first: the office number, then the few facts that matter for that service.
  // Field names are the workbook's own columns, so values are shown exactly as recorded.
  // Everything below reads the service configuration (Settings → Matter Services).
  const fieldOf = (svc, key) => (svc ? svc.fields.find((f) => f.key === key) : null);
  const keysOf = (m) => { const svc = svcOf(m.category); return svc && svc.fields.length ? svc : null; };
  const appNoOf = (m) => { const svc = svcOf(m.category); return svc && svc.noField ? m.app[svc.noField] || null : null; };
  const regNoOf = (m) => { const svc = svcOf(m.category); return svc && svc.regField ? m.app[svc.regField] || null : null; };
  const noLabelOf = (m) => { const svc = svcOf(m.category); const f = svc && fieldOf(svc, svc.noField); return f ? f.label : "Reference"; };
  const regLabelOf = (m) => { const svc = svcOf(m.category); const f = svc && fieldOf(svc, svc.regField); return f ? f.label : "Registration"; };
  const factsOf = (m, flag) => { const svc = keysOf(m); return svc ? svc.fields.filter((f) => f[flag]) : []; };
  const shortLabel = (l) => l.replace("Expiry/Surveillance Due", "Surveillance").replace(/ Date$/, "");
  // Application number cell: the number, or why there isn't one (never blank).
  const appNoHtml = (m, opt = {}) => {
    const no = appNoOf(m);
    if (no) return `<span class="appno${opt.big ? " big" : ""}" title="${esc(noLabelOf(m))}">${esc(no)}</span>${opt.copy ? ` <button class="btn btn-sm btn-ghost" data-act="copy" data-val="${esc(no)}" title="Copy">${ic("applications", 13)}</button>` : ""}`;
    const svc = svcOf(m.category);
    if (!svc || !svc.noField) return '<span class="muted small">No office filing</span>';
    return `<span class="muted small">${m.appStage === "draft" ? "Not filed yet" : `${esc(noLabelOf(m))} not recorded`}</span>`;
  };
  const FIELD_TYPES = [
    { value: "text", label: "Text", hint: "A short answer, like a name or a number with letters", icon: "note" },
    { value: "date", label: "Date", hint: "Picked from a calendar", icon: "deadlines" },
    { value: "number", label: "Number", hint: "Digits only, like a count or an amount", icon: "pipeline" },
    { value: "choice", label: "Dropdown", hint: "One option from a list you set", icon: "list" },
    { value: "file", label: "File upload", hint: "A document; it is also saved to the matter's Documents", icon: "upload" },
  ];
  const typeOf = (t) => FIELD_TYPES.find((x) => x.value === t) || FIELD_TYPES[0];
  const FILE_KINDS = { pdf: { label: "PDF", accept: ".pdf" }, image: { label: "Images", accept: "image/*" }, word: { label: "Word", accept: ".doc,.docx" } };
  const factVal = (m, f) => {
    const v = m.app[f.key];
    if (v == null || v === "") return '<span class="muted">—</span>';
    if (f.type === "file") return `<span class="file-val">${ic("applications", 13)} ${esc(v)}</span>`;
    return showVal(v);
  };
  const stageTag = (m) => (m.stage ? `<span class="tag">${esc(m.stage)}</span>` : m.legacyStage ? `<span class="tag" title="Recorded in workbook; not a configured stage">${esc(m.legacyStage)}</span>` : '<span class="muted small">No stage</span>');

  /* --------------------------------------------------------------- matters */
  // components/matters/MattersCommandCenter.tsx + KpiBar, SavedViewsBar, FilterToolbar, MattersTable, MatterPreviewPanel
  // #/matters = all matters (list); #/matters/<Service> = that service's Kanban pipeline (sidebar sub-items).
  PAGES.matters = function (svc) {
    const st = ui("matters"); st.view = st.view || "all"; st.status = st.status || "all";
    st.pipe = svc || "";
    const all = S.matters(), me = state.me.id;
    const readOnly = is("sales_executive", "sales_manager");
    const nextDl = (m) => DEADLINES.filter((d) => d.matter === m.id && !d.done).sort((a, b) => byDate(toUTC(a.due), toUTC(b.due)))[0];
    const health = (m) => (m.status === "closed" ? null : matterHealth(m).score);
    const VIEWS = {
      all: () => true,
      mine: (m) => m.owner === me || m.sales === me || m.reviewer === me,
      attention: (m) => m.status !== "closed" && matterHealth(m).score < 80,
      week: (m) => { const d = nextDl(m); return d && daysFrom(d.due) <= 7; },
      docs: (m) => m.status !== "closed" && docCompleteness(m).required > docCompleteness(m).present,
      high: (m) => ["high", "urgent"].includes(m.priority) && m.status !== "closed",
    };
    // "Waiting for Client / Government" views exist in the live app, but no matter field records
    // who a matter is waiting on. They are left out until that field exists (see MVP plan).
    const scope = st.pipe ? all.filter((m) => m.category === st.pipe) : all;
    let list = scope.filter(VIEWS[st.view]);
    if (st.status !== "all") list = list.filter((m) => (st.status === "closed" ? m.status === "closed" : m.status !== "closed"));
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter((m) => [m.id, m.title, acct(m.account).display, appNoOf(m) || "", regNoOf(m) || ""].join(" ").toLowerCase().includes(q)); }
    list = list.slice().sort((a, b) => (a.status === "closed") - (b.status === "closed") || (health(a) ?? 101) - (health(b) ?? 101));

    const viewTabs = [
      { value: "all", label: "All" }, { value: "mine", label: "Mine" }, { value: "attention", label: "Needs attention", red: 1 },
      { value: "week", label: "Deadline ≤ 7 days", red: 1 }, { value: "docs", label: "Missing documents" }, { value: "high", label: "High priority" },
    ].map((v) => ({ ...v, n: scope.filter(VIEWS[v.value]).length }));
    const viewBar = `<div class="vtabs">${viewTabs.map((v) => `<button class="vt${st.view === v.value ? " on" : ""}" data-act="seg" data-name="matters.view" data-val="${v.value}">${esc(v.label)}<span class="${v.red && v.n ? "red" : ""}">${v.n}</span></button>`).join("")}</div>`;

    const healthDot = (m) => { const s = health(m); if (s == null) return '<span class="muted small">Closed</span>'; const t = s < 60 ? "red" : s < 80 ? "amber" : "green"; return `<span class="hdot ${t}" title="Matter health ${s}/100: ${esc(matterHealth(m).factors.map((f) => f.t).join("; ") || "no risks")}"><i></i>${s}</span>`; };
    const stageCell = (m) => { const steps = stagesOf(m), i = steps.indexOf(m.stage); return `<div class="stg">${stageTag(m)}${steps.length && i >= 0 ? `<span class="stg-dots" title="Stage ${i + 1} of ${steps.length}">${steps.map((_, j) => `<i class="${j < i ? "done" : j === i ? "cur" : ""}"></i>`).join("")}</span>` : ""}</div>`; };
    const dlCell = (m) => { const d = nextDl(m); return d ? `${dueStatus(d.due)}<div class="small muted ellip" title="${esc(d.type)}">${esc(d.type)}</div>` : '<span class="muted">—</span>'; };
    const flag = (m) => (["high", "urgent"].includes(m.priority) && m.status !== "closed" ? ` <span class="flag ${m.priority}" title="${esc(cap(m.priority))} priority">${ic("flame", 11)}</span>` : "");
    const matterCell = (m) => `<div class="mcell">${appNoHtml(m)}<span class="mc-title"><a class="t" href="#/matter/${m.id}">${esc(m.title)}</a>${flag(m)}</span><div class="small muted">${st.pipe ? "" : `${esc(m.category)} · `}${m.account ? esc(acct(m.account).display) : '<span class="amber">Unlinked client</span>'} · <span class="mono">${esc(m.id)}</span></div></div>`;
    const ownerCell = (m) => (m.owner ? person(m.owner) : '<span class="muted small">Unassigned</span>');

    // Board card: number, title, client, the service's card facts that have a value, next date, owner.
    const card = (m) => { const d = nextDl(m); const facts = factsOf(m, "card").filter((f) => m.app[f.key] != null && m.app[f.key] !== ""); return `<div class="k-card" data-board="matters" data-id="${m.id}" draggable="${can.workMatter(m)}" data-href="#/matter/${m.id}" title="Open ${esc(m.title)}">
        <div class="k-top">${appNoHtml(m)}${flag(m)}</div>
        <div class="t">${esc(m.title)}</div>
        <div class="kc-client">${m.account ? esc(acct(m.account).display) : '<span class="amber">Unlinked client</span>'}</div>
        ${facts.length ? `<div class="k-facts">${facts.map((f) => `<span><em>${esc(shortLabel(f.label))}</em>${factVal(m, f)}</span>`).join("")}</div>` : ""}
        <div class="foot"><span>${d ? dueStatus(d.due) : '<span class="muted small">No open date</span>'}</span>${m.owner ? avatar(m.owner, true) : '<span class="muted small">Unassigned</span>'}</div></div>`; };

    // Per-service table: the service's own list columns from Matter Services.
    const serviceTable = (svcName, items) => {
      const sv = svcOf(svcName);
      const cols = sv ? sv.fields.filter((f) => f.table && f.key !== sv.noField) : [];
      return panel(`${svcName} matters`, items.length, table([
        { h: "Matter", r: matterCell },
        { h: "Stage", r: stageCell },
        ...cols.map((f) => ({ h: f.label, r: (m) => `<span class="nowrap">${factVal(m, f)}</span>` })),
        { h: "Next date", r: dlCell },
        { h: "Health", r: healthDot },
        { h: "Agent", r: ownerCell },
      ], items, { href: (m) => "#/matter/" + m.id, empty: `No ${svcName} matters in this view.` }));
    };

    let body, sub;
    if (st.pipe) {
      const sv = svcOf(st.pipe), steps = SERVICE_STAGES[st.pipe] || [];
      const items = list;
      st.layout = st.layout || "board";
      const open = scope.filter((m) => m.status !== "closed");
      sub = `${scope.length} matter${scope.length === 1 ? "" : "s"} · ${open.length} open${steps.length ? ` · ${steps.length} stages` : ""}`;
      if (steps.length) {
        const cols = steps.map((s) => { const c = stageCfg(st.pipe, s); const n = c && c.checks ? c.checks.length : 0; return { key: s, label: s, checks: n }; });
        if (items.some((m) => !m.stage)) cols.push({ key: "__none__", label: "No stage" });
        const board = `<div class="mboard" style="--cols:${cols.length}">${cols.map((col) => { const l = items.filter((m) => (m.stage || "__none__") === col.key); return `<div class="k-col" data-col="${esc(col.key)}" data-board="matters">
            <div class="k-head"><span class="kh-name">${esc(col.label)}</span>${col.checks ? `<span class="kh-lock" title="${col.checks} check${col.checks === 1 ? "" : "s"} before a matter can move here">${ic("lock", 11)}${col.checks}</span>` : ""}<span class="mono">${l.length}</span></div>
            <div class="k-list">${l.length ? l.map(card).join("") : `<div class="k-empty">${readOnly ? "Empty" : "Drop a matter here"}</div>`}</div></div>`; }).join("")}</div>`;
        body = `<div class="toolbar mtool">${search("matters.q", st.q, `Search ${st.pipe} by number, name or client…`)}${seg("matters.layout", st.layout, [{ value: "board", label: "Board", icon: "kanban" }, { value: "table", label: "Table", icon: "list" }])}</div>`
          + viewBar
          + (st.layout === "table" ? serviceTable(st.pipe, items) : board + (readOnly ? "" : `<div class="small muted" style="margin-top:8px">Drag a card to another column to move it. ${ic("lock", 11)} means the stage has checks that run first.</div>`));
      } else {
        body = `<div class="banner">${ic("alert", 16)}<span>No stages are set up for <b>${esc(st.pipe)}</b> yet, so there is no board. ${is("admin") ? '<a href="#/setup">Set them up in Matter Services</a>.' : "Ask an admin to set them up in Matter Services."}</span></div>`
          + `<div class="toolbar mtool">${search("matters.q", st.q, `Search ${st.pipe}…`)}</div>` + viewBar + serviceTable(st.pipe, items);
      }
    } else {
      const svcs = SERVICE_CONFIG.services.map((x) => x.name).filter((n) => all.some((m) => m.category === n));
      sub = readOnly ? (is("sales_manager") ? "Read-only view of every matter, so you can answer client status calls." : "Read-only view of matters from your accounts and leads, so you can answer client status calls.")
        : is("admin") ? "Every matter in the firm, the riskiest first." : "Matters you own, review or contribute to, the riskiest first.";
      body = `<div class="toolbar mtool">${search("matters.q", st.q, "Search by application no., matter, client or ID…")}${sel("matters.status", st.status, [{ value: "all", label: "Open & closed" }, { value: "open", label: "Open only" }, { value: "closed", label: "Closed only" }])}</div>`
        + viewBar
        + panel("Matters", list.length, table([
          { h: "Matter", r: matterCell },
          { h: "Stage", r: stageCell },
          { h: "Next date", r: dlCell },
          { h: "Health", r: healthDot },
          { h: "Agent", r: ownerCell },
        ], list, { href: (m) => "#/matter/" + m.id, empty: "No matters in this view." }))
        + `<div class="svc-jump">${ic("kanban", 14)} Boards: ${svcs.map((n) => `<a href="#/matters/${encodeURIComponent(n)}">${esc(n)} <span class="muted">${all.filter((m) => m.category === n).length}</span></a>`).join("")}</div>`;
    }
    return {
      crumbs: ["Matters", st.pipe ? st.pipe : "All Matters"],
      html: head(st.pipe ? st.pipe : "Matters", sub,
          (readOnly ? `<span class="status tone-slate"><i class="dot"></i>View only</span>` : "")
          + (st.pipe && is("admin") ? `<a class="btn" href="#/setup">${ic("settings", 14)} Stages & form</a>` : "")
          + (can.createMatter() ? `<button class="btn" data-act="soon">${ic("upload", 14)} Bulk Import</button><button class="btn btn-primary" data-act="new-matter">${ic("plus", 14)} New Matter</button>` : ""))
        + body,
      after() { bindKanban("matters", (id, col) => { const m = matter(id); if (m && col !== "__none__" && m.stage !== col) requestStageMove(m, col); }); },
    };
  };

  function setMatterStage(m, stage, opt = {}) {
    const prev = m.stage, steps = stagesOf(m);
    m.stage = stage; m.lastActivity = TODAY;
    // The filing phase follows the stage's configured phase (Settings → Matter Services).
    const sc = stageCfg(m.category, stage);
    if (sc && sc.phase) m.appStage = sc.phase;
    if (steps.indexOf(stage) === steps.length - 1) m.status = "closed"; else if (m.status === "closed" || m.status === "open") m.status = "in_progress";
    MATTER_ACTIVITIES.unshift({ id: "ACT-" + Date.now(), matter: m.id, date: TODAY, type: "Stage changed", text: `${prev || "No stage"} → ${stage}${opt.reason ? ` · ${opt.override ? "Checks overridden" : "Reason"}: ${opt.reason}` : ""}`, by: state.me.id, clientUpdated: false, external: "Internal" });
    audit("Stage changed", `${m.id}: ${prev} → ${stage}`);
    toast(`${m.id} moved to ${stage}`);
    render();
  }

  // Moving a matter to another stage runs that stage's checks (configured in Matter Services):
  //  - field checks pass when the form field has a value;
  //  - confirmations must be ticked by the user (who/when is recorded);
  //  - if a field check fails, only an admin can move it, and must give an override reason;
  //  - moving back to an earlier stage needs a reason.
  function requestStageMove(m, target) {
    if (!m || !target || m.stage === target) return;
    const steps = stagesOf(m), from = steps.indexOf(m.stage), to = steps.indexOf(target);
    const forward = from < 0 || to > from;
    const sc = stageCfg(m.category, target);
    const checks = forward && sc ? sc.checks || [] : [];
    if (forward && !checks.length) { setMatterStage(m, target); return; }
    const svc = svcOf(m.category);
    const fieldRes = checks.filter((c) => c.type === "field").map((c) => ({ c, f: fieldOf(svc, c.field), ok: m.app[c.field] != null && m.app[c.field] !== "" }));
    const confirms = checks.filter((c) => c.type === "confirm");
    const failing = fieldRes.filter((x) => !x.ok);
    const blocked = forward && failing.length && !is("admin");
    drawer(`Move to ${target}`, `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">${appNoHtml(m)}<b>${esc(m.title)}</b></div>
      <div class="small sub" style="margin-bottom:14px">${esc(m.stage || "No stage")} → <b>${esc(target)}</b>${sc && sc.phase ? ` · filing step: ${esc(cap(sc.phase))}` : ""}</div>
      ${forward ? `<h4 style="margin:0 0 8px">Checks for this stage</h4><div class="checklist">
          ${fieldRes.map((x) => `<div class="ck ${x.ok ? "ok" : "bad"}"><span class="ck-i">${x.ok ? "✓" : "✗"}</span><span>${esc(x.c.label)}${x.ok ? ` <span class="muted">· ${factVal(m, x.f || { key: x.c.field })}</span>` : ` <span class="muted">· not filled in</span>`}</span></div>`).join("")}
          ${confirms.map((c, i) => `<label class="ck"><input type="checkbox" name="cf${i}" /><span>${esc(c.label)}</span></label>`).join("")}
        </div>
        ${failing.length ? `<div class="banner" style="margin-top:12px">${ic("alert", 16)}<span>${blocked ? "Fill in the missing details on the Applications tab first. Only an admin can override." : "Some checks are not met. As admin you can override, with a reason."}</span>${blocked ? `<span class="spacer"></span><button type="button" class="btn btn-sm" data-act="edit-form" data-id="${m.id}">Edit details</button>` : ""}</div>` : ""}`
      : `<div class="banner">${ic("alert", 16)}<span>Moving back to an earlier stage. The reason is recorded in the activity log.</span></div>`}
      ${!forward || (failing.length && !blocked) ? field(!forward ? "Reason" : "Override reason", '<textarea class="textarea" name="reason" required></textarea>') : ""}
    `, blocked ? null : !forward ? "Move back" : failing.length ? "Override and move" : "Confirm and move", (d) => {
      if (forward && confirms.some((c, i) => !d["cf" + i])) { toast("Tick every confirmation first"); return; }
      if ((!forward || failing.length) && !d.reason) { toast("A reason is required"); return; }
      m.stageChecks = m.stageChecks || {};
      m.stageChecks[target] = { by: state.me.id, at: nowStamp(), confirmed: confirms.map((c) => c.label), override: forward && failing.length ? d.reason : null };
      closeLayer();
      setMatterStage(m, target, { reason: d.reason || null, override: forward && failing.length > 0 });
    });
  }

  // Edit the service form for one matter (fields, types and required flags come from Matter Services).
  function editFormDrawer(m) {
    const svc = svcOf(m.category); if (!svc) return;
    const input = (f) => {
      const v = m.app[f.key] == null ? "" : String(m.app[f.key]);
      if (f.type === "date") return `<input class="input" type="date" name="f_${f.key}" value="${ISO_DATE.test(v) ? esc(v) : ""}" />${v && !ISO_DATE.test(v) ? `<div class="help" style="margin:4px 0 0">Currently recorded as text: “${esc(v)}”</div>` : ""}`;
      if (f.type === "choice") return `<select class="select" name="f_${f.key}"><option value="">Choose…</option>${opts((f.options || []).map((o) => ({ value: o, label: o })), v)}</select>`;
      if (f.type === "number") return `<input class="input" type="number" name="f_${f.key}" value="${esc(v)}" />`;
      if (f.type === "file") {
        const accept = (f.accept || []).map((k) => (FILE_KINDS[k] || {}).accept).filter(Boolean).join(",");
        return `${v ? `<div class="file-current">${ic("applications", 14)} ${esc(v)} <span class="muted small">· choose a file to replace it</span></div>` : ""}<input class="input file-input" type="file" name="f_${f.key}" ${accept ? `accept="${accept}"` : ""} />`;
      }
      return `<input class="input" name="f_${f.key}" value="${esc(v)}" />`;
    };
    drawer(`${m.category} details`, `<div style="margin-bottom:14px">${appNoHtml(m)} <b>${esc(m.title)}</b></div>` + svc.fields.map((f) => field(f.label + (f.required ? " *" : ""), input(f) + (f.help ? `<div class="help" style="margin:4px 0 0">${esc(f.help)}</div>` : ""))).join(""), "Save details", (d) => {
      const has = (f) => { const v = d["f_" + f.key]; return f.type === "file" ? (v && v.name) || m.app[f.key] : v || (f.type === "date" && m.app[f.key] && !ISO_DATE.test(String(m.app[f.key]))); };
      const missing = svc.fields.filter((f) => f.required && !has(f));
      if (missing.length) { toast(`Please fill in: ${missing.map((f) => f.label).join(", ")}`); return; }
      const changed = [];
      svc.fields.forEach((f) => {
        const v = d["f_" + f.key];
        if (f.type === "file") {
          if (v && v.name) {
            DOCUMENTS.push({ id: nextId("DOC-", DOCUMENTS), matter: m.id, type: f.label, code: null, file: v.name, version: "1.0", by: state.me.id, date: TODAY, ocr: false, ai: false, src: "app" });
            m.app[f.key] = v.name; changed.push(f.label);
          }
          return;
        }
        const old = m.app[f.key] == null ? "" : String(m.app[f.key]);
        if (f.type === "date" && !v && old && !ISO_DATE.test(old)) return; // keep recorded text dates untouched
        if (v !== old) { changed.push(f.label); if (v) m.app[f.key] = v; else delete m.app[f.key]; }
      });
      if (changed.length) { MATTER_ACTIVITIES.unshift({ id: "ACT-" + Date.now(), matter: m.id, date: TODAY, type: "Details updated", text: changed.join(", "), by: state.me.id, clientUpdated: false, external: "Internal" }); m.lastActivity = TODAY; audit("Matter details updated", `${m.id}: ${changed.join(", ")}`); }
      closeLayer(); toast(changed.length ? "Details saved" : "No changes"); render();
    });
  }

  // Add / edit one form field in Matter Services (plain-language editor).
  function fieldEditor(i) {
    const svc = cfgDraft().services[ui("setup").sel];
    const isNew = i < 0;
    const f = isNew ? { key: "", label: "", type: "text", options: [], accept: [], required: false, keyFact: false, table: false, card: false, help: "", excelColumn: "" } : svc.fields[i];
    const used = isNew ? 0 : MATTERS.filter((m) => m.category === svc.name && m.app[f.key] != null && m.app[f.key] !== "").length;
    const typeCards = FIELD_TYPES.map((t) => `<label class="type-card${used && t.value !== f.type ? " off" : ""}"><input type="radio" name="type" value="${t.value}" data-change="ftype" ${t.value === f.type ? "checked" : ""} ${used && t.value !== f.type ? "disabled" : ""} /><span class="tc-i">${ic(t.icon, 16)}</span><span><b>${t.label}</b><small>${t.hint}</small></span></label>`).join("");
    const toggle = (name, on, title, hint) => `<label class="toggle-row"><input type="checkbox" name="${name}" ${on ? "checked" : ""} /><span><b>${title}</b><small>${hint}</small></span></label>`;
    drawer(isNew ? "Add a field" : `Edit “${f.label}”`, `
      ${field("Field name", `<input class="input" name="label" required value="${esc(f.label)}" placeholder="e.g. Power of Attorney" />`)}
      <div class="field"><label>What kind of answer?</label><div class="type-cards">${typeCards}</div>${used ? `<div class="help" style="margin:6px 0 0">This field already holds data in ${used} matter(s), so its type can't change.</div>` : ""}</div>
      <div class="only-choice ${f.type === "choice" ? "" : "hidden"}">${field("Dropdown options", `<textarea class="textarea" name="options" placeholder="One option per line">${esc((f.options || []).join("\n"))}</textarea>`)}</div>
      <div class="only-file ${f.type === "file" ? "" : "hidden"}"><div class="field"><label>Which files are allowed?</label><div class="chip-row">${Object.entries(FILE_KINDS).map(([k, x]) => `<label class="chip"><input type="checkbox" name="acc_${k}" ${(f.accept || []).includes(k) ? "checked" : ""} /> ${x.label}</label>`).join("")}</div><div class="help" style="margin:6px 0 0">Leave all unticked to allow any file.</div></div></div>
      ${field("Hint for your team (optional)", `<input class="input" name="help" value="${esc(f.help || "")}" placeholder="Shown under the field, e.g. “As printed on the filing receipt”" />`)}
      <div class="field"><label>Rules</label>${toggle("required", f.required, "Required", "The details can't be saved without it")}</div>
      <div class="field"><label>Where should it appear?</label>
        ${toggle("keyFact", f.keyFact, "Matter header", "In the key facts strip at the top of the matter")}
        ${toggle("table", f.table, "Service list", "As a column when viewing this service as a table")}
        ${toggle("card", f.card, "Kanban card", "On the matter's card in the board (keep to one or two)")}
      </div>
      ${!isNew ? `<button type="button" class="btn btn-danger-soft" data-act="cfg-del-field" data-i="${i}">${ic("trash", 14)} Delete this field</button>` : ""}
    `, isNew ? "Add field" : "Save field", (d) => {
      const label = (d.label || "").trim();
      if (!label) { toast("Give the field a name"); return; }
      if (svc.fields.some((x, j) => j !== i && x.label.toLowerCase() === label.toLowerCase())) { toast("Another field already has that name"); return; }
      const type = d.type || f.type;
      const out = Object.assign({}, f, {
        label, type, help: d.help || "", required: !!d.required, keyFact: !!d.keyFact, table: !!d.table, card: !!d.card,
        options: type === "choice" ? String(d.options || "").split(/\n|,/).map((x) => x.trim()).filter(Boolean) : f.options || [],
        accept: type === "file" ? Object.keys(FILE_KINDS).filter((k) => d["acc_" + k]) : f.accept || [],
      });
      if (type === "choice" && !out.options.length) { toast("Add at least one dropdown option"); return; }
      if (isNew) { let k = slug(label) || "field", n = 1, base = k; while (svc.fields.some((x) => x.key === k)) k = `${base}_${++n}`; out.key = k; svc.fields.push(out); }
      else svc.fields[i] = out;
      closeLayer(); render();
    });
  }

  // One "before moving here" check, as an editable row inside the stage drawer.
  function checkRow(svc, c, n) {
    const isField = c.type === "field";
    const fOpts = opts(svc.fields.map((f) => ({ value: f.key, label: f.label })), c.field || (svc.fields[0] || {}).key);
    return `<div class="ck-row" data-ck>
      <input type="hidden" name="ck_type_${n}" value="${isField ? "field" : "confirm"}" />${c.proposed ? `<input type="hidden" name="ck_prop_${n}" value="${esc(c.label)}" />` : ""}
      <span class="ck-ic ${isField ? "f" : "c"}">${ic(isField ? "note" : "check", 14)}</span>
      ${isField ? `<span class="ck-sent"><select class="select" name="ck_field_${n}">${fOpts}</select><span class="small sub nowrap">must be filled in</span></span>`
        : `<span class="ck-sent"><span class="small sub nowrap">Someone confirms:</span><input class="input" name="ck_label_${n}" value="${esc(c.label || "")}" placeholder="e.g. Client approved the draft" /></span>`}
      ${c.proposed ? `<span class="req" title="Suggested from the workbook; review it">Suggested</span>` : ""}
      <button type="button" class="btn btn-sm btn-ghost" data-act="ck-del" title="Remove this check">${ic("close", 14)}</button>
    </div>`;
  }

  // Add / edit one stage of a service (plain-language editor).
  function stageEditor(i) {
    const svc = cfgDraft().services[ui("setup").sel];
    const isNew = i < 0;
    const s = isNew ? { key: "", name: "", phase: null, legacyStatuses: [], checks: [], autoDeadline: null } : svc.stages[i];
    const count = isNew ? 0 : MATTERS.filter((m) => m.category === svc.name && m.stage === s.name).length;
    const counts = legacyStatusCounts(svc);
    const takenElsewhere = (v) => svc.stages.some((x, j) => j !== i && (x.legacyStatuses || []).includes(v));
    const lsList = [...new Set([...(s.legacyStatuses || []), ...Object.keys(counts).filter((v) => !takenElsewhere(v))])];
    const phaseCards = APP_STAGES.map((p) => `<label class="type-card"><input type="radio" name="phase" value="${p}" ${s.phase === p ? "checked" : ""} /><span class="tc-i">${ic(PHASE_INFO[p].icon, 15)}</span><span><b>${esc(PHASE_INFO[p].label)}</b><small>${esc(PHASE_INFO[p].hint)}</small></span></label>`).join("");
    drawer(isNew ? `Add a stage to ${svc.name}` : `Edit stage “${s.name}”`, `
      ${field("Stage name", `<input class="input" name="name" required value="${esc(s.name)}" placeholder="e.g. Examination report received" ${count ? "readonly" : ""} />`)}
      ${count ? `<div class="help" style="margin:-6px 0 12px">${count} matter(s) are in this stage, so its name is locked to keep them in place.</div>` : ""}
      ${svc.isFiling ? `<div class="field"><label>Which step at the office is this?</label><div class="help" style="margin:0 0 8px">Reports and the portfolio use this, so they stay correct even if you rename the stage.</div><div class="type-cards">${phaseCards}</div></div>`
        : `<div class="help" style="margin:0 0 14px">${esc(svc.name)} is an advisory service, so stages aren't linked to office steps.</div>`}
      <div class="field"><label>Before a matter can move here</label>
        <div class="help" style="margin:0 0 8px">Your team sees these as a checklist when they move a matter into this stage. Only an admin can skip a check, and must give a reason.</div>
        <div class="ck-list">${(s.checks || []).map((c, j) => checkRow(svc, c, j)).join("") || '<div class="ck-empty small muted">No checks yet. Matters can move here freely.</div>'}</div>
        <div class="ck-add">${svc.fields.length ? `<button type="button" class="btn btn-sm" data-act="ck-add" data-type="field">${ic("note", 13)} A detail must be filled in</button>` : ""}<button type="button" class="btn btn-sm" data-act="ck-add" data-type="confirm">${ic("check", 13)} Someone must confirm</button></div>
      </div>
      ${lsList.length ? `<details class="adv"><summary>Old records (for data migration later)</summary>
        <div class="help" style="margin:8px 0">Imported matters whose old status matches a ticked one start in this stage.</div>
        <div class="chip-row">${lsList.map((v, j) => `<label class="chip"><input type="checkbox" name="ls_${j}" ${(s.legacyStatuses || []).includes(v) ? "checked" : ""} /> ${esc(v)}${counts[v] ? ` <span class="muted">(${counts[v]})</span>` : ""}</label>`).join("")}</div></details>` : ""}
      ${!isNew ? (count ? `<div class="help" style="margin-top:14px">This stage has matters, so it can't be deleted. Move them to another stage first.</div>` : `<button type="button" class="btn btn-ghost" style="color:var(--red);margin-top:14px" data-act="cfg-del-stage" data-i="${i}">Delete this stage</button>`) : ""}
    `, isNew ? "Add stage" : "Save stage", (d) => {
      const name = (d.name || "").trim();
      if (!name) { toast("Give the stage a name"); return; }
      if (svc.stages.some((x, j) => j !== i && x.name.toLowerCase() === name.toLowerCase())) { toast("Another stage already has that name"); return; }
      if (svc.isFiling && !d.phase) { toast("Choose which step at the office this is"); return; }
      const checks = [];
      Object.keys(d).filter((k) => k.startsWith("ck_type_")).forEach((k) => {
        const n = k.slice(8);
        if (d[k] === "field") {
          const f = svc.fields.find((x) => x.key === d["ck_field_" + n]); if (!f) return;
          const label = `${f.label} ${f.type === "file" ? "is uploaded" : "is filled in"}`;
          checks.push(Object.assign({ type: "field", field: f.key, label }, d["ck_prop_" + n] === label ? { proposed: true } : {}));
        } else {
          const label = (d["ck_label_" + n] || "").trim(); if (!label) return;
          checks.push(Object.assign({ type: "confirm", label }, d["ck_prop_" + n] === label ? { proposed: true } : {}));
        }
      });
      const out = Object.assign({}, s, { name, phase: svc.isFiling ? d.phase : null, checks, legacyStatuses: lsList.filter((v, j) => d["ls_" + j]) });
      if (isNew) { out.key = "stage_" + Date.now(); svc.stages.push(out); } else svc.stages[i] = out;
      closeLayer(); render();
    });
  }

  // Service name, prefix and type.
  function serviceEditor() {
    const cfg = cfgDraft(), i = ui("setup").sel, svc = cfg.services[i];
    const has = MATTERS.some((m) => m.category === svc.name);
    drawer("Service settings", `
      ${field("Service name", `<input class="input" name="name" required value="${esc(svc.name)}" ${has ? "readonly" : ""} />`)}
      ${has ? '<div class="help" style="margin:-6px 0 12px">This service already has matters, so its name is locked.</div>' : ""}
      ${field("Matter number prefix", `<input class="input" name="prefix" value="${esc(svc.prefix || "")}" placeholder="e.g. TM" />`, "Matter numbers for this service start with this, e.g. TM-2025-001.")}
      <div class="field"><label>Type of service</label>
        <label class="toggle-row"><input type="checkbox" name="isFiling" ${svc.isFiling ? "checked" : ""} /><span><b>Office filing</b><small>Has an official application number and counts in My Portfolio. Untick for advisory work (e.g. compliance).</small></span></label></div>
    `, "Save settings", (d) => {
      const name = (d.name || "").trim();
      if (!name) { toast("Give the service a name"); return; }
      if (cfg.services.some((x, j) => j !== i && x.name.toLowerCase() === name.toLowerCase())) { toast("Another service already has that name"); return; }
      svc.name = name; svc.prefix = d.prefix || ""; svc.isFiling = !!d.isFiling;
      closeLayer(); render();
    });
  }

  /* ------------------------------------------------ matter: add / edit everything */
  // Every item shown on a matter can be added and changed here. Each change is written to the
  // matter's activity log (what changed, from → to, by whom) and to the audit log.
  const STAFF = () => USERS.filter((u) => ["agent", "admin"].includes(u.role));
  const SALES_STAFF = () => USERS.filter((u) => ["sales_executive", "sales_manager"].includes(u.role));
  const MATTER_STATUSES = [{ value: "open", label: "Open" }, { value: "in_progress", label: "In progress" }, { value: "on_hold", label: "On hold" }, { value: "closed", label: "Closed" }];
  const DL_KINDS = [{ value: "other", label: "Office / statutory date" }, { value: "renewal", label: "Renewal" }, { value: "annuity", label: "Patent annuity" }, { value: "surveillance", label: "Certificate expiry / surveillance" }];
  const OA_TYPES = ["Examination report", "Objection", "Opposition", "Hearing notice", "Show-cause notice", "Office letter", "Other"];
  const OA_STATUSES = [{ value: "pending", label: "Pending" }, { value: "response_filed", label: "Response filed" }, { value: "hearing_scheduled", label: "Hearing scheduled" }, { value: "resolved", label: "Resolved" }, { value: "abandoned", label: "Abandoned" }];
  const SEVERITIES = [{ value: "routine", label: "Routine" }, { value: "elevated", label: "Elevated" }, { value: "critical", label: "Critical" }, { value: "info", label: "Info" }];
  const INV_STATUSES = [{ value: "GENERATED", label: "Draft" }, { value: "SENT", label: "Sent" }, { value: "PARTIALLY_PAID", label: "Partially paid" }, { value: "PAID", label: "Paid" }, { value: "OVERDUE", label: "Overdue" }, { value: "CANCELLED", label: "Cancelled" }];
  const PAY_MODES = ["Bank Transfer", "UPI", "Cheque", "Cash", "Card"];
  const userOpts = (list, cur, none) => `${none ? `<option value="">${esc(none)}</option>` : ""}${opts(list.map((u) => ({ value: u.id, label: `${u.name} · ${ROLE_LABEL[u.role] || u.role}` })), cur || "")}`;
  // Numbers in the firm's own style, e.g. INV-2026-042 / RCPT-2026-039 (next after the highest used this year).
  const yearId = (prefix, list) => { const y = TODAY.slice(0, 4); const n = Math.max(0, ...list.map((x) => { const mm = String(x.id).match(new RegExp("^" + prefix + "-" + y + "-(\\d+)$")); return mm ? +mm[1] : 0; })); return `${prefix}-${y}-${String(n + 1).padStart(3, "0")}`; };
  const show = (v) => (v == null || v === "" ? "—" : String(v));
  function logM(m, type, changes) {
    const text = Array.isArray(changes) ? changes.join("; ") : changes;
    if (!text) return false;
    MATTER_ACTIVITIES.unshift({ id: "ACT-" + Date.now() + Math.floor(Math.random() * 1000), matter: m.id, date: TODAY, type, text, by: state.me.id, clientUpdated: false, external: "Internal", src: "app", system: true });
    m.lastActivity = TODAY; audit(type, `${m.id}: ${text}`); return true;
  }
  // Compare old and new values and describe each change as "Label: old → new".
  const diff = (pairs) => pairs.filter(([, a, b]) => String(a ?? "") !== String(b ?? "")).map(([l, a, b, f]) => `${l}: ${f ? f(a) : show(a)} → ${f ? f(b) : show(b)}`);
  const dangerBtn = (act, id, label) => `<button type="button" class="btn btn-danger-soft" style="margin-top:14px" data-act="${act}" data-id="${id}">${ic("trash", 14)} ${esc(label)}</button>`;

  // Matter: title, client, service item, status, priority, dates, next action, notes.
  function editMatterDrawer(m) {
    const items = SERVICES.filter((s) => s.category === m.category);
    drawer("Edit matter", `
      ${field("Matter title", `<input class="input" name="title" required value="${esc(m.title)}" />`)}
      ${field("Client account", `<select class="select" name="account"><option value="">Not linked to a client</option>${opts(ACCOUNTS.map((a) => ({ value: a.id, label: a.display })), m.account || "")}</select>`)}
      <div class="form-row">${field("Service", `<input class="input" value="${esc(m.category)}" readonly title="The service decides the stages and form. Changing it is a migration step." />`)}${field("Service item", `<select class="select" name="service"><option value="">—</option>${opts([...new Set(items.map((s) => s.name).concat(m.service ? [m.service] : []))].map((n) => ({ value: n, label: n })), m.service || "")}</select>`)}</div>
      <div class="form-row">${field("Status", `<select class="select" name="status">${opts(MATTER_STATUSES, m.status)}</select>`)}${field("Priority", `<select class="select" name="priority">${opts(PRIOS, m.priority || "normal")}</select>`)}</div>
      <div class="form-row">${field("Opened on", `<input class="input" type="date" name="opened" value="${esc(ISO_DATE.test(m.opened || "") ? m.opened : "")}" />`)}${field("Target completion", `<input class="input" type="date" name="due" value="${esc(ISO_DATE.test(m.due || "") ? m.due : "")}" />`)}</div>
      ${field("Next action", `<input class="input" name="nextAction" value="${esc(m.nextAction || "")}" placeholder="What has to happen next on this matter" />`)}
      ${field("Internal remarks", `<textarea class="textarea" name="remarks">${esc(m.remarks || "")}</textarea>`)}
    `, "Save matter", (d) => {
      if (!d.title) { toast("The matter needs a title"); return; }
      const ch = diff([["Title", m.title, d.title], ["Client", m.account, d.account || null, (v) => (v ? acct(v).display : "none")], ["Service item", m.service, d.service || null], ["Status", m.status, d.status, cap], ["Priority", m.priority, d.priority, cap], ["Opened", m.opened, d.opened || m.opened], ["Target completion", m.due, d.due || null], ["Next action", m.nextAction, d.nextAction || null], ["Remarks", m.remarks, d.remarks || null]]);
      Object.assign(m, { title: d.title, account: d.account || null, service: d.service || null, status: d.status, priority: d.priority, opened: d.opened || m.opened, due: d.due || null, nextAction: d.nextAction || null, remarks: d.remarks || null });
      logM(m, "Matter updated", ch); closeLayer(); toast(ch.length ? "Matter saved" : "No changes"); render();
    });
  }

  // People: owner (responsible agent), reviewer, sales, contributors.
  function peopleDrawer(m) {
    const staff = STAFF();
    drawer("People on this matter", `
      <div class="help" style="margin:0 0 14px">Everyone listed here can see this matter. Agents can also work on it.</div>
      ${field("Owner (responsible agent)", `<select class="select" name="owner">${userOpts(staff, m.owner, "Unassigned")}</select>`)}
      ${field("Reviewer", `<select class="select" name="reviewer">${userOpts(staff, m.reviewer, "No reviewer")}</select>`, "Checks the work before it is filed.")}
      ${field("Sales contact", `<select class="select" name="sales">${userOpts(SALES_STAFF(), m.sales, "None")}</select>`, "The sales person who answers the client's status calls.")}
      <div class="field"><label>Contributors</label><div class="chip-row">${staff.map((u) => `<label class="chip"><input type="checkbox" name="c_${u.id}" ${(m.contributors || []).includes(u.id) ? "checked" : ""} /> ${esc(u.name)}</label>`).join("")}</div><div class="help" style="margin:6px 0 0">Other people who help on this matter.</div></div>
    `, "Save people", (d) => {
      const contributors = staff.filter((u) => d["c_" + u.id] && u.id !== d.owner).map((u) => u.id);
      const nm = (v) => (v ? uname(v) : "none");
      const ch = diff([["Owner", m.owner, d.owner || null, nm], ["Reviewer", m.reviewer, d.reviewer || null, nm], ["Sales", m.sales, d.sales || null, nm]]);
      const added = contributors.filter((c) => !(m.contributors || []).includes(c)), removed = (m.contributors || []).filter((c) => !contributors.includes(c));
      if (added.length) ch.push(`Contributor added: ${added.map(uname).join(", ")}`);
      if (removed.length) ch.push(`Contributor removed: ${removed.map(uname).join(", ")}`);
      Object.assign(m, { owner: d.owner || null, reviewer: d.reviewer || null, sales: d.sales || null, contributors });
      logM(m, "People changed", ch); closeLayer(); toast(ch.length ? "People saved" : "No changes"); render();
    });
  }

  // Official date (deadline): add or edit, mark done/reopen, delete.
  function deadlineDrawer(m, id) {
    const x = id ? DEADLINES.find((d) => d.id === id) : null;
    const before = x && x.due && x.reminders ? x.reminders.map((r) => Math.round((toUTC(x.due) - toUTC(r)) / 864e5)).filter((n) => n > 0).join(", ") : "7, 2, 1";
    drawer(x ? "Edit official date" : "Add official date", `
      ${field("What is due", `<input class="input" name="type" required value="${esc(x ? x.type : "")}" placeholder="e.g. Reply to examination report" />`)}
      <div class="form-row">${field("Due date", `<input class="input" type="date" name="due" required value="${esc(x && ISO_DATE.test(x.due || "") ? x.due : "")}" />`)}${field("Kind", `<select class="select" name="kind">${opts(DL_KINDS, (x && x.kind) || "other")}</select>`)}</div>
      <div class="form-row">${field("Priority", `<select class="select" name="priority">${opts(PRIOS, (x && x.priority) || "high")}</select>`)}${field("Remind me (days before)", `<input class="input" name="rem" value="${esc(before)}" placeholder="7, 2, 1" />`)}</div>
      ${field("Remarks", `<input class="input" name="remarks" value="${esc((x && x.remarks) || "")}" />`)}
      ${x ? `<label class="toggle-row"><input type="checkbox" name="done" ${x.done ? "checked" : ""} /><span><b>Done</b><small>${x.done && x.completedDate ? `Completed ${fmtDate(x.completedDate)}` : "Tick when this date has been met"}</small></span></label>` : ""}
      ${x ? dangerBtn("m-del-deadline", x.id, "Delete this date") : ""}
    `, x ? "Save date" : "Add date", (d) => {
      if (!d.type || !d.due) { toast("Fill in what is due and the date"); return; }
      const reminders = String(d.rem || "").split(/[ ,]+/).map(Number).filter((n) => n > 0).sort((a, b) => b - a).map((n) => addDays(d.due, -n));
      const nx = { type: d.type, due: d.due, kind: d.kind, priority: d.priority, remarks: d.remarks || "", reminders };
      if (x) {
        const ch = diff([["What", x.type, nx.type], ["Due", x.due, nx.due, (v) => (v ? fmtDate(v) : "—")], ["Kind", x.kind, nx.kind], ["Priority", x.priority, nx.priority, cap], ["Remarks", x.remarks, nx.remarks]]);
        if (!!d.done !== !!x.done) ch.push(d.done ? "Marked done" : "Reopened");
        Object.assign(x, nx, { done: !!d.done, completedDate: d.done ? x.completedDate || TODAY : null });
        logM(m, "Official date updated", ch.length ? `${x.type}: ${ch.join("; ")}` : "");
      } else {
        DEADLINES.push(Object.assign({ id: nextId("DL-", DEADLINES), matter: m.id, done: false, completedDate: null, src: "app" }, nx));
        logM(m, "Official date added", `${nx.type} due ${fmtDate(nx.due)}`);
      }
      closeLayer(); render();
    });
  }

  // Task: add or edit, delete.
  function taskDrawer(m, id) {
    const x = id ? TASKS.find((t) => t.id === id) : null;
    drawer(x ? "Edit task" : "Add task", `
      ${field("Task", `<input class="input" name="title" required value="${esc(x ? x.title : "")}" />`)}
      <div class="form-row">${field("Assignee", `<select class="select" name="assignee">${userOpts(STAFF(), x ? x.assignee : m.owner, "Team queue (unassigned)")}</select>`)}${field("Status", `<select class="select" name="status">${opts(TASK_STATUSES.concat([{ key: "blocked", label: "Blocked" }]).map((s) => ({ value: s.key, label: s.label })), x ? x.status : "todo")}</select>`)}</div>
      <div class="form-row">${field("Due date", `<input class="input" type="date" name="due" value="${esc(x && ISO_DATE.test(x.due || "") ? x.due : "")}" />`)}${field("Priority", `<select class="select" name="priority">${opts(PRIOS, x ? x.priority : "normal")}</select>`)}</div>
      ${field("Hours spent", `<input class="input" type="number" step="0.5" min="0" name="hours" value="${esc(x ? x.hours || 0 : 0)}" />`)}
      ${field("Remarks", `<textarea class="textarea" name="remarks">${esc((x && x.remarks) || "")}</textarea>`)}
      ${x ? dangerBtn("m-del-task", x.id, "Delete this task") : ""}
    `, x ? "Save task" : "Add task", (d) => {
      if (!d.title) { toast("Give the task a name"); return; }
      const nx = { title: d.title, assignee: d.assignee || null, status: d.status, due: d.due || null, priority: d.priority, hours: +d.hours || 0, remarks: d.remarks || "" };
      if (x) {
        const ch = diff([["Task", x.title, nx.title], ["Assignee", x.assignee, nx.assignee, (v) => (v ? uname(v) : "unassigned")], ["Status", x.status, nx.status, cap], ["Due", x.due, nx.due, (v) => (v ? fmtDate(v) : "—")], ["Priority", x.priority, nx.priority, cap], ["Hours", x.hours, nx.hours], ["Remarks", x.remarks, nx.remarks]]);
        Object.assign(x, nx, { completedDate: nx.status === "completed" ? x.completedDate || TODAY : null });
        logM(m, "Task updated", ch.length ? `${x.title}: ${ch.join("; ")}` : "");
      } else {
        TASKS.push(Object.assign({ id: nextId("TSK-", TASKS), matter: m.id, createdBy: state.me.id, completedDate: null, src: "app" }, nx));
        logM(m, "Task added", `${nx.title}${nx.assignee ? ` → ${uname(nx.assignee)}` : ""}`);
      }
      closeLayer(); render();
    });
  }

  // Office action (examination report, objection, notice…): add or edit, delete.
  function oaDrawer(m, id) {
    const x = id ? OFFICIAL_ACTIONS.find((o) => o.id === id) : null;
    drawer(x ? "Edit office action" : "Record office action", `
      <div class="form-row">${field("Type", `<select class="select" name="type">${opts(OA_TYPES.concat(x && !OA_TYPES.includes(x.type) ? [x.type] : []).map((t) => ({ value: t, label: t })), x ? x.type : OA_TYPES[0])}</select>`)}${field("Severity", `<select class="select" name="severity">${opts(SEVERITIES, x ? x.severity : "elevated")}</select>`)}</div>
      ${field("Summary", `<textarea class="textarea" name="summary" required placeholder="What the office raised">${esc(x ? x.summary : "")}</textarea>`)}
      <div class="form-row">${field("Received on", `<input class="input" type="date" name="received" required value="${esc(x ? x.received : TODAY)}" />`)}${field("Response due", `<input class="input" type="date" name="responseDue" value="${esc((x && x.responseDue) || "")}" />`)}</div>
      ${field("Status", `<select class="select" name="status">${opts(OA_STATUSES, x ? x.status : "pending")}</select>`)}
      ${x ? "" : `<label class="toggle-row"><input type="checkbox" name="mkdl" checked /><span><b>Also add the response date to official dates</b><small>So it shows in the next-date box and reminders</small></span></label>`}
      ${x ? dangerBtn("m-del-oa", x.id, "Delete this office action") : ""}
    `, x ? "Save" : "Record", (d) => {
      if (!d.summary || !d.received) { toast("Fill in the summary and the date received"); return; }
      const nx = { type: d.type, severity: d.severity, summary: d.summary, received: d.received, responseDue: d.responseDue || null, status: d.status };
      if (x) {
        const ch = diff([["Type", x.type, nx.type], ["Severity", x.severity, nx.severity, cap], ["Summary", x.summary, nx.summary], ["Received", x.received, nx.received], ["Response due", x.responseDue, nx.responseDue], ["Status", x.status, nx.status, cap]]);
        Object.assign(x, nx); logM(m, "Office action updated", ch.length ? `${x.type}: ${ch.join("; ")}` : "");
      } else {
        OFFICIAL_ACTIONS.push(Object.assign({ id: nextId("OA-", OFFICIAL_ACTIONS), matter: m.id, by: state.me.id, src: "app" }, nx));
        if (d.mkdl && nx.responseDue) DEADLINES.push({ id: nextId("DL-", DEADLINES), matter: m.id, type: `Response to ${nx.type.toLowerCase()}`, kind: "other", due: nx.responseDue, reminders: [7, 2, 1].map((n) => addDays(nx.responseDue, -n)), done: false, completedDate: null, priority: nx.severity === "critical" ? "urgent" : "high", remarks: nx.summary.slice(0, 80), src: "app" });
        logM(m, "Office action recorded", `${nx.type} received ${fmtDate(nx.received)}${nx.responseDue ? `, response due ${fmtDate(nx.responseDue)}` : ""}`);
      }
      closeLayer(); render();
    });
  }

  // Document: upload, or edit type/version/remarks, replace the file (new version), delete.
  function docDrawer(m, id) {
    const x = id ? DOCUMENTS.find((d) => d.id === id) : null;
    const nextVer = (v) => { const n = parseFloat(v); return isNaN(n) ? "2.0" : (Math.floor(n) + 1).toFixed(1); };
    drawer(x ? "Edit document" : "Upload document", `
      ${field("Document type", `<input class="input" name="type" required value="${esc(x ? x.type : "")}" placeholder="e.g. Power of Attorney" list="doc-types" /><datalist id="doc-types">${[...new Set(DOCUMENTS.map((d) => d.type))].map((t) => `<option value="${esc(t)}">`).join("")}</datalist>`)}
      ${x ? `<div class="file-current">${ic("applications", 14)} ${esc(x.file)} <span class="muted small">· version ${esc(x.version)}</span></div>` : ""}
      ${field(x ? "Replace with a new version (optional)" : "File", `<input class="input file-input" type="file" name="file" ${x ? "" : "required"} />`)}
      ${x ? field("Version", `<input class="input" name="version" value="${esc(x.version)}" />`) : ""}
      ${field("Remarks", `<input class="input" name="remarks" value="${esc((x && x.remarks) || "")}" />`)}
      ${x ? dangerBtn("m-del-doc", x.id, "Delete this document") : ""}
    `, x ? "Save" : "Upload", (d) => {
      if (!d.type) { toast("Say what kind of document this is"); return; }
      const f = d.file && d.file.name ? d.file.name : null;
      if (x) {
        const ver = f ? nextVer(x.version) : d.version || x.version;
        const ch = diff([["Type", x.type, d.type], ["Version", x.version, ver], ["Remarks", x.remarks, d.remarks || ""]]);
        if (f) ch.push(`New file: ${f}`);
        Object.assign(x, { type: d.type, version: ver, remarks: d.remarks || "" }, f ? { file: f, date: TODAY, by: state.me.id, ocr: false, ai: false } : {});
        logM(m, "Document updated", ch.length ? `${x.file}: ${ch.join("; ")}` : "");
      } else {
        if (!f) { toast("Choose a file"); return; }
        DOCUMENTS.push({ id: nextId("DOC-", DOCUMENTS), matter: m.id, type: d.type, code: null, file: f, version: "1.0", by: state.me.id, date: TODAY, ocr: false, ai: false, remarks: d.remarks || "", src: "app" });
        logM(m, "Document uploaded", `${d.type}: ${f}`);
      }
      closeLayer(); render();
    });
  }

  // Invoice: create or edit (fees; GST worked out), status. Payments are recorded separately.
  const invPaidStatus = (i) => (i.status === "CANCELLED" ? "CANCELLED" : i.paid >= i.total && i.total > 0 ? "PAID" : i.paid > 0 ? "PARTIALLY_PAID" : i.status === "PAID" || i.status === "PARTIALLY_PAID" ? "SENT" : i.status);
  function invoiceDrawer(m, id) {
    const x = id ? INVOICES.find((i) => i.id === id) : null;
    const rate = x && x.prof ? Math.round((x.gst / x.prof) * 100) : 18;
    drawer(x ? `Edit invoice ${x.id}` : "Create invoice", `
      <div class="form-row">${field("Invoice date", `<input class="input" type="date" name="date" required value="${esc(x ? x.date : TODAY)}" />`)}${field("Payment due", `<input class="input" type="date" name="due" value="${esc((x && x.due) || addDays(TODAY, 15))}" />`)}</div>
      <div class="form-row">${field("Professional fee (₹)", `<input class="input" type="number" min="0" name="prof" required value="${esc(x ? x.prof : "")}" />`)}${field("Government fee (₹)", `<input class="input" type="number" min="0" name="govt" value="${esc(x ? x.govt : 0)}" />`)}</div>
      <div class="form-row">${field("GST % (on professional fee)", `<input class="input" type="number" min="0" name="rate" value="${rate}" />`)}${field("Status", `<select class="select" name="status">${opts(INV_STATUSES, x ? x.status : "GENERATED")}</select>`)}</div>
      <div class="help">Total = professional fee + government fee + GST. ${x ? `Received so far: <b>${inr(x.paid)}</b>. Use "Record payment" to add a payment.` : ""}</div>
    `, x ? "Save invoice" : "Create invoice", (d) => {
      const prof = +d.prof || 0, govt = +d.govt || 0, gst = Math.round((prof * (+d.rate || 0)) / 100), total = prof + govt + gst;
      if (!prof && !govt) { toast("Enter at least one fee"); return; }
      if (x) {
        if (total < x.paid) { toast(`Total can't be less than what was already received (${inr(x.paid)})`); return; }
        const ch = diff([["Date", x.date, d.date], ["Due", x.due, d.due || null], ["Prof. fee", x.prof, prof, inr], ["Govt. fee", x.govt, govt, inr], ["GST", x.gst, gst, inr], ["Status", x.status, d.status]]);
        Object.assign(x, { date: d.date, due: d.due || null, prof, govt, gst, total, status: d.status }); x.status = invPaidStatus(x);
        logM(m, "Invoice updated", ch.length ? `${x.id}: ${ch.join("; ")}` : "");
      } else {
        const inv = { id: yearId("INV", INVOICES), account: m.account, matter: m.id, date: d.date, prof, govt, gst, total, paid: 0, status: d.status, due: d.due || null, source: m.service || m.category, firm: null, src: "app" };
        INVOICES.push(inv); logM(m, "Invoice created", `${inv.id} for ${inr(total)}`);
      }
      closeLayer(); render();
    });
  }
  function paymentDrawer(m, invId) {
    const x = INVOICES.find((i) => i.id === invId), bal = x.total - x.paid;
    drawer(`Record payment · ${x.id}`, `
      <div class="help" style="margin:0 0 12px">Invoice total ${inr(x.total)} · received ${inr(x.paid)} · <b>balance ${inr(bal)}</b></div>
      <div class="form-row">${field("Amount (₹)", `<input class="input" type="number" min="1" max="${bal}" name="amount" required value="${bal > 0 ? bal : ""}" />`)}${field("Received on", `<input class="input" type="date" name="date" required value="${TODAY}" />`)}</div>
      <div class="form-row">${field("Mode", `<select class="select" name="mode">${opts(PAY_MODES.map((p) => ({ value: p, label: p })), "Bank Transfer")}</select>`)}${field("Receipt / reference no.", '<input class="input" name="ref" placeholder="e.g. UTR or cheque no." />')}</div>
    `, "Record payment", (d) => {
      const amt = +d.amount || 0;
      if (amt <= 0 || amt > bal) { toast(`Enter an amount between ₹1 and ${inr(bal)}`); return; }
      PAYMENTS.push({ id: yearId("RCPT", PAYMENTS), invoice: x.id, date: d.date, amount: amt, mode: d.mode, ref: d.ref || null, verified: false, by: state.me.id, src: "app" });
      x.paid += amt; x.status = invPaidStatus(x);
      logM(m, "Payment recorded", `${inr(amt)} against ${x.id} (${d.mode}${d.ref ? `, ref ${d.ref}` : ""})`); closeLayer(); render();
    });
  }

  // Notes: only notes typed in this app can be edited, and only by the person who wrote them.
  // Imported history and system entries (stage changes, edits) stay as they are, for the audit trail.
  const noteEditable = (x) => x.src === "app" && !x.system && x.by === state.me.id;
  function noteDrawer(m, id) {
    const x = MATTER_ACTIVITIES.find((a) => a.id === id); if (!x) return;
    drawer("Edit note", `
      ${field("Type", `<input class="input" name="type" required value="${esc(x.type)}" />`)}
      ${field("Note", `<textarea class="textarea" name="text" required>${esc(x.text)}</textarea>`)}
      <label class="toggle-row"><input type="checkbox" name="client" ${x.clientUpdated ? "checked" : ""} /><span><b>Client was updated</b><small>Tick if this was shared with the client</small></span></label>
      ${dangerBtn("m-del-note", x.id, "Delete this note")}
    `, "Save note", (d) => {
      if (!d.type || !d.text) { toast("Fill in the type and the note"); return; }
      Object.assign(x, { type: d.type, text: d.text, clientUpdated: !!d.client, edited: TODAY }); audit("Matter note edited", `${m.id} · ${x.id}`); closeLayer(); render();
    });
  }

  // Matter preview panel (components/matters/MatterPreviewPanel.tsx)
  function previewMatter(id) {
    const m = matter(id); if (!m) return;
    const tasks = TASKS.filter((t) => t.matter === m.id && t.status !== "completed");
    const invs = INVOICES.filter((i) => i.matter === m.id);
    const acts = MATTER_ACTIVITIES.filter((x) => x.matter === m.id).slice(0, 4);
    drawer(m.id, `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${appNoHtml(m)}<span class="tag">${esc(m.category)}</span><span class="small muted">${esc(m.service || "")}</span></div>${factsOf(m, "keyFact").length ? `<div class="keyfacts compact">${factsOf(m, "keyFact").slice(0, 4).map((f) => `<div class="kf"><span>${esc(f.label)}</span><b>${factVal(m, f)}</b></div>`).join("")}</div>` : ""}
      <h2 style="margin:4px 0 8px;font-size:17px">${esc(m.title)}</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${matterStatus(m.status)}${priority(m.priority)}<span class="tag">${esc(acct(m.account).display)}</span></div>
      <h4 style="margin:12px 0 6px">Stage</h4>${can.workMatter(m) ? `<select class="select" data-change="matter-stage" data-id="${m.id}">${opts(stagesOf(m).map((s) => ({ value: s, label: s })), m.stage)}</select>` : `<span class="tag">${esc(m.stage)}</span>`}
      <h4 style="margin:16px 0 6px">Tasks <span class="muted">(${tasks.length} open)</span></h4>${tasks.length ? tasks.map((t) => `<div class="small" style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--gray-3)"><span>${esc(t.title)}</span>${dueStatus(t.due)}</div>`).join("") : '<div class="small muted">No open tasks.</div>'}
      <h4 style="margin:16px 0 6px">Billing</h4>${invs.length ? invs.map((i) => `<div class="small" style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--gray-3)"><span class="mono">${esc(i.id)}</span>${invStatus(i.status)}<b>${inr(i.total)}</b></div>`).join("") : '<div class="small muted">No invoices.</div>'}
      <h4 style="margin:16px 0 6px">Recent Activity</h4>${acts.length ? acts.map((a) => `<div class="small" style="padding:5px 0;border-bottom:1px solid var(--gray-3)"><b>${esc(a.type)}</b> <span class="muted">· ${fmtDate(a.date)}</span><div class="sub">${esc(a.text)}</div></div>`).join("") : '<div class="small muted">No activity.</div>'}
      ${can.workMatter(m) ? `<h4 style="margin:16px 0 6px">Add Note</h4><textarea class="textarea" name="note" placeholder="Write a quick note…"></textarea>` : ""}
    `, can.workMatter(m) ? "Save note & open" : "Open matter", (d) => {
      if (d.note) { MATTER_ACTIVITIES.unshift({ id: "ACT-" + Date.now(), matter: m.id, date: TODAY, type: "Note", text: d.note, by: state.me.id, clientUpdated: false, external: "Internal" }); m.lastActivity = TODAY; }
      closeLayer(); go("matter/" + m.id);
    });
  }

  // Matter detail (app/(agent)/agent/matters/[id]/page.tsx): 9 tabs
  // Matter detail (app/(agent)/agent/matters/[id]/page.tsx). Rebuilt around three questions, in order:
  //  1. Which filing is this?   → office number, title, the service's key facts (editable in place).
  //  2. What's the next official date, and where is it in the process? → next-date callout + stage bar.
  //  3. What do I do now?       → one "To do" list (overdue first), then health, people, documents, money.
  // Tabs went from 9 to 6: Stage Track is the stage bar plus the Activity log; Official Actions
  // sit with deadlines and tasks under "Deadlines & tasks", because all three are things to act on.
  PAGES.matter = function (id) {
    const m = S.matters().find((x) => x.id === id);
    if (!m) return notFound("Matter not found, or it's outside your access.");
    const st = ui("matter:" + id); st.tab = st.tab || "overview";
    if (st.tab === "stage" || st.tab === "oa" || st.tab === "tasks" || st.tab === "deadlines") st.tab = st.tab === "stage" ? "activity" : "work";
    if (st.tab === "applications") st.tab = "details";
    const a = acct(m.account), work = can.workMatter(m), h = matterHealth(m), steps = stagesOf(m), svc = svcOf(m.category);
    const tasks = TASKS.filter((t) => t.matter === m.id);
    const dls = DEADLINES.filter((d) => d.matter === m.id).sort((x, y) => byDate(toUTC(x.due), toUTC(y.due)));
    const docs = DOCUMENTS.filter((d) => d.matter === m.id);
    const acts = MATTER_ACTIVITIES.filter((x) => x.matter === m.id);
    const invs = INVOICES.filter((i) => i.matter === m.id);
    const oas = OFFICIAL_ACTIONS.filter((o) => o.matter === m.id);
    const openTasks = tasks.filter((t) => t.status !== "completed");
    const openDls = dls.filter((d) => !d.done);
    const dc = docCompleteness(m);
    const billed = sum(invs, (i) => i.total), paid = sum(invs, (i) => i.paid);
    const tone = h.score < 60 ? "red" : h.score < 80 ? "amber" : "green";
    const closed = m.status === "closed";

    // 1. Header.
    const keyFacts = factsOf(m, "keyFact").filter((f) => f.key !== (svc || {}).noField);
    const header = `<section class="mh2">
        <div class="mh2-top">
          <div class="mh2-id">
            <div class="mh2-nos"><span class="mh-label">${esc(noLabelOf(m))}</span>${appNoHtml(m, { big: true, copy: true })}${regNoOf(m) ? `<span class="mh-label">${esc(regLabelOf(m))}</span><span class="appno big reg">${esc(regNoOf(m))}</span>` : ""}</div>
            <h1>${esc(m.title)}</h1>
            <div class="mh2-meta">
              <a class="tag" href="#/matters/${encodeURIComponent(m.category)}">${esc(m.category)}</a>
              ${m.account ? `<a href="#/account/${a.id}">${esc(a.display)}</a>` : '<span class="amber">Unlinked client</span>'}
              <span>Agent <b>${esc(m.owner ? uname(m.owner) : "unassigned")}</b></span>
              ${m.opened ? `<span>Opened ${fmtDate(m.opened)}</span>` : ""}
              <span class="muted mono">${esc(m.id)}</span>
              ${closed ? matterStatus(m.status) : ""}${["high", "urgent"].includes(m.priority) && !closed ? priority(m.priority) : ""}
            </div>
          </div>
          ${closed ? "" : `<a class="mh2-health ${tone}" href="javascript:void 0" data-act="seg" data-name="matter:${m.id}.tab" data-val="overview" title="Matter health: ${esc(h.factors.map((f) => f.t).join("; ") || "no risks found")}"><b>${h.score}</b><span>${esc(h.band)}</span></a>`}
          <div class="mh2-actions">${work ? `<button class="btn" data-act="m-edit" data-what="matter" data-m="${m.id}">${ic("pencil", 14)} Edit matter</button><button class="btn" data-act="new-task" data-id="${m.id}">${ic("plus", 14)} Task</button><button class="btn btn-primary" data-act="seg" data-name="matter:${m.id}.tab" data-val="activity">${ic("note", 14)} Add note</button>` : `<span class="status tone-slate"><i class="dot"></i>View only</span>`}</div>
        </div>
        ${keyFacts.length || (svc || {}).isFiling ? `<div class="kf2">${keyFacts.map((f) => `<div class="kf"><span>${esc(f.label)}</span><b>${factVal(m, f)}</b></div>`).join("")}${(svc || {}).isFiling ? `<div class="kf"><span>Office step</span><b>${m.appStage ? esc((PHASE_INFO[m.appStage] || { label: cap(m.appStage) }).label) : '<span class="muted">—</span>'}</b></div>` : ""}${work && svc && svc.fields.length ? `<button class="kf-edit" data-act="edit-form" data-id="${m.id}" title="Edit these details">${ic("pencil", 14)} Edit</button>` : ""}</div>` : ""}
      </section>`;

    // 2. Next official date + stage bar.
    const next = openDls[0];
    // Same calendar tile as the dashboard list; status is one pill, the rest stays neutral.
    const nextBox = next ? (() => {
      const n = daysFrom(next.due);
      const tone = n < 0 ? "over" : n === 0 ? "today" : n <= 7 ? "soon" : "";
      const [y, mo, dd] = next.due.slice(0, 10).split("-");
      const more = openDls.length - 1;
      const pill = n < 0 ? `${-n} day${n === -1 ? "" : "s"} overdue` : n === 0 ? "Due today" : n === 1 ? "Due tomorrow" : `In ${n} days`;
      return `<div class="nextdate ${tone}">
        <span class="dl-date lg ${tone}" title="${esc(fmtDate(next.due))}"><small>${MONTHS[+mo - 1]}${y !== TODAY.slice(0, 4) ? ` ’${y.slice(2)}` : ""}</small><b>${+dd}</b></span>
        <div class="grow">
          <div class="nd-top"><span class="nd-k">Next official date</span><span class="nd-pill ${tone}">${pill}</span></div>
          <b class="nd-t" title="${esc(next.type)}">${esc(next.type)}</b>
          ${next.remarks ? `<small class="nd-note" title="${esc(next.remarks)}">${esc(next.remarks)}</small>` : ""}
        </div>
        <div class="nd-side">
          ${work ? `<button class="btn btn-sm" data-act="dl-done" data-id="${next.id}">${ic("check", 14)} Mark done</button>` : ""}
          ${more > 0 ? `<button class="nd-more" data-act="seg" data-name="matter:${m.id}.tab" data-val="work">+${more} more date${more > 1 ? "s" : ""}</button>` : ""}
        </div>
      </div>`; })() : `<div class="nextdate none">${ic("check", 16)}<div class="grow"><b>No open official dates</b><small>${closed ? "This matter is closed." : "Add a deadline when the office sets one."}</small></div>${work && !closed ? `<button class="btn btn-sm" data-act="new-deadline" data-id="${m.id}">${ic("plus", 14)} Add date</button>` : ""}</div>`;
    const idx = steps.indexOf(m.stage);
    const nextStage = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : !m.stage && steps.length ? steps[0] : null;
    const stageBox = steps.length ? `<div class="stagebox">
        <div class="sb-head"><span>Stage${m.stage ? ` <b>${idx + 1} of ${steps.length}</b>` : ""}</span>${work && nextStage ? `<button class="btn btn-sm btn-primary" data-act="matter-step" data-id="${m.id}" data-val="${esc(nextStage)}">Move to ${esc(nextStage)} ${ic("chev-r", 13)}</button>` : ""}</div>
        ${m.stage ? "" : `<div class="banner" style="margin:0 0 10px">${ic("alert", 16)}<span>The old record says <b>“${esc(m.legacyStatus || m.legacyStage || "not recorded")}”</b>, which doesn't match a ${esc(m.category)} stage.${work ? " Pick the right stage below." : ""}</span></div>`}
        ${statusbar(steps, m.stage, { act: work ? "matter-step" : null, id: m.id, line: true, tones: true })}
      </div>` : `<div class="stagebox"><div class="banner" style="margin:0">${ic("alert", 16)}<span>No stages are set up for ${esc(m.category)}. Recorded stage: <b>${esc(m.legacyStage || "not recorded")}</b>.</span></div></div>`;

    // 3. Tabs.
    const todo = [
      ...openDls.map((d) => ({ kind: "Date", due: d.due, title: d.type, sub: d.remarks, id: d.id, act: "dl-done", what: "deadline" })),
      ...oas.filter((o) => ["pending", "hearing_scheduled"].includes(o.status)).map((o) => ({ kind: "Office action", due: o.responseDue, title: o.type, sub: o.summary, id: o.id, what: "oa" })),
      ...openTasks.map((t) => ({ kind: "Task", due: t.due, title: t.title, sub: `${uname(t.assignee) || "Unassigned"}${t.status === "blocked" ? " · blocked" : ""}`, who: t.assignee, id: t.id, what: "task" })),
    ].sort((x, y) => (x.due ? 0 : 1) - (y.due ? 0 : 1) || byDate(toUTC(x.due), toUTC(y.due)));
    const todoList = todo.length ? `<div class="todo">${todo.map((x) => `<div class="td-row${work ? " edit" : ""}" ${work ? `data-act="m-edit" data-what="${x.what}" data-m="${m.id}" data-id="${x.id}" title="Edit"` : ""}><span class="td-k ${x.kind === "Task" ? "" : "off"}">${esc(x.kind)}</span><div class="grow"><b>${esc(x.title)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</div><span class="td-due">${x.due ? dueStatus(x.due) : '<span class="muted small">No date</span>'}</span>${work && x.act ? `<button class="btn btn-sm btn-ghost" data-act="${x.act}" data-id="${x.id}">Done</button>` : ""}</div>`).join("")}</div>` : '<div class="empty">Nothing to do on this matter.</div>';
    const people = [[m.owner, "Agent (owner)"], [m.reviewer, "Reviewer"], [m.sales, "Sales"], ...(m.contributors || []).map((c) => [c, "Contributor"])].filter(([u]) => u);

    const T = {};
    T.overview = `<div class="grid-2"><div>
        ${panel("To do", todo.length, todoList, work ? `<button class="btn btn-sm btn-ghost" data-act="new-task" data-id="${m.id}">${ic("plus", 14)} Task</button>` : "")}
        ${m.nextAction ? `<div class="nextaction">${ic("activity", 16)}<div><span class="nd-k">Next action (agent's note)</span><b>${esc(m.nextAction)}</b></div>${work ? `<button class="icon-btn" style="margin-left:auto" data-act="m-edit" data-what="matter" data-m="${m.id}" title="Edit next action">${ic("pencil", 14)}</button>` : ""}</div>` : work ? `<button class="nextaction add" data-act="m-edit" data-what="matter" data-m="${m.id}">${ic("plus", 14)} Add the next action for this matter</button>` : ""}
        ${panel("Latest activity", acts.length, acts.length ? `<div class="timeline">${acts.slice(0, 3).map((x) => `<div class="tl-item">${avatar(x.by, true)}<div><div class="head"><b>${esc(x.type)}</b><span class="muted small">${esc(uname(x.by))} · ${fmtDate(x.date)}</span></div><p>${esc(x.text)}</p></div></div>`).join("")}</div>` : '<div class="empty">No activity yet.</div>', `<button class="btn btn-sm btn-ghost" data-act="seg" data-name="matter:${m.id}.tab" data-val="activity">All activity</button>`)}
      </div><div>
        ${closed ? "" : panel("Health", "auto", `<div class="panel-body"><div class="hl-top"><b class="${tone}">${h.score}</b><span>/100 · ${esc(h.band)}</span></div><div class="progress ${h.score < 60 ? "bad" : h.score < 80 ? "warn" : ""}"><i style="width:${h.score}%"></i></div>${h.factors.length ? `<ul class="hl-list">${h.factors.map((f) => `<li class="${f.sev}">${esc(f.t)}</li>`).join("")}</ul>` : '<div class="small muted" style="margin-top:10px">No risks found.</div>'}</div>`)}
        ${panel("Documents", dc.required ? `${dc.present}/${dc.required}` : docs.length, `<div class="panel-body">${dc.required ? `<div class="doc-chk">${dc.missing.map((c) => `<div class="dc miss">${ic("close", 12)} ${esc(cap(c))} <span>missing</span></div>`).join("")}${dc.present ? `<div class="dc ok">${ic("check", 12)} ${dc.present} required document${dc.present === 1 ? "" : "s"} on file</div>` : ""}</div>` : '<div class="small muted">No required-document list for this service.</div>'}<div class="small muted" style="margin-top:8px">${docs.length} file${docs.length === 1 ? "" : "s"} uploaded</div></div>`, `<button class="btn btn-sm btn-ghost" data-act="seg" data-name="matter:${m.id}.tab" data-val="documents">Open</button>`)}
        ${panel("Money", null, invs.length ? `<div class="panel-body"><div class="money3"><div><span>Billed</span><b>${inr(billed)}</b></div><div><span>Received</span><b>${inr(paid)}</b></div><div><span>Outstanding</span><b class="${billed - paid ? "red" : ""}">${inr(billed - paid)}</b></div></div></div>` : '<div class="empty">No invoices yet.</div>', `<button class="btn btn-sm btn-ghost" data-act="seg" data-name="matter:${m.id}.tab" data-val="billing">Open</button>`)}
        ${panel("People", people.length, `<div class="rows">${people.map(([u, r]) => `<div class="row-item">${avatar(u, true)}<div class="grow"><div class="t">${esc(uname(u))}</div><div class="s">${r} · ${TASKS.filter((t) => t.matter === m.id && t.assignee === u && t.status !== "completed").length} open task(s)</div></div></div>`).join("") || '<div class="empty">Nobody assigned.</div>'}</div>`, work ? `<button class="btn btn-sm" data-act="m-edit" data-what="people" data-m="${m.id}">${ic("users", 14)} Manage</button>` : "")}
      </div></div>`;

    // Details = the service's full form.
    const fieldsOf = svc ? svc.fields : [];
    T.details = panel(`${m.category} details`, fieldsOf.length, fieldsOf.length ? `<div class="panel-body"><div class="dgrid">${fieldsOf.map((f) => `<div class="dg"><span>${esc(f.label)}${f.required ? " *" : ""}</span><b class="${/No\.|Code|Class/.test(f.label) ? "mono" : ""}">${factVal(m, f)}</b></div>`).join("")}${m.legacyStatus ? `<div class="dg"><span>Status in old records</span><b>${esc(m.legacyStatus)}</b></div>` : ""}</div></div>` : `<div class="empty">No form fields are set up for ${esc(m.category)}. Add them in Settings → Matter Services.</div>`, work && fieldsOf.length ? `<button class="btn btn-sm btn-primary" data-act="edit-form" data-id="${m.id}">${ic("pencil", 14)} Edit details</button>` : "");

    T.work = panel("Official dates", dls.length, table([
        { h: "Due", r: (d) => dueStatus(d.due, d.done) },
        { h: "What", r: (d) => `<span class="t">${esc(d.type)}</span><div class="small muted">${esc(d.remarks)}</div>` },
        { h: "Date", r: (d) => `<span class="nowrap">${fmtDate(d.due)}</span>` },
        { h: "Reminders", r: (d) => `<span class="small sub">${d.reminders.map(fmtDate).join(" · ") || "—"}</span>` },
        { h: "", r: (d) => (work ? `<span class="row-acts">${!d.done ? `<button class="btn btn-sm" data-act="dl-done" data-id="${d.id}">Mark done</button>` : ""}<button class="icon-btn" data-act="m-edit" data-what="deadline" data-m="${m.id}" data-id="${d.id}" title="Edit date">${ic("pencil", 14)}</button></span>` : "") },
      ], dls, { empty: "No official dates recorded." }), work ? `<button class="btn btn-sm" data-act="new-deadline" data-id="${m.id}">${ic("plus", 14)} Add date</button>` : "")
      + panel("Tasks", tasks.length, table([
        { h: "Task", r: (t) => `<span class="t">${esc(t.title)}</span>` },
        { h: "Status", r: (t) => (work ? `<select class="select" style="height:30px;width:150px" data-change="task-status" data-id="${t.id}">${opts(TASK_STATUSES.concat([{ key: "blocked", label: "Blocked" }]).map((s) => ({ value: s.key, label: s.label })), t.status)}</select>` : taskStatus(t.status)) },
        { h: "Assignee", r: (t) => person(t.assignee) },
        { h: "Due", r: (t) => (t.status === "completed" ? `<span class="muted">${fmtDate(t.due)}</span>` : dueStatus(t.due)) },
        { h: "", r: (t) => (work ? `<button class="icon-btn" data-act="m-edit" data-what="task" data-m="${m.id}" data-id="${t.id}" title="Edit task">${ic("pencil", 14)}</button>` : "") },
      ], tasks, { empty: "No tasks yet." }), work ? `<button class="btn btn-sm btn-primary" data-act="new-task" data-id="${m.id}">${ic("plus", 14)} Add task</button>` : "")
      + panel("Office actions", oas.length, table([
        { h: "Action", r: (o) => `<span class="t">${esc(o.type)}</span><div class="small muted">${esc(o.summary)}</div>` },
        { h: "Severity", r: (o) => severity(o.severity) },
        { h: "Received", r: (o) => fmtDate(o.received) },
        { h: "Response due", r: (o) => (["pending", "hearing_scheduled"].includes(o.status) ? dueStatus(o.responseDue) : fmtDate(o.responseDue)) },
        { h: "Status", r: (o) => oaStatus(o.status) },
        { h: "", r: (o) => (work ? `<button class="icon-btn" data-act="m-edit" data-what="oa" data-m="${m.id}" data-id="${o.id}" title="Edit office action">${ic("pencil", 14)}</button>` : "") },
      ], oas, { empty: "No office actions (examination reports, objections, notices) recorded yet." }), work ? `<button class="btn btn-sm" data-act="m-edit" data-what="oa" data-m="${m.id}">${ic("plus", 14)} Record office action</button>` : "");

    T.documents = panel("Documents", docs.length, table([{ h: "File", r: (d) => `<span class="t">${ic("applications", 13)} ${esc(d.file)}</span><div class="small muted">${esc(d.type)}</div>` }, { h: "Version", r: (d) => `<span class="mono">${esc(d.version)}</span>` }, { h: "Uploaded", r: (d) => `${fmtDate(d.date)}<div class="small muted">${esc(uname(d.by) || "Imported")}</div>` }, { h: "OCR", r: (d) => (d.ocr ? badge("green", "Done") : badge("slate", "Pending")) }, { h: "AI indexed", r: (d) => (d.ai ? badge("green", "Yes") : badge("slate", "No")) }, { h: "", r: (d) => (work ? `<button class="icon-btn" data-act="m-edit" data-what="doc" data-m="${m.id}" data-id="${d.id}" title="Edit or replace">${ic("pencil", 14)}</button>` : "") }], docs, { empty: "No documents yet." }), work ? `<button class="btn btn-sm btn-primary" data-act="upload-doc" data-id="${m.id}">${ic("upload", 14)} Upload</button>` : "");
    T.billing = panel("Invoices", invs.length, table([{ h: "Invoice", r: (i) => `<span class="mono">${esc(i.id)}</span><div class="small muted">${fmtDate(i.date)}</div>` }, { h: "Prof. fee", num: 1, r: (i) => inr(i.prof) }, { h: "Govt. fee", num: 1, r: (i) => inr(i.govt) }, { h: "GST", num: 1, r: (i) => inr(i.gst) }, { h: "Total", num: 1, r: (i) => inr(i.total) }, { h: "Paid", num: 1, r: (i) => inr(i.paid) }, { h: "Status", r: (i) => invStatus(i.status) }, { h: "", r: (i) => (work ? `<span class="row-acts">${i.status !== "CANCELLED" && i.total > i.paid ? `<button class="btn btn-sm" data-act="m-pay" data-m="${m.id}" data-id="${i.id}">Record payment</button>` : ""}<button class="icon-btn" data-act="m-edit" data-what="invoice" data-m="${m.id}" data-id="${i.id}" title="Edit invoice">${ic("pencil", 14)}</button></span>` : "") }], invs, { empty: "No invoices yet." }), work ? `<button class="btn btn-sm btn-primary" data-act="m-edit" data-what="invoice" data-m="${m.id}">${ic("plus", 14)} Create invoice</button>` : "")
      + (PAYMENTS.some((p) => invs.some((i) => i.id === p.invoice)) ? panel("Payments received", PAYMENTS.filter((p) => invs.some((i) => i.id === p.invoice)).length, table([{ h: "Receipt", r: (p) => `<span class="mono">${esc(p.id)}</span>` }, { h: "Invoice", r: (p) => `<span class="mono">${esc(p.invoice)}</span>` }, { h: "Date", r: (p) => fmtDate(p.date) }, { h: "Mode", r: (p) => esc(p.mode || "—") + (p.ref ? `<div class="small muted">${esc(p.ref)}</div>` : "") }, { h: "Amount", num: 1, r: (p) => inr(p.amount) }, { h: "Verified", r: (p) => (p.verified ? badge("green", "Verified") : badge("amber", "Not verified")) }], PAYMENTS.filter((p) => invs.some((i) => i.id === p.invoice)))) : "");
    T.activity = panel("Activity", acts.length, `${work ? `<form class="panel-body" data-form="matter-activity" data-id="${m.id}" style="border-bottom:1px solid var(--border)"><div class="form-row" style="grid-template-columns:200px 1fr"><input class="input" name="type" placeholder="Type, e.g. Client call" required /><input class="input" name="text" placeholder="Write a note about this matter…" required /></div><div style="display:flex;gap:12px;align-items:center;margin-top:10px"><label class="small sub"><input type="checkbox" name="client" /> Client updated</label><span class="spacer"></span><button class="btn btn-primary btn-sm" type="submit">Add note</button></div></form>` : ""}
      ${acts.length ? `<div class="timeline">${acts.map((x) => `<div class="tl-item">${avatar(x.by, true)}<div><div class="head"><b>${esc(x.type)}</b><span class="muted small">${esc(uname(x.by))} · ${fmtDate(x.date)}</span>${x.clientUpdated ? badge("green", "Client updated") : ""}<span class="tag">${esc(x.external)}</span>${x.edited ? '<span class="muted small">edited</span>' : ""}${noteEditable(x) ? `<button class="icon-btn" style="margin-left:auto" data-act="m-edit" data-what="note" data-m="${m.id}" data-id="${x.id}" title="Edit your note">${ic("pencil", 13)}</button>` : ""}</div><p>${esc(x.text)}</p></div></div>`).join("")}</div>` : '<div class="empty">No activity yet.</div>'}`);

    const todoCount = todo.length;
    return {
      crumbs: [`<a href="#/matters">Matters</a>`, `<a href="#/matters/${encodeURIComponent(m.category)}">${esc(m.category)}</a>`, esc(appNoOf(m) || m.id)],
      html: header
        + `<div class="mh2-row">${nextBox}${stageBox}</div>`
        + tabs(`matter:${m.id}.tab`, st.tab, [
          { value: "overview", label: "Overview" },
          { value: "details", label: "Details", n: fieldsOf.length },
          { value: "work", label: "Dates & tasks", n: todoCount },
          { value: "documents", label: "Documents", n: docs.length },
          { value: "billing", label: "Billing", n: invs.length },
          { value: "activity", label: "Activity", n: acts.length },
        ])
        + T[st.tab],
    };
  };

  /* -------------------------------------------------------------- deadlines */
  // app/(agent)/agent/deadlines/page.tsx: Deadline, Matter, Client, Due date, Agent
  PAGES.deadlines = function () {
    const st = ui("deadlines"); st.f = st.f || "overdue";
    const all = S.deadlines().slice().sort((a, b) => byDate(toUTC(a.due), toUTC(b.due)));
    const G = { overdue: (d) => !d.done && daysFrom(d.due) < 0, week: (d) => !d.done && daysFrom(d.due) >= 0 && daysFrom(d.due) <= 7, upcoming: (d) => !d.done && daysFrom(d.due) > 7, completed: (d) => d.done };
    let list = all.filter(G[st.f]);
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter((d) => [d.type, d.matter, acct(matter(d.matter).account).display, uname(matter(d.matter).owner)].join(" ").toLowerCase().includes(q)); }
    return {
      crumbs: ["Matters", "Deadlines"],
      html: head("Deadlines", "Statutory dates, hearings and renewals with their reminder schedule.")
        + tabs("deadlines.f", st.f, [{ value: "overdue", label: "Overdue", n: all.filter(G.overdue).length }, { value: "week", label: "Due this week", n: all.filter(G.week).length }, { value: "upcoming", label: "Upcoming", n: all.filter(G.upcoming).length }, { value: "completed", label: "Completed", n: all.filter(G.completed).length }])
        + `<div class="toolbar">${search("deadlines.q", st.q, "Search deadline, matter, client or agent…")}</div>`
        + panel("Deadlines", list.length, table([
          { h: "Deadline", r: (d) => `<span class="t">${esc(d.type)}</span><div class="small muted">${esc(d.remarks)}</div>` },
          { h: "Matter", r: (d) => `<a class="mono" href="#/matter/${d.matter}">${esc(d.matter)}</a><div class="small muted">${esc(matter(d.matter).title)}</div>` },
          { h: "Client", r: (d) => esc(acct(matter(d.matter).account).display) },
          { h: "Due date", r: (d) => `${dueStatus(d.due, d.done)}<div class="small muted" style="margin-top:3px">${fmtDate(d.due)}</div>` },
          { h: "Reminders", r: (d) => `<span class="small sub" title="View or edit the reminders on this deadline">${ic("bell", 12)} ${d.reminders.map(fmtDate).join(" · ") || "—"}</span>` },
          { h: "Agent", r: (d) => person(matter(d.matter).owner) },
          { h: "Priority", r: (d) => priority(d.priority) },
        ], list, { empty: "No deadlines in this view." })),
    };
  };

  /* ------------------------------------------------------------------ tasks */
  // app/(agent)/agent/tasks/page.tsx: My work / Created by me / Team queue / All agents
  PAGES.tasks = function () {
    const st = ui("tasks"); st.view = st.view || (is("admin") ? "all" : "mine"); st.chip = st.chip || "";
    const me = state.me.id, base = S.tasks();
    const V = { mine: (t) => t.assignee === me, created: (t) => t.createdBy === me, team: (t) => !t.assignee, all: () => true };
    let list = base.filter(V[st.view]);
    const C = { overdue: (t) => t.due && t.status !== "completed" && daysFrom(t.due) < 0, today: (t) => t.due && daysFrom(t.due) === 0, blocked: (t) => t.status === "blocked", nodue: (t) => !t.due };
    if (st.chip) list = list.filter(C[st.chip]);
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter((t) => [t.title, t.matter, uname(t.assignee)].join(" ").toLowerCase().includes(q)); }
    list = list.slice().sort((a, b) => (a.status === "completed") - (b.status === "completed") || (a.due ? toUTC(a.due) : 9e15) - (b.due ? toUTC(b.due) : 9e15));
    const vbase = base.filter(V[st.view]);
    return {
      crumbs: ["Matters", "Tasks"],
      html: head("Tasks", "Work items across your matters.")
        + tabs("tasks.view", st.view, [{ value: "mine", label: "My work", n: base.filter(V.mine).length }, { value: "created", label: "Created by me", n: base.filter(V.created).length }, { value: "team", label: "Team queue", n: base.filter(V.team).length }, { value: "all", label: is("admin") ? "All agents" : "All my matters", n: base.length }])
        + `<div class="toolbar">${search("tasks.q", st.q, "Search tasks…")}${seg("tasks.chip", st.chip, [{ value: "", label: "All" }, { value: "overdue", label: "Overdue", n: vbase.filter(C.overdue).length }, { value: "today", label: "Due today", n: vbase.filter(C.today).length }, { value: "blocked", label: "Blocked", n: vbase.filter(C.blocked).length }, { value: "nodue", label: "No due date", n: vbase.filter(C.nodue).length }])}</div>`
        + panel("Tasks", list.length, table([
          { h: "Task", r: (t) => `<span class="t">${esc(t.title)}</span><div class="small muted mono">${esc(t.id)}</div>` },
          { h: "Status", r: (t) => taskStatus(t.status) },
          { h: "Priority", r: (t) => priority(t.priority) },
          { h: "Assignee", r: (t) => (t.assignee ? person(t.assignee) : `<button class="btn btn-sm btn-primary" data-act="claim-task" data-id="${t.id}">Claim</button>`) },
          { h: "Due", r: (t) => (t.status === "completed" ? `<span class="muted">${fmtDate(t.due)}</span>` : dueStatus(t.due)) },
          { h: "Matter", r: (t) => `<a class="mono" href="#/matter/${t.matter}">${esc(t.matter)}</a>` },
        ], list, { act: "task-inspector", empty: "No tasks in this view." })),
    };
  };

  /* ----------------------------------------------------------- applications */
  // app/(agent)/agent/applications/page.tsx (customer portal applications)
  PAGES.applications = function () {
    const st = ui("applications"); st.f = st.f || "all"; st.layout = st.layout || "grid";
    const all = S.applications();
    let list = st.f === "all" ? all : all.filter((a) => a.status === st.f);
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter((a) => [a.service, a.variant, a.ref, a.customer].join(" ").toLowerCase().includes(q)); }
    const F = [["all", "All"], ["draft", "Draft"], ["payment_pending", "Payment Pending"], ["payment_submitted", "Payment Submitted"], ["submitted", "Submitted"], ["under_review", "Under Review"], ["approved", "Approved"], ["payment_rejected", "Payment Rejected"], ["completed", "Completed"]];
    const grid = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px">${list.map((a) => `<div class="panel" style="margin:0"><div class="panel-body"><div style="display:flex;justify-content:space-between;gap:8px"><span class="mono" style="color:var(--primary)">${esc(a.ref)}</span>${appStatus(a.status)}</div><div class="t" style="font-weight:700;margin:8px 0 2px">${esc(a.service)}</div><div class="small muted">${esc(a.variant)}</div><div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--gray-3)" class="small"><span>${esc(a.customer)}</span><b>${inr(a.amount)}</b></div><div class="small muted" style="margin-top:4px">${fmtDate(a.date)} · Agent ${esc(uname(a.agent))}</div></div></div>`).join("") || '<div class="empty">No applications found</div>'}</div>`;
    return {
      crumbs: ["Matters", label("applications")],
      html: head(label("applications") === "My Applications" ? "Applications" : "Applications", "Service orders placed by customers on the website portal.")
        + `<div class="toolbar">${search("applications.q", st.q, "Search by service, variant, or reference...")}${sel("applications.f", st.f, F.map(([v, l]) => ({ value: v, label: l === "All" ? "Status: All" : l })))}<span class="spacer"></span>${seg("applications.layout", st.layout, [{ value: "grid", label: "Grid", icon: "grid" }, { value: "list", label: "List", icon: "list" }])}</div>`
        + (st.layout === "grid" ? grid : panel("Applications", list.length, table([
          { h: "Reference", r: (a) => `<span class="mono">${esc(a.ref)}</span>` },
          { h: "Service", r: (a) => `<span class="t">${esc(a.service)}</span><div class="small muted">${esc(a.variant)}</div>` },
          { h: "Customer", r: (a) => `${esc(a.customer)}<div class="small muted">${esc(a.email)}</div>` },
          { h: "Agent", r: (a) => person(a.agent) },
          { h: "Amount", num: 1, r: (a) => inr(a.amount) },
          { h: "Date", r: (a) => fmtDate(a.date) },
          { h: "Status", r: (a) => appStatus(a.status) },
        ], list, { empty: "No applications found" }))),
    };
  };

  /* --------------------------------------------------------------- payments */
  // Agent: app/(agent)/agent/payments (Pending (User) / Pending (Verification) / History)
  // Admin: app/(admin)/admin/payments "Finance & Payments"
  PAGES.payments = function () {
    const st = ui("payments");
    const payTable = (rows) => table([
      { h: "Transaction ID", r: (p) => `<span class="mono">${esc(p.id)}</span>` },
      { h: "User", r: (p) => `${esc(p.customer)}<div class="small muted mono">${esc(p.app)}</div>` },
      { h: "Amount", num: 1, r: (p) => inr(p.amount) },
      { h: "Method", r: (p) => esc(p.method) },
      { h: "Status", r: (p) => payStatus(p.status) },
      { h: "Date", r: (p) => fmtDate(p.date) },
      { h: "Actions", r: (p) => (p.status === "pending_verification" && can.verifyPayment() ? `<span style="display:inline-flex;gap:6px"><button class="btn btn-sm" data-act="reject-portal-pay" data-id="${p.id}">Reject</button><button class="btn btn-sm btn-primary" data-act="verify-portal-pay" data-id="${p.id}">Verify</button></span>` : "") },
    ], rows, { empty: "No transactions." });
    if (is("agent")) {
      st.tab = st.tab || "pending_verification";
      const mine = new Set(S.applications().map((a) => a.id));
      const all = PORTAL_PAYMENTS.filter((p) => mine.has(p.app));
      const G = { pending_user: (p) => p.status === "pending_user", pending_verification: (p) => p.status === "pending_verification", history: (p) => ["verified", "rejected"].includes(p.status) };
      return {
        crumbs: ["Finance", "Payments"],
        html: head("Payments", "Payments for your customers' applications (read-only).")
          + tabs("payments.tab", st.tab, [{ value: "pending_user", label: "Pending (User)", n: all.filter(G.pending_user).length }, { value: "pending_verification", label: "Pending (Verification)", n: all.filter(G.pending_verification).length }, { value: "history", label: "History", n: all.filter(G.history).length }])
          + panel("Payments", all.filter(G[st.tab]).length, payTable(all.filter(G[st.tab]))),
      };
    }
    st.tab = st.tab || "transactions";
    const verified = PORTAL_PAYMENTS.filter((p) => p.status === "verified");
    const month = verified.filter((p) => p.date.slice(0, 7) === TODAY.slice(0, 7));
    return {
      crumbs: ["Finance", "Finance & Payments"],
      html: head("Finance & Payments", "Portal transactions, invoice receipts and payment QR codes.", `<button class="btn btn-primary" data-act="upload-qr">${ic("upload", 14)} Upload QR Code</button>`)
        + stats([tile("Total Revenue", inr(sum(verified, (p) => p.amount) + sum(PAYMENTS.filter((p) => p.verified), (p) => p.amount)), "Portal + invoices", "javascript:void 0", "rupee"), tile("Monthly Revenue", inr(sum(month, (p) => p.amount) + sum(PAYMENTS.filter((p) => p.verified && p.date.slice(0, 7) === TODAY.slice(0, 7)), (p) => p.amount)), MONTHS[+TODAY.slice(5, 7) - 1] + " " + TODAY.slice(0, 4), "javascript:void 0", "conversion"), tile("Transactions", PORTAL_PAYMENTS.length + PAYMENTS.length, `${PORTAL_PAYMENTS.filter((p) => p.status === "pending_verification").length + PAYMENTS.filter((p) => !p.verified).length} to verify`, "javascript:void 0", "payments", PORTAL_PAYMENTS.some((p) => p.status === "pending_verification")), tile("Active QR Codes", QR_CODES.filter((q) => q.active).length, "", "javascript:void 0", "grid")])
        + tabs("payments.tab", st.tab, [{ value: "transactions", label: "Portal Transactions", n: PORTAL_PAYMENTS.length }, { value: "receipts", label: "Invoice Receipts", n: PAYMENTS.length }, { value: "qr", label: "QR Codes", n: QR_CODES.length }])
        + (st.tab === "transactions" ? panel("Transactions", PORTAL_PAYMENTS.length, payTable(PORTAL_PAYMENTS))
          : st.tab === "receipts" ? panel("Invoice Receipts", PAYMENTS.length, table([
            { h: "Receipt", r: (p) => `<span class="mono">${esc(p.id)}</span>` },
            { h: "Invoice", r: (p) => `<span class="mono">${esc(p.invoice)}</span>` },
            { h: "Account", r: (p) => esc(acct((INVOICES.find((i) => i.id === p.invoice) || {}).account).display) },
            { h: "Date", r: (p) => fmtDate(p.date) },
            { h: "Mode", r: (p) => esc(p.mode) },
            { h: "Amount", num: 1, r: (p) => inr(p.amount) },
            { h: "Verification", r: (p) => (p.verified ? badge("green", `Verified · ${uname(p.by)}`) : `<button class="btn btn-sm btn-primary" data-act="verify-pay" data-id="${p.id}">Verify</button>`) },
          ], PAYMENTS))
          : panel("QR Codes", QR_CODES.length, table([
            { h: "QR Code", r: () => `<span class="tag">${ic("grid", 12)} QR</span>` },
            { h: "Service", r: (q) => esc(q.service) },
            { h: "Variant", r: (q) => esc(q.variant) },
            { h: "Bank Name", r: (q) => esc(q.bank) },
            { h: "UPI ID", r: (q) => `<span class="mono">${esc(q.upi)}</span>` },
            { h: "Status", r: (q) => (q.active ? badge("green", "Active") : badge("gray", "Inactive")) },
            { h: "Actions", r: (q) => `<button class="btn btn-sm" data-act="toggle-qr" data-id="${q.id}">${q.active ? "Deactivate" : "Activate"}</button>` },
          ], QR_CODES))),
    };
  };

  /* ------------------------------------------------------ settings & admin */
  PAGES.settings = function () {
    const items = [["Service Areas & Stages", "Service pipelines and the stages each matter moves through", "kanban"], ["Form Templates", "Application form templates for Trademark / Patent / Design / Copyright", "estimates"], ["Document Categories", "Folders and document types per service", "applications"], ["User Groups", "Teams that share matters", "leads"], ["Conflict Templates", "Checks run before a new matter is opened", "roles"]];
    return {
      crumbs: ["Settings", "Matter Settings"],
      html: head("Matter Settings", "Templates and structures your delivery team works with.")
        + `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">${items.map(([n, d, i]) => `<a class="stat" href="javascript:void 0" data-act="soon"><span class="ic">${ic(i, 18)}</span><span><div class="lbl" style="font-weight:700;color:var(--ink);font-size:13px">${esc(n)}</div><div class="hint" style="font-size:12px">${esc(d)}</div></span></a>`).join("")}</div>`
        + `<div style="height:16px"></div>` + panel("Matter services", SERVICE_CONFIG.services.length, table([
          { h: "Service", r: (x) => `<span class="t">${esc(x.name)}</span>` },
          { h: "Stages", num: 1, r: (x) => x.stages.length || badge("amber", "None") },
          { h: "Form fields", num: 1, r: (x) => x.fields.length },
          { h: "Matters", num: 1, r: (x) => MATTERS.filter((m) => m.category === x.name).length },
        ], SERVICE_CONFIG.services), `<a class="btn btn-sm btn-primary" href="#/setup">Open Matter Services</a>`),
    };
  };

  /* ------------------------------------------------------ matter services */
  // Settings → Matter Services: services, their stages (phase, legacy statuses, checks) and form fields
  // (type, Excel column, display flags). One configuration drives the app AND the legacy import.
  // Plain-language meaning of each office step (config.matter_applications.stage).
  const PHASE_INFO = {
    draft: { label: "Not filed yet", hint: "Being prepared inside the firm", icon: "note" },
    filed: { label: "Filed", hint: "Submitted to the office, waiting for review", icon: "upload" },
    examination: { label: "Examination", hint: "The office is reviewing the application", icon: "search" },
    objection: { label: "Objection", hint: "The office or a third party has objected", icon: "alert" },
    hearing: { label: "Hearing", hint: "A hearing is scheduled or under way", icon: "chat" },
    registered: { label: "Registered / granted", hint: "Protection is in force", icon: "shield" },
    rejected: { label: "Refused", hint: "The office refused the application", icon: "close" },
    abandoned: { label: "Abandoned / lapsed", hint: "Dropped, withdrawn or lapsed", icon: "clock" },
  };
  const PHASE_OPTS = [{ value: "", label: "— not a filing step" }, ...APP_STAGES.map((p) => ({ value: p, label: cap(p) }))];
  const cfgDraft = () => (state.cfgDraft = state.cfgDraft || JSON.parse(JSON.stringify(SERVICE_CONFIG)));
  const cfgDirty = () => state.cfgDraft && JSON.stringify(state.cfgDraft) !== JSON.stringify(SERVICE_CONFIG);
  // What the workbook actually contains for a service: its columns and its status texts.
  const legacyColumns = (svc) => (svc.sheet && LEGACY[svc.sheet] && LEGACY[svc.sheet].length ? Object.keys(LEGACY[svc.sheet][0]).filter((c) => !NON_FIELD_COLUMNS.includes(c)) : []);
  const legacyStatusCounts = (svc) => {
    const out = {};
    if (svc.sheet && LEGACY[svc.sheet] && svc.statusColumn) LEGACY[svc.sheet].forEach((r) => { const v = r[svc.statusColumn]; if (v) out[v] = (out[v] || 0) + 1; });
    const inSheet = new Set(svc.sheet && LEGACY[svc.sheet] ? LEGACY[svc.sheet].map((r) => r["Matter ID"]) : []);
    LEGACY["Matter Master"].filter((r) => r["Service Category"] === svc.name && !inSheet.has(r["Matter ID"])).forEach((r) => { const v = r["Current Stage"]; if (v) out[v] = (out[v] || 0) + 1; });
    return out;
  };

  PAGES.setup = function () {
    const st = ui("setup"); st.sel = st.sel || 0; st.tab = st.tab || "stages";
    const cfg = cfgDraft();
    const svc = cfg.services[st.sel] || cfg.services[0];
    const P = (path) => `data-change="cfg" data-path="${path}"`;
    const chk = (path, on, title) => `<input type="checkbox" ${P(path)} ${on ? "checked" : ""} title="${esc(title || "")}" />`;
    const used = (key) => MATTERS.filter((m) => m.category === svc.name && m.app[key] != null && m.app[key] !== "").length;
    const inStage = (name) => MATTERS.filter((m) => m.category === svc.name && m.stage === name).length;
    const statusCounts = legacyStatusCounts(svc);
    const linkedTo = (status) => svc.stages.find((x) => (x.legacyStatuses || []).includes(status));

    const svcMatters = (name) => MATTERS.filter((m) => m.category === name).length;
    const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
    const mark = (x, cls) => `<span class="svc-mark${cls ? " " + cls : ""}">${esc((x.prefix || x.name).slice(0, 3).toUpperCase())}</span>`;
    const iconBtn = (act, i, icon, title, extra) => `<button type="button" class="icon-btn${extra ? " " + extra : ""}" data-act="${act}" data-i="${i}" title="${esc(title)}" aria-label="${esc(title)}">${ic(icon, 14)}</button>`;

    // Left rail: every service, with its own delete button.
    const rail = `<aside class="svc-rail">
        <div class="rail-head"><span>Services</span><span class="muted">${cfg.services.length}</span></div>
        <div class="rail-list">${cfg.services.map((x, i) => `<div class="rail-item${i === st.sel ? " sel" : ""}">
          <a href="javascript:void 0" data-act="cfg-sel" data-i="${i}" class="rail-link">${mark(x)}<span class="svc-txt"><b>${esc(x.name)}</b><small>${plural(svcMatters(x.name), "matter")} · ${x.isFiling ? "Filing" : "Advisory"}</small></span></a>
          ${iconBtn("cfg-del-service", i, "trash", `Delete ${x.name}`, "danger")}
        </div>`).join("")}</div>
        <button class="rail-add" data-act="cfg-new-service">${ic("plus", 15)} New service</button>
        <a class="rail-reset" href="javascript:void 0" data-act="cfg-reset">Reset to starting setup</a>
      </aside>`;

    // Workflow: stages as board columns, each showing its checks.
    const nChecks = (x) => (x.checks || []).length;
    const tone = (x) => (x.phase === "registered" ? "good" : x.phase === "rejected" || x.phase === "abandoned" ? "end" : x.phase === "objection" || x.phase === "hearing" ? "warn" : "");
    const board = `<div class="board">${svc.stages.map((x, i) => `<div class="stage-col ${tone(x)}">
        <div class="col-head">
          <span class="col-n">${i + 1}</span>
          <span class="col-tools">
            ${iconBtn("cfg-move-stage", i + ":-1", "chev-l", "Move left", i === 0 ? "off" : "")}${iconBtn("cfg-move-stage", i + ":1", "chev-r", "Move right", i === svc.stages.length - 1 ? "off" : "")}${iconBtn("cfg-del-stage", i, "trash", `Delete stage ${x.name}`, "danger")}
          </span>
        </div>
        <a href="javascript:void 0" class="col-name" data-act="cfg-stage" data-i="${i}">${esc(x.name)}</a>
        <div class="col-meta">${x.phase ? `<span class="req blue">${esc(PHASE_INFO[x.phase].label)}</span>` : ""}<span>${plural(inStage(x.name), "matter")}</span></div>
        <div class="col-checks">
          <div class="cc-title">${ic("lock", 11)} Before moving here</div>
          ${(x.checks || []).map((c) => `<div class="cc">${ic(c.type === "field" ? "note" : "check", 12)}<span>${esc(c.label || "(no description)")}</span></div>`).join("") || '<div class="cc none">Nothing required</div>'}
        </div>
        <button class="btn btn-sm col-edit" data-act="cfg-stage" data-i="${i}">Edit stage</button>
      </div>`).join("")}
      <button class="stage-col add" data-act="cfg-stage" data-i="-1">${ic("plus", 18)}<b>Add stage</b><small>A new column on the board</small></button>
    </div>`;

    // Form: a table of fields with edit and delete on every row.
    const numOpts = (cur) => opts([{ value: "", label: "None" }, ...svc.fields.filter((f) => f.type === "text" || f.type === "number").map((f) => ({ value: f.key, label: f.label }))], cur || "");
    const shownOn = (f) => [f.keyFact && "Header", f.table && "List", f.card && "Card"].filter(Boolean).map((w) => `<span class="pill">${w}</span>`).join("") || '<span class="muted small">Form only</span>';
    const fieldTable = svc.fields.length ? `<div class="ftable">
        <div class="ft-row ft-head"><span></span><span>Field</span><span>Answer</span><span>Shown on</span><span>In use</span><span></span></div>
        ${svc.fields.map((f, i) => `<div class="ft-row">
          <span class="fl-order"><button class="btn btn-sm btn-ghost" data-act="cfg-move" data-list="fields" data-i="${i}" data-d="-1" ${i === 0 ? "disabled" : ""} title="Move up">↑</button><button class="btn btn-sm btn-ghost" data-act="cfg-move" data-list="fields" data-i="${i}" data-d="1" ${i === svc.fields.length - 1 ? "disabled" : ""} title="Move down">↓</button></span>
          <a href="javascript:void 0" class="ft-name" data-act="cfg-field" data-i="${i}"><b>${esc(f.label)}</b>${f.required ? '<span class="req">Required</span>' : ""}${svc.noField === f.key ? '<span class="req blue">Official no.</span>' : ""}${svc.regField === f.key ? '<span class="req blue">Registration no.</span>' : ""}${f.help ? `<small>${esc(f.help)}</small>` : ""}</a>
          <span class="ft-type">${ic(typeOf(f.type).icon, 14)} ${typeOf(f.type).label}</span>
          <span class="ft-pills">${shownOn(f)}</span>
          <span class="small ${used(f.key) ? "" : "muted"}">${used(f.key) ? plural(used(f.key), "matter") : "Not yet"}</span>
          <span class="ft-actions">${iconBtn("cfg-field", i, "pencil", `Edit ${f.label}`)}${iconBtn("cfg-del-field", i, "trash", `Delete ${f.label}`, "danger")}</span>
        </div>`).join("")}
      </div>` : '<div class="empty">No fields yet. Add the first detail your team should record.</div>';

    const totalChecks = svc.stages.reduce((a, x) => a + nChecks(x), 0);
    const main = `<div class="studio-main">
        <section class="panel svc-head">
          ${mark(svc, "lg")}
          <div class="grow"><h2>${esc(svc.name)}</h2>
            <div class="svc-sub">${svc.isFiling ? badge("blue", "Office filing") : badge("slate", "Advisory service")}<span>Prefix <b class="mono">${esc(svc.prefix || "—")}</b></span><span>${plural(svcMatters(svc.name), "matter")}</span></div></div>
          <div class="svc-actions"><button class="btn" data-act="cfg-svc-edit">${ic("settings", 14)} Settings</button>
          <button class="btn btn-danger-soft" data-act="cfg-del-service" data-i="${st.sel}">${ic("trash", 14)} Delete service</button></div>
        </section>

        <section class="panel">
          <div class="sec-head"><div><h3>${ic("kanban", 16)} Workflow</h3><p>The board's columns, left to right. A matter can only move into a stage once its checks are done.</p></div></div>
          ${board}
        </section>

        <section class="panel">
          <div class="sec-head"><div><h3>${ic("note", 16)} Form fields</h3><p>What your team records on each ${esc(svc.name)} matter.</p></div>
            <div class="sec-actions"><button class="btn" data-act="cfg-preview">${ic("search", 14)} Preview form</button><button class="btn btn-primary" data-act="cfg-field" data-i="-1">${ic("plus", 14)} Add field</button></div></div>
          <div class="num-pick">
            <label>${ic("shield", 14)}<span>Official number</span><select class="select" ${P("noField")}>${numOpts(svc.noField)}</select><small>Shown big on every matter</small></label>
            <label>${ic("check", 14)}<span>Registration number</span><select class="select" ${P("regField")}>${numOpts(svc.regField)}</select><small>Shown once granted</small></label>
          </div>
          ${fieldTable}
        </section>
      </div>`;

    return {
      crumbs: ["Settings", "Matter Services"],
      html: head("Matter Services", "Each service has a workflow (the stages on its board) and a form (the details your team records).")
        + `<div class="studio">${rail}${main}</div>
          ${cfgDirty() ? `<div class="savebar"><span class="status tone-amber"><i class="dot"></i>You have unsaved changes</span><span class="spacer"></span><button class="btn" data-act="cfg-discard">Discard</button><button class="btn btn-primary" data-act="cfg-save">Save changes</button></div>` : ""}`,
    };
  };

  PAGES.pipeline = function () {
    const execs = USERS.filter((u) => u.role === "sales_executive");
    return {
      crumbs: ["Reports", "Pipeline Report"],
      html: head("Pipeline Report", "Pipeline value by stage and by sales executive.")
        + panel("Pipeline value by stage", null, `<div class="panel-body">${bars(LEAD_STAGES_UI.map((s, i) => { const l = LEADS.filter((x) => x.status === s.key); return { l: s.label, n: l.length, v: sum(l, (x) => x.value), c: ["blue", "orange", "red", "green", "slate"][i] }; }), inr)}</div>`)
        + panel("By sales executive", null, table([{ h: "Executive", r: (u) => person(u.id) }, ...LEAD_STAGES_UI.map((s) => ({ h: s.label, num: 1, r: (u) => LEADS.filter((l) => l.owner === u.id && l.status === s.key).length })), { h: "Open value", num: 1, r: (u) => inr(sum(LEADS.filter((l) => l.owner === u.id && OPEN(l)), (l) => l.value)) }], execs)),
    };
  };
  PAGES.conversion = function () {
    const execs = USERS.filter((u) => u.role === "sales_executive");
    const sources = [...new Set(LEADS.map((l) => l.source))];
    return {
      crumbs: ["Reports", "Conversion Stats"],
      html: head("Conversion Stats", "How leads convert, by executive and by source.")
        + `<div class="grid-even">${panel("Conversion by executive", null, table([
            { h: "Executive", r: (u) => person(u.id) },
            { h: "Leads", num: 1, r: (u) => LEADS.filter((l) => l.owner === u.id).length },
            { h: "Converted", num: 1, r: (u) => LEADS.filter((l) => l.owner === u.id && l.status === "converted").length },
            { h: "Win rate", num: 1, r: (u) => { const a = LEADS.filter((l) => l.owner === u.id); return a.length ? Math.round((a.filter((l) => l.status === "converted").length / a.length) * 100) + "%" : "—"; } },
            { h: "Won value", num: 1, r: (u) => inr(sum(LEADS.filter((l) => l.owner === u.id && l.status === "converted"), (l) => l.value)) },
          ], execs))}
          ${panel("Leads by source", null, `<div class="panel-body">${bars(sources.map((s) => ({ l: s, v: LEADS.filter((l) => l.source === s).length })))}</div>`)}</div>`,
    };
  };

  PAGES.services = function () {
    const st = ui("services"); st.cat = st.cat || "";
    const cats = [...new Set(SERVICES.map((s) => s.category))];
    const list = st.cat ? SERVICES.filter((s) => s.category === st.cat) : SERVICES;
    return {
      crumbs: ["Firm Setup", "Service Management"],
      html: head("Service Management", "The service catalogue used on estimates, matters and the website.", `<button class="btn btn-primary" data-act="soon">${ic("plus", 14)} Add Service</button>`)
        + `<div class="toolbar">${sel("services.cat", st.cat, [{ value: "", label: "All categories" }, ...cats.map((c) => ({ value: c, label: c }))])}</div>`
        + panel("Services", list.length, table([
          { h: "Service Name", r: (s) => `<span class="t">${esc(s.name)}</span><div class="small muted">Turnaround: ${esc(s.tat)}</div>` },
          { h: "Category", r: (s) => `<span class="tag">${esc(s.category)}</span>` },
          { h: "Gov Fee", num: 1, r: (s) => inr(s.govt) },
          { h: "Professional Fee", num: 1, r: (s) => inr(s.prof) },
          { h: "GST %", num: 1, r: () => "18%" },
          { h: "Actions", r: () => `<span style="display:inline-flex;gap:4px"><button class="btn btn-sm" data-act="soon">Edit</button><button class="btn btn-sm btn-ghost" data-act="soon">Delete</button></span>` },
        ], list)),
    };
  };

  PAGES.discounts = function () {
    const st = ui("discounts"); st.f = st.f || "all";
    let list = DISCOUNTS;
    if (st.f !== "all") list = list.filter((d) => (st.f === "active" ? d.active : !d.active));
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter((d) => [d.code, d.appliesTo].join(" ").toLowerCase().includes(q)); }
    return {
      crumbs: ["Firm Setup", "Discounts"],
      html: head("Discount Management", "Promo codes and bundle discounts applied on estimates and the website.", `<button class="btn btn-primary" data-act="new-discount">${ic("plus", 14)} New Discount</button>`)
        + `<div class="toolbar">${search("discounts.q", st.q, "Search by code or name...")}${sel("discounts.f", st.f, [{ value: "all", label: "Status: All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }])}</div>`
        + panel("Discounts", list.length, table([
          { h: "Code", r: (d) => `<span class="mono t">${esc(d.code)}</span>` },
          { h: "Description", r: (d) => esc(d.appliesTo) },
          { h: "Discount", num: 1, r: (d) => (d.type === "Percent" ? d.value + "%" : inr(d.value)) },
          { h: "Valid From", r: (d) => fmtDate(d.validFrom || addDays(d.validTill, -90)) },
          { h: "Valid Until", r: (d) => fmtDate(d.validTill) },
          { h: "Status", r: (d) => (d.active ? badge("green", "Active") : badge("gray", "Inactive")) },
          { h: "Actions", r: (d) => `<span style="display:inline-flex;gap:4px"><button class="btn btn-sm" data-act="toggle-discount" data-id="${d.id}">${d.active ? "Deactivate" : "Activate"}</button><button class="btn btn-sm btn-ghost" data-act="delete-discount" data-id="${d.id}">Delete</button></span>` },
        ], list)),
    };
  };

  PAGES.config = function () {
    const items = [["Firms", "Eeva IP Services LLP · Eeva Legal", "accounts"], ["Tax Rates", "GST 18% · IGST 18% · Exempt", "discounts"], ["Tax Groups & Mappings", "Intra-state (CGST+SGST) · Inter-state (IGST)", "config"], ["Bank Accounts", "2 accounts linked to invoices", "payments"], ["Service Items", "Line items used on estimates and invoices", "services"]];
    return {
      crumbs: ["Firm Setup", "Configuration"],
      html: head("Configuration", "Firm-wide settings used by billing, estimates and matters.")
        + `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">${items.map(([n, d, i]) => `<a class="stat" href="javascript:void 0" data-act="soon"><span class="ic">${ic(i, 18)}</span><span><div class="lbl" style="font-weight:700;color:var(--ink);font-size:13px">${esc(n)}</div><div class="hint" style="font-size:12px">${esc(d)}</div></span></a>`).join("")}</div>`,
    };
  };

  /* ------------------------------------------------------------ portfolio */
  // CEO view of the firm's IP book. Every number is derived from a recorded field;
  // the "How these numbers are calculated" panel on the page states each rule.
  // Classification uses the filing stage (config.matter_applications.stage, a backend enum),
  // never a judgement. Records whose stage is not recorded are counted as "Stage unknown".
  const IP_TYPES = FILING_SERVICES;
  const BUCKETS = [
    { key: "registered", label: "Registered / granted", stages: ["registered"], color: "#10B981" },
    { key: "pending", label: "Pending at office", stages: ["filed", "examination"], color: "#4F46E5" },
    { key: "contested", label: "Objection / hearing", stages: ["objection", "hearing"], color: "#EF4444" },
    { key: "unfiled", label: "Not yet filed", stages: ["draft"], color: "#F59E0B" },
    { key: "lapsed", label: "Refused / abandoned", stages: ["rejected", "abandoned"], color: "#A855F7" },
  ];
  const bucketOf = (m) => (BUCKETS.find((b) => b.stages.includes(m.appStage)) || { key: "unknown", label: "Stage unknown", color: "var(--ghost)" });
  const RENEWAL_KINDS = { renewal: "Renewal", annuity: "Patent annuity", surveillance: "Certificate expiry / surveillance" };

  PAGES.portfolio = function () {
    const st = ui("portfolio"); st.svc = st.svc || "all";
    const filingsAll = MATTERS.filter((m) => IP_TYPES.includes(m.category));
    const filings = filingsAll.filter((m) => st.svc === "all" || m.category === st.svc);
    const ids = new Set(filings.map((m) => m.id));
    const inB = (k) => filings.filter((m) => bucketOf(m).key === k);
    const clients = [...new Set(filings.map((m) => m.account).filter(Boolean))];
    const unlinked = filings.filter((m) => !m.account).length;
    const openDls = DEADLINES.filter((d) => ids.has(d.matter) && !d.done);
    const overdueDls = openDls.filter((d) => daysFrom(d.due) < 0);
    const renewals = DEADLINES.filter((d) => ids.has(d.matter) && RENEWAL_KINDS[d.kind] && !d.done).sort((a, b) => byDate(toUTC(a.due), toUTC(b.due)));
    const ren12 = renewals.filter((d) => daysFrom(d.due) >= 0 && daysFrom(d.due) <= 365);
    const renOverdue = renewals.filter((d) => daysFrom(d.due) < 0);
    const invs = INVOICES.filter((i) => ids.has(i.matter));
    const billed = sum(invs, (i) => i.total), collected = sum(invs, (i) => i.paid);
    const notRegisteredRenewal = (d) => d.kind === "renewal" && (matter(d.matter) || {}).appStage !== "registered";
    const pct = (n, of) => (of ? Math.round((100 * n) / of) : 0);
    const groups = BUCKETS.concat([{ key: "unknown", label: "Stage unknown", color: "var(--ghost)" }]).map((b) => ({ ...b, ms: inB(b.key) })).filter((g) => g.ms.length || g.key !== "unknown");

    // 1. One sentence that answers "how is the book?" (Stripe: microcopy carries the meaning).
    const sentence = filings.length ? `<b>${filings.length}</b> IP filing${filings.length === 1 ? "" : "s"} for <b>${clients.length}</b> client${clients.length === 1 ? "" : "s"}${unlinked ? ` (plus ${unlinked} with an applicant not in the client list)` : ""}. <b>${inB("registered").length}</b> registered or granted (${pct(inB("registered").length, filings.length)}%), <b>${inB("pending").length}</b> pending at the office, and ${inB("contested").length ? `<b class="red">${inB("contested").length} at objection or hearing</b>` : "none at objection or hearing"}. ${renOverdue.length ? `<b class="red">${renOverdue.length} renewal${renOverdue.length === 1 ? " is" : "s are"} past due</b>; ` : ""}${ren12.length ? `${ren12.length} renewal${ren12.length === 1 ? "" : "s"} fall due in the next 12 months.` : "No renewals are due in the next 12 months."}` : "No IP filings recorded for this type.";

    // 2. The whole book as one bar, labelled directly underneath (Tufte: direct labels, no legend hunt).
    const hero = `<div class="book-bar">${groups.filter((g) => g.ms.length).map((g) => `<i style="flex:${g.ms.length};background:${g.color}" title="${esc(g.label)}: ${g.ms.length}"></i>`).join("") || '<i style="flex:1;background:var(--sunken)"></i>'}</div>
      <div class="book-keys">${groups.map((g) => `<div class="bk${g.key === "contested" && g.ms.length ? " alert" : ""}"><span class="bk-sw" style="background:${g.color}"></span><span class="bk-v">${g.ms.length}</span><span class="bk-l">${esc(g.label)}</span><span class="bk-p">${pct(g.ms.length, filings.length)}%</span></div>`).join("")}</div>`;
    const money = `<div class="money">
        <div><span>Billed on these filings</span><b>${inrShort(billed)}</b></div>
        <div><span>Collected</span><b>${inrShort(collected)}</b></div>
        <div><span>Outstanding</span><b class="${billed - collected > 0 ? "red" : ""}">${inrShort(billed - collected)}</b></div>
        <div><span>Overdue deadlines</span><b class="${overdueDls.length ? "red" : ""}">${overdueDls.length}</b></div>
      </div>`;

    // 3. Small multiples: one card per IP type, all bars on the same scale.
    const types = st.svc === "all" ? IP_TYPES : [st.svc];
    const tmax = Math.max(1, ...types.map((c) => filingsAll.filter((m) => m.category === c).length));
    const cards = types.map((c) => {
      const ms = filingsAll.filter((m) => m.category === c), mids = new Set(ms.map((m) => m.id));
      const iv = INVOICES.filter((i) => mids.has(i.matter)), b = sum(iv, (i) => i.total), p = sum(iv, (i) => i.paid);
      const con = ms.filter((m) => bucketOf(m).key === "contested").length, reg = ms.filter((m) => bucketOf(m).key === "registered").length;
      const next = renewals.filter((d) => mids.has(d.matter))[0];
      return `<a class="ip-card" href="#/matters/${encodeURIComponent(c)}">
        <div class="ip-top"><span>${esc(c)}</span><b>${ms.length}</b></div>
        ${ms.length ? stackBar(ms, tmax) : '<div class="sbar" style="width:6%"><i style="flex:1;background:var(--sunken)"></i></div>'}
        <div class="ip-facts">
          <span><small>Registered</small>${reg} <em>${pct(reg, ms.length)}%</em></span>
          <span><small>Objection / hearing</small>${con ? `<b class="red">${con}</b>` : "0"}</span>
          <span><small>Next renewal</small>${next ? `<span class="${daysFrom(next.due) < 0 ? "red" : ""}">${esc(fmtDate(next.due))}</span>` : '<span class="muted">None recorded</span>'}</span>
          <span><small>Collected</small>${b ? `${inrShort(p)} <em>of ${inrShort(b)}</em>` : '<span class="muted">No invoices</span>'}</span>
        </div></a>`;
    }).join("");

    // 4. Exceptions: filings that need action, with the recorded reason.
    const attention = filings.filter((m) => bucketOf(m).key === "contested" || overdueDls.some((d) => d.matter === m.id)).map((m) => {
      const reasons = [];
      if (bucketOf(m).key === "contested") reasons.push(`At ${m.appStage}`);
      overdueDls.filter((d) => d.matter === m.id).forEach((d) => reasons.push(`${d.type} overdue since ${fmtDate(d.due)}`));
      return { m, reasons };
    });
    const attnHtml = attention.length ? `<div class="attn">${attention.map(({ m, reasons }) => `<a class="attn-row" href="#/matter/${m.id}"><span class="attn-dot red"></span><span class="attn-t"><b>${esc(m.title)}</b><small><span class="mono">${esc(appNoOf(m) || m.id)}</span> · ${esc(m.category)} · ${m.account ? esc(acct(m.account).display) : "Unlinked client"} · ${esc(uname(m.owner))}</small><span class="attn-why left">${reasons.map((r) => `<span class="why">${esc(r)}</span>`).join("")}</span></span><span class="attn-go">${ic("chev-r", 14)}</span></a>`).join("")}</div>`
      : `<div class="attn-clear">${ic("check", 16)} No filing is at objection or hearing, and none has an overdue deadline.</div>`;

    // 5. Renewals on a 12-month strip, then the list.
    const [cy, cm] = TODAY.split("-").map(Number);
    const strip = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(cy, cm - 1 + i, 1)); const key = d.toISOString().slice(0, 7); return { key, label: MONTHS_SHORT[d.getUTCMonth()], n: renewals.filter((r) => r.due.slice(0, 7) === key).length }; });
    const renStrip = `<div class="ren-strip">${strip.map((s) => `<div class="rs${s.n ? " on" : ""}" title="${s.label} ${s.key.slice(0, 4)}: ${s.n} renewal(s)"><span class="rs-n">${s.n || ""}</span><span class="rs-dot"></span><span class="rs-l">${s.label}</span></div>`).join("")}</div>`;
    const renList = renewals.length ? `<div class="ren-list">${renewals.slice(0, 8).map((d) => { const m = matter(d.matter) || {}; return dlRow({ href: `#/matter/${d.matter}`, due: d.due, title: m.title || d.matter, showOwner: false, meta: [esc(RENEWAL_KINDS[d.kind]), esc(acct(m.account).display), notRegisteredRenewal(d) ? '<span class="amber">not registered yet</span>' : ""] }); }).join("")}${renewals.length > 8 ? `<div class="small muted" style="padding:8px 0 0">+ ${renewals.length - 8} more on the Deadlines page</div>` : ""}</div>` : '<div class="empty">No renewal dates recorded for these filings.</div>';

    // 6. Clients, each with a word-sized bar of their filings.
    const cmax = Math.max(1, ...[...new Set(filings.map((m) => m.account || null))].map((id) => filings.filter((m) => (m.account || null) === id).length));
    const clientRows = [...new Set(filings.map((m) => m.account || null))].map((id) => {
      const ms = filings.filter((m) => (m.account || null) === id); const iv = INVOICES.filter((i) => ms.some((m) => m.id === i.matter));
      return { id, a: acct(id), ms, n: ms.length, billed: sum(iv, (i) => i.total), due: sum(iv, (i) => i.total - i.paid), nextRen: renewals.filter((d) => ms.some((m) => m.id === d.matter))[0] };
    }).sort((x, y) => (x.id ? 0 : 1) - (y.id ? 0 : 1) || y.n - x.n);

    const withOpened = filings.filter((m) => m.opened);
    const yNow = +TODAY.slice(0, 4); const years = [yNow - 4, yNow - 3, yNow - 2, yNow - 1, yNow];
    const agents = USERS.filter((u) => filings.some((m) => m.owner === u.id));
    const services = MATTERS.filter((m) => !IP_TYPES.includes(m.category));

    return {
      crumbs: ["My Portfolio"],
      html: `<div class="page-head calm"><div><p class="kicker">My Portfolio · ${longDate()}</p><h1>The firm's IP book</h1></div><div class="actions">${seg("portfolio.svc", st.svc, [{ value: "all", label: "All" }, ...IP_TYPES.map((c) => ({ value: c, label: c }))])}<button class="btn" data-act="print">${ic("estimates", 14)} Export</button></div></div>`
        + `<section class="panel book">
            <p class="sentence">${sentence}</p>
            ${hero}
            ${money}
          </section>`
        + (types.length > 1 ? `<div class="ip-cards">${cards}</div>` : "")
        + `<div class="grid-2">
            ${panel("Needs attention", attention.length, attnHtml)}
            ${panel("Renewals & maintenance", renewals.length, `<div class="panel-body">${ren12.length || renOverdue.length ? renStrip : renewals.length ? `<div class="ren-note">${ic("check", 14)}<span>Nothing due in the next 12 months. The nearest is <b>${fmtDate(renewals[0].due)}</b>.</span></div>` : ""}${renList}</div>`)}
          </div>`
        + panel("Clients", clientRows.length, table([
            { h: "Client", r: (c) => (c.id ? `<a class="t" href="#/account/${c.id}">${esc(c.a.display)}</a><div class="small muted">${esc(c.a.industry || "")}</div>` : `<span class="t">Unlinked applicant</span><div class="small muted">Not in Client Master</div>`) },
            { h: "Filings", r: (c) => `<div class="cl-bar"><span class="cl-v">${c.n}</span>${stackBar(c.ms, cmax)}</div>` },
            { h: "Billed", num: 1, r: (c) => (c.billed ? inr(c.billed) : '<span class="muted">—</span>') },
            { h: "Outstanding", num: 1, r: (c) => (c.due ? `<b class="red">${inr(c.due)}</b>` : '<span class="muted">—</span>') },
            { h: "Next renewal", r: (c) => (c.nextRen ? `<span class="${daysFrom(c.nextRen.due) < 0 ? "red" : ""}">${fmtDate(c.nextRen.due)}</span>` : '<span class="muted">—</span>') },
          ], clientRows))
        + `<div class="grid-2">
            ${panel("Team load", agents.length, table([
              { h: "Agent", r: (u) => person(u.id) },
              { h: "Open filings", num: 1, r: (u) => filings.filter((m) => m.owner === u.id && m.status !== "closed").length },
              { h: "Objection / hearing", num: 1, r: (u) => { const n = filings.filter((m) => m.owner === u.id && bucketOf(m).key === "contested").length; return n ? `<b class="red">${n}</b>` : '<span class="muted">0</span>'; } },
              { h: "Overdue tasks", num: 1, r: (u) => { const n = TASKS.filter((t) => t.assignee === u.id && t.due && t.status !== "completed" && daysFrom(t.due) < 0).length; return n ? `<b class="red">${n}</b>` : '<span class="muted">0</span>'; } },
            ], agents, { empty: "No filings have an assigned agent recorded." }))}
            ${panel("Filings opened per year", sum(years, (y) => withOpened.filter((m) => +m.opened.slice(0, 4) === y).length), `<div class="panel-body tall-cols">${microCols(years.map((y) => ({ label: String(y), v: withOpened.filter((m) => +m.opened.slice(0, 4) === y).length })))}<div class="small muted" style="margin-top:10px">${withOpened.length} of ${filings.length} filings have an opened date recorded; the rest are not counted.</div></div>`)}
          </div>`
        + (st.svc === "all" && services.length ? `<details class="panel fold"><summary>Advisory & compliance matters <span class="muted">(${services.length}, not IP filings)</span></summary>${table([
            { h: "Matter", r: (m) => `<a class="t" href="#/matter/${m.id}">${esc(m.title)}</a><div class="small muted mono">${esc(m.id)}</div>` },
            { h: "Service", r: (m) => `<span class="tag">${esc(m.category)}</span>` },
            { h: "Client", r: (m) => esc(acct(m.account).display) },
            { h: "Recorded stage", r: (m) => esc(m.legacyStage || "—") },
            { h: "Status", r: (m) => matterStatus(m.status) },
          ], services)}</details>` : "")
        + `<details class="panel fold"><summary>How these numbers are calculated</summary><div class="panel-body small sub" style="line-height:1.7">
            <b style="color:var(--ink)">Source.</b> The client's legacy workbook (via the import mapping), plus any changes made in this app. Nothing is estimated.<br>
            <b style="color:var(--ink)">IP filings.</b> Matters whose service is marked "Office filing" in Matter Services (${esc(IP_TYPES.join(", "))}). Other services are listed separately as advisory work.<br>
            <b style="color:var(--ink)">Registered / Pending / Objection / Not filed / Refused.</b> Grouped from the office step of each matter's stage (draft, filed, examination, objection, hearing, registered, rejected, abandoned).<br>
            <b style="color:var(--ink)">Renewals.</b> Only dates recorded in the workbook ("Renewal Due", "Next Renewal Due", "Expiry/Surveillance Due"). A renewal on a filing that isn't registered yet is flagged, not hidden.<br>
            <b style="color:var(--ink)">Overdue.</b> A recorded deadline whose due date is before today and isn't marked completed.<br>
            <b style="color:var(--ink)">Money.</b> Invoice total (billed) and amount paid (collected) from the Billing sheet.
          </div></details>`,
    };
  };

  PAGES.blog = function () {
    return {
      crumbs: ["Firm Setup", "Blog Posts"],
      html: head("Blog Posts", "Articles published on the Eeva website.", `<button class="btn btn-primary" data-act="soon">${ic("plus", 14)} New Post</button>`)
        + panel("Posts", BLOG_POSTS.length, table([{ h: "Title", r: (b) => `<span class="t">${esc(b.title)}</span>` }, { h: "Author", r: (b) => person(b.author) }, { h: "Status", r: (b) => (b.status === "Published" ? badge("green", "Published") : badge("slate", "Draft")) }, { h: "Date", r: (b) => fmtDate(b.date) }, { h: "Views", num: 1, r: (b) => b.views.toLocaleString("en-IN") }, { h: "Actions", r: () => `<button class="btn btn-sm" data-act="soon">Edit</button>` }], BLOG_POSTS)),
    };
  };

  PAGES.team = function () {
    const st = ui("team"); st.f = st.f || "all";
    const list = st.f === "all" ? USERS : USERS.filter((u) => u.role === st.f);
    return {
      crumbs: ["Access Control", "Team Members"],
      html: head("Team Members", "Everyone who works in the EEVA workspace.", `<button class="btn btn-primary" data-act="new-user">${ic("plus", 14)} Add Team Member</button>`)
        + stats([tile("Total Staff", USERS.length, "", "javascript:void 0", "team"), tile("Agents", USERS.filter((u) => u.role === "agent").length, "", "javascript:void 0", "matters"), tile("Sales", USERS.filter((u) => u.role.startsWith("sales")).length, "", "javascript:void 0", "leads"), tile("Active", USERS.filter((u) => u.active).length, "", "javascript:void 0", "check")])
        + tabs("team.f", st.f, [{ value: "all", label: "All" }, { value: "agent", label: "Agent" }, { value: "sales_executive", label: "Sales Executive" }, { value: "sales_manager", label: "Sales Manager" }, { value: "admin", label: "Admin" }])
        + panel("Members", list.length, table([
          { h: "Name", r: (u) => `<span style="display:inline-flex;gap:10px;align-items:center">${avatar(u.id, true)}<span><span class="t">${esc(u.name)}</span><div class="small muted">${esc(u.email)} · ${esc(u.phone)}</div></span></span>` },
          { h: "Role", r: (u) => badge({ admin: "purple", sales_manager: "teal", sales_executive: "blue", agent: "orange" }[u.role] || "slate", ROLE_LABEL[u.role] || u.role) },
          { h: "Type", r: (u) => esc(u.type) },
          { h: "Skillset", r: (u) => `<span class="small">${esc(u.skillset)}</span>` },
          { h: "Status", r: (u) => (u.active ? badge("green", "Active") : badge("gray", "Inactive")) },
          { h: "Actions", r: (u) => `<span style="display:inline-flex;gap:4px"><button class="btn btn-sm" data-act="soon">Edit</button>${u.id !== state.me.id ? `<button class="btn btn-sm btn-ghost" data-act="toggle-user" data-id="${u.id}">${u.active ? "Deactivate" : "Activate"}</button>` : ""}</span>` },
        ], list)),
    };
  };

  PAGES.roles = function () {
    const roles = ["admin", "sales_manager", "sales_executive", "agent"];
    const cell = (s) => ["V", "C", "E", "D"].map((p) => `<span title="${{ V: "View", C: "Create", E: "Edit", D: "Delete" }[p]}" style="display:inline-grid;place-items:center;width:20px;height:20px;border-radius:4px;font-size:10px;font-weight:700;margin:0 1px;${s.includes(p) ? "background:var(--green-bg);color:var(--green)" : "background:var(--gray-4);color:#C5CED8"}">${p}</span>`).join("");
    return {
      crumbs: ["Access Control", "Roles & Permissions"],
      html: head("Roles & Permissions", "V = View · C = Create · E = Edit · D = Delete. Row-level scope (own / team / all) is applied on top of these.")
        + panel("Permission matrix", null, `<div class="table-wrap"><table class="tbl"><thead><tr><th>Module</th>${roles.map((r) => `<th style="text-align:center">${esc(ROLE_LABEL[r])}</th>`).join("")}</tr></thead><tbody>${Object.entries(ROLE_PERMS).map(([mod, p]) => `<tr><td class="t">${esc(mod)}</td>${roles.map((r) => `<td style="text-align:center">${cell(p[r] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`),
    };
  };

  PAGES.users = function () {
    const st = ui("users");
    let list = CUSTOMERS;
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter((c) => [c.name, c.email].join(" ").toLowerCase().includes(q)); }
    return {
      crumbs: ["Access Control", "Customer Users"],
      html: head("User Management", "Customers registered on the website portal.")
        + `<div class="toolbar">${search("users.q", st.q, "Search by name or email…")}</div>`
        + panel("Customer Users", list.length, table([
          { h: "Name", r: (c) => `<span style="display:inline-flex;gap:10px;align-items:center"><span class="avatar sm light">${esc(initials(c.name))}</span><span class="t">${esc(c.name)}</span></span>` },
          { h: "Email", r: (c) => esc(c.email) },
          { h: "Applications", num: 1, r: (c) => c.apps },
          { h: "Total Spent", num: 1, r: (c) => inr(c.spent) },
          { h: "Registered", r: (c) => fmtDate(c.registered) },
          { h: "Status", r: (c) => (c.active ? badge("green", "Active") : badge("red", "Suspended")) },
          { h: "Actions", r: (c) => `<span style="display:inline-flex;gap:4px"><button class="btn btn-sm" data-act="soon">View Details</button><button class="btn btn-sm btn-ghost" data-act="toggle-customer" data-id="${c.id}">${c.active ? "Suspend" : "Reactivate"}</button></span>` },
        ], list)),
    };
  };

  /* ====================================================== drawer / forms */
  let drawerSubmit = null;
  function drawer(title, body, submitLabel, onSubmit) {
    drawerSubmit = onSubmit;
    $("#layer").innerHTML = `<div class="overlay" data-act="close-layer-bg"><form class="drawer" data-form="drawer" autocomplete="off">
      <div class="drawer-head"><h3>${esc(title)}</h3><button type="button" class="btn btn-ghost btn-sm" data-act="close-layer" aria-label="Close">${ic("close")}</button></div>
      <div class="drawer-body">${body}</div>
      <div class="drawer-foot"><button type="button" class="btn" data-act="close-layer">Cancel</button>${submitLabel ? `<button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>` : ""}</div>
    </form></div>`;
    const first = $("#layer input:not([type=hidden]), #layer select, #layer textarea"); if (first) first.focus();
  }
  function closeLayer() { $("#layer").innerHTML = ""; drawerSubmit = null; }
  const field = (lbl, input, help) => `<div class="field"><label>${esc(lbl)}</label>${input}</div>${help ? `<div class="help">${esc(help)}</div>` : ""}`;
  const formData = (form) => { const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === "string" ? v.trim() : v; }); $$("input[type=checkbox]", form).forEach((c) => { o[c.name] = c.checked; }); return o; };
  const PRIOS = ["low", "normal", "high", "urgent"].map((p) => ({ value: p, label: cap(p) }));

  let toastTimer;
  function toast(msg) {
    let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.style.display = "block"; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.display = "none"; }, 2600);
  }
  function stamp(ref) {
    const el = document.createElement("div"); el.className = "stamp-overlay";
    el.innerHTML = `<div class="stamp"><div>CONVERTED<small>${esc(ref)} · ${fmtDate(TODAY)}</small></div></div>`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2100);
  }

  function newLeadDrawer(prefill = {}) {
    const execs = USERS.filter((u) => u.role === "sales_executive");
    const ownerField = is("sales_executive")
      ? field("Assign To", `<input class="input" value="${esc(state.me.name)} (you)" disabled />`, "Leads you create are assigned to you.")
      : field("Assign To (Sales Executive)", `<select class="select" name="owner" required><option value="">Select…</option>${opts(execs.map((u) => ({ value: u.id, label: u.name })), prefill.owner || "")}</select>`, is("agent") ? "Agents can bring in a lead, but a sales executive must own it." : "");
    drawer(prefill.inquiry ? "Convert to Lead" : "New Lead", `
      <h4 style="margin:0 0 10px">Who is this?</h4>
      ${field("Account", `<select class="select" name="account"><option value="">New client</option>${opts(S.accounts().map((a) => ({ value: a.id, label: `${a.display} (${a.id})` })), prefill.account || "")}</select>`)}
      <div class="form-row">${field("Contact Person *", `<input class="input" name="contactName" required value="${esc(prefill.contactName || "")}" />`)}${field("Company / Entity", `<input class="input" name="company" value="${esc(prefill.company || "")}" />`)}</div>
      <div class="form-row">${field("Primary Phone *", `<input class="input" name="phone" required value="${esc(prefill.phone || "")}" />`)}${field("Email", `<input class="input" name="email" type="email" value="${esc(prefill.email || "")}" />`)}</div>
      <h4 style="margin:6px 0 10px">What do they need?</h4>
      ${field("Lead Title", `<input class="input" name="title" required placeholder="e.g. Brand logo trademark" value="${esc(prefill.title || "")}" />`)}
      <div class="form-row">${field("Service *", `<select class="select" name="service">${opts(SERVICES.map((s) => ({ value: s.name, label: `${s.category}: ${s.name}` })), prefill.service || SERVICES[0].name)}</select>`)}${field("Urgency *", `<select class="select" name="urgency">${opts([{ value: "normal", label: "Normal" }, { value: "time_bound", label: "Time-bound" }, { value: "litigation_urgent", label: "Litigation Urgent" }], "normal")}</select>`)}</div>
      <div class="form-row">${field("Source *", `<select class="select" name="source">${opts(["Website", "Referral", "Google Ads", "Existing Client", "Walk-in", "Incubator"].map((s) => ({ value: s, label: s })), prefill.source || "Referral")}</select>`)}${field("Expected value (₹)", `<input class="input" name="value" type="number" min="0" value="${esc(prefill.value || "")}" />`)}</div>
      ${field("Requirement Brief", `<textarea class="textarea" name="brief">${esc(prefill.brief || "")}</textarea>`)}
      ${ownerField}
      ${field("First follow-up", `<input class="input" name="next" type="date" value="${TODAY}" />`)}
    `, prefill.inquiry ? "Convert to Lead" : "Create Lead", (d) => {
      const svc = SERVICES.find((s) => s.name === d.service) || SERVICES[0];
      const ac = d.account ? acct(d.account) : null;
      const id = "LD-2026-" + String(Math.max(...LEADS.map((l) => +l.id.slice(-3))) + 1).padStart(3, "0");
      LEADS.unshift({ id, title: d.title, account: d.account || null, contactName: d.contactName, company: ac ? ac.display : d.company || d.contactName, phone: d.phone, email: d.email, service: svc.name, category: svc.category, status: "cold", urgency: d.urgency, entityType: ac ? ac.type : "Private Limited", value: +d.value || Math.round(svc.prof + svc.govt + svc.prof * 0.18), owner: is("sales_executive") ? state.me.id : d.owner, createdBy: state.me.id, contributors: is("agent") ? [state.me.id] : [], source: d.source, nextFollowUp: d.next || null, created: TODAY, matterId: null });
      if (d.brief) LEAD_ACTIVITIES.unshift({ id: "LA" + Date.now(), lead: id, type: "note", text: d.brief, by: state.me.id, at: nowStamp() });
      audit("Lead created", id);
      if (prefill.inquiry) { const q = INQUIRIES.find((i) => i.id === prefill.inquiry); if (q) q.status = "converted"; }
      closeLayer(); toast(`${id} created`); go("lead/" + id);
    });
  }

  function newMatterDrawer(leadId) {
    const l = leadId ? lead(leadId) : null;
    const agents = USERS.filter((u) => u.role === "agent");
    const convertedLeads = LEADS.filter((x) => x.status === "converted" && !x.matterId && (is("admin") || x.contributors.includes(state.me.id)));
    drawer("Create Matter", `
      <h4 style="margin:0 0 10px">Client Mapping</h4>
      ${field("Search Lead", `<select class="select" name="lead"><option value="">No lead (legacy / direct)</option>${opts(convertedLeads.map((x) => ({ value: x.id, label: `${x.id} · ${x.title}` })), leadId || "")}</select>`, "Linking a lead lets the sales team trace the matter back to the deal.")}
      ${field("Account", `<select class="select" name="account" required>${opts(ACCOUNTS.map((a) => ({ value: a.id, label: a.display })), l && l.account ? l.account : "")}</select>`)}
      <h4 style="margin:6px 0 10px">Service & Status</h4>
      ${field("Matter Title", `<input class="input" name="title" required value="${esc(l ? l.title : "")}" />`)}
      <div class="form-row">${field("Service Area / IP Type", `<select class="select" name="service">${opts(SERVICES.map((s) => ({ value: s.name, label: `${s.category}: ${s.name}` })), l ? l.service : "")}</select>`)}${field("Priority", `<select class="select" name="priority">${opts(PRIOS, "normal")}</select>`)}</div>
      <div class="form-row">${field("Assign to Agent", `<select class="select" name="owner">${opts(agents.map((u) => ({ value: u.id, label: u.name })), is("agent") ? state.me.id : (l && l.contributors[0]) || "")}</select>`)}${field("First due date", `<input class="input" type="date" name="due" />`)}</div>
      <div class="form-row">${field("Reviewer", `<select class="select" name="reviewer">${userOpts(STAFF(), "", "No reviewer yet")}</select>`)}${field("Sales contact", `<select class="select" name="sales">${userOpts(SALES_STAFF(), l ? l.owner : "", "Account owner")}</select>`)}</div>
      ${l && !l.account ? `<div class="banner">${ic("alert", 16)} This lead has no account yet. A client account will be created for <b>${esc(l.company)}</b>.</div>` : ""}
    `, "Create Matter", (d) => {
      const svc = SERVICES.find((s) => s.name === d.service) || SERVICES[0];
      const prefix = { Trademark: "TM", Patent: "PAT", Design: "DES", Copyright: "CR", ISO: "ISO", "Legal & Compliance": "LEG", Startup: "DPIIT" }[svc.category];
      const id = `${prefix}-2026-${String(MATTERS.filter((m) => m.id.startsWith(prefix + "-2026")).length + 12).padStart(3, "0")}`;
      const ld = d.lead ? lead(d.lead) : null;
      let accountId = d.account;
      if (ld && !ld.account) {
        accountId = nextId("CL-", ACCOUNTS);
        ACCOUNTS.push({ id: accountId, name: ld.company, display: ld.company, group: "", type: ld.entityType || "Company", industry: "—", cin: "", gstin: "", pan: "", dpiit: "", udyam: "", website: "", status: "Active", since: TODAY, owner: ld.owner, source: ld.source, notes: "", portal: "None", lastActivity: TODAY });
        CONTACTS.push({ id: nextId("CON-", CONTACTS), account: accountId, name: ld.contactName, designation: "", email: ld.email, mobile: ld.phone, primary: true, billing: true, technical: true });
        ld.account = accountId;
      }
      MATTERS.unshift({ id, account: accountId, lead: d.lead || null, category: svc.category, service: svc.name, title: d.title, status: "open", stage: (SERVICE_STAGES[svc.category] || [null])[0], appStage: (stageCfg(svc.category, (SERVICE_STAGES[svc.category] || [])[0]) || {}).phase || null, stageChecks: {}, legacyStatus: null, legacyStage: null, src: "app", priority: d.priority, owner: d.owner, sales: d.sales || (ld ? ld.owner : acct(accountId).owner), reviewer: d.reviewer || null, opened: TODAY, due: d.due || null, lastActivity: TODAY, nextAction: null, billing: "Not billed", waitingClient: null, waitingGov: null, contributors: [], risk: "Low", app: {} });
      if (d.due) DEADLINES.push({ id: nextId("DL-", DEADLINES), matter: id, type: "First filing target", due: d.due, reminders: [addDays(d.due, -7), addDays(d.due, -2)], done: false, priority: d.priority, remarks: "" });
      if (ld) ld.matterId = id;
      MATTER_ACTIVITIES.unshift({ id: "ACT-" + Date.now(), matter: id, date: TODAY, type: "Matter opened", text: ld ? `Opened from lead ${ld.id}.` : "Opened directly.", by: state.me.id, clientUpdated: false, external: "Internal" });
      audit("Matter created", id + (ld ? ` from ${ld.id}` : ""));
      closeLayer(); toast(`${id} created`); go("matter/" + id);
    });
  }

  function newEstimateDrawer(leadId) {
    const l = lead(leadId);
    const prev = ESTIMATES.filter((e) => e.lead === leadId).sort((a, b) => b.version - a.version)[0];
    const svc = SERVICES.find((s) => s.name === l.service) || { prof: 0, govt: 0 };
    const base = prev ? prev.items : [{ service: l.service, prof: svc.prof, govt: svc.govt }];
    drawer(prev ? `Revise Estimate (v${prev.version + 1})` : "Create Estimate", `
      <p class="sub" style="margin-top:0">${esc(l.title)} · ${esc(l.company)}</p>
      ${base.map((it, i) => `<div class="panel" style="box-shadow:none"><div class="panel-body">${field(`Line ${i + 1}: service`, `<input class="input" name="svc${i}" value="${esc(it.service)}" />`)}<div class="form-row">${field("Professional fee (₹)", `<input class="input" type="number" name="prof${i}" value="${it.prof}" />`)}${field("Government fee (₹)", `<input class="input" type="number" name="govt${i}" value="${it.govt}" />`)}</div></div></div>`).join("")}
      ${field("Firm", `<select class="select" name="firm"><option>${esc(FIRM)}</option><option>Eeva Legal</option></select>`)}
      ${prev ? `<div class="help">v${prev.version} is kept in history and marked as revised.</div>` : ""}
    `, prev ? "Save New Version" : "Create Estimate", (d) => {
      const items = base.map((_, i) => ({ service: d["svc" + i], prof: +d["prof" + i] || 0, govt: +d["govt" + i] || 0 }));
      if (prev && !["approved", "converted"].includes(prev.status)) prev.status = "revised";
      const id = "EST-2026-" + String(Math.max(...ESTIMATES.map((e) => +e.id.slice(-3))) + 1).padStart(3, "0");
      const e = { id, lead: leadId, version: prev ? prev.version + 1 : 1, status: "draft", preparedBy: state.me.id, date: TODAY, validUntil: addDays(TODAY, 30), firm: d.firm, items };
      ESTIMATES.unshift(e);
      l.value = estTotal(e).total;
      LEAD_ACTIVITIES.unshift({ id: "LA" + Date.now(), lead: leadId, type: "system", text: `Estimate ${id} (v${e.version}) prepared: ${inr(l.value)}.`, by: state.me.id, at: nowStamp() });
      audit("Estimate created", `${id} v${e.version}`);
      closeLayer(); toast(`${id} saved as draft`); go("estimate/" + id);
    });
  }

  function logActivityDrawer(l) {
    drawer("Log Activity", `
      <p class="sub" style="margin-top:0">${esc(l.title)} · ${esc(l.company)}</p>
      ${field("Type", `<select class="select" name="type">${opts(["call", "whatsapp", "email", "meeting", "note"].map((t) => ({ value: t, label: t === "whatsapp" ? "WhatsApp" : cap(t) })), "call")}</select>`)}
      ${field("What happened", '<textarea class="textarea" name="text" required placeholder="e.g. Client asked for a revised fee"></textarea>')}
      <div class="form-row">${field("Next follow-up", `<input class="input" type="date" name="next" value="${esc(l.nextFollowUp || "")}" />`)}${field("Move lead to", `<select class="select" name="move">${opts([{ value: "", label: "No change" }, ...["cold", "warm", "hot", "lost"].map((s) => ({ value: s, label: cap(s) }))], "")}</select>`)}</div>
    `, "Log Activity", (d) => {
      LEAD_ACTIVITIES.unshift({ id: "LA" + Date.now(), lead: l.id, type: d.type, text: d.text, by: state.me.id, at: nowStamp() });
      if (d.next) l.nextFollowUp = d.next;
      audit("Activity logged", `${l.id} · ${d.type}`);
      closeLayer();
      if (d.move && d.move !== l.status && can.moveLead(l)) setLeadStatus(l, d.move); else { toast("Activity logged"); render(); }
    });
  }

  function inquiryDrawer(i) {
    const execs = USERS.filter((u) => u.role === "sales_executive");
    const canWork = i.assignedTo === state.me.id || can.assign();
    const open = ["new", "contacted"].includes(i.status);
    drawer("Inquiry Details", `
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="mono" style="color:var(--primary)">${esc(i.id)}</span>${inqStatus(i)}</div>
      <h4 style="margin:14px 0 6px">Contact Information</h4>${kv([["Name", esc(i.name)], ["Company", esc(i.company)], ["Phone", `<span class="mono">${esc(i.phone)}</span>`], ["Email", esc(i.email)]])}
      <div style="margin:8px 0 0">${contactActions(i.phone, i.email)}</div>
      <h4 style="margin:16px 0 6px">Service Interest</h4>${kv([["Service", esc(i.service)], ["Message", esc(i.message)], ["Source", esc(i.source)], ["Received", `${fmtDate(i.created)} (${-daysFrom(i.created)}d ago)`]])}
      <h4 style="margin:16px 0 6px">Activity</h4>${kv([["Assigned To", esc(uname(i.assignedTo))], ["Status", inqStatus(i)]])}
      ${can.assign() && open ? field("Assign To", `<select class="select" name="assign"><option value="">Unassigned</option>${opts(execs.map((u) => ({ value: u.id, label: u.name })), i.assignedTo || "")}</select>`) : ""}
      ${canWork && open ? field("Call Notes", `<textarea class="textarea" name="notes" placeholder="Add notes from the call...">${esc(i.notes || "")}</textarea>`) : i.notes ? `<h4 style="margin:16px 0 6px">Call Notes</h4><p class="sub">${esc(i.notes)}</p>` : ""}
      ${canWork && open ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${i.status === "new" ? `<button type="button" class="btn btn-sm" data-act="inq-contacted" data-id="${i.id}">Mark Contacted</button>` : ""}<button type="button" class="btn btn-sm" data-act="inq-close" data-id="${i.id}" data-kind="not_interested">Not Interested</button><button type="button" class="btn btn-sm" data-act="inq-close" data-id="${i.id}" data-kind="not_relevant">Not Relevant</button>${i.assignedTo ? `<button type="button" class="btn btn-sm btn-primary" data-act="inq-convert" data-id="${i.id}">Convert to Lead</button>` : ""}</div>` : ""}
    `, canWork && open ? "Save" : null, (d) => {
      if (d.assign !== undefined && d.assign !== (i.assignedTo || "")) { i.assignedTo = d.assign || null; audit("Assigned inquiry", `${i.id} → ${uname(i.assignedTo)}`); }
      if (d.notes !== undefined) i.notes = d.notes;
      closeLayer(); toast("Inquiry saved"); render();
    });
  }

  function taskInspector(t) {
    const m = matter(t.matter);
    const editable = (m && can.workMatter(m)) || t.assignee === state.me.id || !t.assignee;
    drawer("Task Inspector", `
      <div class="small muted mono">${esc(t.id)} · <a href="#/matter/${t.matter}">${esc(t.matter)}</a></div>
      <h2 style="margin:4px 0 12px;font-size:16px">${esc(t.title)}</h2>
      ${kv([["Matter", esc(m ? m.title : t.matter)], ["Priority", priority(t.priority)], ["Due", dueStatus(t.due, t.status === "completed")], ["Created by", esc(uname(t.createdBy))], ["Hours logged", `${t.hours}h`]])}
      <div style="height:12px"></div>
      ${editable ? `<div class="form-row">${field("Status", `<select class="select" name="status">${opts(TASK_STATUSES.concat([{ key: "blocked", label: "Blocked" }]).map((s) => ({ value: s.key, label: s.label })), t.status)}</select>`)}${field("Assignee", `<select class="select" name="assignee"><option value="">Unassigned</option>${opts(USERS.filter((u) => u.role === "agent").map((u) => ({ value: u.id, label: u.name })), t.assignee || "")}</select>`)}</div>${field("Log hours", `<input class="input" type="number" step="0.5" min="0" name="hours" value="0" />`)}` : `<div class="banner">${ic("lock", 14)} Read-only: this task belongs to another agent's matter.</div>`}
    `, editable ? "Save" : null, (d) => {
      t.status = d.status; t.assignee = d.assignee || null; t.hours = +(t.hours + (+d.hours || 0)).toFixed(1);
      audit("Task updated", `${t.id} → ${t.status}`); closeLayer(); render();
    });
  }

  /* ======================================================= event handling */
  const ACT = {
    "demo-login": (el) => login(user(el.dataset.id)),
    logout: () => { state.me = null; saveSession(); go("login"); },
    "reset-data": () => { if (confirm("Reset all demo data to the original sample?")) resetData(); },
    "toggle-menu": () => { const s = $("#sidebar"); if (s) s.classList.toggle("open"); },
    "close-layer": () => closeLayer(),
    "close-layer-bg": (el, e) => { if (e.target === el) closeLayer(); },
    seg: (el) => {
      const i = el.dataset.name.lastIndexOf("."); const page = el.dataset.name.slice(0, i), key = el.dataset.name.slice(i + 1);
      ui(page)[key] = el.dataset.val; render();
    },
    "clear-filters": (el) => { state.ui[el.dataset.page] = {}; render(); },
    "acct-matter-clear": (el) => { const s = ui("account:" + el.dataset.id); s.msvc = "all"; s.mstage = "all"; s.mq = ""; render(); },
    copy: (el) => { try { navigator.clipboard.writeText(el.dataset.val); toast(`Copied ${el.dataset.val}`); } catch (e) { toast(el.dataset.val); } },
    "edit-form": (el) => editFormDrawer(matter(el.dataset.id)),
    "cfg-sel": (el) => { ui("setup").sel = +el.dataset.i; render(); },
    "cfg-add-stage": () => { const svc = cfgDraft().services[ui("setup").sel]; svc.stages.push({ key: "stage_" + Date.now(), name: `Stage ${svc.stages.length + 1}`, phase: svc.isFiling ? "filed" : null, legacyStatuses: [], checks: [], autoDeadline: null }); render(); },
    "cfg-del-stage": (el) => {
      const svc = cfgDraft().services[ui("setup").sel], s = svc.stages[+el.dataset.i];
      const n = MATTERS.filter((m) => m.category === svc.name && m.stage === s.name).length;
      if (n) { toast(`“${s.name}” has ${n} matter(s). Move them to another stage first.`); return; }
      if (!confirm(`Delete the stage “${s.name}”?`)) return;
      svc.stages.splice(+el.dataset.i, 1); closeLayer(); render();
    },
    "cfg-move-stage": (el) => { const [i, d] = el.dataset.i.split(":").map(Number); const list = cfgDraft().services[ui("setup").sel].stages; const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; render(); },
    "cfg-del-service": (el) => {
      const cfg = cfgDraft(), i = +el.dataset.i, svc = cfg.services[i];
      const n = MATTERS.filter((m) => m.category === svc.name).length;
      if (n) { drawer(`Can't delete ${svc.name}`, `<div class="tab-intro" style="margin:0">${ic("alert", 16)}<div><b>${svc.name} has ${n} matter(s)</b><span>A service that has matters can't be deleted, because those matters would lose their stages and form. Close or move the matters first. Their history is kept either way.</span></div></div>`, null); return; }
      if (!confirm(`Delete the service “${svc.name}” with its ${svc.stages.length} stage(s) and ${svc.fields.length} field(s)?\n\nIt is only removed for good when you click Save changes.`)) return;
      cfg.services.splice(i, 1); ui("setup").sel = Math.max(0, Math.min(ui("setup").sel, cfg.services.length - 1)); closeLayer(); render();
    },
    "cfg-preview": () => {
      const svc = cfgDraft().services[ui("setup").sel];
      const input = (f) => (f.type === "date" ? '<input class="input" type="date" disabled />' : f.type === "choice" ? `<select class="select" disabled><option>${esc((f.options || [])[0] || "Choose…")}</option></select>` : f.type === "file" ? `<div class="dropzone">${ic("upload", 15)} Click to upload${(f.accept || []).length ? ` · ${f.accept.map((k) => FILE_KINDS[k].label).join(", ")}` : ""}</div>` : `<input class="input" disabled ${f.type === "number" ? 'type="number"' : ""} />`);
      drawer(`${svc.name}: form preview`, `<div class="help" style="margin:0 0 14px">This is exactly what your team sees under “Edit details” on a ${esc(svc.name)} matter.</div>${svc.fields.map((f) => `<div class="field"><label>${esc(f.label)}${f.required ? " *" : ""}</label>${input(f)}${f.help ? `<div class="help" style="margin:4px 0 0">${esc(f.help)}</div>` : ""}</div>`).join("") || '<div class="muted small">The form is empty.</div>'}`, null);
    },
    "cfg-stage": (el) => stageEditor(+el.dataset.i),
    "cfg-svc-edit": () => serviceEditor(),
    "ck-add": (el) => {
      const svc = cfgDraft().services[ui("setup").sel], list = $(".drawer .ck-list"); if (!list) return;
      const empty = list.querySelector(".ck-empty"); if (empty) empty.remove();
      list.insertAdjacentHTML("beforeend", checkRow(svc, { type: el.dataset.type, label: "" }, "n" + Date.now()));
      const last = list.lastElementChild.querySelector("input.input, select"); if (last) last.focus();
    },
    "ck-del": (el) => { const row = el.closest("[data-ck]"); const list = row.parentElement; row.remove(); if (!list.querySelector("[data-ck]")) list.innerHTML = '<div class="ck-empty small muted">No checks yet. Matters can move here freely.</div>'; },
    "cfg-move": (el) => { const list = cfgDraft().services[ui("setup").sel][el.dataset.list]; const i = +el.dataset.i, j = i + +el.dataset.d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; render(); },
    "cfg-unlink": (el) => { cfgDraft().services[ui("setup").sel].stages[+el.dataset.i].legacyStatuses.splice(+el.dataset.j, 1); render(); },
    "cfg-add-check": (el) => { const svc = cfgDraft().services[ui("setup").sel]; const st = svc.stages[+el.dataset.i]; st.checks = st.checks || []; st.checks.push(el.dataset.type === "field" ? { type: "field", field: svc.fields[0].key, label: `${svc.fields[0].label} ${svc.fields[0].type === "file" ? "is uploaded" : "is filled in"}` } : { type: "confirm", label: "" }); render(); },
    "cfg-del-check": (el) => { cfgDraft().services[ui("setup").sel].stages[+el.dataset.i].checks.splice(+el.dataset.j, 1); render(); },
    "cfg-field": (el) => fieldEditor(+el.dataset.i),
    "cfg-del-field": (el) => {
      const svc = cfgDraft().services[ui("setup").sel], f = svc.fields[+el.dataset.i];
      if (svc.noField === f.key || svc.regField === f.key) { toast(`“${f.label}” is the ${svc.noField === f.key ? "official" : "registration"} number. Pick a different one above first.`); return; }
      const n = MATTERS.filter((m) => m.category === svc.name && m.app[f.key] != null && m.app[f.key] !== "").length;
      const inChecks = svc.stages.filter((x) => (x.checks || []).some((c) => c.type === "field" && c.field === f.key)).map((x) => x.name);
      if (!confirm(`Delete the field “${f.label}”?` + (n ? `\n\n${n} matter(s) have a value in it. Those values stay on the matter records but are no longer shown on the form.` : "") + (inChecks.length ? `\n\nIt is also removed from the checks on: ${inChecks.join(", ")}.` : ""))) return;
      const key = f.key; svc.fields.splice(+el.dataset.i, 1); svc.stages.forEach((x) => { x.checks = (x.checks || []).filter((c) => !(c.type === "field" && c.field === key)); }); closeLayer(); render(); },
    "cfg-new-service": () => drawer("New service", `${field("Service name", '<input class="input" name="name" required placeholder="e.g. Geographical Indication" />')}${field("Matter number prefix", '<input class="input" name="prefix" placeholder="e.g. GI" />')}<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="filing" checked /> Office filing (has an application number and counts in the portfolio)</label>`, "Create service", (d) => {
      const cfg = cfgDraft(); if (cfg.services.some((x) => x.name.toLowerCase() === d.name.toLowerCase())) { toast("A service with that name exists"); return; }
      cfg.services.push({ name: d.name, prefix: d.prefix, isFiling: !!d.filing, sheet: null, statusColumn: null, noField: null, regField: null, stages: [], fields: [] });
      ui("setup").sel = cfg.services.length - 1; closeLayer(); render();
    }),
    "cfg-discard": () => { state.cfgDraft = null; render(); },
    "cfg-reset": () => { if (confirm("Reset all services to the defaults built from the workbook? Your saved setup will be replaced.")) { state.cfgDraft = defaultServiceConfig(); ui("setup").sel = 0; render(); } },
    "cfg-save": () => {
      const cfg = cfgDraft(), errs = [];
      cfg.services.forEach((x) => {
        const names = x.stages.map((st) => st.name.trim().toLowerCase());
        if (names.some((n, i) => !n || names.indexOf(n) !== i)) errs.push(`${x.name}: stage names must be filled and unique`);
        if (x.isFiling && x.stages.some((st) => !st.phase)) errs.push(`${x.name}: every stage needs a filing step`);
        const keys = x.fields.map((f) => f.key); if (keys.some((k, i) => keys.indexOf(k) !== i)) errs.push(`${x.name}: field keys must be unique`);
        const cols = x.fields.map((f) => f.excelColumn).filter(Boolean); if (cols.some((c, i) => cols.indexOf(c) !== i)) errs.push(`${x.name}: an Excel column is mapped to two fields`);
        x.stages.forEach((st) => (st.checks || []).forEach((c) => { if (!c.label) errs.push(`${x.name} / ${st.name}: a check has no description`); }));
      });
      if (errs.length) { drawer("Can't save yet", `<div class="rows">${errs.map((e) => `<div class="row-item">${badge("red", "Fix")}<div class="grow small">${esc(e)}</div></div>`).join("")}</div>`, null); return; }
      if (!confirm("Save these service settings?\n\nPrototype note: saving reloads the demo data, so changes made to matters in this demo are reset.")) return;
      cfg.version = (cfg.version || 1) + 1;
      try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      location.reload();
    },
    soon: () => toast("This action exists in the current application; it's not wired in the prototype."),
    toast: (el) => toast(el.dataset.msg),
    print: () => window.print(),
    notifications: () => {
      const items = [];
      const nInq = navCount("inquiries"); if (nInq && canOpen("inquiries")) items.push(`<a class="row-item" href="#/inquiries">${badge("blue", "Inquiries")}<div class="grow">${nInq} new inquiry lead${nInq > 1 ? "s" : ""}</div></a>`);
      const nIn = navCount("inbox"); if (nIn && canOpen("inbox")) items.push(`<a class="row-item" href="#/inbox">${badge("amber", "Inbox")}<div class="grow">${nIn} reassignment request${nIn > 1 ? "s" : ""} waiting</div></a>`);
      S.deadlines().filter((d) => !d.done && daysFrom(d.due) < 0).forEach((d) => items.push(`<a class="row-item" href="#/matter/${d.matter}">${badge("red", "Overdue")}<div class="grow">${esc(d.type)} · ${esc(d.matter)}</div></a>`));
      drawer("Notifications", items.length ? `<div class="rows" style="margin:-20px">${items.join("")}</div>` : '<div class="empty">You are all caught up.</div>', null);
    },
    "new-lead": (el) => newLeadDrawer({ account: el.dataset.account }),
    "new-matter": (el) => newMatterDrawer(el.dataset.lead),
    "new-estimate": (el) => newEstimateDrawer(el.dataset.lead),
    "pick-lead-estimate": () => {
      const ls = S.leads().filter((l) => OPEN(l) && can.editLead(l));
      drawer("New Estimate", field("Lead", `<select class="select" name="lead">${opts(ls.map((l) => ({ value: l.id, label: `${l.id} · ${l.title} (${l.company})` })), "")}</select>`, "Estimates are always prepared against a lead."), "Continue", (d) => { closeLayer(); newEstimateDrawer(d.lead); });
    },
    "log-activity": (el) => logActivityDrawer(lead(el.dataset.id)),
    "log-account-activity": (el) => {
      const ls = S.leads().filter((l) => l.account === el.dataset.id && OPEN(l));
      if (!ls.length) { toast("No open lead on this account to log against."); return; }
      drawer("Log Activity", field("Lead", `<select class="select" name="lead">${opts(ls.map((l) => ({ value: l.id, label: l.title })), "")}</select>`), "Continue", (d) => { closeLayer(); logActivityDrawer(lead(d.lead)); });
    },
    "mark-lost": (el) => markLostDrawer(lead(el.dataset.id)),
    "lead-step": (el) => {
      const l = lead(el.dataset.id); const to = el.dataset.val.toLowerCase();
      if (l.status === to) return;
      setLeadStatus(l, to);
    },
    "matter-step": (el) => { const m = matter(el.dataset.id); if (m.stage !== el.dataset.val) requestStageMove(m, el.dataset.val); },
    "preview-matter": (el) => previewMatter(el.dataset.id),
    "task-inspector": (el) => taskInspector(TASKS.find((t) => t.id === el.dataset.id)),
    "claim-task": (el) => { const t = TASKS.find((x) => x.id === el.dataset.id); t.assignee = state.me.id; audit("Task claimed", t.id); toast("Task claimed"); render(); },
    "new-account": () => drawer("New Account", `${field("Legal name of the company *", '<input class="input" name="name" required />')}${field("Display name", '<input class="input" name="display" />')}<div class="form-row">${field("Entity Type *", `<select class="select" name="type">${opts(["Individual", "Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "NGO", "Educational", "Government", "Other"].map((x) => ({ value: x, label: x })), "Private Limited")}</select>`)}${field("Industry", '<input class="input" name="industry" />')}</div><div class="form-row">${field("Who should we contact? *", '<input class="input" name="contact" required />')}${field("Primary Phone *", '<input class="input" name="phone" required />')}</div><div class="form-row">${field("PAN Number", '<input class="input" name="pan" placeholder="AAAAA9999A" />')}${field("GSTIN", '<input class="input" name="gstin" />')}</div>`, "Create Account", (d) => {
      const id = nextId("CL-", ACCOUNTS);
      ACCOUNTS.push({ id, name: d.name, display: d.display || d.name, group: "", type: d.type, industry: d.industry || "—", cin: "", gstin: d.gstin, pan: d.pan, dpiit: "", udyam: "", website: "", status: "Active", since: TODAY, owner: is("sales_executive") ? state.me.id : "u3", source: "Manual", notes: "", portal: "None", lastActivity: TODAY });
      CONTACTS.push({ id: nextId("CON-", CONTACTS), account: id, name: d.contact, designation: "", email: "", mobile: d.phone, primary: true, billing: true, technical: true });
      audit("Account created", id); closeLayer(); go("account/" + id);
    }),
    "new-user": () => drawer("Add Team Member", `${field("Full Name", '<input class="input" name="name" required placeholder="Full Name" />')}${field("Work email", '<input class="input" name="email" type="email" required />')}<div class="form-row">${field("Role", `<select class="select" name="role">${opts(Object.keys(ROLE_LABEL).map((r) => ({ value: r, label: ROLE_LABEL[r] })), "sales_executive")}</select>`)}${field("Phone", '<input class="input" name="phone" />')}</div><div class="form-row">${field("Type", '<input class="input" name="type" placeholder="Attorney, Associate, Sales…" />')}${field("Skillset", '<input class="input" name="skillset" />')}</div>`, "Add Member", (d) => {
      const id = "u" + (USERS.length + 1); USERS.push({ id, name: d.name, email: d.email, role: d.role, title: d.type || ROLE_LABEL[d.role], type: d.type || "Staff", skillset: d.skillset, phone: d.phone, active: true });
      audit("User created", `${d.name} (${ROLE_LABEL[d.role]})`); closeLayer(); toast("Member added"); render();
    }),
    "toggle-user": (el) => { const u = user(el.dataset.id); u.active = !u.active; audit(u.active ? "User activated" : "User deactivated", u.name); render(); },
    "toggle-customer": (el) => { const c = CUSTOMERS.find((x) => x.id === el.dataset.id); c.active = !c.active; audit(c.active ? "Customer reactivated" : "Customer suspended", c.name); render(); },
    "new-discount": () => drawer("New Discount", `${field("Code", '<input class="input" name="code" required style="text-transform:uppercase" />')}${field("Description", '<input class="input" name="desc" required />')}<div class="form-row">${field("Type", `<select class="select" name="type">${opts([{ value: "Percent", label: "Percent" }, { value: "Flat", label: "Flat amount" }], "Percent")}</select>`)}${field("Value", '<input class="input" type="number" name="value" required />')}</div><div class="form-row">${field("Valid From", `<input class="input" type="date" name="from" value="${TODAY}" />`)}${field("Valid Until", '<input class="input" type="date" name="till" required />')}</div>`, "Create Discount", (d) => {
      DISCOUNTS.unshift({ id: "D" + Date.now(), code: d.code.toUpperCase(), type: d.type, value: +d.value, appliesTo: d.desc, active: true, validFrom: d.from, validTill: d.till });
      audit("Discount created", d.code.toUpperCase()); closeLayer(); render();
    }),
    "toggle-discount": (el) => { const d = DISCOUNTS.find((x) => x.id === el.dataset.id); d.active = !d.active; audit("Discount updated", d.code); render(); },
    "delete-discount": (el) => { if (!confirm("Delete this discount?")) return; const i = DISCOUNTS.findIndex((x) => x.id === el.dataset.id); audit("Discount deleted", DISCOUNTS[i].code); DISCOUNTS.splice(i, 1); render(); },
    "upload-qr": () => drawer("Upload Payment QR Code", `<div class="form-row">${field("Select Service *", `<select class="select" name="service">${opts(SERVICES.map((s) => ({ value: s.name, label: s.name })), "")}</select>`)}${field("Select Variant *", '<input class="input" name="variant" value="All variants" />')}</div>${field("QR Code Image *", '<input class="input" type="file" name="file" style="padding-top:6px" />')}<div class="form-row">${field("Bank Name *", '<input class="input" name="bank" required />')}${field("UPI ID", '<input class="input" name="upi" />')}</div>${field("Additional Info", '<textarea class="textarea" name="info" placeholder="Any additional payment instructions..."></textarea>')}`, "Upload QR Code", (d) => {
      QR_CODES.push({ id: "QR" + Date.now(), service: d.service, variant: d.variant, bank: d.bank, upi: d.upi, active: true }); audit("QR code uploaded", d.service); closeLayer(); render();
    }),
    "toggle-qr": (el) => { const q = QR_CODES.find((x) => x.id === el.dataset.id); q.active = !q.active; render(); },
    "verify-portal-pay": (el) => { const p = PORTAL_PAYMENTS.find((x) => x.id === el.dataset.id); p.status = "verified"; const a = APPLICATIONS.find((x) => x.id === p.app); if (a) a.status = "submitted"; audit("Portal payment verified", `${p.id} · ${inr(p.amount)}`); toast("Payment verified"); render(); },
    "reject-portal-pay": (el) => { const p = PORTAL_PAYMENTS.find((x) => x.id === el.dataset.id); p.status = "rejected"; const a = APPLICATIONS.find((x) => x.id === p.app); if (a) a.status = "payment_rejected"; audit("Portal payment rejected", p.id); render(); },
    "open-inquiry": (el) => inquiryDrawer(INQUIRIES.find((i) => i.id === el.dataset.id)),
    "assign-inquiry": (el) => {
      const q = INQUIRIES.find((i) => i.id === el.dataset.id);
      drawer("Assign Inquiry", `<p class="sub" style="margin-top:0">${esc(q.name)} · ${esc(q.service)}</p>${field("Sales Executive", `<select class="select" name="to" required>${opts(USERS.filter((u) => u.role === "sales_executive").map((u) => ({ value: u.id, label: `${u.name} (${S.inquiries().filter((i) => i.assignedTo === u.id && ["new", "contacted"].includes(i.status)).length} open)` })), q.assignedTo || "")}</select>`)}`, "Assign", (d) => {
        q.assignedTo = d.to; audit("Assigned inquiry", `${q.id} → ${uname(d.to)}`); closeLayer(); toast(`Assigned to ${uname(d.to)}`); render();
      });
    },
    "inq-contacted": (el) => { const q = INQUIRIES.find((i) => i.id === el.dataset.id); q.status = "contacted"; audit("Inquiry contacted", q.id); toast("Marked as contacted"); render(); },
    "inq-close": (el) => {
      const q = INQUIRIES.find((i) => i.id === el.dataset.id); const kind = el.dataset.kind;
      drawer(kind === "not_relevant" ? "Mark Not Relevant" : "Mark Not Interested", field("Note", '<textarea class="textarea" name="note" placeholder="Anything worth remembering about this inquiry…"></textarea>'), "Close Inquiry", (d) => {
        q.status = "not_interested"; q.notRelevant = kind === "not_relevant"; if (d.note) q.notes = d.note;
        audit("Inquiry closed", `${q.id} · ${kind}`); closeLayer(); render();
      });
    },
    "inq-convert": (el) => {
      const q = INQUIRIES.find((i) => i.id === el.dataset.id);
      newLeadDrawer({ title: `${q.service}${q.company ? ": " + q.company : ""}`, contactName: q.name, company: q.company, phone: q.phone, email: q.email, service: q.service, owner: q.assignedTo, source: q.source, inquiry: q.id, brief: q.message });
    },
    "add-agent": (el) => {
      const l = lead(el.dataset.id);
      const agents = USERS.filter((u) => u.role === "agent" && !l.contributors.includes(u.id));
      drawer("Assign Agent", `<p class="sub" style="margin-top:0">The agent can see this lead, log activity and prepare estimates. Ownership stays with ${esc(uname(l.owner))}.</p>${field("Select Attorney or Associate", `<select class="select" name="agent">${opts(agents.map((u) => ({ value: u.id, label: `${u.name} · ${u.title}` })), "")}</select>`)}${field("Notes (optional)", '<textarea class="textarea" name="note" placeholder="Any specific instructions for the agent?"></textarea>')}`, "Assign Agent", (d) => {
        l.contributors.push(d.agent);
        LEAD_ACTIVITIES.unshift({ id: "LA" + Date.now(), lead: l.id, type: "system", text: `${uname(d.agent)} assigned as agent.${d.note ? " " + d.note : ""}`, by: state.me.id, at: nowStamp() });
        audit("Agent assigned", `${l.id} + ${uname(d.agent)}`); closeLayer(); render();
      });
    },
    "request-reassign": (el) => {
      const l = lead(el.dataset.id);
      drawer("Request Reassignment", `<p class="sub" style="margin-top:0">Your manager approves this in the Inbox. The lead stays with you until then.</p>${field("Transfer To", `<select class="select" name="to">${opts(USERS.filter((u) => u.role === "sales_executive" && u.id !== state.me.id).map((u) => ({ value: u.id, label: u.name })), "")}</select>`)}${field("Reason", '<textarea class="textarea" name="reason" required placeholder="Explain why you are requesting reassignment…"></textarea>')}`, "Send Request", (d) => {
        REASSIGN_REQUESTS.unshift({ id: "RR-" + Date.now(), lead: l.id, from: l.owner, to: d.to, reason: d.reason, requestedBy: state.me.id, at: TODAY, status: "pending" });
        audit("Reassignment requested", `${l.id} → ${uname(d.to)}`); closeLayer(); toast("Request sent to your manager"); render();
      });
    },
    reassign: (el) => {
      const l = lead(el.dataset.id);
      drawer("Reassign Lead", field("Sales Executive", `<select class="select" name="to">${opts(USERS.filter((u) => u.role === "sales_executive").map((u) => ({ value: u.id, label: u.name })), l.owner)}</select>`, "The account owner is updated too, so the two stay in sync."), "Reassign", (d) => {
        const prev = l.owner; l.owner = d.to; if (l.account) acct(l.account).owner = d.to;
        audit("Lead reassigned", `${l.id}: ${uname(prev)} → ${uname(d.to)}`); closeLayer(); render();
      });
    },
    "delete-lead": (el) => {
      if (!confirm(`Delete ${el.dataset.id}? This is a soft delete.`)) return;
      LEADS.splice(LEADS.findIndex((l) => l.id === el.dataset.id), 1); audit("Lead deleted", el.dataset.id); go("leads");
    },
    "approve-req": (el) => {
      const r = REASSIGN_REQUESTS.find((x) => x.id === el.dataset.id); const l = lead(r.lead);
      r.status = "approved"; l.owner = r.to; if (l.account) acct(l.account).owner = r.to;
      audit("Reassignment approved", `${l.id} → ${uname(r.to)}`); toast("Approved: lead moved"); render();
    },
    "reject-req": (el) => { const r = REASSIGN_REQUESTS.find((x) => x.id === el.dataset.id); r.status = "rejected"; audit("Reassignment rejected", r.lead); render(); },
    "est-status": (el) => { const e = ESTIMATES.find((x) => x.id === el.dataset.id); e.status = el.dataset.to; audit("Estimate " + el.dataset.to, e.id); toast(`Estimate ${el.dataset.to}`); render(); },
    "verify-pay": (el) => {
      const p = PAYMENTS.find((x) => x.id === el.dataset.id); const inv = INVOICES.find((i) => i.id === p.invoice);
      p.verified = true; p.by = state.me.id; inv.paid += p.amount; inv.status = inv.paid >= inv.total ? "PAID" : "PARTIALLY_PAID";
      audit("Payment verified", `${p.id} · ${inr(p.amount)}`); toast("Payment verified"); render();
    },
    "dl-done": (el) => { const d = DEADLINES.find((x) => x.id === el.dataset.id); d.done = true; d.completedDate = TODAY; const m = matter(d.matter); if (m) logM(m, "Official date done", d.type); else audit("Deadline completed", d.id); render(); },
    "new-task": (el) => taskDrawer(matter(el.dataset.id)),
    "new-deadline": (el) => deadlineDrawer(matter(el.dataset.id)),
    "upload-doc": (el) => docDrawer(matter(el.dataset.id)),
    // One entry point for every add/edit on a matter page.
    "m-edit": (el) => {
      const m = matter(el.dataset.m), id = el.dataset.id || null;
      if (!m || !can.workMatter(m)) { toast("You can view this matter but not change it"); return; }
      ({ matter: () => editMatterDrawer(m), people: () => peopleDrawer(m), deadline: () => deadlineDrawer(m, id), task: () => taskDrawer(m, id), oa: () => oaDrawer(m, id), doc: () => docDrawer(m, id), invoice: () => invoiceDrawer(m, id), note: () => noteDrawer(m, id) }[el.dataset.what] || (() => {}))();
    },
    "m-pay": (el) => paymentDrawer(matter(el.dataset.m), el.dataset.id),
    "m-del-deadline": (el) => { const i = DEADLINES.findIndex((x) => x.id === el.dataset.id), x = DEADLINES[i]; if (!confirm(`Delete the date “${x.type}”?`)) return; DEADLINES.splice(i, 1); logM(matter(x.matter), "Official date deleted", `${x.type} (was due ${fmtDate(x.due)})`); closeLayer(); render(); },
    "m-del-task": (el) => { const i = TASKS.findIndex((x) => x.id === el.dataset.id), x = TASKS[i]; if (!confirm(`Delete the task “${x.title}”?`)) return; TASKS.splice(i, 1); logM(matter(x.matter), "Task deleted", x.title); closeLayer(); render(); },
    "m-del-oa": (el) => { const i = OFFICIAL_ACTIONS.findIndex((x) => x.id === el.dataset.id), x = OFFICIAL_ACTIONS[i]; if (!confirm("Delete this office action?")) return; OFFICIAL_ACTIONS.splice(i, 1); logM(matter(x.matter), "Office action deleted", `${x.type} received ${fmtDate(x.received)}`); closeLayer(); render(); },
    "m-del-doc": (el) => { const i = DOCUMENTS.findIndex((x) => x.id === el.dataset.id), x = DOCUMENTS[i]; if (!confirm(`Delete “${x.file}”?`)) return; DOCUMENTS.splice(i, 1); const m = matter(x.matter); Object.keys(m.app).forEach((k) => { if (m.app[k] === x.file) delete m.app[k]; }); logM(m, "Document deleted", `${x.type}: ${x.file}`); closeLayer(); render(); },
    "m-del-note": (el) => { const i = MATTER_ACTIVITIES.findIndex((x) => x.id === el.dataset.id), x = MATTER_ACTIVITIES[i]; if (!noteEditable(x) || !confirm("Delete this note?")) return; MATTER_ACTIVITIES.splice(i, 1); audit("Matter note deleted", x.matter + " · " + x.id); closeLayer(); render(); },
  };

  const CHANGE = {
    "matter-stage": (el) => { closeLayer(); requestStageMove(matter(el.dataset.id), el.value); },
    "task-status": (el) => { const t = TASKS.find((x) => x.id === el.dataset.id); t.status = el.value; audit("Task status", `${t.id} → ${t.status}`); render(); },
    // Service setup inputs write into the draft configuration (path is relative to the selected service).
    cfg: (el) => {
      const svc = cfgDraft().services[ui("setup").sel];
      const path = el.dataset.path.split(".");
      let o = svc; for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
      const k = path[path.length - 1];
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (k === "options") v = String(v).split(",").map((x) => x.trim()).filter(Boolean);
      if ((k === "phase" || k === "noField" || k === "regField" || k === "excelColumn") && v === "") v = null;
      o[k] = v;
      if (k === "field" && path[0] === "stages") { const f = svc.fields.find((x) => x.key === v); if (f) o.label = `${f.label} ${f.type === "file" ? "is uploaded" : "is filled in"}`; }
      render();
    },
    // Show only the settings that apply to the chosen field type.
    ftype: (el) => { const box = el.closest(".drawer"); if (!box) return; box.querySelectorAll(".only-choice").forEach((x) => x.classList.toggle("hidden", el.value !== "choice")); box.querySelectorAll(".only-file").forEach((x) => x.classList.toggle("hidden", el.value !== "file")); },
    "cfg-link": (el) => { if (!el.value) return; const st = cfgDraft().services[ui("setup").sel].stages[+el.dataset.i]; st.legacyStatuses = st.legacyStatuses || []; st.legacyStatuses.push(el.value); render(); },
    "pipe-nav": (el) => go(el.value ? "matters/" + encodeURIComponent(el.value) : "matters"),
    "account-note": (el) => { acct(el.dataset.id).notes = el.value; saveData(); toast("Note saved"); },
    ui: (el) => { const i = el.dataset.key.lastIndexOf("."); ui(el.dataset.key.slice(0, i))[el.dataset.key.slice(i + 1)] = el.value; render(); },
  };

  document.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]");
    if (act && ACT[act.dataset.act] && !(act.tagName === "TR" && e.target.closest("a, button, select, input"))) {
      if (act.tagName === "A" || act.tagName === "BUTTON") e.preventDefault();
      ACT[act.dataset.act](act, e); return;
    }
    const row = e.target.closest("[data-href]");
    if (row && !e.target.closest("a, button, select, input, textarea")) { location.hash = row.dataset.href; return; }
    if (!e.target.closest(".top-search")) { const r = $("#search-results"); if (r) r.classList.add("hidden"); }
    if (window.innerWidth <= 860 && !e.target.closest("#sidebar")) { const sb = $("#sidebar"); if (sb) sb.classList.remove("open"); }
  });
  document.addEventListener("change", (e) => { const el = e.target.closest("[data-change]"); if (el && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el); });

  let inputTimer;
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.input) {
      const k = el.dataset.input, i = k.lastIndexOf(".");
      ui(k.slice(0, i))[k.slice(i + 1)] = el.value;
      clearTimeout(inputTimer);
      inputTimer = setTimeout(() => { render(); const again = $(`[data-input="${k}"]`); if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); } }, 200);
    }
    if (el.id === "global-search") {
      const q = el.value.trim().toLowerCase(); const box = $("#search-results");
      if (!q) { box.classList.add("hidden"); return; }
      const hits = [
        ...S.leads().filter((l) => [l.id, l.title, l.company, l.contactName].join(" ").toLowerCase().includes(q)).map((l) => ({ href: "#/lead/" + l.id, t: l.title, s: `Lead · ${l.id} · ${l.company}` })),
        ...S.accounts().filter((a) => [a.id, a.name, a.display].join(" ").toLowerCase().includes(q)).map((a) => ({ href: "#/account/" + a.id, t: a.display, s: `Account · ${a.id}` })),
        ...S.matters().filter((m) => [m.id, m.title, appNoOf(m) || ""].join(" ").toLowerCase().includes(q)).map((m) => ({ href: "#/matter/" + m.id, t: m.title, s: `Matter · ${m.id}` })),
      ].slice(0, 10);
      box.innerHTML = hits.length ? hits.map((h) => `<a href="${h.href}"><div class="t">${esc(h.t)}</div><div class="small muted">${esc(h.s)}</div></a>`).join("") : '<div class="empty">No results</div>';
      box.classList.remove("hidden");
    }
  });

  document.addEventListener("submit", (e) => {
    const f = e.target; e.preventDefault();
    const kind = f.dataset.form;
    if (kind === "login") {
      const d = formData(f); const u = USERS.find((x) => x.email.toLowerCase() === (d.email || "").toLowerCase());
      ui("login").email = d.email;
      if (!u || !ROLE_LABEL[u.role]) { ui("login").err = "No account with that email. Use one of the demo accounts below."; renderLogin(); return; }
      ui("login").err = null; login(u); return;
    }
    if (kind === "drawer" && drawerSubmit) { drawerSubmit(formData(f)); return; }
    if (kind === "matter-activity") {
      const d = formData(f); const m = matter(f.dataset.id);
      MATTER_ACTIVITIES.unshift({ id: "ACT-" + Date.now(), matter: m.id, date: TODAY, type: d.type, text: d.text, by: state.me.id, clientUpdated: !!d.client, external: "Internal", src: "app" });
      m.lastActivity = TODAY; audit("Matter note", `${m.id} · ${d.type}`); render();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLayer();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { const s = $("#global-search"); if (s) { e.preventDefault(); s.focus(); } }
  });
  window.addEventListener("hashchange", render);
  render();
})();
