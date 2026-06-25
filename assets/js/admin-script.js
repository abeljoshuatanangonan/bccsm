document.addEventListener("DOMContentLoaded", () => {
  // ---------- Utils ----------
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);
  const delegate = (root, evt, sel, handler) => on(root, evt, e => {
    const target = e.target.closest(sel);
    if (root.contains(target)) handler(e, target);
  });
  function toISODateLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function toISODate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function iso(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
  function toISO(d) { return iso(d); }
  function parseMoney(s) { const n = parseFloat(String(s || "").replace(/[^\d.\-]/g, "")); return Number.isFinite(n) ? n : 0; }
  function toDateOnly(isoStr) { return new Date(`${isoStr}T00:00:00`); }

  /* Given a Sunday ISO, return [mondayISO, sundayISO] in local time */
  function weekFromSunday(sundayISO) {
    const sun = toDateOnly(sundayISO);
    const mon = new Date(sun); mon.setDate(sun.getDate() - 6);
    return [iso(mon), iso(sun)];
  }

  let _addReceiptsCache = Object.create(null);

  function formatWeekCovered(startDate, endDate) {
    const sameYear = startDate.getFullYear() === endDate.getFullYear();
    const sameMonth = sameYear && (startDate.getMonth() === endDate.getMonth());
    const day = d => d.getDate();
    if (sameMonth) {
      const monthLong = startDate.toLocaleDateString("en-US", { month: "long" });
      return `${monthLong} ${day(startDate)} - ${day(endDate)}, ${endDate.getFullYear()}`;
    }
    const mShort = d => d.toLocaleDateString("en-US", { month: "short" });
    const left = `${mShort(startDate)} ${day(startDate)}${sameYear ? "" : ", " + startDate.getFullYear()}`;
    const right = `${mShort(endDate)} ${day(endDate)}, ${endDate.getFullYear()}`;
    return `${left} - ${right}`;
  }

  function addCSRF(body) {
    const t = window.CSRF_TOKEN || getCSRF();
    if (!t) return body;

    if (body instanceof FormData) {
      if (!body.has('csrf_token')) body.append('csrf_token', t);
      return body;
    }
    if (body instanceof URLSearchParams) {
      if (!body.has('csrf_token')) body.append('csrf_token', t);
      return body;
    }
    const params = new URLSearchParams();
    if (body && typeof body === 'object') {
      for (const [k, v] of Object.entries(body)) params.append(k, v);
    }
    params.append('csrf_token', t);
    return params;
  }

  function getCSRF() {
    if (window.CSRF_TOKEN) return window.CSRF_TOKEN;
    const m = document.querySelector('meta[name="csrf-token"]');
    if (m && m.content) return m.content;
    const h = document.querySelector('input[name="csrf_token"]');
    return h ? h.value : '';
  }

  const safeFetch = async (url, opts = {}) => {
    const o = { ...opts };
    const h = new Headers(o.headers || {});
    const method = (o.method || "GET").toUpperCase();

    const token = window.CSRF_TOKEN || getCSRF();
    if (method !== "GET" && token && !h.has("X-CSRF-Token")) {
      h.set("X-CSRF-Token", token);
    }
    o.headers = h;

    const res = await fetch(url, o);
    if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
    return res;
  };

  async function safeFetchJSON(url, init = {}, timeoutMs = 10000) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('Server returned non-JSON from', url, '\n--- RAW START ---\n', text, '\n--- RAW END ---');
        throw e;
      }
    } finally {
      clearTimeout(id);
    }
  }

  (function () {
    const KEY = 'bcc:ending-balance';

    function readMap() {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    }
    function writeMap(map) {
      try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { }
    }

    window.__bcc_sundayISO = function (d) {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      const daysToNextSunday = (7 - x.getDay()) % 7; // 0 if Sunday
      const sun = new Date(x);
      sun.setDate(x.getDate() + daysToNextSunday);
      const pad = n => String(n).padStart(2, '0');
      return `${sun.getFullYear()}-${pad(sun.getMonth() + 1)}-${pad(sun.getDate())}`;
    };

    window.__bcc_prevSundayISO = function (currISO) {
      const d = new Date(`${currISO}T00:00:00`);
      d.setDate(d.getDate() - 7);
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    window.__bcc_getEndingBalance = function (iso) {
      const map = readMap();
      const v = map[iso];
      return (typeof v === 'number' && isFinite(v)) ? v : 0;
    };

    window.__bcc_setEndingBalance = function (iso, amount) {
      if (!(typeof amount === 'number' && isFinite(amount))) return;
      const map = readMap();
      map[iso] = amount;
      writeMap(map);
    };
  })();

  const safeFetchAdmin = window.safeFetchAdmin || (async (endpoint, opts = {}) => {
    const isString = (v) => typeof v === "string";
    const ep = isString(endpoint) ? endpoint : String(endpoint ?? "");

    const makeCandidates = (s) => {
      const hasAdminFunctions = s.includes("admin-functions/");
      const hasAdminFuncitons = s.includes("admin-funcitons/");
      if (hasAdminFunctions) {
        return [s, s.replace("admin-functions/", "admin-funcitons/")];
      }
      if (hasAdminFuncitons) {
        return [s, s.replace("admin-funcitons/", "admin-functions/")];
      }
      return [`admin-functions/${s}`, `admin-funcitons/${s}`, s];
    };

    const candidates = makeCandidates(ep);

    let lastErr = null;
    for (const url of candidates) {
      try {
        const res = await safeFetch(url, opts);
        return res;
      } catch (err) {
        lastErr = err;
        const msg = String(err && err.message ? err.message : err);
        const is404 = msg.includes("HTTP 404");
        if (!is404) {
          // still allow retrying next candidate
        }
      }
    }
    throw lastErr || new Error("safeFetchAdmin failed");
  });

  window.safeFetchAdmin = safeFetchAdmin;


  const jsonOrThrow = async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON response");
    }
  };

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const fmtNumber = (v) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // ---------- Shared constants (used by Receipts + Summary) ----------
  const ADMIN_DIRECT_SUBCATS = [
    "Food Expenses",
    "Medical Expenses",
    "Philhealth",
    "SSS Contribution",
    "Communications Expense",
    "Love Gift (deducted from MRF)",
    "Other Miscellaneous"
  ];

  const ADMIN_OTHER_SUBCATS = [];

  const MEMBERS_ASSIST_SUBCATS = [
    "Financial Assistance",
    "Funeral Assistance",
    "Educational Assistance"
  ];

  const MINISTRY_HIERARCHY = {
    "Worship Ministry": ["Transportation", "Food"],
    "Sunday School": ["Transportation/others", "Food"],
    "Worker's meeting": ["Transportation", "Materials", "Food"],
    "Buso Buso": ["Transportation"],
    "ALS": ["Transportation", "Food"],
    "Timothites": ["Food Expenses"],
    "VOICE": ["Transportation", "Food", "Misc"]
  };

  const MISSION_SUPPORT_SUBCATS = [
    "Mission Support - Ptr M",
    "Love Gift-Ptr A & Sis Neneng",
    "Love Gift - Sis Criselda"
  ];

  const OUTREACH_HIERARCHY = {
    "Maly Outreach": ["Transportation", "Food", "Rental", "Love Gift"],
    "Burgos Outreach": ["Transportation", "Food", "Rental", "Love Gift"],
    "Guinayang Outreach": ["Transportation", "Food", "Rental", "Love Gift"],
    "Parang. Marikina Outreach": ["Transportation", "Food", "Rental", "Love Gift"],
    "Banaba & Moises Outreach": ["Transportation", "Food", "Rental", "Love Gift"],
    "Samar Leyte Outreach": [
      "Food Expenses & others",
      "Transportation",
      "Samar-Leyte printing",
      "Samar-Leyte Internet",
      "Checked Baggage"
    ],
    "Manggahan Outreach": ["Food Expenses", "Transportation"]
  };

  const PASTORAL_MINISTRY_SUBCATS = [
    "Transportation",
    "Food"
  ];

  const SUPPLIES_STANDALONE_CATS = [
    "Taxes & Licenses",
    "Training, Convention, and Seminar Expenses",
    "Transportation Expense",
    "Utilities Expense",
    "Land and Buildings & Bldq. Equipment",
    "Furniture & Fixtures",
    "Music Instruments and Sound Equipment",
    "Computer Equipment",
    "Meralco Upgrade",
    "Other Assets",
    "Advances (Bro Onad)",
    "Over/Short",
    "Advances from Samar Leyte",
    "Advances from Gemma (Utilities)"
  ];

  const SUPPLIES_EXPENSES_SUBCATS = [
    "Office Supplies Expense",
    "Cleaning Materials"
  ];

  const SUPPLIES_DIRECT_SUBCATS = [
    "Office Supplies Expense",
    "Cleaning Materials",
  ];

  const SUPPLIES_OTHER_SUBCATS = SUPPLIES_EXPENSES_SUBCATS.filter(
    n => !SUPPLIES_DIRECT_SUBCATS.includes(n)
  );

  window.BCCSM_OFFERTORY_SHARED = window.BCCSM_OFFERTORY_SHARED || {};

  Object.assign(window.BCCSM_OFFERTORY_SHARED, {
    ADMIN_DIRECT_SUBCATS,
    ADMIN_OTHER_SUBCATS,
    MEMBERS_ASSIST_SUBCATS,
    MINISTRY_HIERARCHY,
    MISSION_SUPPORT_SUBCATS,
    OUTREACH_HIERARCHY,
    PASTORAL_MINISTRY_SUBCATS,
    SUPPLIES_STANDALONE_CATS,
    SUPPLIES_EXPENSES_SUBCATS,
    SUPPLIES_DIRECT_SUBCATS,
    SUPPLIES_OTHER_SUBCATS,
  });

  // Backward-compat: keep old global names working (Summary uses these)
  for (const [k, v] of Object.entries(window.BCCSM_OFFERTORY_SHARED)) {
    if (typeof window[k] === "undefined") window[k] = v;
  }


  function weekRangeForTodayMonSun() {
    const today = new Date();
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dow = base.getDay(); // 0=Sun..6=Sat

    const monday = new Date(base);
    monday.setDate(base.getDate() - ((dow + 6) % 7));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mMon = monday.toLocaleString("en-US", { month: "long" });
    const mSun = sunday.toLocaleString("en-US", { month: "long" });
    const dMon = monday.getDate();
    const dSun = sunday.getDate();

    if (monday.getMonth() === sunday.getMonth() && monday.getFullYear() === sunday.getFullYear()) {
      return {
        monday,
        sunday,
        human: `${mMon} ${dMon} - ${dSun}, ${sunday.getFullYear()}`
      };
    }

    return {
      monday,
      sunday,
      human: `${mMon} ${dMon} - ${mSun} ${dSun}, ${sunday.getFullYear()}`
    };
  }

  const txt = (node) => (node?.textContent || "").trim();
  const removePeso = (s) => (s || "").replace(/₱/g, "");

  const preferDate = (s) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  // ---------- Offertory ----------
  (() => {
    let selectedOffertoryDate = (() => {
      const d = new Date();
      const pad = n => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    })();

    const CB_GET_URL = "admin-functions/get-offertory-cash-balances.php";
    const CB_SAVE_URL = "admin-functions/save-offertory-cash-balances.php";
    const CB_CARRY_URL = "admin-functions/get-offertory-sunday-carry.php";
    const _cbCache = new Map();
    const _cbLoading = new Set();

    function _cbIndentPx(item) {
      return item.parent_id ? 48 : 24;
    }

    function _cbFmtNum(n) {
      const x = Number(n);
      if (!Number.isFinite(x) || x === 0) return "";
      return fmtNumber(x);
    }

    async function ensureCashBalancesLoaded(sundayISO) {
      if (!sundayISO) return [];
      if (_cbCache.has(sundayISO)) return _cbCache.get(sundayISO);
      if (_cbLoading.has(sundayISO)) return [];

      _cbLoading.add(sundayISO);
      try {
        const url = `${CB_GET_URL}?date=${encodeURIComponent(sundayISO)}`;
        const j = await safeFetchJSON(url, {}, 10000);
        const items = (j && j.success && Array.isArray(j.items)) ? j.items : [];
        _cbCache.set(sundayISO, items);
        return items;
      } catch (e) {
        console.error("ensureCashBalancesLoaded():", e);
        _cbCache.set(sundayISO, []);
        return [];
      } finally {
        _cbLoading.delete(sundayISO);
      }
    }

    async function resolvePreviousSundayEnding(currSundayISO) {
      const prevISO = window.__bcc_prevSundayISO(currSundayISO);
      if (!prevISO) {
        return { prevISO: "", amount: 0, source: "none" };
      }

      const cacheAmount =
        typeof window.__bcc_getEndingBalance === "function"
          ? Number(window.__bcc_getEndingBalance(prevISO) || 0)
          : 0;

      if (cacheAmount !== 0) {
        return { prevISO, amount: cacheAmount, source: "localStorage" };
      }

      const items = await ensureCashBalancesLoaded(prevISO);
      if (Array.isArray(items) && items.length) {
        const pickAmount = (it) =>
          Number(it?.amount ?? it?.amt ?? it?.value ?? it?.balance ?? 0) || 0;

        const endingItem =
          items.find(it => String(it?.code || "").toUpperCase() === "CB_ENDING") ||
          items.find(it =>
            /cash\s*balance/i.test(String(it?.name || "")) &&
            /ending/i.test(String(it?.name || ""))
          ) ||
          items.find(it => /total\s*ending\s*balance/i.test(String(it?.name || ""))) ||
          items.find(it => /^ending$/i.test(String(it?.name || "")));

        const endpointAmount = pickAmount(endingItem);

        if (endpointAmount !== 0 && typeof window.__bcc_setEndingBalance === "function") {
          window.__bcc_setEndingBalance(prevISO, endpointAmount);
        }

        if (endpointAmount !== 0) {
          return { prevISO, amount: endpointAmount, source: "endpoint" };
        }
      }

      return { prevISO, amount: 0, source: "fallback-zero" };
    }

    async function fetchSundayCarryComputation(currSundayISO) {
      const sundayISO = String(currSundayISO || "").trim();
      if (!sundayISO) {
        return {
          sunday: "",
          beginning: 0,
          receipts: 0,
          disbursements: 0,
          ending: 0
        };
      }

      const url = `${CB_CARRY_URL}?sunday=${encodeURIComponent(sundayISO)}`;
      const data = await safeFetchJSON(url, {}, 15000);

      if (!data || data.success !== true || !data.target) {
        throw new Error(data?.message || "Failed to compute Sunday carry chain.");
      }

      return {
        sunday: String(data.target.sunday || sundayISO),
        beginning: Number(data.target.beginning || 0),
        receipts: Number(data.target.receipts || 0),
        disbursements: Number(data.target.disbursements || 0),
        ending: Number(data.target.ending || 0),
        seedSunday: String(data.seed_sunday || ""),
        chain: Array.isArray(data.chain) ? data.chain : []
      };
    }

    function renderCashBalanceRowsHtml(items, endingNumber, prevItems) {
      if (!Array.isArray(items) || items.length === 0) return "";

      const prevMap = new Map();
      if (Array.isArray(prevItems)) {
        for (const it of prevItems) {
          const k = normKey(String(it?.name || ""));
          if (!k) continue;
          prevMap.set(k, Number(it?.amount) || 0);
        }
      }

      const cashInBank = items.find(it => it.code === "CASH_IN_BANK");
      const cashInBankId = cashInBank ? Number(cashInBank.id) : null;

      const effAmount = (it) => {
        const name = String(it?.name || "");
        const key = normKey(name);

        const hasExplicitCurrent =
          it?.amount !== null &&
          it?.amount !== undefined &&
          String(it?.amount) !== "";

        const curr = hasExplicitCurrent ? (Number(it.amount) || 0) : null;

        if (RCC_CB_SPLIT_ROWS.has(key)) {
          const prev = Number(prevMap.get(key)) || 0;
          if (curr === null && Math.round(prev * 100) !== 0) return prev;
        }

        return curr === null ? 0 : curr;
      };

      const leafInputs = items.filter(it => Number(it.is_input) === 1);
      const bankLeafInputs = leafInputs.filter(it => cashInBankId && Number(it.parent_id) === cashInBankId);

      const sum = (arr) => arr.reduce((s, it) => s + effAmount(it), 0);
      const bankTotal = sum(bankLeafInputs);
      const totalCash = sum(leafInputs);

      const rowHTMLCb = (label, val, padPx, strong, extraClass, attrs = "", opts = {}) => {
        const padVisual = Math.max(0, (padPx | 0));
        const yPadPx = 2;
        const n = Number(val);
        const hasValue = Number.isFinite(n) && Math.round(n * 100) !== 0;
        const shouldRenderInput = !!window._editRCC && !!attrs && attrs.includes('data-cb-input="1"');

        const isSplit = !!opts.split;
        const baseVal = Number(opts.base) || 0;
        const addVal = Number(opts.add) || 0;
        const baseHas = Math.round(baseVal * 100) !== 0;
        const addHas = Math.round(addVal * 100) !== 0;

        const amountCellHTML = shouldRenderInput
          ? (isSplit
            ? `
          <div class="cb-split" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <input type="number" inputmode="decimal" min="0" step="0.01"
              ${baseHas ? `value="${round2(baseVal)}"` : ""}
              data-prev="${round2(baseVal)}"
              data-cb-part="base"
              style="width:120px;height:26px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;text-align:right;box-sizing:border-box;">
            <span style="font-weight:600;">+</span>
            <input type="number" inputmode="decimal" step="0.01"
              value=""
              data-prev="0"
              data-cb-part="add"
              style="width:120px;height:26px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;text-align:right;box-sizing:border-box;">
          </div>
            `
            : `<input type="number" inputmode="decimal" min="0" step="0.01"
            ${hasValue ? `value="${n}"` : ""}
            data-prev="${Number.isFinite(n) ? n : 0}"
            style="width:120px;height:26px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;text-align:right;box-sizing:border-box;">`
          )
          : (hasValue ? fmtNumber(n) : "");

        return `
      <tr class="${extraClass || ""}" ${attrs}>
        <td style="padding-top:${yPadPx}px;padding-bottom:${yPadPx}px;padding-left:${padVisual}px;${strong ? "font-weight:600;" : ""}">${label}</td>
        <td class="amount" style="padding-top:${yPadPx}px;padding-bottom:${yPadPx}px;">${amountCellHTML}</td>
      </tr>`;
      };

      const sorted = items.slice().sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
      let html = "";

      for (const it of sorted) {
        const code = String(it.code || "");
        const name = String(it.name || "");
        const id = Number(it.id);
        const isInput = Number(it.is_input) === 1;

        if (code === "CB_ENDING") {
          html += rowHTMLCb(
            name,
            Number(endingNumber) || 0,
            0,
            true,
            "cb-ending-mirror rcc-gap-xl",
            `data-cb="1" data-cb-code="${code}"`
          );
          continue;
        }

        if (code === "CASH_IN_BANK") {
          html += rowHTMLCb(
            name,
            bankTotal,
            24,
            true,
            "cb-bank-total",
            `data-cb="1" data-cb-code="${code}"`
          );
          continue;
        }

        if (code === "TOTAL_CASH") {
          html += rowHTMLCb(
            name,
            totalCash,
            0,
            true,
            "cb-total-cash",
            `data-cb="1" data-cb-code="${code}"`
          );
          continue;
        }

        if (isInput) {
          const key = normKey(name);
          const curr = Number(it.amount) || 0;
          const prev = Number(prevMap.get(key)) || 0;
          const split = RCC_CB_SPLIT_ROWS.has(key);

          const display = effAmount(it);
          const base = display;
          const add = 0;

          const pad = _cbIndentPx(it);
          html += rowHTMLCb(
            name,
            display,
            pad,
            false,
            it.parent_id ? "cb-bank-leaf" : "cb-cash-leaf",
            `data-cb="1" data-cb-code="${code}" data-cb-input="1" data-cb-account-id="${id}"${it.parent_id ? ` data-cb-parent-id="${Number(it.parent_id)}"` : ""}`,
            split ? { split: true, base, add } : {}
          );
        }
      }

      return html;
    }

    function recalcCashBalanceComputedRows(container) {
      if (!container) return;

      const parseCellNumber = (td) => {
        if (!td) return 0;
        const raw = (td.textContent || "").replace(/,/g, "").trim();
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : 0;
      };

      const endingCell = container.querySelector('tr.rcc-ending td.amount');
      const ending = parseCellNumber(endingCell);

      // Mirror "Cash Balance, Ending"
      const mirror = container.querySelector('tr[data-cb="1"][data-cb-code="CB_ENDING"] td.amount');
      if (mirror) mirror.textContent = _cbFmtNum(ending);

      // Sum leaf rows (works in BOTH edit mode [inputs] and view mode [text])
      const leafRows = Array.from(container.querySelectorAll('tr[data-cb="1"][data-cb-input="1"]'));
      let totalCash = 0;
      let bankTotal = 0;

      for (const tr of leafRows) {
        const inp = tr.querySelector('input[type="number"]');

        const baseInp =
          tr.querySelector('input[type="number"][data-cb-part="base"]') ||
          tr.querySelector('input[type="number"]:not([data-cb-part])');

        const addInp = tr.querySelector('input[type="number"][data-cb-part="add"]');
        const td = tr.querySelector("td.amount");

        let n = 0;
        if (baseInp) {
          const v1 = parseFloat(baseInp.value);
          const v2 = addInp ? parseFloat(addInp.value) : 0;
          const n1 = Number.isFinite(v1) ? v1 : 0;
          const n2 = Number.isFinite(v2) ? v2 : 0;
          n = round2(round2(n1) + round2(n2));
        } else {
          n = parseCellNumber(td);
        }

        totalCash = round2(totalCash + n);
        if (tr.hasAttribute("data-cb-parent-id")) bankTotal = round2(bankTotal + n);
      }

      const bankCell = container.querySelector('tr[data-cb="1"][data-cb-code="CASH_IN_BANK"] td.amount');
      if (bankCell) bankCell.textContent = _cbFmtNum(bankTotal);

      const totalCell = container.querySelector('tr[data-cb="1"][data-cb-code="TOTAL_CASH"] td.amount');
      if (totalCell) totalCell.textContent = _cbFmtNum(totalCash);
    }

    let _addOffering = {
      tithes: 0, offering: 0, pledge: 0, es: 0, others: 0, construction: 0, samar_leyte: 0
    };
    let _editAO = false;

    const calendarEl = qs('#calendar');
    if (!calendarEl) return;

    const DELETE_RECEIPT_URL = "admin-functions/delete-offertory.php";

    const receiptsContainer = qs('#receiptsContainer');
    const receiptsTableBody = qs('#receiptsTable tbody');
    const selectedDateEl = qs('#selectedDate');

    const bankProofModal = qs("#bankProofModal");
    const closeBankProofModalBtn = qs("#closeBankProofModal");

    on(closeBankProofModalBtn, "click", closeBankProofModal);
    on(bankProofModal, "click", (e) => {
      if (e.target === bankProofModal) closeBankProofModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && bankProofModal?.style.display === "flex") {
        closeBankProofModal();
      }
    });

    (() => {
      const receiptsTable = document.querySelector('#receiptsTable');
      if (!receiptsTable || receiptsTable.querySelector('colgroup')) return;

      const cg = document.createElement('colgroup');
      cg.innerHTML = `
    <col class="c-name" />
    <col class="c-role" />
    <col class="c-type" />
    <col class="c-mode" />
    <col class="c-money" /><col class="c-money" /><col class="c-money" />
    <col class="c-money" /><col class="c-money" /><col class="c-money" /><col class="c-money" />
    <col class="c-total" />
    <col class="c-date" />
    `;
      receiptsTable.insertBefore(cg, receiptsTable.firstChild);
    })();

    (function centerAlignReceiptsTableMoneyCols() {
      const id = "receipts-money-align-css";
      const css = `
        /* Body: columns 5..12 = Tithes, Offering, Pledge, ES, Others, Construction, Samar Leyte, Total */
        #receiptsTable tbody td:nth-child(5),
        #receiptsTable tbody td:nth-child(6),
        #receiptsTable tbody td:nth-child(7),
        #receiptsTable tbody td:nth-child(8),
        #receiptsTable tbody td:nth-child(9),
        #receiptsTable tbody td:nth-child(10),
        #receiptsTable tbody td:nth-child(11),
        #receiptsTable tbody td:nth-child(12) { text-align: center; }

        /* Footer numeric cells stay the same */
        #receiptsTable tfoot td:nth-child(2),
        #receiptsTable tfoot td:nth-child(3),
        #receiptsTable tfoot td:nth-child(4),
        #receiptsTable tfoot td:nth-child(5),
        #receiptsTable tfoot td:nth-child(6),
        #receiptsTable tfoot td:nth-child(7),
        #receiptsTable tfoot td:nth-child(8),
        #receiptsTable tfoot td:nth-child(9) { text-align: center; }
      `;

      let style = document.getElementById(id);
      if (!style) {
        style = document.createElement("style");
        style.id = id;
        document.head.appendChild(style);
      }
      style.textContent = css; // why: ensure we overwrite previous right-align rules
    })();

    const rcEditBtn = qs("#rcEditBtn");
    const rcSaveBtn = qs("#rcSaveBtn");

    function updateActionButtons() {
      if (!rcEditBtn || !rcSaveBtn) return;
      if (_editAO) {
        rcEditBtn.textContent = "CANCEL";
        rcSaveBtn.disabled = false;
        rcSaveBtn.classList.remove("OP-hidden");
      } else {
        rcEditBtn.textContent = "EDIT";
        rcSaveBtn.disabled = true;
        rcSaveBtn.classList.remove("OP-hidden");
      }
    }

    function applyReceiptsColumnSizing() {
      const table = document.querySelector("#receiptsTable");
      if (!table) return;

      const old = table.querySelector("colgroup");
      if (old) old.remove();

      const cg = document.createElement("colgroup");
      cg.innerHTML = `
        <col class="c-name" />
        <col class="c-role" />
        <col class="c-type" />
        <col class="c-mode" />
        <col class="c-money" /><col class="c-money" /><col class="c-money" />
        <col class="c-money" /><col class="c-money" />
        <col class="c-construction" />
        <col class="c-samar" />
        <col class="c-total" />
        <col class="c-date" />
    `;
      table.insertBefore(cg, table.firstChild);
    }

    on(rcEditBtn, "click", () => {
      if (_editAO) {
        if (window._rcDirty) {
          const ok = window.confirm("Are you sure you want to cancel?\nYour changes will not be saved.");
          if (!ok) return;
        }
        _editAO = false;
        window._rcDirty = false;
        loadReceiptsForDate(selectedOffertoryDate);
        updateActionButtons();
        return;
      }

      window._rcDirty = false;
      _editAO = true;
      loadReceiptsForDate(selectedOffertoryDate);
      updateActionButtons();
    });


    on(rcSaveBtn, "click", async () => {
      if (!rcSaveBtn) return;
      if (!_editAO) return;

      const table = qs("#receiptsTable");
      if (!table) return;

      const unsavedNewRows = qsa("tbody tr.receipt-new", table);

      for (const newRow of unsavedNewRows) {
        const ok = await saveReceiptNewRow(newRow);
        if (!ok) {
          rcSaveBtn.disabled = false;
          return;
        }
      }

      const rowEls = qsa("tbody tr", table)
        .filter(tr =>
          tr.dataset.id &&
          !tr.classList.contains("receipt-action") &&
          !tr.classList.contains("receipt-empty") &&
          !tr.classList.contains("receipt-search-empty")
        );

      for (const tr of rowEls) {
        if (!validateEditedReceiptRowHasAmount(tr)) {
          rcSaveBtn.disabled = false;
          return;
        }
      }

      const rowsPayload = rowEls.map(tr => {
        const id = Number(tr.dataset.id || "0");

        const getVal = (col, tdIndex) => {
          const input = tr.querySelector(`input[data-col="${col}"]`);
          if (input) {
            const v = parseFloat(input.value || "0");
            return Number.isFinite(v) ? v : 0;
          }
          const tds = tr.querySelectorAll("td");
          if (tds[tdIndex]) {
            const raw = (tds[tdIndex].textContent || "").replace(/,/g, "").trim();
            const v = parseFloat(raw);
            return Number.isFinite(v) ? v : 0;
          }
          return 0;
        };

        const getTextVal = (col, tdIndex) => {
          const input = tr.querySelector(`[data-col="${col}"]`);
          if (input) return String(input.value || "").trim();

          const tds = tr.querySelectorAll("td");
          return tds[tdIndex] ? String(tds[tdIndex].textContent || "").trim() : "";
        };

        return {
          id,
          mode_of_offertory: getTextVal("mode_of_offertory", 3) || "Cash",
          tithes: getVal("tithes", 4),
          offering: getVal("offering", 5),
          pledge: getVal("pledge", 6),
          es: getVal("es", 7),
          others: getVal("others", 8),
          construction: getVal("construction", 9),
          samar_leyte: getVal("samar_leyte", 10)
        };
      }).filter(r => r.id > 0);

      let body = new URLSearchParams();
      body.set("date", selectedOffertoryDate);
      body.set("rows_json", JSON.stringify(rowsPayload));

      const readAO = () => {
        const out = { tithes: 0, offering: 0, pledge: 0, es: 0, others: 0, construction: 0, samar_leyte: 0 };
        const tfoot = table.tFoot;
        if (!tfoot) return out;
        const meta = tfoot.querySelectorAll("tr.receipt-meta");
        const aoRow = meta[1];
        if (!aoRow) return out;
        for (const k of Object.keys(out)) {
          const inp = aoRow.querySelector(`input.add-offering[data-col="${k}"]`);
          if (inp) {
            const v = parseFloat(inp.value || "0");
            out[k] = Number.isFinite(v) ? v : 0;
          }
        }
        return out;
      };

      body.set("add_offering_json", JSON.stringify(readAO()));
      body = addCSRF(body);

      rcSaveBtn.disabled = true;

      try {
        const res = await safeFetch("admin-functions/update-offertory-rows.php", {
          method: "POST",
          body
        });

        const data = await jsonOrThrow(res);
        if (!data || data.success !== true) {
          throw new Error(data && data.message ? data.message : "Save failed");
        }

        _editAO = false;

        alert("Saved!");

        await loadReceiptsForDate(selectedOffertoryDate);
        await computeSundayWeekTotalsAndRenderCard(_lastReceiptsAnchor || selectedOffertoryDate);
        updateActionButtons();
        await loadOffertoryDots();
      } catch (err) {
        console.error("Failed to save offertory edits:", err);
        alert("Save failed: " + (err.message || "Network error"));
      } finally {
        rcSaveBtn.disabled = false;
      }
    });


    function buildAddActionRow() {
      const tr = document.createElement("tr");
      tr.className = "receipt-action";

      tr.innerHTML = `
        <td style="padding:8px 6px;">
          <button id="rcAddRowBtn"
            style="display:inline-block;background:#f1c94a;color:#fff;border:none;font-weight:700;padding:8px 14px;border-radius:6px;cursor:pointer;height:28px;line-height:12px;">
            Add Row
          </button>
        </td>${'<td></td>'.repeat(12)}
      `;
      return tr;
    }

    function showNameError(tr, msg = "Name not valid") {
      const wrap = tr.querySelector('.op-name')?.closest('.op-field');
      if (!wrap) return;
      let note = wrap.querySelector('.op-error');
      if (!note) {
        note = document.createElement('div');
        note.className = 'op-error';
        wrap.appendChild(note);
      }
      note.textContent = msg;
      const input = wrap.querySelector('.op-name');
      if (input) {
        input.classList.add('op-invalid');
        input.focus();
        input.select?.();
      }
    }

    function clearNameError(tr) {
      const wrap = tr.querySelector('.op-name')?.closest('.op-field');
      if (!wrap) return;
      const note = wrap.querySelector('.op-error');
      if (note) note.remove();
      const input = wrap.querySelector('.op-name');
      if (input) input.classList.remove('op-invalid');
    }

    function showTypeError(tr, msg = "Type not valid") {
      const wrap = tr.querySelector('.op-type')?.closest('.op-field');
      if (!wrap) return;
      let note = wrap.querySelector('.op-error');
      if (!note) {
        note = document.createElement('div');
        note.className = 'op-error';
        wrap.appendChild(note);
      }
      note.textContent = msg;
      const input = wrap.querySelector('.op-type');
      if (input) {
        input.classList.add('op-invalid');
        input.focus();
      }
    }

    function clearTypeError(tr) {
      const wrap = tr.querySelector('.op-type')?.closest('.op-field');
      if (!wrap) return;
      const note = wrap.querySelector('.op-error');
      if (note) note.remove();
      const input = wrap.querySelector('.op-type');
      if (input) input.classList.remove('op-invalid');
    }

    function renderReceiptNameOptions(nameList, users) {
      nameList.innerHTML = users.map(u => {
        const label = String(u.label || "").trim().replace(/\s+/g, " ");
        const spouseId = Number(u.spouse_id || 0);

        return `
      <div
        class="op-item"
        data-id="${u.id}"
        data-spouse-id="${spouseId || ''}"
        data-type="${u.type || 'single'}"
      >
        <span>${label}</span>
      </div>
      `;
      }).join('');

      clearActiveOpItem(nameList);
    }

    function getVisibleOpItems(listEl) {
      return Array.from(listEl.querySelectorAll('.op-item'))
        .filter(item => item.style.display !== 'none');
    }

    function clearActiveOpItem(listEl) {
      listEl.querySelectorAll('.op-item.is-active').forEach(item => {
        item.classList.remove('is-active');
        item.style.background = '';
      });
    }

    function setActiveOpItem(listEl, item) {
      clearActiveOpItem(listEl);
      if (!item) return;

      item.classList.add('is-active');
      item.style.background = '#f1f1f1';
      item.scrollIntoView({ block: 'nearest' });
    }

    function moveActiveOpItem(listEl, direction) {
      const items = getVisibleOpItems(listEl);
      if (!items.length) return null;

      const currentIndex = items.findIndex(item => item.classList.contains('is-active'));
      let nextIndex = 0;

      if (currentIndex === -1) {
        nextIndex = direction > 0 ? 0 : items.length - 1;
      } else {
        nextIndex = currentIndex + direction;
        if (nextIndex < 0) nextIndex = items.length - 1;
        if (nextIndex >= items.length) nextIndex = 0;
      }

      const nextItem = items[nextIndex];
      setActiveOpItem(listEl, nextItem);
      return nextItem;
    }

    function selectReceiptNameOption(tr, item, nameInput, userIdHidden, spouseIdHidden, nameList) {
      if (!item) return;

      nameInput.value = item.querySelector('span')?.textContent || item.textContent;
      userIdHidden.value = item.dataset.id || '';
      spouseIdHidden.value = item.dataset.spouseId || '';
      nameList.style.display = 'none';
      clearActiveOpItem(nameList);
      clearNameError(tr);
    }

    function selectSimpleOpOption(inputEl, listEl, item) {
      if (!item) return;
      inputEl.value = item.dataset.value || item.textContent.trim();
      listEl.style.display = 'none';
      clearActiveOpItem(listEl);
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function resolveBankProofUrl(path) {
      const raw = String(path || "").trim();
      if (!raw) return "";

      if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) {
        return raw;
      }

      return raw.replace(/^\.?\/*/, "");
    }

    function openBankProofModal(username, proofPath) {
      const modal = qs("#bankProofModal");
      const titleEl = qs("#bankProofModalTitle");
      const imgEl = qs("#bankProofModalImage");
      const downloadBtn = qs("#bankProofDownloadBtn");

      if (!modal || !titleEl || !imgEl || !downloadBtn) return;

      const safeName = String(username || "Member").trim() || "Member";
      const proofUrl = resolveBankProofUrl(proofPath);
      if (!proofUrl) return;

      titleEl.textContent = `${safeName}'s Proof of Receipt`;
      imgEl.src = proofUrl;
      imgEl.alt = `${safeName}'s Proof of Receipt`;
      downloadBtn.href = proofUrl;

      modal.style.display = "flex";
    }

    function closeBankProofModal() {
      const modal = qs("#bankProofModal");
      const imgEl = qs("#bankProofModalImage");
      const downloadBtn = qs("#bankProofDownloadBtn");

      if (!modal || !imgEl || !downloadBtn) return;

      modal.style.display = "none";
      imgEl.src = "";
      downloadBtn.href = "#";
    }

    async function loadReceiptNameOptions(roleValue, typeValue, nameList) {
      const res = await fetch(
        `admin-functions/get-users-by-role.php?role=${encodeURIComponent(roleValue)}&type=${encodeURIComponent(typeValue)}`
      );
      return res.json();
    }

    // Add Row → inserts a new editable row above the meta rows
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("#rcAddRowBtn");
      if (!btn) return;
      if (!_editAO) return;
      if (!receiptsTableBody) return;

      const tr = btn.closest("tr.receipt-action");
      if (!tr) return;

      const moneyStyle = 'width:100%;height:28px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;text-align:right;box-sizing:border-box;';
      const textStyle = 'width:100%;height:28px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;';

      tr.classList.remove("receipt-action");
      tr.classList.add("receipt-new");

      const tds = tr.querySelectorAll("td");

      tds[0].innerHTML = `
        <div class="op-field" style="position:relative">
          <input class="receipt-edit op-name" data-col="name" type="text"
                placeholder="Name" autocomplete="off" style="${textStyle}" disabled>
          <input type="hidden" class="op-user-id">
          <input type="hidden" class="op-spouse-id">
          <div class="op-list op-name-list"></div>
        </div>`;

      tds[1].innerHTML = `
        <div class="op-field" style="position:relative">
          <input class="receipt-edit op-role" data-col="role" type="text"
                placeholder="Role" autocomplete="off"
                style="${textStyle}">
          <div class="op-list op-role-list"></div>
        </div>`;

      tds[2].innerHTML = `
        <div class="op-field" style="position:relative">
          <input class="receipt-edit op-type" data-col="type" type="text"
                value="Single" placeholder="Type" autocomplete="off"
                style="${textStyle}" disabled>
          <div class="op-list op-type-list"></div>
        </div>`;

      tds[3].innerHTML = `
        <div class="op-field" style="position:relative">
          <input class="receipt-edit op-mode" data-col="mode_of_offertory" type="text"
                value="Cash" placeholder="Mode" autocomplete="off"
                style="${textStyle};text-align:left;" readonly disabled>
          <div class="op-list op-mode-list"></div>
        </div>`;

      const roleInput = tr.querySelector('.op-role');
      const roleList = tr.querySelector('.op-role-list');
      const typeInput = tr.querySelector('.op-type');
      const typeList = tr.querySelector('.op-type-list');
      const modeInput = tr.querySelector('.op-mode');
      const modeList = tr.querySelector('.op-mode-list');
      const nameInput = tr.querySelector('.op-name');
      const nameList = tr.querySelector('.op-name-list');
      const userIdHidden = tr.querySelector('.op-user-id');
      const spouseIdHidden = tr.querySelector('.op-spouse-id');

      const resetNameSelection = () => {
        nameInput.value = '';
        userIdHidden.value = '';
        spouseIdHidden.value = '';
        nameList.innerHTML = '';
        hideList(nameList);
        clearNameError(tr);
      };

      const resetTypeSelection = () => {
        typeInput.value = 'Single';
        typeInput.disabled = true;
        hideList(typeList);
        clearTypeError(tr);
      };

      const applyFieldAvailability = () => {
        const roleValue = (roleInput.value || '').trim().toLowerCase();
        const typeValue = (typeInput.value || 'Single').trim().toLowerCase();

        if (!roleValue) {
          typeInput.disabled = true;
          modeInput.disabled = true;
          modeInput.value = 'Cash';
          hideList(modeList);
          nameInput.disabled = true;
          resetNameSelection();
          return;
        }

        if (roleValue === 'visitor') {
          typeInput.value = 'Single';
          typeInput.disabled = true;
          modeInput.disabled = false;
          nameInput.disabled = false;
          resetNameSelection();
          return;
        }

        typeInput.disabled = false;
        modeInput.disabled = false;
        nameInput.disabled = false;

        if (!['single', 'couple'].includes(typeValue)) {
          typeInput.value = 'Single';
        }
      };

      const openNameDropdown = () => {
        if ((roleInput.value || "").toLowerCase() === "visitor") {
          nameList.style.display = "none";
          return;
        }
        if (nameList.children.length > 0) {
          nameList.style.display = "block";
        }
      };

      nameInput.addEventListener("focus", openNameDropdown);
      nameInput.addEventListener("click", (e) => {
        e.stopPropagation();
        openNameDropdown();
      });

      nameInput.addEventListener('keydown', (e) => {
        const visibleItems = getVisibleOpItems(nameList);

        if (e.key === 'ArrowDown') {
          if (!visibleItems.length) return;
          e.preventDefault();
          showList(nameList);
          moveActiveOpItem(nameList, 1);
          return;
        }

        if (e.key === 'ArrowUp') {
          if (!visibleItems.length) return;
          e.preventDefault();
          showList(nameList);
          moveActiveOpItem(nameList, -1);
          return;
        }

        if (e.key === 'Enter') {
          const activeItem = nameList.querySelector('.op-item.is-active');
          if (!activeItem) return;
          e.preventDefault();
          selectReceiptNameOption(tr, activeItem, nameInput, userIdHidden, spouseIdHidden, nameList);
        }
      });

      nameList.addEventListener("mousedown", (e) => e.stopPropagation());

      const showList = (el) => { el.style.display = 'block'; };
      const hideList = (el) => { el.style.display = 'none'; };

      const closeOnOutside = (ev) => {
        const roleWrap = roleList.closest('.op-field');
        const typeWrap = typeList.closest('.op-field');
        const modeWrap = modeList.closest('.op-field');
        const nameWrap = nameList.closest('.op-field');

        if (!roleWrap.contains(ev.target)) hideList(roleList);
        if (!typeWrap.contains(ev.target)) hideList(typeList);
        if (!modeWrap.contains(ev.target)) hideList(modeList);
        if (!nameWrap.contains(ev.target)) hideList(nameList);
      };

      document.addEventListener('click', closeOnOutside, { once: false });

      roleList.addEventListener('mousedown', (e) => e.stopPropagation());
      typeList.addEventListener('mousedown', (e) => e.stopPropagation());
      modeList.addEventListener('mousedown', (e) => e.stopPropagation());
      nameList.addEventListener('mousedown', (e) => e.stopPropagation());

      roleInput.addEventListener('mousedown', (e) => e.stopPropagation());
      typeInput.addEventListener('mousedown', (e) => e.stopPropagation());
      modeInput.addEventListener('mousedown', (e) => e.stopPropagation());
      nameInput.addEventListener('mousedown', (e) => e.stopPropagation());

      roleInput.addEventListener('focus', async () => {
        if (!roleList.dataset.loaded) {
          const res = await fetch('admin-functions/get-roles.php');
          const roles = await res.json();
          roleList.innerHTML = roles
            .map(r => `<div class="op-item" data-value="${r.value}">${r.label}</div>`)
            .join('');
          roleList.dataset.loaded = '1';
        }
        clearActiveOpItem(roleList);
        showList(roleList);
      });

      roleInput.addEventListener('input', () => {
        const q = (roleInput.value || '').toLowerCase();
        showList(roleList);
        roleList.querySelectorAll('.op-item').forEach(it => {
          it.style.display = it.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
        clearActiveOpItem(roleList);
      });

      roleInput.addEventListener('keydown', async (e) => {
        const visibleItems = getVisibleOpItems(roleList);

        if (e.key === 'Tab') {
          hideList(roleList);
          clearActiveOpItem(roleList);
          return;
        }

        if (e.key === 'ArrowDown') {
          if (!visibleItems.length) return;
          e.preventDefault();
          showList(roleList);
          moveActiveOpItem(roleList, 1);
          return;
        }

        if (e.key === 'ArrowUp') {
          if (!visibleItems.length) return;
          e.preventDefault();
          showList(roleList);
          moveActiveOpItem(roleList, -1);
          return;
        }

        if (e.key === 'Enter') {
          const activeItem = roleList.querySelector('.op-item.is-active');
          if (!activeItem) return;
          e.preventDefault();

          const role = activeItem.dataset.value;
          selectSimpleOpOption(roleInput, roleList, activeItem);

          resetNameSelection();
          applyFieldAvailability();

          if (role === 'visitor') {
            clearNameError(tr);
            return;
          }

          typeInput.value = 'Single';

          try {
            const users = await loadReceiptNameOptions(role, 'single', nameList);
            renderReceiptNameOptions(nameList, Array.isArray(users) ? users : []);
            hideList(nameList);
          } catch (err) {
            console.error('load users by role failed:', err);
            nameList.innerHTML = '';
            hideList(nameList);
          }

          const filterNames = () => {
            const q = (nameInput.value || '').toLowerCase();
            showList(nameList);
            nameList.querySelectorAll('.op-item').forEach(node => {
              node.style.display = node.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
            userIdHidden.value = '';
            spouseIdHidden.value = '';
            clearActiveOpItem(nameList);
            clearNameError(tr);
          };

          nameInput.oninput = filterNames;
        }
      });

      roleList.addEventListener('mousedown', async (e) => {
        const it = e.target.closest('.op-item');
        if (!it) return;

        const role = it.dataset.value;
        selectSimpleOpOption(roleInput, roleList, it);

        resetNameSelection();
        applyFieldAvailability();

        if (role === 'visitor') {
          clearNameError(tr);
          return;
        }

        typeInput.value = 'Single';

        try {
          const users = await loadReceiptNameOptions(role, 'single', nameList);
          renderReceiptNameOptions(nameList, Array.isArray(users) ? users : []);
          hideList(nameList);
        } catch (err) {
          console.error('load users by role failed:', err);
          nameList.innerHTML = '';
          hideList(nameList);
        }

        const filterNames = () => {
          const q = (nameInput.value || '').toLowerCase();
          showList(nameList);
          nameList.querySelectorAll('.op-item').forEach(node => {
            node.style.display = node.textContent.toLowerCase().includes(q) ? '' : 'none';
          });
          userIdHidden.value = '';
          spouseIdHidden.value = '';
          clearActiveOpItem(nameList);
          clearNameError(tr);
        };

        nameInput.oninput = filterNames;
      });

      typeInput.addEventListener('focus', () => {
        if (typeInput.disabled) return;
        typeList.innerHTML = `
    <div class="op-item" data-value="Single">Single</div>
    <div class="op-item" data-value="Couple">Couple</div>
  `;
        clearActiveOpItem(typeList);
        showList(typeList);
      });

      typeInput.addEventListener('keydown', async (e) => {
        const visibleItems = getVisibleOpItems(typeList);

        if (e.key === 'Tab') {
          hideList(typeList);
          clearActiveOpItem(typeList);
          return;
        }

        if (e.key === 'ArrowDown') {
          if (!visibleItems.length) return;
          e.preventDefault();
          showList(typeList);
          moveActiveOpItem(typeList, 1);
          return;
        }

        if (e.key === 'ArrowUp') {
          if (!visibleItems.length) return;
          e.preventDefault();
          showList(typeList);
          moveActiveOpItem(typeList, -1);
          return;
        }

        if (e.key === 'Enter') {
          const activeItem = typeList.querySelector('.op-item.is-active');
          if (!activeItem) return;
          e.preventDefault();

          selectSimpleOpOption(typeInput, typeList, activeItem);
          resetNameSelection();

          const roleValue = (roleInput.value || '').trim().toLowerCase();
          if (roleValue && roleValue !== 'visitor') {
            try {
              const users = await loadReceiptNameOptions(roleValue, typeInput.value.toLowerCase(), nameList);
              renderReceiptNameOptions(nameList, Array.isArray(users) ? users : []);
            } catch (err) {
              console.error('load users by role/type failed:', err);
              nameList.innerHTML = '';
              hideList(nameList);
            }
          }
        }
      });

      typeInput.addEventListener('mousedown', (e) => e.stopPropagation());
      typeList.addEventListener('mousedown', (e) => e.stopPropagation());
      typeList.addEventListener('mousedown', async (e) => {
        e.stopPropagation();
        const it = e.target.closest('.op-item');
        if (!it) return;

        selectSimpleOpOption(typeInput, typeList, it);
        resetNameSelection();

        const roleValue = (roleInput.value || '').trim().toLowerCase();
        if (roleValue && roleValue !== 'visitor') {
          try {
            const users = await loadReceiptNameOptions(roleValue, typeInput.value.toLowerCase(), nameList);
            renderReceiptNameOptions(nameList, Array.isArray(users) ? users : []);
          } catch (err) {
            console.error('load users by role/type failed:', err);
            nameList.innerHTML = '';
            hideList(nameList);
          }
        }
      });

      modeInput.addEventListener('focus', () => {
        if (modeInput.disabled) return;
        modeList.innerHTML = `
          <div class="op-item" data-value="Cash">Cash</div>
          <div class="op-item" data-value="Bank">Bank</div>
        `;
        clearActiveOpItem(modeList);
        showList(modeList);
      });

      modeInput.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modeInput.disabled) return;
        modeList.innerHTML = `
          <div class="op-item" data-value="Cash">Cash</div>
          <div class="op-item" data-value="Bank">Bank</div>
        `;
        clearActiveOpItem(modeList);
        showList(modeList);
      });

      modeInput.addEventListener('keydown', (e) => {
        if (modeInput.disabled) return;

        const visibleItems = getVisibleOpItems(modeList);

        if (e.key === 'Tab') {
          hideList(modeList);
          clearActiveOpItem(modeList);
          return;
        }

        if (e.key === 'ArrowDown') {
          if (!visibleItems.length) return;
          e.preventDefault();
          showList(modeList);
          moveActiveOpItem(modeList, 1);
          return;
        }

        if (e.key === 'ArrowUp') {
          if (!visibleItems.length) return;
          e.preventDefault();
          showList(modeList);
          moveActiveOpItem(modeList, -1);
          return;
        }

        if (e.key === 'Enter') {
          const activeItem = modeList.querySelector('.op-item.is-active');
          if (!activeItem) return;
          e.preventDefault();
          selectSimpleOpOption(modeInput, modeList, activeItem);
        }
      });

      modeList.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const it = e.target.closest('.op-item');
        if (!it) return;
        selectSimpleOpOption(modeInput, modeList, it);
      });

      nameList.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const it = e.target.closest('.op-item');
        if (!it) return;
        selectReceiptNameOption(tr, it, nameInput, userIdHidden, spouseIdHidden, nameList);
      });

      const cols = ["tithes", "offering", "pledge", "es", "others", "construction", "samar_leyte"];
      for (let i = 0; i < cols.length; i++) {
        tds[4 + i].innerHTML =
          `<input class="receipt-edit" data-col="${cols[i]}" type="number" step="0.01" min="0" style="${moneyStyle}">`;
      }

      tds[11].className = "row-total";
      tds[11].textContent = "";
      tds[12].textContent = selectedOffertoryDate;

      const actionsWrap = document.createElement("span");
      actionsWrap.className = "actions";
      actionsWrap.innerHTML = `
        <button type="button" class="receipt-save btn-approve" title="Save row">✓</button>
        <button type="button" class="receipt-cancel btn-reject" title="Cancel row">✕</button>
      `;
      tds[12].appendChild(document.createTextNode(" "));
      tds[12].appendChild(actionsWrap);

      const newActionRow = document.createElement("tr");
      newActionRow.className = "receipt-action";
      newActionRow.innerHTML = `
        <td style="padding:8px 6px;">
          <button id="rcAddRowBtn"
            style="display:inline-block;background:#f1c94a;color:#fff;border:none;font-weight:700;padding:8px 14px;border-radius:6px;cursor:pointer;height:28px;line-height:12px;">
            Add Row
          </button>
        </td>${'<td></td>'.repeat(12)}
      `;
      tr.insertAdjacentElement("afterend", newActionRow);

      const recalc = () => {
        const get = (k) => parseFloat(tr.querySelector(`[data-col="${k}"]`)?.value || "") || 0;
        const total = get("tithes") + get("offering") + get("pledge") + get("es") + get("others") + get("construction") + get("samar_leyte");
        tds[11].textContent = total > 0 ? total.toLocaleString('en-PH') : "";
      };

      tr.addEventListener("input", (ev) => {
        if (ev.target.matches('.receipt-edit[type="number"]')) {
          ev.target.setCustomValidity("");
          recalc();
        }
      });
    });

    document.addEventListener("click", async (e) => {
      const btn = e.target.closest(".receipt-save");
      if (!btn) return;

      const tr = btn.closest("tr.receipt-new");
      if (!tr) return;

      await saveReceiptNewRow(tr, btn);
    });

    function recalcReceiptsMetaRows() {
      const table = document.querySelector("#receiptsTable");
      if (!table || !table.tFoot) return;

      const rows = Array.from(table.querySelectorAll("tbody tr"))
        .filter(r => r.style.display !== "none")
        .filter(r => !r.classList.contains("receipt-action"))
        .filter(r => !r.classList.contains("receipt-empty"))
        .filter(r => !r.classList.contains("receipt-search-empty"));

      const bodyTotals = { tithes: 0, offering: 0, pledge: 0, es: 0, others: 0, construction: 0, samar_leyte: 0, overall: 0 };
      rows.forEach(r => {
        const td = r.querySelectorAll("td");
        const t = numFromTd(td[4]);
        const o = numFromTd(td[5]);
        const p = numFromTd(td[6]);
        const e = numFromTd(td[7]);
        const ot = numFromTd(td[8]);
        const c = numFromTd(td[9]);
        const s = numFromTd(td[10]);
        const sum = t + o + p + e + ot + c + s;

        bodyTotals.tithes += t;
        bodyTotals.offering += o;
        bodyTotals.pledge += p;
        bodyTotals.es += e;
        bodyTotals.others += ot;
        bodyTotals.construction += c;
        bodyTotals.samar_leyte += s;
        bodyTotals.overall += sum;
      });

      // ADD: OFFERING current values
      let aoCurrent = {
        tithes: 0, offering: 0, pledge: 0, es: 0, others: 0, construction: 0, samar_leyte: 0
      };

      const meta = table.tFoot.querySelectorAll("tr.receipt-meta");
      const aoRow = meta[1]; // 2nd meta row is "ADD: OFFERING"

      if (_editAO && aoRow) {
        const tds = aoRow.querySelectorAll("td");
        aoCurrent = {
          tithes: numFromTd(tds[1]),
          offering: numFromTd(tds[2]),
          pledge: numFromTd(tds[3]),
          es: numFromTd(tds[4]),
          others: numFromTd(tds[5]),
          construction: numFromTd(tds[6]),
          samar_leyte: numFromTd(tds[7]),
        };
      } else {
        aoCurrent = {
          tithes: _addOffering.tithes || 0,
          offering: _addOffering.offering || 0,
          pledge: _addOffering.pledge || 0,
          es: _addOffering.es || 0,
          others: _addOffering.others || 0,
          construction: _addOffering.construction || 0,
          samar_leyte: _addOffering.samar_leyte || 0,
        };
      }

      const aoSum =
        aoCurrent.tithes + aoCurrent.offering + aoCurrent.pledge + aoCurrent.es +
        aoCurrent.others + aoCurrent.construction + aoCurrent.samar_leyte;

      const tsr = {
        tithes: bodyTotals.tithes + aoCurrent.tithes,
        offering: bodyTotals.offering + aoCurrent.offering,
        pledge: bodyTotals.pledge + aoCurrent.pledge,
        es: bodyTotals.es + aoCurrent.es,
        others: bodyTotals.others + aoCurrent.others,
        construction: bodyTotals.construction + aoCurrent.construction,
        samar_leyte: bodyTotals.samar_leyte + aoCurrent.samar_leyte,
        overall: bodyTotals.overall + aoSum
      };

      const fmt = (v) => v > 0 ? v.toLocaleString('en-PH', { maximumFractionDigits: 2 }) : "";

      if (meta[0]) {
        const tds = meta[0].querySelectorAll("td");
        tds[1].textContent = fmt(bodyTotals.tithes);
        tds[2].textContent = fmt(bodyTotals.offering);
        tds[3].textContent = fmt(bodyTotals.pledge);
        tds[4].textContent = fmt(bodyTotals.es);
        tds[5].textContent = fmt(bodyTotals.others);
        tds[6].textContent = fmt(bodyTotals.construction);
        tds[7].textContent = fmt(bodyTotals.samar_leyte);
        tds[8].textContent = fmt(bodyTotals.overall);
      }

      if (meta[1]) {
        const tds = meta[1].querySelectorAll("td");
        tds[8].textContent = _editAO ? "" : fmt(aoSum);
      }

      if (meta[2]) {
        const tds = meta[2].querySelectorAll("td");
        tds[1].textContent = fmt(tsr.tithes);
        tds[2].textContent = fmt(tsr.offering);
        tds[3].textContent = fmt(tsr.pledge);
        tds[4].textContent = fmt(tsr.es);
        tds[5].textContent = fmt(tsr.others);
        tds[6].textContent = fmt(tsr.construction);
        tds[7].textContent = fmt(tsr.samar_leyte);
        tds[8].textContent = fmt(tsr.overall);
      }
    }

    document.addEventListener("click", (e) => {
      const cancelBtn = e.target.closest(".receipt-cancel");
      if (!cancelBtn) return;

      const tr = cancelBtn.closest("tr.receipt-new");
      if (!tr) return;

      const val = (sel) => (tr.querySelector(sel)?.value || "").trim();
      const num = (sel) => {
        const n = parseFloat(val(sel));
        return Number.isFinite(n) && n > 0 ? n : 0;
      };

      const hasAnyInput =
        val('.op-name') ||
        val('.op-role') ||
        num('input[data-col="tithes"]') ||
        num('input[data-col="offering"]') ||
        num('input[data-col="pledge"]') ||
        num('input[data-col="es"]') ||
        num('input[data-col="others"]') ||
        num('input[data-col="construction"]') ||
        num('input[data-col="samar_leyte"]');

      if (hasAnyInput) {
        const ok = confirm("Are you sure you want to cancel adding row?");
        if (!ok) return;
      }

      const below = tr.nextElementSibling;

      const replacement = buildAddActionRow();
      tr.replaceWith(replacement);

      if (below && below.classList.contains("receipt-action")) {
        below.remove();
      }
    });

    document.addEventListener("click", (e) => {
      const trigger = e.target.closest(".bank-proof-cell");
      if (!trigger) return;

      const proofPath = trigger.dataset.proofImage || "";
      const username = trigger.dataset.proofName || "";

      if (!proofPath) return;
      openBankProofModal(username, proofPath);
    });

    // DELETE an existing receipt row (Edit mode)
    document.addEventListener("click", async (e) => {
      const delBtn = e.target.closest(".receipt-del");
      if (!delBtn) return;

      const tr = delBtn.closest("tr");
      const id = tr?.dataset.id;
      const uname = (tr?.dataset.name || tr?.querySelector("td:first-child")?.textContent || "").trim();

      if (!id) {
        alert("Missing row id – cannot delete.");
        return;
      }

      const ok = confirm(`Are you sure you want to delete ${uname ? uname + "" : "this"} offertory row?`);
      if (!ok) return;

      delBtn.disabled = true;
      try {
        const res = await fetch(DELETE_RECEIPT_URL, {
          method: "POST",
          headers: { "X-CSRF-Token": window.CSRF_TOKEN },
          body: addCSRF(new URLSearchParams({ id }))
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message || `HTTP ${res.status}`);

        tr.remove();
        recalcReceiptsMetaRows();

        const tbody = document.querySelector("#receiptsTable tbody");
        const remaining = tbody ? tbody.querySelectorAll("tr:not(.receipt-action):not(.receipt-empty):not(.receipt-search-empty)").length : 0;
        if (tbody && remaining === 0) {
          const wasEditing = _editAO;
          await loadReceiptsForDate(selectedOffertoryDate);
          _editAO = wasEditing;
          updateActionButtons();
        }
        await loadOffertoryDots();
      } catch (err) {
        console.error(err);
        alert("Delete failed: " + (err.message || "Network error"));
        delBtn.disabled = false;
      }
    });

    function numFromTd(td) {
      if (!td) return 0;
      const src = td.querySelector('input')?.value ?? td.textContent ?? "";
      const n = parseFloat(String(src).replace(/[₱,]/g, '')); // strip peso + commas
      return Number.isFinite(n) ? n : 0;
    }

    function validateEditedReceiptRowHasAmount(tr) {
      if (!tr) return true;

      const amountKeys = ["tithes", "offering", "pledge", "es", "others", "construction", "samar_leyte"];
      const amountInputs = amountKeys
        .map((key) => tr.querySelector(`input[data-col="${key}"]`))
        .filter(Boolean);

      if (!amountInputs.length) return true;

      const hasAnyAmount = amountInputs.some((input) => {
        const raw = String(input.value || "").trim();
        if (raw === "") return false;
        const n = parseFloat(raw);
        return Number.isFinite(n) && n > 0;
      });

      amountInputs.forEach((input) => input.setCustomValidity(""));

      if (hasAnyAmount) return true;

      const firstInput = amountInputs[0];
      if (firstInput) {
        firstInput.setCustomValidity("Please enter at least one amount.");
        firstInput.reportValidity();
        firstInput.focus();
      }

      return false;
    }

    function recalcRowTotal(tr) {
      if (!tr) return;
      const tds = tr.querySelectorAll('td');
      const sum = [4, 5, 6, 7, 8, 9, 10].reduce((acc, idx) => acc + numFromTd(tds[idx]), 0);
      const totalTd = tds[11];
      totalTd.textContent = sum > 0
        ? sum.toLocaleString('en-PH', { maximumFractionDigits: 2 })
        : "";
    }

    function recalcAllRowTotals() {
      const tbody = document.querySelector("#receiptsTable tbody");
      if (!tbody) return;
      tbody.querySelectorAll("tr:not(.receipt-action):not(.receipt-empty):not(.receipt-search-empty)").forEach(tr => {
        if (tr.querySelector('input.receipt-edit[type="number"]')) {
          recalcRowTotal(tr);
        }
      });
    }

    function buildSavedReceiptRowHtml(rowData, keepEditMode = false) {
      const rid = String(rowData.id || "").trim();
      const rname = String(rowData.name || "").trim();
      const role = String(rowData.role || "Visitor").trim();
      const receiptType = String(rowData.type || "Single").trim();
      const modeOfOffertory = String(rowData.mode_of_offertory || "Cash").trim();

      const moneyCell = (key, value) => {
        const n = parseFloat(value);
        if (keepEditMode) {
          const hasValue = Number.isFinite(n) && n > 0;
          const valueAttr = hasValue ? ` value="${n}"` : "";
          return `
        <input
          class="receipt-edit"
          data-col="${key}"
          type="number"
          step="0.01"
          min="0"${valueAttr}
          style="width:100%;height:28px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;text-align:right;box-sizing:border-box;"
        >
      `;
        }
        return Number.isFinite(n) && n > 0 ? fmtNumber(n) : "";
      };

      return `
        <tr class="receipt-row" data-id="${rid}" data-name="${rname.replace(/"/g, '&quot;')}">
          <td>${rname}</td>
          <td>${role}</td>
          <td>${receiptType}</td>
          <td>${modeOfOffertory}</td>

          <td>${moneyCell("tithes", rowData.tithes)}</td>
          <td>${moneyCell("offering", rowData.offering)}</td>
          <td>${moneyCell("pledge", rowData.pledge)}</td>
          <td>${moneyCell("es", rowData.es)}</td>
          <td>${moneyCell("others", rowData.others)}</td>
          <td>${moneyCell("construction", rowData.construction)}</td>
          <td>${moneyCell("samar_leyte", rowData.samar_leyte)}</td>

          <td>${fmtNumber(rowData.total)}</td>
          <td>
            ${rowData.date || ""}
            ${keepEditMode ? `
              <span class="actions">
                <button type="button" class="receipt-del btn-reject" title="Delete row">✕</button>
              </span>
            ` : ``}
          </td>
        </tr>
      `;
    }

    function getReceiptNewRowValues(tr) {
      const name = (tr.querySelector('.op-name')?.value || '').trim();
      const roleTyped = (tr.querySelector('.op-role')?.value || '').trim().toLowerCase();
      const typeTyped = (tr.querySelector('.op-type')?.value || 'Single').trim().toLowerCase();
      const modeOfOffertory = tr.querySelector('[data-col="mode_of_offertory"]')?.value || "Cash";
      const userIdPicked = (tr.querySelector('.op-user-id')?.value || '').trim();
      const spouseIdPicked = (tr.querySelector('.op-spouse-id')?.value || '').trim();

      const readMoney = (key) => {
        const v = parseFloat(tr.querySelector(`[data-col="${key}"]`)?.value || '');
        return Number.isFinite(v) ? v : 0;
      };

      return {
        name,
        roleTyped,
        typeTyped,
        modeOfOffertory,
        userIdPicked,
        spouseIdPicked,
        tithes: readMoney('tithes'),
        offering: readMoney('offering'),
        pledge: readMoney('pledge'),
        es: readMoney('es'),
        others: readMoney('others'),
        construction: readMoney('construction'),
        samar: readMoney('samar_leyte')
      };
    }

    function validateReceiptNewRow(tr, row) {
      if ((row.roleTyped === 'admin' || row.roleTyped === 'member')) {
        if (!row.userIdPicked) {
          showNameError(tr, "Name not valid");
          return false;
        }
        if (row.typeTyped === 'couple' && !row.spouseIdPicked) {
          showNameError(tr, "Couple account not valid");
          return false;
        }
      } else {
        clearNameError(tr);
      }

      const amounts = [
        row.tithes, row.offering, row.pledge, row.es,
        row.others, row.construction, row.samar
      ];

      if (!amounts.some(v => v > 0)) {
        alert("Please enter at least one amount.");
        tr.querySelector(
          'input[data-col="tithes"], input[data-col="offering"], input[data-col="pledge"], input[data-col="es"], input[data-col="others"], input[data-col="construction"], input[data-col="samar_leyte"]'
        )?.focus();
        return false;
      }

      if (!row.name) {
        alert("Please enter a Name.");
        tr.querySelector('input[data-col="name"]')?.focus();
        return false;
      }

      if ((row.roleTyped === 'admin' || row.roleTyped === 'member') && !row.typeTyped) {
        showTypeError(tr, "Please select a Type.");
        return false;
      }

      clearTypeError(tr);
      return true;
    }

    function buildReceiptNewRowFormData(row) {
      const form = new FormData();
      if (window.CSRF_TOKEN) form.set("csrf_token", window.CSRF_TOKEN);

      form.set("mode_of_offertory", row.modeOfOffertory || "Cash");
      form.set("tithes", row.tithes);
      form.set("offering", row.offering);
      form.set("pledge", row.pledge);
      form.set("eskwela_suporta", row.es);
      form.set("others", row.others);
      form.set("other_use", "");
      form.set("construction", row.construction);
      form.set("samarleyte_pledge", row.samar);
      form.set("date", selectedOffertoryDate);
      form.set("receipt_type", row.typeTyped);

      if (row.roleTyped === "visitor") {
        form.set("visitor_name", row.name || "Visitor");
        form.set("force_visitor", "1");
      } else if (row.userIdPicked) {
        form.set("user_id", row.userIdPicked);
        if (row.typeTyped === "couple" && row.spouseIdPicked) {
          form.set("spouse_id", row.spouseIdPicked);
        }
      }

      return form;
    }

    async function saveReceiptNewRow(tr, triggerBtn = null) {
      const row = getReceiptNewRowValues(tr);
      if (!validateReceiptNewRow(tr, row)) return false;

      if (triggerBtn) triggerBtn.disabled = true;

      try {
        const form = buildReceiptNewRowFormData(row);
        const res = await safeFetch("admin-functions/save-offertory-admin.php", {
          method: "POST",
          body: form
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }

        const savedId =
          data.id ??
          data.receipt_id ??
          data.offertory_id ??
          data.insert_id ??
          "";

        const savedRole = row.roleTyped === "visitor" ? "visitor" : row.roleTyped;
        const savedType = row.typeTyped === "couple" ? "Couple" : "Single";
        const savedTotal =
          row.tithes + row.offering + row.pledge + row.es +
          row.others + row.construction + row.samar;

        const savedRowHtml = buildSavedReceiptRowHtml(
          {
            id: savedId,
            name: row.name,
            role: savedRole,
            type: savedType,
            mode_of_offertory: row.modeOfOffertory || "Cash",
            tithes: row.tithes,
            offering: row.offering,
            pledge: row.pledge,
            es: row.es,
            others: row.others,
            construction: row.construction,
            samar_leyte: row.samar,
            total: savedTotal,
            date: selectedOffertoryDate
          },
          _editAO
        );

        const wrapper = document.createElement("tbody");
        wrapper.innerHTML = savedRowHtml.trim();
        const savedRowEl = wrapper.firstElementChild;

        tr.replaceWith(savedRowEl);

        window._rcDirty = true;
        recalcReceiptsMetaRows();
        updateActionButtons();
        return true;
      } catch (err) {
        console.error(err);
        alert("Save failed: " + (err.message || "Network error"));
        if (triggerBtn) triggerBtn.disabled = false;
        return false;
      }
    }

    delegate(document, "input", '#receiptsTable tbody input.receipt-edit[type="number"]', () => {
      if (_editAO) window._rcDirty = true;
      recalcAllRowTotals();
      recalcReceiptsMetaRows();
    });

    delegate(document, "input", "#receiptsTable tfoot .add-offering", () => {
      if (_editAO) window._rcDirty = true;
      recalcReceiptsMetaRows();
    });

    // ---------- Receipts Computed Card ----------
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pad = n => String(n).padStart(2, "0");
    const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

    let _receiptsCardDayLabel = "";
    let _monthBeginning = 0;
    let _dailyReceiptsTotal = 0;
    let _dailyDisbTotal = 0;
    let _dailyDisbByCategory = {};
    let _adminDirectBySubcat = {};
    let _adminOtherBySubcat = {};
    let _maBySubcat = {};
    let _maOtherAmt = 0;
    let _ministryGroupTotals = {};
    let _ministryLeafTotals = {};
    let _msBySubcat = {};
    let _msOtherAmt = 0;
    let _outreachGroupTotals = {};
    let _outreachLeafTotals = {};
    let _pmBySubcat = {};
    let _pmOtherAmt = 0;
    let _supBySubcat = {};
    let _supOtherAmt = 0;

    let _contextDates = [];
    let _isSundayContext = false;
    const _disbItemsByYM = {};
    window._disbItemsByYM = _disbItemsByYM;

    const DISB_CATEGORY_ORDER = [
      "Administrative Expenses",

      "BCC Center Contribution",
      "BOT Share",
      "BHC Share",
      "Church Activity Expenses",
      "Insurance Expense",
      "Legal & Compliance Expenses",

      "Members Assistance",
      "Ministry Expenses",
      "Miscellaneous Expense",
      "Mission Support",
      "Outreach Support",
      "Repairs & Maintenance Expense",
      "Representation Expense",
      "Pastoral Ministry Expenses",
      "Supplies Expenses",

      "Taxes & Licenses",
      "Training, Convention, and Seminar Expenses",
      "Transportation Expense",
      "Utilities Expense",
      "Land and Buildings & Bldq. Equipment",
      "Furniture & Fixtures",
      "Music Instruments and Sound Equipment",
      "Computer Equipment",
      "Meralco Upgrade",
      "Other Assets",
      "Advances (Bro Onad)",
      "Over/Short",
      "Advances from Samar Leyte",
      "Advances from Gemma (Utilities)"
    ];

    window._rcDirty = false;
    window._rccDirty = false;
    window._editRCC = false;
    const RCC_SAVE_URL = "admin-offertory.php?action=saveReceiptsComputed";
    const RCC_EDITABLE_ADMIN_LABELS = new Set([
      // Direct
      "Food Expenses",
      "Medical Expenses",
      "Philhealth",
      "SSS Contribution",
      "Communications Expense",
      "Love Gift (deducted from MRF)",
      "Other Miscellaneous",
      // Other (still Administrative)
      "BCC Center Contribution",
      "BOT Share",
      "BHC Share",
      "Church Activity Expenses",
      "Insurance Expense",
      "Legal & Compliance Expenses",
      // Members Assistance 
      "Financial Assistance",
      "Funeral Assistance",
      "Educational Assistance",
      // Ministry Expenses (All)
      "Transportation",
      "Food",
      "Transportation/others",
      "Materials",
      "Misc",
      "Miscellaneous Expense",
      // Mission Support
      "Mission Support - Ptr M",
      "Love Gift-Ptr A & Sis Neneng",
      "Love Gift - Sis Criselda",
      // Outreach Support (All)
      "Repairs & Maintenance Expense",
      "Representation Expense",
      "Rental",
      "Love Gift",
      "Food Expenses & others",
      "Samar-Leyte printing",
      "Samar-Leyte Internet",
      "Checked Baggage",
      // Supplies Expenses
      "Office Supplies Expense",
      "Cleaning Materials",
      "Taxes & Licenses",
      "Training, Convention, and Seminar Expenses",
      "Transportation Expense",
      "Utilities Expense",
      "Land and Buildings & Bldq. Equipment",
      "Furniture & Fixtures",
      "Music Instruments and Sound Equipment",
      "Computer Equipment",
      "Meralco Upgrade",
      "Other Assets",
      "Advances (Bro Onad)",
      "Over/Short",
      "Advances from Samar Leyte",
      "Advances from Gemma (Utilities)"
    ]);

    const RCC_OTHER_RECEIPTS_OVERRIDE_LABELS = new Set([
      "One Time Pledge/Offering",
      "Bank Interest/Other Income",
      "Pledge Outreach",
      "Kids Church",
      "Samar Leyte beg 5700",
      "Pledge -Worship Team",
      "Eskwela Suporta",
      "Donation fr Sis Criselda",
      "BCC CENTER",
      "Donation for Wellness Program",
      "Anniversary Pledge/Contibution",
    ]);

    const RCC_OTHER_RECEIPTS_ALWAYS_INPUT_LABELS = new Set([
      "Bank Interest/Other Income",
      "Pledge Outreach",
      "Kids Church",
      "Pledge -Worship Team",
      "Eskwela Suporta",
      "Donation fr Sis Criselda",
      "BCC CENTER",
      "Donation for Wellness Program",
      "Anniversary Pledge/Contibution",
    ]);

    const RCC_CB_SPLIT_INPUT_LABELS = new Set([
      "cash on hand",
      "cash on construction",
      "cash on samar leyte",
      "coh - sis criselda",
      "coh - anniversary",
      "coh - sodexo",
      "ps bank",
      "bdo-savings",
      "bdo-checking fr bcc marikina",
      "bdo-checking samar leyte",
      "samar leyte",
      "gcash",
      "for dep of bro ronald",
      "cash for wellness program",
      "cash for worship team",
    ]);

    const RCC_SAVE_OVERRIDES_URL = "admin-functions/save-receipts-computed-overrides.php";
    window._rccOverridesByDate = window._rccOverridesByDate || Object.create(null);

    const normStr = (s) => (s || "").trim().replace(/\s+/g, " ");
    const normKey = (s) => normStr(s).toLowerCase();

    // Cash Balance rows that should show: base (previous Sunday) + add (this Sunday)
    const RCC_CB_SPLIT_ROWS = new Set([
      "cash on hand",
      "cash on construction",
      "cash on samar leyte",
      "coh - sis criselda",
      "coh - anniversary",
      "coh - sodexo",
      "ps bank",
      "bdo-savings",
      "bdo-checking fr bcc marikina",
      "bdo-checking samar leyte",
      "samar leyte",
      "gcash",
      "for dep of bro ronald",
      "cash for wellness program",
      "cash for worship team",
    ]);

    const MINISTRY_GROUPS_ORDERED = Object.keys(MINISTRY_HIERARCHY);
    const MINISTRY_GROUPS_NORM = MINISTRY_GROUPS_ORDERED.map(g => [g, normKey(g)]);
    const MINISTRY_LEAVES_NORM = Object.fromEntries(
      MINISTRY_GROUPS_ORDERED.map(g => [normKey(g), (MINISTRY_HIERARCHY[g] || []).map(normKey)])
    );

    const OUTREACH_GROUPS_ORDERED = Object.keys(OUTREACH_HIERARCHY);
    const OUTREACH_GROUPS_NORM = OUTREACH_GROUPS_ORDERED.map(g => [g, normKey(g)]);
    const OUTREACH_LEAVES_NORM = Object.fromEntries(
      OUTREACH_GROUPS_ORDERED.map(g => [normKey(g), (OUTREACH_HIERARCHY[g] || []).map(normKey)])
    );

    const addDays = (d, n) => {
      const x = new Date(d);
      x.setDate(x.getDate() + n);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const toISO = (d) => {
      const pad = n => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const isSunday = (d) => d.getDay() === 0;

    const weekRangeMonToSunForUpcomingSunday = (dateISO) => {
      const d = new Date(dateISO + "T00:00:00");
      d.setHours(0, 0, 0, 0);
      let endSunday;
      if (isSunday(d)) {
        endSunday = d;
      } else {
        const offset = 7 - d.getDay();
        endSunday = addDays(d, offset);
      }
      const startMonday = addDays(endSunday, -6);
      return { startMonday, endSunday };
    };

    let _isComputingReceipts = false;
    let _lastReceiptsAnchor = null;

    let _receiptsComputeSeq = 0;
    let _receiptsComputeAbort = null;

    async function computeSundayWeekTotalsAndRenderCard(anchorDateISO) {
      const seq = ++_receiptsComputeSeq;
      try { _receiptsComputeAbort?.abort(); } catch (_) { }
      const ac = (typeof AbortController !== "undefined") ? new AbortController() : null;
      _receiptsComputeAbort = ac;
      _isComputingReceipts = true;
      _lastReceiptsAnchor = anchorDateISO;

      try {
        computeContextDates(anchorDateISO);
        const dates = Array.isArray(_contextDates) ? _contextDates.slice() : [];

        let sum = 0;
        for (const dayISO of dates) {
          const res = await safeFetchAdmin(`get-offertory-by-date.php?date=${encodeURIComponent(dayISO)}`, ac ? { signal: ac.signal } : {});
          const data = await jsonOrThrow(res);
          const receiptsArr = Array.isArray(data?.receipts)
            ? data.receipts
            : (Array.isArray(data) ? data : []);

          const receiptsSum = receiptsArr.reduce((s, r) => s + (Number(r?.total) || 0), 0);
          const ao = data?.add_offering || {};
          const aoSum = ["tithes", "offering", "pledge", "es", "others", "construction", "samar_leyte"]
            .reduce((s, k) => s + (Number(ao?.[k]) || 0), 0);

          const daySum = receiptsSum + aoSum;
          sum += daySum;
        }
        if (seq !== _receiptsComputeSeq) return;
        if (ac?.signal?.aborted) return;

        _dailyReceiptsTotal = sum;

        const endDate = _contextEnd ? new Date(_contextEnd) : new Date(`${anchorDateISO}T00:00:00`);
        _receiptsCardDayLabel = endDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

        const sundayISO = (_contextEnd instanceof Date)
          ? __bcc_sundayISO(_contextEnd)
          : __bcc_sundayISO(endDate);
        await ensureCashBalancesLoaded(sundayISO);
        const prevISO_cb = __bcc_prevSundayISO(sundayISO);
        await ensureCashBalancesLoaded(prevISO_cb);

      } catch (e) {
        if (e && (e.name === "AbortError" || String(e).includes("AbortError"))) {
          return;
        }
        console.error("computeSundayWeekTotalsAndRenderCard():", e);
        if (seq === _receiptsComputeSeq) _dailyReceiptsTotal = 0;
      } finally {
        if (seq === _receiptsComputeSeq) {
          await renderReceiptsComputedCard();
          _isComputingReceipts = false;
        }
      }
    }

    window.getReceiptsComputedSnapshotsForSundays = async function (sundayISOs) {
      const list = Array.from(new Set((Array.isArray(sundayISOs) ? sundayISOs : []).filter(Boolean)));
      const box = qs("#receiptsComputedContainer");
      if (!list.length || !box) return Object.create(null);

      const prevSelected = selectedOffertoryDate;
      const prevAnchor = _lastReceiptsAnchor || selectedOffertoryDate || list[0];

      const parseAmt = (td) => {
        if (!td) return 0;
        const inp = td.querySelector('input[type="number"]');
        const raw = inp ? inp.value : td.textContent;
        const n = parseFloat(String(raw || "").replace(/,/g, "").trim());
        return Number.isFinite(n) ? n : 0;
      };

      const snapshotBox = () =>
        Array.from(box.querySelectorAll("tr"))
          .map(tr => ({
            label: (tr.querySelector("td:first-child")?.textContent || "").trim(),
            cat: (tr.dataset.cat || "").trim(),
            group: (tr.dataset.group || "").trim(),
            value: parseAmt(tr.querySelector("td.amount"))
          }))
          .filter(row => row.label);

      const waitForCashBalanceRows = async () => {
        const wanted = [
          "Cash Balance, Ending",
          "Cash on Hand",
          "Cash on Construction",
          "Cash on Samar Leyte",
          "COH - Sis Criselda",
          "COH - Anniversary",
          "COH - Sodexo",
          "Cash In bank",
          "PS BANK",
          "BDO-SAVINGS",
          "BDO-CHECKING fr BCC Marikina",
          "BDO-CHECKING Samar Leyte",
          "Samar Leyte",
          "GCASH",
          "For dep of Bro Ronald",
          "Cash for Wellness Program",
          "Cash for Worship Team",
          "Total Cash"
        ];

        const hasWantedRows = () => {
          const rows = Array.from(document.querySelectorAll('#receiptsComputedContainer tr'));
          const labels = rows.map(tr => (tr.querySelector('td:first-child')?.textContent || '').trim());
          return wanted.every(w => labels.includes(w));
        };

        if (hasWantedRows()) {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return;
        }

        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          if (hasWantedRows()) {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return;
          }
        }
      };

      const out = Object.create(null);

      try {
        for (const iso of list) {
          selectedOffertoryDate = iso;

          try { await loadReceiptsForDate(iso); } catch (_) { }
          try { await loadMonthBeginningFor(iso); } catch (_) { }
          try { await loadDailyDisbursements(iso); } catch (_) { }
          try { await computeSundayWeekTotalsAndRenderCard(iso); } catch (_) { }

          await new Promise(resolve =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          );

          await waitForCashBalanceRows();

          out[iso] = snapshotBox();
        }
      } finally {
        if (prevAnchor) {
          selectedOffertoryDate = prevSelected;
          try { await loadReceiptsForDate(prevAnchor); } catch (_) { }
          try { await loadMonthBeginningFor(prevAnchor); } catch (_) { }
          try { await loadDailyDisbursements(prevAnchor); } catch (_) { }
          try { await computeSundayWeekTotalsAndRenderCard(prevAnchor); } catch (_) { }
        }
      }

      return out;
    };

    // ----- Receipts Computed Card -----
    (function addReceiptsComputedControls() {
      const box = document.querySelector('#receiptsComputedContainer');
      if (!box) return;
      if (document.getElementById('rccControls')) return;

      const tableWrap = box.closest('.table-container') || box;
      const host = tableWrap.parentNode;

      let scope = document.getElementById('receiptsComputedScope');
      if (!scope) {
        scope = document.createElement('div');
        scope.id = 'receiptsComputedScope';
        scope.className = 'rcc-scope';
        host.insertBefore(scope, tableWrap);
        scope.appendChild(tableWrap);
      }

      const wrap = document.createElement('div');
      wrap.id = 'rccControls';
      wrap.className = 'rcc-controls-row';
      wrap.style.display = 'none';
      wrap.style.justifyContent = 'space-between';
      wrap.style.width = '100%';
      wrap.style.alignItems = 'center';
      wrap.style.margin = '0 0 6px 0';

      const dateLabel = document.createElement('span');
      dateLabel.id = 'rccSelectedDate';
      dateLabel.className = 'rcc-selected-date';
      dateLabel.style.whiteSpace = 'nowrap';

      const opDate = qs('#selectedDateLabel') || qs('#selectedDate');
      if (opDate && opDate.textContent) dateLabel.textContent = opDate.textContent;

      const actions = document.createElement('span');
      actions.className = 'export-buttons';
      actions.innerHTML = `
    <button id="rccEditBtn">EDIT</button>
    <button id="rccSaveBtn" class="OP-hidden" disabled>SAVE</button>
  `;

      wrap.appendChild(dateLabel);
      wrap.appendChild(actions);
      scope.insertBefore(wrap, scope.firstChild);
    })();

    let _editRCC = false;
    const rccEditBtn = qs("#rccEditBtn");
    const rccSaveBtn = qs("#rccSaveBtn");

    function updateRccButtons() {
      if (!rccEditBtn || !rccSaveBtn) return;
      if (window._editRCC) {
        rccEditBtn.textContent = "CANCEL";
        rccSaveBtn.disabled = false;
        rccSaveBtn.classList.remove("OP-hidden");
        rccSaveBtn.classList.remove("OP-disabled");
      } else {
        rccEditBtn.textContent = "EDIT";
        rccSaveBtn.disabled = true;
        rccSaveBtn.classList.remove("OP-hidden");
        rccSaveBtn.classList.add("OP-disabled");
      }
    }

    if (rccEditBtn) {
      rccEditBtn.onclick = () => {
        if (window._editRCC) {
          if (window._rccDirty) {
            const ok = window.confirm("Are you sure you want to cancel?\nYour changes will not be saved.");
            if (!ok) return;
          }
          window._editRCC = false;
          window._rccDirty = false;
          updateRccButtons();
          renderReceiptsComputedCard();
          return;
        }

        window._rccDirty = false;
        window._editRCC = true;
        updateRccButtons();
        renderReceiptsComputedCard();
      };
    }

    updateRccButtons();

    function updateReceiptsComputedVisibility(dateISO) {
      const isSun = new Date(dateISO + "T00:00:00").getDay() === 0;
      const cont = qs("#receiptsComputedContainer");
      const actions = qs("#receiptsActions");
      const rcc = qs("#rccControls");
      const rccDate = qs("#rccSelectedDate");

      if (cont) cont.style.display = isSun ? "" : "none";
      if (rcc) rcc.style.display = isSun ? "flex" : "none";
      if (rccDate) {
        const formattedDate = new Date(dateISO + "T00:00:00").toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        rccDate.textContent = formattedDate;
      }
      if (actions) actions.style.display = "";
    }

    (() => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const formattedToday = new Date(`${todayISO}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      if (receiptsContainer) receiptsContainer.style.display = "block";
      if (selectedDateEl) selectedDateEl.textContent = formattedToday;
      const rccDateEl = qs('#rccSelectedDate');
      if (rccDateEl) rccDateEl.textContent = formattedToday;
      updateActionButtons();

      updateReceiptsComputedVisibility(todayISO);

      loadMonthBeginningFor(todayISO);
      loadDailyDisbursements(todayISO);
      loadReceiptsForDate(todayISO);

      if (isSunday(new Date(todayISO + "T00:00:00"))) {
        const box = qs("#receiptsComputedContainer");
        if (box) box.style.display = "";
        computeSundayWeekTotalsAndRenderCard(todayISO);
      } else {
        const box = qs("#receiptsComputedContainer");
        if (box) box.style.display = "none";
      }
    })();

    async function renderReceiptsComputedCard() {
      const box = qs("#receiptsComputedContainer");
      if (!box) return;

      // BEGINNING = previous Sunday's TOTAL ENDING BALANCE
      const currSundayISO = (_contextEnd instanceof Date)
        ? __bcc_sundayISO(_contextEnd)
        : __bcc_sundayISO(new Date());

      const carryInfo = await fetchSundayCarryComputation(currSundayISO);
      const prevISO = window.__bcc_prevSundayISO(currSundayISO);
      const beginning = Number(carryInfo.beginning || 0);

      if (window.__bccCarryDebug === true) {
        console.log("[BCC CARRY]", {
          currSundayISO,
          beginningFromBackend: carryInfo.beginning,
          receiptsFromBackend: carryInfo.receipts,
          disbursementsFromBackend: carryInfo.disbursements,
          endingFromBackend: carryInfo.ending,
          liveDailyReceiptsTotal: Number(_dailyReceiptsTotal || 0),
          liveDailyDisbTotal: Number(_dailyDisbTotal || 0)
        });
      }

      let receipts = Number(_dailyReceiptsTotal) || 0;

      try {
        const dateISO = (typeof selectedOffertoryDate === "string") ? selectedOffertoryDate : "";
        const tsr = readTSRFromTable() || {};
        const ovMap = (window._rccOverridesByDate && dateISO) ? (window._rccOverridesByDate[dateISO] || {}) : {};
        const isZeroCents = (x) => Math.round((Number(x) || 0) * 100) === 0;

        const otherLeaves = {
          "One Time Pledge/Offering": tsr.others,
          "Bank Interest/Other Income": null,
          "Pledge Outreach": null,
          "Kids Church": null,
          "Samar Leyte beg 5700": tsr.samar_leyte,
          "Pledge -Worship Team": tsr.construction,
          "Eskwela Suporta": tsr.es,
          "Donation fr Sis Criselda": null,
          "BCC CENTER": null,
          "Donation for Wellness Program": null,
          "Anniversary Pledge/Contibution": null
        };

        for (const k of Object.keys(otherLeaves)) {
          const cur = Number(otherLeaves[k]);
          const hasCur = Number.isFinite(cur) && !isZeroCents(cur);
          if (!hasCur && Object.prototype.hasOwnProperty.call(ovMap, k)) {
            const n = Number(ovMap[k]);
            if (Number.isFinite(n) && !isZeroCents(n)) otherLeaves[k] = n;
          }
        }

        const otherSum = Object.values(otherLeaves).reduce((a, v) => a + (Number(v) || 0), 0);

        const baseMapped =
          (Number(tsr.others) || 0) +
          (Number(tsr.samar_leyte) || 0) +
          (Number(tsr.construction) || 0) +
          (Number(tsr.es) || 0);

        const manualExtra = otherSum - baseMapped;
        if (Number.isFinite(manualExtra)) receipts += manualExtra;

      } catch (e) {
        console.warn("renderReceiptsComputedCard() override-adjust failed:", e);
      }

      const totalAvailable = beginning + receipts;
      const ending = totalAvailable - _dailyDisbTotal;

      __bcc_setEndingBalance(currSundayISO, Number(ending) || 0);

      const cbItems = _cbCache.get(currSundayISO) || [];
      const prevCbItems = _cbCache.get(prevISO) || [];
      const cashBalanceRowsHtml = renderCashBalanceRowsHtml(cbItems, ending, prevCbItems);

      (function leftAlignReceiptsComputedAmounts() {
        const id = "rcc-amount-align-css";
        if (document.getElementById(id)) return;

        const style = document.createElement("style");
        style.id = id;
        style.textContent = `
          /* Amount cell values */
          #receiptsComputedContainer td.amount { text-align: left; }

          /* Override inline right-align on editable inputs inside Amount cells */
          #receiptsComputedContainer td.amount input[type="number"] { text-align: left !important; }
        `;
        document.head.appendChild(style);
      })();

      const rowHTML = (label, val, padPx = 24, strong = false, extraClass = "") => {
        const padVisual = Math.max(0, (padPx | 0));
        const yPadPx = 2;
        const n = Number(val);

        const isZeroCents = (x) => Math.round((Number(x) || 0) * 100) === 0;
        const isReceiptsTotal = /^TOTAL CASH RECEIPTS\b/.test(label);
        const isEndingTotal = label === "TOTAL ENDING BALANCE";

        const hasValue = Number.isFinite(n) && !isZeroCents(n);

        const shouldRenderInput = !!window._editRCC && (
          RCC_EDITABLE_ADMIN_LABELS.has(label) ||
          RCC_OTHER_RECEIPTS_ALWAYS_INPUT_LABELS.has(label) ||
          (RCC_OTHER_RECEIPTS_OVERRIDE_LABELS.has(label) && !hasValue)
        );

        const amountCellHTML = shouldRenderInput

          ? `<input type="number" inputmode="decimal" step="0.01"
            ${hasValue ? `value="${n}"` : ""}
            data-prev="${Number.isFinite(n) ? n : 0}"
            style="width:120px;height:26px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;text-align:right;box-sizing:border-box;">`
          : (hasValue ? fmtNumber(n) : "");

        return `
        <tr class="${extraClass}" data-cat="${window._curCat || ''}" data-group="${window._curGroup || ''}">
          <td style="padding-top:${yPadPx}px;padding-bottom:${yPadPx}px;padding-left:${padVisual}px;${strong ? "font-weight:600;" : ""}">${label}</td>
          <td class="amount" style="padding-top:${yPadPx}px;padding-bottom:${yPadPx}px;">${amountCellHTML}</td>
        </tr>`;
      };

      const _rccSaveBtnEl = qs("#rccSaveBtn");
      if (_rccSaveBtnEl) _rccSaveBtnEl.onclick = async () => {
        if (!window._editRCC) return;

        const container = document.querySelector("#receiptsComputedContainer");
        const saveBtn = document.querySelector("#rccSaveBtn");
        if (!container || !saveBtn) return;

        const prevText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving…";
        saveBtn.classList.add("OP-disabled");

        const restoreSaveBtn = () => {
          if (window._editRCC) {
            saveBtn.textContent = prevText;
            saveBtn.disabled = false;
            saveBtn.classList.remove("OP-disabled");
          } else {
            saveBtn.textContent = "SAVE";
            saveBtn.disabled = true;
            saveBtn.classList.add("OP-disabled");
          }
        };

        const dateISO = typeof selectedOffertoryDate === "string" ? selectedOffertoryDate : "";
        const sundayISO = currSundayISO; // cash balances key
        const inputs = Array.from(container.querySelectorAll('td.amount input[type="number"]'));
        const jobs = [];
        const overrideInputs = Array.from(container.querySelectorAll('tr td.amount input[type="number"]'))
          .filter(inp => {
            const tr = inp.closest("tr");
            const label = (tr?.querySelector("td:first-child")?.textContent || "").trim();
            return RCC_OTHER_RECEIPTS_OVERRIDE_LABELS.has(label);
          });

        const cbItems = [];

        const _rccCents = (x) => Math.round((Number(x) || 0) * 100);
        const _isZeroCents = (x) => _rccCents(x) === 0;

        const _overrideItems = overrideInputs.map((inp) => {
          const tr = inp.closest("tr");
          const label = (tr?.querySelector("td:first-child")?.textContent || "").trim();

          const raw = String(inp.value ?? "").trim();
          if (!raw) return { label, amount: null };

          const v = parseFloat(raw);
          if (!Number.isFinite(v) || _isZeroCents(v)) return { label, amount: null };

          return { label, amount: Math.round(v * 100) / 100 };
        });
        const _rccOverridesDirty =
          !!dateISO &&
          _overrideItems.some((it, idx) => {
            const prev = _rccCents(overrideInputs[idx]?.dataset?.prev ?? 0);
            const curr = _rccCents(it.amount ?? 0);
            return prev !== curr;
          });

        if (_rccOverridesDirty) {
          const body = addCSRF(
            new URLSearchParams({
              date: dateISO,
              items_json: JSON.stringify(_overrideItems),
            })
          );

          jobs.push(
            safeFetchJSON(RCC_SAVE_OVERRIDES_URL, { method: "POST", body }, 10000)
              .then((j) => {
                if (!j.success) throw new Error(j.message || "Overrides save failed");
              })
              .then(() => {
                const cur =
                  (window._rccOverridesByDate && window._rccOverridesByDate[dateISO])
                    ? window._rccOverridesByDate[dateISO]
                    : {};
                for (const it of _overrideItems) {
                  if (!it.label) continue;
                  if (it.amount === null) delete cur[it.label];
                  else cur[it.label] = it.amount;
                }
                window._rccOverridesByDate[dateISO] = cur;
              })
          );
        }


        for (const inp of inputs) {
          const tr = inp.closest("tr");
          if (!tr) continue;

          const cbRow = tr.closest('tr[data-cb="1"]');
          const cbAccountId = cbRow?.getAttribute("data-cb-account-id");
          if (cbAccountId) {
            // Only process once per row (skip the "add" input in split rows)
            if (inp.getAttribute("data-cb-part") === "add") continue;

            const baseInp =
              cbRow.querySelector('input[type="number"][data-cb-part="base"]') ||
              cbRow.querySelector('input[type="number"]:not([data-cb-part])');

            const addInp = cbRow.querySelector('input[type="number"][data-cb-part="add"]');

            const v1 = parseFloat(baseInp?.value || "0");
            const v2 = parseFloat(addInp?.value || "0");
            const p1 = parseFloat(baseInp?.dataset?.prev || "0");
            const p2 = parseFloat(addInp?.dataset?.prev || "0");

            const n1 = round2(Number.isFinite(v1) ? v1 : 0);
            const n2 = round2(Number.isFinite(v2) ? v2 : 0);
            const nCurr = round2(n1 + n2);

            const pp1 = round2(Number.isFinite(p1) ? p1 : 0);
            const pp2 = round2(Number.isFinite(p2) ? p2 : 0);
            const nPrev = round2(pp1 + pp2);

            const leafLabel = (tr.querySelector("td:first-child")?.textContent || "").trim();
            const isSplit = RCC_CB_SPLIT_ROWS.has(normKey(leafLabel));

            if (isSplit) {
              cbItems.push({
                account_id: Number(cbAccountId),
                amount: nCurr,
                preserve_blank: 1
              });
            } else {
              if (_rccCents(nCurr) !== _rccCents(nPrev)) {
                cbItems.push({
                  account_id: Number(cbAccountId),
                  amount: nCurr,
                  preserve_blank: 0
                });
              }
            }

            continue;
          }

          const leaf = (tr.querySelector("td:first-child")?.textContent || "").trim();
          if (RCC_OTHER_RECEIPTS_OVERRIDE_LABELS.has(leaf)) continue;

          const category = (tr.dataset.cat || "").trim();
          const group = (tr.dataset.group || "").trim();

          const catU = (category || "").toUpperCase();
          const leafU = (leaf || "").toUpperCase();
          if (
            catU.startsWith("LESS:") ||
            catU.startsWith("TOTAL ") ||
            catU === "TOTAL DISBURSEMENTS" ||
            catU === "TOTAL CASH AVAILABLE" ||
            catU === "TOTAL ENDING BALANCE" ||
            !leaf || leafU.startsWith("TOTAL ")
          ) continue;

          if (!dateISO || !category || !leaf) continue;

          const curr = Number.parseFloat(inp.value);
          const prev = Number.parseFloat(inp.dataset.prev || "0");
          const nCurr = Number.isFinite(curr) ? curr : 0;
          const nPrev = Number.isFinite(prev) ? prev : 0;
          if (nCurr === nPrev) continue;

          let normalizedLeaf = leaf;
          if (!group && (!leaf || leaf === category)) {
            normalizedLeaf = category;
          }

          const body = addCSRF(new URLSearchParams({
            txn_date: dateISO,
            category: category,
            catalog_subcategory: group,
            subcategory: normalizedLeaf,
            amount: String(nCurr),
          }));

          // When editing a Sunday (weekly) card, allow server-side delete/update to target any matching row in that week.
          if (isSunday && Array.isArray(_contextDates) && _contextDates.length) {
            body.append('scope_dates', _contextDates.join(','));
          }

          jobs.push(
            safeFetchJSON('admin-functions/save-disbursement.php', { method: 'POST', body }, 10000)
              .then(j => { if (!j.success) throw new Error(j.message || 'Save failed'); })
          );
        }

        if (cbItems.length > 0) {
          const body = addCSRF(new URLSearchParams({
            sunday_date: sundayISO,
            items_json: JSON.stringify(cbItems),
          }));

          jobs.push(
            safeFetchJSON(
              CB_SAVE_URL,
              { method: "POST", body },
              10000
            ).then(j => { if (!j.success) throw new Error(j.message || "Cash balance save failed"); })
          );
        }

        if (jobs.length === 0) {
          window._editRCC = false;
          window._rccDirty = false;
          updateRccButtons();
          for (const inp of inputs) {
            const cbRow = inp.closest('tr[data-cb="1"]');
            const cbAccountId = cbRow?.getAttribute("data-cb-account-id");

            if (cbAccountId) {
              if (inp.dataset.cbPart === "add") continue;

              const baseInp =
                cbRow.querySelector('input[type="number"][data-cb-part="base"]') ||
                cbRow.querySelector('input[type="number"]:not([data-cb-part])');
              const addInp = cbRow.querySelector('input[type="number"][data-cb-part="add"]');

              const p1 = parseFloat(baseInp?.dataset.prev || "0");
              const p2 = parseFloat(addInp?.dataset.prev || "0");
              const prevSum = (Number.isFinite(p1) ? p1 : 0) + (Number.isFinite(p2) ? p2 : 0);

              const td = cbRow.querySelector("td.amount");
              if (td) td.textContent = prevSum ? fmtNumber(prevSum) : "";
              continue;
            }

            const n = Number.parseFloat(inp.dataset.prev || "0");
            const td = inp.closest("td.amount");
            if (td) td.textContent = n ? fmtNumber(n) : "";
          }

          recalcCashBalanceComputedRows(container);
          restoreSaveBtn();
          return;
        }

        try {
          await Promise.all(jobs);

          if (cbItems.length > 0) {
            _cbCache.delete(sundayISO);
            const savedItems = await ensureCashBalancesLoaded(sundayISO);

            const nextSundayISO = (() => {
              const d = new Date(`${sundayISO}T00:00:00`);
              d.setDate(d.getDate() + 7);
              const pad = (n) => String(n).padStart(2, "0");
              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            })();

            _cbCache.delete(nextSundayISO);

            const seeded = (Array.isArray(savedItems) ? savedItems : []).map((it) => ({
              ...it,
              amount: (Number(it?.is_input) === 1)
                ? null
                : (it?.amount === null || it?.amount === undefined || String(it?.amount) === ""
                  ? null
                  : (Number(it.amount) || 0)),
            }));

            _cbCache.set(nextSundayISO, seeded);
          }

          for (const inp of inputs) {
            const cbRow = inp.closest('tr[data-cb="1"]');
            const cbAccountId = cbRow?.getAttribute("data-cb-account-id");

            if (cbAccountId) {
              if (inp.dataset.cbPart === "add") continue;

              const baseInp =
                cbRow.querySelector('input[type="number"][data-cb-part="base"]') ||
                cbRow.querySelector('input[type="number"]:not([data-cb-part])');
              const addInp = cbRow.querySelector('input[type="number"][data-cb-part="add"]');

              const v1 = parseFloat(baseInp?.value || "0");
              const v2 = parseFloat(addInp?.value || "0");
              const n1 = Number.isFinite(v1) ? v1 : 0;
              const n2 = Number.isFinite(v2) ? v2 : 0;
              const sum = round2(round2(n1) + round2(n2));

              const sum2 = round2(sum);

              if (baseInp) baseInp.dataset.prev = String(sum2);
              if (addInp) {
                addInp.dataset.prev = "0";
                addInp.value = "";
              }

              const td = cbRow.querySelector("td.amount");
              if (td) td.textContent = sum2 ? fmtNumber(sum2) : "";

              continue;
            }

            const v = parseFloat(inp.value);
            const n = Number.isFinite(v) ? v : 0;
            inp.dataset.prev = String(n);
            const td = inp.closest("td.amount");
            if (td) td.textContent = n ? fmtNumber(n) : "";
          }


          container.dispatchEvent(new Event("input", { bubbles: true }));
          window._editRCC = false;
          window._rccDirty = false;
          recalcCashBalanceComputedRows(container);
          updateRccButtons();

          const ym = dateISO.slice(0, 7);
          if (window._disbItemsByYM && window._disbItemsByYM[ym]) delete window._disbItemsByYM[ym];
          loadDailyDisbursements(dateISO).catch(console.error);
        } catch (err) {
          console.error('RCC save error:', err);
          alert('Save failed. Please try again.');
        } finally {
          restoreSaveBtn();
        }
      };

      window._curGroup = "";
      const categoryRowsHtml = DISB_CATEGORY_ORDER.map(label => {
        window._curCat = label;
        window._curGroup = "";

        const val = (_dailyDisbByCategory && typeof _dailyDisbByCategory[label] === "number")
          ? _dailyDisbByCategory[label] : 0;

        // Administrative Expenses
        if (label === "Administrative Expenses") {
          window._curCat = label;
          const safeGet = (map, name) => (map && typeof map[name] === "number") ? map[name] : 0;

          const directRows = ADMIN_DIRECT_SUBCATS
            .map(name => rowHTML(name, safeGet(_adminDirectBySubcat, name), 34, false, "disb-subcat-row"))
            .join("");

          const otherRows = ADMIN_OTHER_SUBCATS
            .map(name => rowHTML(name, safeGet(_adminOtherBySubcat, name), 34, false, "disb-subcat-row"))
            .join("");

          return [rowHTML(label, val, 0, false, "disb-cat-row admin-cat-row"), directRows, otherRows].join("");
        }

        // Members Assistance
        if (label === "Members Assistance") {
          window._curCat = label;
          const fixedRows = MEMBERS_ASSIST_SUBCATS
            .map(n => rowHTML(n, (_maBySubcat?.[n] ?? 0), 34, false, "disb-subcat-row"))
            .join("");
          const otherRow = (_maOtherAmt && _maOtherAmt !== 0)
            ? rowHTML("Other Assistance", _maOtherAmt, 44, false, "disb-subcat-row")
            : "";
          return [rowHTML(label, val, 0, false, "disb-cat-row members-cat-row"), fixedRows, otherRow].join("");
        }

        // Ministry Expenses (groups + leaves)
        if (label === "Ministry Expenses") {
          window._curCat = label;
          const rows = MINISTRY_GROUPS_ORDERED.map(g => {
            const gVal = _ministryGroupTotals?.[g] ?? 0;
            const groupRowPadMinistry = 34;
            const groupRow = rowHTML(g, gVal, groupRowPadMinistry, false, "disb-subcat-row ministry-group-row");

            window._curGroup = g;
            const leaves = MINISTRY_HIERARCHY[g] || [];
            const leafRows = leaves.map(leaf => {
              const v = _ministryLeafTotals?.[g]?.[leaf] ?? 0;
              return rowHTML(leaf, v, 60, false, ["Miscellaneous Expense", "Repairs & Maintenance Expense", "Representation Expense"].includes(leaf) ? "disb-subcat-row" : "");
            }).join("");
            const out = groupRow + leafRows;
            window._curGroup = "";
            return out;
          }).join("");
          return [rowHTML(label, val, 0, false, "disb-cat-row ministry-cat-row"), rows].join("");
        }

        // Mission Support
        if (label === "Mission Support") {
          window._curCat = label;
          const fixedRows = MISSION_SUPPORT_SUBCATS
            .map(n => rowHTML(n, (_msBySubcat?.[n] ?? 0), 34, false, "disb-subcat-row"))
            .join("");
          const otherRow = (_msOtherAmt && _msOtherAmt !== 0)
            ? rowHTML("Other Mission Support", _msOtherAmt, 44, false, "disb-subcat-row")
            : "";
          return [rowHTML(label, val, 0, false, "disb-cat-row mission-cat-row"), fixedRows, otherRow].join("");
        }

        // Outreach Support (groups + leaves)
        if (label === "Outreach Support") {
          window._curCat = label;
          const rows = OUTREACH_GROUPS_ORDERED.map(g => {
            const gVal = _outreachGroupTotals?.[g] ?? 0;
            const groupRowPadOutreach = 34;
            const groupRow = rowHTML(g, gVal, groupRowPadOutreach, false, "disb-subcat-row outreach-group-row");

            window._curGroup = g;
            const leaves = OUTREACH_HIERARCHY[g] || [];
            const leafRows = leaves.map(leaf => {
              const v = _outreachLeafTotals?.[g]?.[leaf] ?? 0;
              return rowHTML(leaf, v, 60, false, ["Miscellaneous Expense", "Repairs & Maintenance Expense", "Representation Expense"].includes(leaf) ? "disb-subcat-row" : "");
            }).join("");
            const out = groupRow + leafRows;
            window._curGroup = "";
            return out;
          }).join("");
          return [
            rowHTML(label, val, 0, false, "disb-cat-row outreach-cat-row"), rows].join("");
        }

        // Pastoral Ministry Expenses
        if (label === "Pastoral Ministry Expenses") {
          window._curCat = label;
          const fixedRows = PASTORAL_MINISTRY_SUBCATS
            .map(n => rowHTML(n, (_pmBySubcat?.[n] ?? 0), 34, false, "disb-subcat-row"))
            .join("");
          const otherRow = (_pmOtherAmt && _pmOtherAmt !== 0)
            ? rowHTML("Other Pastoral Ministry", _pmOtherAmt, 44, false, "disb-subcat-row")
            : "";
          return [rowHTML(label, val, 0, false, "disb-cat-row pastoral-cat-row"), fixedRows, otherRow].join("");
        }

        if (label === "Supplies Expenses") {
          window._curCat = label;
          const sumDirect = SUPPLIES_DIRECT_SUBCATS.reduce(
            (acc, n) => acc + (parseFloat(_supBySubcat?.[n]) || 0),
            0
          );

          const directRows = SUPPLIES_DIRECT_SUBCATS
            .map(n => rowHTML(n, (_supBySubcat?.[n] ?? 0), 34, false, "disb-subcat-row"))
            .join("");

          const otherRows = SUPPLIES_OTHER_SUBCATS
            .map(n => rowHTML(n, (_supBySubcat?.[n] ?? 0), 34, false, "disb-subcat-row"))
            .join("");

          const sumOthers = SUPPLIES_OTHER_SUBCATS.reduce(
            (acc, n) => acc + (parseFloat(_supBySubcat?.[n]) || 0),
            0
          );
          const suppliesSectionTotal = sumDirect + sumOthers;

          return [rowHTML(label, suppliesSectionTotal, 0, false, "disb-cat-row supplies-cat-row"), directRows, otherRows].join("");
        }

        return rowHTML(label, val, 0, false, "disb-cat-row");

      }).join("");

      const receiptsRowLabel = _receiptsCardDayLabel
        ? `TOTAL CASH RECEIPTS (${_receiptsCardDayLabel})`
        : `TOTAL CASH RECEIPTS (DAY)`;

      {
        const startStr = _contextStart ? _contextStart.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown";
        const endStr = _contextEnd ? _contextEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown";
        var ctxHint = `<div style="font-size:11px;margin:4px 0 0 0;opacity:.75;">Week covered: ${startStr} - ${endStr}</div>`;
      }

      box.innerHTML = `
        <table>
          <thead><tr><th>Computed</th><th>Amount</th></tr></thead>
          <tbody>
            ${rowHTML("CASH BALANCE BEGINNING", beginning, 0, false, "rcc-begin")}
            ${typeof renderAddReceiptsBlockSync === "function" ? renderAddReceiptsBlockSync(rowHTML) : ""}
            ${rowHTML(receiptsRowLabel, receipts, 0, false, "rcc-total-receipts")}
            ${rowHTML("TOTAL CASH AVAILABLE", totalAvailable, 0, true, "rcc-total-available rcc-gap")}
            ${rowHTML("LESS: DISBURSEMENTS", "", 0, false, "rcc-gap")}
            ${categoryRowsHtml}

            ${rowHTML("TOTAL DISBURSEMENTS", _dailyDisbTotal, 0, true, "disb-total-row rcc-gap")}
            ${rowHTML("TOTAL ENDING BALANCE", ending, 0, true, "rcc-ending rcc-gap")}
            ${cashBalanceRowsHtml}
          </tbody>
        </table>
        ${ctxHint}
      `;

      {
        const container = box;

        // Install once
        if (!container._rccSumWired) {
          container.addEventListener("input", (ev) => {
            const t = ev.target;
            if (!t || t.tagName !== "INPUT" || t.type !== "number") return;
            if (window._editRCC) window._rccDirty = true;

            (function () {
              const otherLeafLabels = Array.from(RCC_OTHER_RECEIPTS_OVERRIDE_LABELS);
              const readRowValueByLabel = (label) => {
                const trs = Array.from(container.querySelectorAll("tr"));
                const tr = trs.find(r => ((r.querySelector("td:first-child")?.textContent || "").trim() === label));
                if (!tr) return 0;
                const inp = tr.querySelector('td.amount input[type="number"]');
                if (inp) {
                  const v = parseFloat(inp.value);
                  return Number.isFinite(v) ? v : 0;
                }
                const txt = (tr.querySelector("td.amount")?.textContent || "").replace(/,/g, "");
                const v = parseFloat(txt);
                return Number.isFinite(v) ? v : 0;
              };
              const otherLeavesSum = otherLeafLabels.reduce((a, lbl) => a + readRowValueByLabel(lbl), 0);

              {
                const tr = Array.from(container.querySelectorAll("tr"))
                  .find(r => ((r.querySelector("td:first-child")?.textContent || "").trim() === "OTHER RECEIPTS"));
                const cell = tr?.querySelector("td.amount");
                if (cell) cell.textContent = otherLeavesSum ? fmtNumber(otherLeavesSum) : "";
              }

              const tsr = readTSRFromTable() || {};
              const baseMapped = (Number(tsr.others) || 0) + (Number(tsr.samar_leyte) || 0) + (Number(tsr.construction) || 0) + (Number(tsr.es) || 0);
              const manualExtra = otherLeavesSum - baseMapped;

              const receiptsLive = (Number(_dailyReceiptsTotal) || 0) + (Number.isFinite(manualExtra) ? manualExtra : 0);

              {

                const tr = container.querySelector("tr.rcc-total-receipts");
                const cell = tr?.querySelector("td.amount");
                if (cell) cell.textContent = receiptsLive ? fmtNumber(receiptsLive) : "";
              }

              // Update TOTAL CASH AVAILABLE (Beginning + receiptsLive)
              {
                const beginTr = container.querySelector("tr.rcc-begin");
                const beginTxt = (beginTr?.querySelector("td.amount")?.textContent || "").replace(/,/g, "");
                const beginVal = parseFloat(beginTxt);
                const beginning = Number.isFinite(beginVal) ? beginVal : 0;

                const totalAvail = beginning + receiptsLive;
                const tr = container.querySelector("tr.rcc-total-available");
                const cell = tr?.querySelector("td.amount");
                if (cell) cell.textContent = totalAvail ? fmtNumber(totalAvail) : "";
              }
            })();

            /* --- Administrative */
            {
              const adminHeader = container.querySelector("tr.admin-cat-row");
              let adminSum = 0;

              if (adminHeader) {
                for (let tr = adminHeader.nextElementSibling;
                  tr && !tr.classList.contains("disb-cat-row");
                  tr = tr.nextElementSibling) {
                  const label = (tr.querySelector("td:first-child")?.textContent || "").trim();
                  if (!ADMIN_DIRECT_SUBCATS.includes(label)) continue;

                  const input = tr.querySelector('td.amount input[type="number"]');
                  let v;
                  if (input) {
                    v = parseFloat(input.value);
                  } else {
                    const txt = (tr.querySelector("td.amount")?.textContent || "").replace(/,/g, "");
                    v = parseFloat(txt);
                  }
                  if (Number.isFinite(v)) adminSum += v;
                }

                const adminCell = adminHeader.querySelector("td.amount");
                if (adminCell) adminCell.textContent = adminSum ? fmtNumber(adminSum) : "";
              }
            }

            // --- Members Assistance (NEW) ---
            const membersLabels = new Set([
              "Financial Assistance",
              "Funeral Assistance",
              "Educational Assistance",
            ]);
            let membersSum = 0;
            container.querySelectorAll("tr").forEach((tr) => {
              const label = (tr.querySelector("td:first-child")?.textContent || "").trim();
              if (!membersLabels.has(label)) return;
              const input = tr.querySelector('td.amount input[type="number"]');
              if (input) {
                const v = parseFloat(input.value);
                if (Number.isFinite(v)) membersSum += v;
              } else {
                const txt = (tr.querySelector("td.amount")?.textContent || "").replace(/,/g, "");
                const v = parseFloat(txt);
                if (Number.isFinite(v)) membersSum += v;
              }
            });
            const membersCell = container.querySelector("tr.members-cat-row td.amount");
            if (membersCell) membersCell.textContent = membersSum ? fmtNumber(membersSum) : "";

            /* === Ministry Expenses === */
            (function () {
              const headerGroups = new Set([
                "Worship Ministry",
                "Sunday School",
                "Worker's meeting",
                "Buso Buso",
                "ALS",
                "Timothites",
                "VOICE",
              ]);

              const readRowValue = (tr) => {
                const inp = tr.querySelector('td.amount input[type="number"]');
                if (inp) {
                  const v = parseFloat(inp.value);
                  return Number.isFinite(v) ? v : 0;
                }
                const txt = (tr.querySelector("td.amount")?.textContent || "").replace(/,/g, "");
                const v = parseFloat(txt);
                return Number.isFinite(v) ? v : 0;
              };

              let ministryHeaderSum = 0;

              const groupRows = Array.from(container.querySelectorAll("tr.ministry-group-row"));
              groupRows.forEach((groupRow) => {
                const groupName = (groupRow.querySelector("td:first-child")?.textContent || "").trim();

                let groupSum = 0;
                for (let tr = groupRow.nextElementSibling;
                  tr && !tr.classList.contains("ministry-group-row") && !tr.classList.contains("disb-cat-row");
                  tr = tr.nextElementSibling) {
                  const lbl = (tr.querySelector("td:first-child")?.textContent || "").trim();
                  if (lbl.toUpperCase().startsWith("TOTAL ")) continue;

                  groupSum += readRowValue(tr);
                }

                const cell = groupRow.querySelector("td.amount");
                if (cell) cell.textContent = groupSum ? fmtNumber(groupSum) : "";

                if (headerGroups.has(groupName)) {
                  ministryHeaderSum += groupSum;
                }
              });

              const hdrCell = container.querySelector("tr.ministry-cat-row td.amount");
              if (hdrCell) hdrCell.textContent = ministryHeaderSum ? fmtNumber(ministryHeaderSum) : "";
            })();

            /* === Mission Support === */
            (function () {
              const header = container.querySelector("tr.mission-cat-row");
              if (!header) return;

              const msLabels = new Set([
                "Mission Support - Ptr M",
                "Love Gift-Ptr A & Sis Neneng",
                "Love Gift - Sis Criselda",
              ]);

              const readRowValue = (tr) => {
                const inp = tr.querySelector('td.amount input[type="number"]');
                if (inp) {
                  const v = parseFloat(inp.value);
                  return Number.isFinite(v) ? v : 0;
                }
                const txt = (tr.querySelector("td.amount")?.textContent || "").replace(/,/g, "");
                const v = parseFloat(txt);
                return Number.isFinite(v) ? v : 0;
              };

              let sum = 0;
              for (let tr = header.nextElementSibling;
                tr && !tr.classList.contains("disb-cat-row");
                tr = tr.nextElementSibling) {
                const label = (tr.querySelector("td:first-child")?.textContent || "").trim();
                if (!msLabels.has(label)) continue;
                sum += readRowValue(tr);
              }

              const targetCell = header.querySelector("td.amount");
              if (targetCell) targetCell.textContent = sum ? fmtNumber(sum) : "";
            })();

            /* === Outreach Support === */
            (function () {
              const header = container.querySelector("tr.outreach-cat-row");
              if (!header) return;

              const headerGroups = new Set([
                "Maly Outreach",
                "Burgos Outreach",
                "Guinayang Outreach",
                "Parang. Marikina Outreach",
                "Banaba & Moises Outreach",
                "Samar Leyte Outreach",
                "Manggahan Outreach"
              ]);

              const EXCLUDE_LABELS = new Set([
                "Repairs & Maintenance Expense",
                "Representation Expense",
              ]);

              const readRowValue = (tr) => {
                const inp = tr.querySelector('td.amount input[type="number"]');
                if (inp) {
                  const v = parseFloat(inp.value);
                  return Number.isFinite(v) ? v : 0;
                }
                const txt = (tr.querySelector("td.amount")?.textContent || "").replace(/,/g, "");
                const v = parseFloat(txt);
                return Number.isFinite(v) ? v : 0;
              };

              let outreachHeaderSum = 0;

              const groupRows = Array.from(container.querySelectorAll("tr.outreach-group-row"));
              groupRows.forEach((groupRow) => {
                const groupName = (groupRow.querySelector("td:first-child")?.textContent || "").trim();

                let groupSum = 0;
                for (let tr = groupRow.nextElementSibling;
                  tr && !tr.classList.contains("outreach-group-row") && !tr.classList.contains("disb-cat-row");
                  tr = tr.nextElementSibling) {
                  const lbl = (tr.querySelector("td:first-child")?.textContent || "").trim();
                  if (lbl.toUpperCase().startsWith("TOTAL ")) continue;
                  if (EXCLUDE_LABELS.has(lbl)) continue;
                  groupSum += readRowValue(tr);
                }

                const cell = groupRow.querySelector("td.amount");
                if (cell) cell.textContent = groupSum ? fmtNumber(groupSum) : "";

                if (headerGroups.has(groupName)) {
                  outreachHeaderSum += groupSum;
                }
              });

              const hdrCell = header.querySelector("td.amount");
              if (hdrCell) hdrCell.textContent = outreachHeaderSum ? fmtNumber(outreachHeaderSum) : "";
            })();

            /* === Pastoral Ministry Expenses === */
            (function () {
              const header = container.querySelector("tr.pastoral-cat-row");
              if (!header) return;

              const INCLUDE = new Set(["Transportation", "Food"]);

              const readRowValue = (tr) => {
                const inp = tr.querySelector('td.amount input[type="number"]');
                if (inp) {
                  const v = parseFloat(inp.value);
                  return Number.isFinite(v) ? v : 0;
                }
                const txt = (tr.querySelector("td.amount")?.textContent || "").replace(/,/g, "");
                const v = parseFloat(txt);
                return Number.isFinite(v) ? v : 0;
              };

              let sum = 0;
              for (let tr = header.nextElementSibling;
                tr && !tr.classList.contains("disb-cat-row");
                tr = tr.nextElementSibling) {
                const label = (tr.querySelector("td:first-child")?.textContent || "").trim();
                if (!INCLUDE.has(label)) continue;
                sum += readRowValue(tr);
              }

              const targetCell = header.querySelector("td.amount");
              if (targetCell) targetCell.textContent = sum ? fmtNumber(sum) : "";
            })();

            /* === Supplies Expenses === */
            (function () {
              const header = container.querySelector("tr.supplies-cat-row");
              if (!header) return;

              const INCLUDE = new Set(["Office Supplies Expense", "Cleaning Materials"]);

              const readRowValue = (tr) => {
                const inp = tr.querySelector('td.amount input[type="number"]');
                if (inp) {
                  const v = parseFloat(inp.value);
                  return Number.isFinite(v) ? v : 0;
                }
                const txt = (tr.querySelector("td.amount")?.textContent || "").replace(/,/g, "");
                const v = parseFloat(txt);
                return Number.isFinite(v) ? v : 0;
              };

              let sum = 0;
              for (let tr = header.nextElementSibling;
                tr && !tr.classList.contains("disb-cat-row");
                tr = tr.nextElementSibling) {
                const label = (tr.querySelector("td:first-child")?.textContent || "").trim();
                if (!INCLUDE.has(label)) continue;
                sum += readRowValue(tr);
              }

              const cell = header.querySelector("td.amount");
              if (cell) cell.textContent = sum ? fmtNumber(sum) : "";
            })();

            (function () {
              const container = box; // #receiptsComputedContainer
              const totalRow = container.querySelector("tr.disb-total-row td.amount");
              if (!totalRow) return;

              // Helper: read number from a row (input in edit mode, else formatted text)
              const readRowValue = (tr) => {
                const inp = tr.querySelector('td.amount input[type="number"]');
                if (inp) {
                  const v = parseFloat(inp.value);
                  return Number.isFinite(v) ? v : 0;
                }
                const txt = (tr.querySelector("td.amount")?.textContent || "").replace(/,/g, "");
                const v = parseFloat(txt);
                return Number.isFinite(v) ? v : 0;
              };

              const DISB_TOTAL_CATEGORIES = [
                "Administrative Expenses",
                "BCC Center Contribution",
                "BOT Share",
                "BHC Share",
                "Church Activity Expenses",
                "Insurance Expense",
                "Legal & Compliance Expenses",
                "Members Assistance",
                "Ministry Expenses",
                "Miscellaneous Expense",
                "Mission Support",
                "Outreach Support",
                "Repairs & Maintenance Expense",
                "Representation Expense",
                "Pastoral Ministry Expenses",
                "Supplies Expenses",
                "Taxes & Licenses",
                "Training, Convention, and Seminar Expenses",
                "Transportation Expense",
                "Utilities Expense",
                "Land and Buildings & Bldq. Equipment",
                "Furniture & Fixtures",
                "Music Instruments and Sound Equipment",
                "Computer Equipment",
                "Meralco Upgrade",
                "Other Assets",
                "Advances (Bro Onad)",
                "Over/Short",
                "Advances from Samar Leyte",
                "Advances from Gemma (Utilities)"
              ];

              let sum = 0;

              for (const label of DISB_TOTAL_CATEGORIES) {
                const tr = Array.from(container.querySelectorAll("tr.disb-cat-row")).find((row) => {
                  const txt = (row.querySelector("td:first-child")?.textContent || "").trim();
                  return txt === label;
                });
                if (tr) sum += readRowValue(tr);
              }

              totalRow.textContent = sum ? fmtNumber(sum) : "";
            })();

            (function () {
              const container = box;
              const availCell = container.querySelector("tr.rcc-total-available td.amount");
              const disbCell = container.querySelector("tr.disb-total-row td.amount");
              const endingCell = container.querySelector("tr.rcc-ending td.amount");
              if (!availCell || !disbCell || !endingCell) return;

              const parseNum = (cell) => {
                const inp = cell.querySelector('input[type="number"]');
                if (inp) {
                  const v = parseFloat(inp.value);
                  return Number.isFinite(v) ? v : 0;
                }
                const txt = (cell.textContent || "").replace(/,/g, "");
                const v = parseFloat(txt);
                return Number.isFinite(v) ? v : 0;
              };

              const totalAvailable = parseNum(availCell);
              const totalDisb = parseNum(disbCell);
              const ending = totalAvailable - totalDisb;

              const isZeroCents = (x) => Math.round((Number(x) || 0) * 100) === 0;
              endingCell.textContent =
                Number.isFinite(ending) && !isZeroCents(ending) ? fmtNumber(ending) : "";
            })();
            recalcCashBalanceComputedRows(container);
          });

          container._rccSumWired = true;
        }

        (function _initRccSums() {
          const first = container.querySelector('td.amount input[type="number"]');
          if (first) first.dispatchEvent(new Event("input", { bubbles: true }));
          else container.dispatchEvent(new Event("input", { bubbles: true }));
          recalcCashBalanceComputedRows(container);
        })();
      }
    }

    var _contextStart = null;
    var _contextEnd = null;

    function computeContextDates(dateISO) {
      const d = new Date(`${dateISO}T00:00:00`);
      d.setHours(0, 0, 0, 0);
      const nextSunday = new Date(d);
      const daysToNextSunday = (7 - d.getDay()) % 7;
      nextSunday.setDate(d.getDate() + daysToNextSunday);
      const endSunday = nextSunday;
      const startMonday = new Date(nextSunday);
      startMonday.setDate(nextSunday.getDate() - 6);

      _contextStart = startMonday;
      _contextEnd = endSunday;

      const days = [];
      for (let dt = new Date(startMonday); dt <= endSunday; dt.setDate(dt.getDate() + 1)) {
        days.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
      }
      _contextDates = days;
    }

    function ensureReceiptsTFoot() {
      const table = document.querySelector("#receiptsTable");
      if (!table) return null;
      if (!table.tFoot) {
        const tf = document.createElement("tfoot");
        table.appendChild(tf);
      }
      return table.tFoot;
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      selectable: true,
      height: 'auto',
      validRange: {
        end: tomorrowISO,
      },
      eventContent: function (info) {
        const dot = document.createElement("span");
        dot.classList.add("offertory-dot");
        return { domNodes: [dot] };
      },

      eventClick: (info) => {
        const clicked = new Date(info.event.start);
        if (clicked > today) return;

        const dateISO = info.event.start.toISOString().split('T')[0];
        handleDateClick(dateISO, null);
        updateReceiptsComputedVisibility(dateISO);

        if (clicked.getDay() === 0) {
          computeSundayWeekTotalsAndRenderCard(dateISO);
        }
      },

      select: (info) => {
        const clicked = new Date(info.startStr);
        if (clicked > today) return;

        const dateISO = info.startStr;
        handleDateClick(dateISO, null);
        updateReceiptsComputedVisibility(dateISO);

        if (clicked.getDay() === 0) {
          computeSundayWeekTotalsAndRenderCard(dateISO);
        }
      },

      datesSet: (info) => {
        const midTime = info.start.getTime() + (info.end.getTime() - info.start.getTime()) / 2;
        const midDate = new Date(midTime);
        const currentMonth = midDate.getMonth() + 1;
        const currentYear = midDate.getFullYear();

        safeFetch("admin-functions/update-offertory-monthly-totals.php", {
          method: "POST",
          body: addCSRF(new URLSearchParams({
            month: String(currentMonth),
            year: String(currentYear)
          }))
        }).catch((err) => {
          console.error("Failed to update offertory monthly totals (calendar view):", err);
        });
      },

      dateClick: (info) => {
        const clicked = new Date(info.dateStr + "T00:00:00");
        if (clicked > today) return;

        handleDateClick(info.dateStr, info.dayEl);

        if (isSunday(clicked)) {
          const box = qs("#receiptsComputedContainer");
          if (box) box.style.display = "";
          computeSundayWeekTotalsAndRenderCard(info.dateStr);
        } else {
          const box = qs("#receiptsComputedContainer");
          if (box) box.style.display = "none";
        }
      }
    });

    // Load red-dot events from daily totals table
    async function loadOffertoryDots() {
      try {
        const res = await safeFetch("admin-functions/get-offertory-daily-totals.php");
        const data = await jsonOrThrow(res);

        if (!data || !data.success || !Array.isArray(data.totals)) {
          console.warn("No offertory daily totals found for dots.");
          return;
        }

        const events = data.totals
          .filter(row => {
            const total = parseFloat(row.total ?? 0);
            return Number.isFinite(total) && total > 0;
          })
          .map(row => ({
            start: row.date,
            allDay: true
          }));

        // Clear old events and set new ones
        calendar.removeAllEvents();
        calendar.addEventSource(events);
      } catch (err) {
        console.error("Failed to load offertory dots:", err);
      }
    }

    function handleDateChange(iso) {
      const selectedDateEl = qs("#selectedDateLabel");
      const formattedDate = new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (selectedDateEl) selectedDateEl.textContent = formattedDate;
      const rccDateEl = qs('#rccSelectedDate');
      if (rccDateEl) rccDateEl.textContent = formattedDate;
      updateReceiptsComputedVisibility(iso);
      updateActionButtons();

      loadReceiptsForDate(iso);
      loadMonthBeginningFor(iso);
      loadDailyDisbursements(iso);

      const clicked = new Date(iso);

      safeFetch("admin-functions/update-offertory-monthly-totals.php", {
        method: "POST",
        body: addCSRF(new URLSearchParams({
          month: String(clicked.getMonth() + 1),
          year: String(clicked.getFullYear())
        }))
      }).catch((err) => {
        console.error("Failed to update offertory monthly totals (day click):", err);
      });
    }

    loadOffertoryDots();
    calendar.render();
    requestAnimationFrame(updateSundayOnlyExportOptions);

    let lastSelectedCell = null;
    on(calendarEl, "mouseover", (e) => {
      const cell = e.target.closest(".fc-daygrid-day");
      if (!cell) return;
      cell.classList.add("OP-hover");
    });
    on(calendarEl, "mouseout", (e) => {
      const cell = e.target.closest(".fc-daygrid-day");
      if (!cell) return;
      cell.classList.remove("OP-hover");
    });

    const handleDateClick = (iso, dayEl) => {
      selectedOffertoryDate = iso;
      updateSundayOnlyExportOptions();

      if (lastSelectedCell) lastSelectedCell.classList.remove("OP-selected-date");
      if (dayEl) dayEl.classList.add("OP-selected-date");
      lastSelectedCell = dayEl || null;

      const formattedDate = new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      if (selectedDateEl) selectedDateEl.textContent = formattedDate;
      const rccDateEl = qs('#rccSelectedDate');
      if (rccDateEl) rccDateEl.textContent = formattedDate;
      updateReceiptsComputedVisibility(iso);
      updateActionButtons();

      loadReceiptsForDate(iso);
      loadMonthBeginningFor(iso);
      loadDailyDisbursements(iso);

      const clicked = new Date(iso);
      safeFetch("admin-functions/update-offertory-monthly-totals.php", {
        method: "POST",
        body: addCSRF(
          new URLSearchParams({
            month: String(clicked.getMonth() + 1),
            year: String(clicked.getFullYear())
          })
        )
      }).catch((err) => {
        console.error("Failed to update offertory monthly totals (day click):", err);
      });
    };

    async function loadReceiptsForDate(dateISO) {
      try {
        const fetchAndNormalize = async (url) => {
          const res = await safeFetch(url);
          const ct = res.headers.get("content-type") || "";
          const text = await res.text();
          let raw;
          try { raw = JSON.parse(text); } catch { raw = []; }
          let rows = [];
          if (Array.isArray(raw)) rows = raw;
          else if (Array.isArray(raw?.data)) rows = raw.data;
          else if (Array.isArray(raw?.items)) rows = raw.items;
          else if (Array.isArray(raw?.receipts)) rows = raw.receipts;
          return { rows, raw, ct };
        };

        let { rows, raw } = await fetchAndNormalize(`admin-functions/get-offertory-by-date.php?date=${encodeURIComponent(dateISO)}`);

        // Pull persisted ADD: OFFERING for this date (if provided)
        if (raw && typeof raw === "object" && raw.add_offering) {
          const ao = raw.add_offering || {};
          _addOffering = {
            tithes: Number(ao.tithes) || 0,
            offering: Number(ao.offering) || 0,
            pledge: Number(ao.pledge) || 0,
            es: Number(ao.es) || 0,
            others: Number(ao.others) || 0,
            construction: Number(ao.construction) || 0,
            samar_leyte: Number(ao.samar_leyte) || 0,
          };
        } else {
          _addOffering = { tithes: 0, offering: 0, pledge: 0, es: 0, others: 0, construction: 0, samar_leyte: 0 };
        }

        // Pull persisted Receipts Computed overrides
        if (raw && typeof raw === "object" && raw.receipts_computed_overrides && typeof raw.receipts_computed_overrides === "object") {
          window._rccOverridesByDate[dateISO] = raw.receipts_computed_overrides || {};
        } else if (!window._rccOverridesByDate[dateISO]) {
          window._rccOverridesByDate[dateISO] = {};
        }

        const selectedDate = new Date(dateISO + "T00:00:00");
        if (isSunday(selectedDate)) {
          const { startMonday, endSunday } = weekRangeMonToSunForUpcomingSunday(dateISO);
          const extraRows = [];

          for (let dt = new Date(startMonday); dt < endSunday; dt = addDays(dt, 1)) {
            const dayISO = toISO(dt);
            if (dayISO === dateISO) continue;

            const { rows: dayRows } = await fetchAndNormalize(
              `admin-functions/get-offertory-by-date.php?date=${encodeURIComponent(dayISO)}`
            );

            if (Array.isArray(dayRows) && dayRows.length) {
              dayRows.forEach(r => {
                extraRows.push({ ...r, _weekImported: true });
              });
            }
          }

          if (extraRows.length) {
            rows = rows.concat(extraRows);
          }
        }

        if (!rows.length) {
          const aoCell = (key) => {
            const val = parseFloat(_addOffering[key] || 0) || 0;
            if (_editAO) {
              const n = parseFloat(val);
              const hasValue = Number.isFinite(n) && n > 0;
              const valueAttr = hasValue ? ` value="${n}"` : "";
              return `<input class="add-offering" data-col="${key}" type="number" step="0.01" min="0"${valueAttr}
               style="width:90px;min-width:90px;max-width:90px;height:28px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;text-align:right;box-sizing:border-box;">`;
            }
            return val > 0 ? fmtNumber(val) : "";
          };
          const aoSum =
            (_addOffering.tithes || 0) + (_addOffering.offering || 0) + (_addOffering.pledge || 0) +
            (_addOffering.es || 0) + (_addOffering.others || 0) + (_addOffering.construction || 0) + (_addOffering.samar_leyte || 0);

          const tsrNoTithes = (_addOffering.tithes || 0);
          const tsrNoOffering = (_addOffering.offering || 0);
          const tsrNoPledge = (_addOffering.pledge || 0);
          const tsrNoES = (_addOffering.es || 0);
          const tsrNoOthers = (_addOffering.others || 0);
          const tsrNoConstruction = (_addOffering.construction || 0);
          const tsrNoSamarLeyte = (_addOffering.samar_leyte || 0);
          const tsrNoOverall = aoSum;

          receiptsTableBody.innerHTML = `
            <tr class="receipt-empty"><td colspan="13">No receipts found.</td></tr>
          `;
          if (_editAO) {
            receiptsTableBody.insertBefore(buildAddActionRow(), receiptsTableBody.firstChild);
          }

          const tfoot = ensureReceiptsTFoot();
          if (tfoot) {
            tfoot.innerHTML = `
              <tr class="receipt-meta">
                <td colspan="4"><strong>TOTAL COLLECTION</strong></td>
                <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                <td></td><td></td>
              </tr>
              <tr class="receipt-meta">
                <td colspan="4"><strong>ADD: OFFERING</strong></td>
                <td>${aoCell("tithes")}</td>
                <td>${aoCell("offering")}</td>
                <td>${aoCell("pledge")}</td>
                <td>${aoCell("es")}</td>
                <td>${aoCell("others")}</td>
                <td>${aoCell("construction")}</td>
                <td>${aoCell("samar_leyte")}</td>
                <td>${_editAO ? "" : fmtNumber(aoSum)}</td>
                <td></td>
              </tr>
              <tr class="receipt-meta">
                <td colspan="4"><strong>TOTAL SOURCES OF REVENUE</strong></td>
                <td>${fmtNumber(tsrNoTithes)}</td>
                <td>${fmtNumber(tsrNoOffering)}</td>
                <td>${fmtNumber(tsrNoPledge)}</td>
                <td>${fmtNumber(tsrNoES)}</td>
                <td>${fmtNumber(tsrNoOthers)}</td>
                <td>${fmtNumber(tsrNoConstruction)}</td>
                <td>${fmtNumber(tsrNoSamarLeyte)}</td>
                <td>${fmtNumber(tsrNoOverall)}</td>
                <td></td>
              </tr>
            `;
          }

          applyReceiptsColumnSizing();
          recalcReceiptsMetaRows();
          return;
        }

        const moneyInput = (key, val, rowIndex) => {
          const n = parseFloat(val);
          const hasValue = Number.isFinite(n) && n > 0;
          const valueAttr = hasValue ? ` value="${n}"` : "";
          return `
            <input
              class="receipt-edit"
              data-row="${rowIndex}"
              data-col="${key}"
              type="number"
              step="0.01"
              min="0"${valueAttr}
              style="width:100%;height:28px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;text-align:right;box-sizing:border-box;"
            >
          `;
        };

        const resolveId = (r) =>
          (r.id ?? r.receipt_id ?? r.receiptID ?? r.offertory_id ?? r.offertoryId ?? r.ID ?? r.Id ?? '');

        const resolveName = (r) =>
          (r.name ?? r.username ?? r.member_name ?? r.visitor_name ?? '').toString();

        const baseRows = rows.map((row, i) => {
          const rid = String(resolveId(row)).trim();
          const rname = resolveName(row);
          const extraClass = row._weekImported ? " receipt-week-import" : "";
          const receiptType = (row.type || "Single").toString();
          const modeOfOffertory = String(row.mode_of_offertory || "Cash").trim();

          const proofImage = String(row.bank_proof_image || "").trim();
          const modeCellHtml =
            modeOfOffertory === "Bank" && proofImage
              ? `<span class="bank-proof-cell" data-proof-image="${escapeHtml(proofImage)}" data-proof-name="${escapeHtml(rname || '')}">Bank</span>`
              : escapeHtml(modeOfOffertory);

          return `
            <tr class="receipt-row${extraClass}" data-id="${rid}" data-name="${(rname || '').replace(/"/g, '&quot;')}">
              <td>${rname || ''}</td>
              <td>${row.role || 'Visitor'}</td>
              <td>${receiptType}</td>
              <td>${modeCellHtml}</td>

              <td>${_editAO ? moneyInput("tithes", row.tithes, i) : (parseFloat(row.tithes) > 0 ? fmtNumber(row.tithes) : "")}</td>
              <td>${_editAO ? moneyInput("offering", row.offering, i) : (parseFloat(row.offering) > 0 ? fmtNumber(row.offering) : "")}</td>
              <td>${_editAO ? moneyInput("pledge", row.pledge, i) : (parseFloat(row.pledge) > 0 ? fmtNumber(row.pledge) : "")}</td>
              <td>${_editAO ? moneyInput("es", row.es, i) : (parseFloat(row.es) > 0 ? fmtNumber(row.es) : "")}</td>
              <td>${_editAO ? moneyInput("others", row.others, i) : (parseFloat(row.others) > 0 ? fmtNumber(row.others) : "")}</td>
              <td>${_editAO ? moneyInput("construction", row.construction, i) : (parseFloat(row.construction) > 0 ? fmtNumber(row.construction) : "")}</td>
              <td>${_editAO ? moneyInput("samar_leyte", row.samar_leyte, i) : (parseFloat(row.samar_leyte) > 0 ? fmtNumber(row.samar_leyte) : "")}</td>

              <td>${fmtNumber(row.total)}</td>
              <td>
                ${(row.date || '')}
                ${_editAO ? `
                  <span class="actions">
                    <button type="button" class="receipt-del btn-reject" title="Delete row">✕</button>
                  </span>
                ` : ``}
              </td>
            </tr>
          `;
        }).join("");

        const sum = key => rows.reduce((a, r) => a + (parseFloat(r[key]) || 0), 0);

        const totTithes = sum('tithes');
        const totOffering = sum('offering');
        const totPledge = sum('pledge');
        const totES = sum('es');
        const totOthers = sum('others');
        const totConstruction = sum('construction');
        const totSamarLeyte = sum('samar_leyte');
        const totOverall = sum('total');

        const aoCell = (key) => {
          const val = parseFloat(_addOffering[key] || 0) || 0;
          if (_editAO) {
            const n = parseFloat(val);
            const hasValue = Number.isFinite(n) && n > 0;
            const valueAttr = hasValue ? ` value="${n}"` : "";
            return `<input class="add-offering" data-col="${key}" type="number" step="0.01" min="0"${valueAttr} 
            style="width:100%;height:28px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;text-align:right;box-sizing:border-box;">`;
          }
          return val > 0 ? fmtNumber(val) : "";
        };

        const aoSum =
          (_addOffering.tithes || 0) + (_addOffering.offering || 0) + (_addOffering.pledge || 0) +
          (_addOffering.es || 0) + (_addOffering.others || 0) + (_addOffering.construction || 0) + (_addOffering.samar_leyte || 0);

        const tsrTithes = totTithes + (_addOffering.tithes || 0);
        const tsrOffering = totOffering + (_addOffering.offering || 0);
        const tsrPledge = totPledge + (_addOffering.pledge || 0);
        const tsrES = totES + (_addOffering.es || 0);
        const tsrOthers = totOthers + (_addOffering.others || 0);
        const tsrConstruction = totConstruction + (_addOffering.construction || 0);
        const tsrSamarLeyte = totSamarLeyte + (_addOffering.samar_leyte || 0);
        const tsrOverall = totOverall + aoSum;

        const metaRows = `
          <tr class="receipt-meta">
            <td colspan="4"><strong>TOTAL COLLECTION</strong></td>
            <td>${fmtNumber(totTithes)}</td>
            <td>${fmtNumber(totOffering)}</td>
            <td>${fmtNumber(totPledge)}</td>
            <td>${fmtNumber(totES)}</td>
            <td>${fmtNumber(totOthers)}</td>
            <td>${fmtNumber(totConstruction)}</td>
            <td>${fmtNumber(totSamarLeyte)}</td>
            <td>${fmtNumber(totOverall)}</td>
            <td></td>
          </tr>
          <tr class="receipt-meta">
            <td colspan="4"><strong>ADD: OFFERING</strong></td>
            <td>${aoCell("tithes")}</td>
            <td>${aoCell("offering")}</td>
            <td>${aoCell("pledge")}</td>
            <td>${aoCell("es")}</td>
            <td>${aoCell("others")}</td>
            <td>${aoCell("construction")}</td>
            <td>${aoCell("samar_leyte")}</td>
            <td>${_editAO ? "" : fmtNumber(aoSum)}</td>
            <td></td>
          </tr>
          <tr class="receipt-meta">
            <td colspan="4"><strong>TOTAL SOURCES OF REVENUE</strong></td>
            <td>${fmtNumber(tsrTithes)}</td>
            <td>${fmtNumber(tsrOffering)}</td>
            <td>${fmtNumber(tsrPledge)}</td>
            <td>${fmtNumber(tsrES)}</td>
            <td>${fmtNumber(tsrOthers)}</td>
            <td>${fmtNumber(tsrConstruction)}</td>
            <td>${fmtNumber(tsrSamarLeyte)}</td>
            <td>${fmtNumber(tsrOverall)}</td>
            <td></td>
          </tr>
        `;

        receiptsTableBody.innerHTML = baseRows;
        if (_editAO) {
          receiptsTableBody.insertBefore(buildAddActionRow(), receiptsTableBody.firstChild);
        }

        const tfoot = ensureReceiptsTFoot();
        if (tfoot) {
          tfoot.innerHTML = `
            <tr class="receipt-meta">
              <td colspan="4"><strong>TOTAL COLLECTION</strong></td>
              <td>${fmtNumber(totTithes)}</td>
              <td>${fmtNumber(totOffering)}</td>
              <td>${fmtNumber(totPledge)}</td>
              <td>${fmtNumber(totES)}</td>
              <td>${fmtNumber(totOthers)}</td>
              <td>${fmtNumber(totConstruction)}</td>
              <td>${fmtNumber(totSamarLeyte)}</td>
              <td>${fmtNumber(totOverall)}</td>
              <td></td>
            </tr>
            <tr class="receipt-meta">
              <td colspan="4"><strong>ADD: OFFERING</strong></td>
              <td>${aoCell("tithes")}</td>
              <td>${aoCell("offering")}</td>
              <td>${aoCell("pledge")}</td>
              <td>${aoCell("es")}</td>
              <td>${aoCell("others")}</td>
              <td>${aoCell("construction")}</td>
              <td>${aoCell("samar_leyte")}</td>
              <td>${_editAO ? "" : fmtNumber(aoSum)}</td>
              <td></td>
            </tr>
            <tr class="receipt-meta">
              <td colspan="4"><strong>TOTAL SOURCES OF REVENUE</strong></td>
              <td>${fmtNumber(tsrTithes)}</td>
              <td>${fmtNumber(tsrOffering)}</td>
              <td>${fmtNumber(tsrPledge)}</td>
              <td>${fmtNumber(tsrES)}</td>
              <td>${fmtNumber(tsrOthers)}</td>
              <td>${fmtNumber(tsrConstruction)}</td>
              <td>${fmtNumber(tsrSamarLeyte)}</td>
              <td>${fmtNumber(tsrOverall)}</td>
              <td></td>
            </tr>
          `;
        }

        applyReceiptsColumnSizing();
        recalcReceiptsMetaRows();
        try {
          const d = new Date(dateISO + "T00:00:00");
          if (d.getDay() === 0) {
            computeSundayWeekTotalsAndRenderCard(dateISO);
          } else {
            renderReceiptsComputedCard();
          }
        } catch { }

      } catch (err) {
        console.error("Error loading receipts:", err);
        receiptsTableBody.innerHTML = `<tr><td colspan="13">Error loading data.</td></tr>`;
      }
    }

    function _numFromCellText(s) {
      const n = parseFloat(String(s || "").replace(/[^\d.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }

    async function loadMonthBeginningFor(dateISO) {
      try {
        const d = new Date(dateISO);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const res = await safeFetch(`admin-functions/get-cash-beginning.php?year=${y}&month=${m}`);
        const data = await jsonOrThrow(res);
        _monthBeginning = parseFloat(data?.amount || "0") || 0;
      } catch (e) {
        console.error("loadMonthBeginningFor error:", e);
        _monthBeginning = 0;
      } finally {
        await renderReceiptsComputedCard();
      }
    }

    async function loadDailyDisbursements(dateISO) {
      return loadDailyDisbursementsWithAdminBreakdown(dateISO);
    }

    async function loadDailyDisbursementsWithAdminBreakdown(dateISO) {
      try {
        computeContextDates(dateISO);

        // Monthly cache key
        const y = dateISO.slice(0, 4);
        const m = dateISO.slice(5, 7);
        const ym = `${y}-${m}`;

        if (!_disbItemsByYM[ym]) {
          const res = await safeFetch(`admin-functions/get-disbursements.php?year=${Number(y)}&month=${Number(m)}`);
          const data = await jsonOrThrow(res);
          _disbItemsByYM[ym] = Array.isArray(data?.items) ? data.items : [];
        }

        const items = _disbItemsByYM[ym];

        // Scope to the target date(s)
        const inScope = items.filter(r => _contextDates.includes(r.txn_date));

        // Category totals (top-level categories)
        const byCat = {};
        DISB_CATEGORY_ORDER.forEach(label => { byCat[label] = 0; });

        const labelByNorm = {
          "administrative expenses": "Administrative Expenses",
          "bcc center contribution": "BCC Center Contribution",
          "bot share": "BOT Share",
          "bhc share": "BHC Share",
          "church activity expenses": "Church Activity Expenses",
          "insurance expense": "Insurance Expense",
          "legal & compliance expenses": "Legal & Compliance Expenses",
          "members assistance": "Members Assistance",
          "ministry expenses": "Ministry Expenses",
          "miscellaneous expense": "Miscellaneous Expense",
          "mission support": "Mission Support",
          "outreach support": "Outreach Support",
          "repairs & maintenance expense": "Repairs & Maintenance Expense",
          "representation expense": "Representation Expense",
          "pastoral ministry expenses": "Pastoral Ministry Expenses",
          "supplies expenses": "Supplies Expenses",
          "taxes & licenses": "Taxes & Licenses",
          "training, convention, and seminar expenses": "Training, Convention, and Seminar Expenses",
          "transportation expense": "Transportation Expense",
          "utilities expense": "Utilities Expense",
          "land and buildings & bldq. equipment": "Land and Buildings & Bldq. Equipment",
          "furniture & fixtures": "Furniture & Fixtures",
          "music instruments and sound equipment": "Music Instruments and Sound Equipment",
          "computer equipment": "Computer Equipment",
          "meralco upgrade": "Meralco Upgrade",
          "other assets": "Other Assets",
          "advances (bro onad)": "Advances (Bro Onad)",
          "over/short": "Over/Short",
          "advances from samar leyte": "Advances from Samar Leyte",
          "advances from gemma (utilities)": "Advances from Gemma (Utilities)"
        };

        const normStr = (s) => (s || "").trim().replace(/\s+/g, " ");
        const normKey = (s) => normStr(s).toLowerCase();
        const catNormSup = (s) => normKey(s);

        inScope.forEach(r => {
          const amt = parseMoney(r.amount);
          const catRaw = String(r.category || "").trim();
          let cat = catRaw;

          if (/^\d+(?:\.\d+)?$/.test(catRaw)) {
            const maybeCat = String(r.subcategory || "").trim();
            if (labelByNorm[normKey(maybeCat)]) cat = maybeCat;
          }

          const key = labelByNorm[normKey(cat)] || "Miscellaneous Expense";
          byCat[key] += amt;
        });
        dailyDisbByCategory = byCat;

        _dailyDisbTotal = DISB_CATEGORY_ORDER.reduce((sum, label) => sum + (byCat[label] || 0), 0);
        _dailyDisbByCategory = byCat;

        // Admin
        const adminRows = inScope.filter(r => (r.category || "").trim() === "Administrative Expenses");
        _adminDirectBySubcat = {}; ADMIN_DIRECT_SUBCATS.forEach(n => (_adminDirectBySubcat[n] = 0));
        _adminOtherBySubcat = {}; ADMIN_OTHER_SUBCATS.forEach(n => (_adminOtherBySubcat[n] = 0));

        // Members Assistance
        const maRows = inScope.filter(r => (r.category || "").trim() === "Members Assistance");
        _maBySubcat = {}; MEMBERS_ASSIST_SUBCATS.forEach(n => { _maBySubcat[n] = 0; });
        _maOtherAmt = 0;

        // Ministry (groups + leaves)
        const ministryRows = inScope.filter(r => normKey(r.category) === "ministry expenses");
        _ministryGroupTotals = {};
        _ministryLeafTotals = {};
        for (const g of MINISTRY_GROUPS_ORDERED) {
          _ministryGroupTotals[g] = 0;
          _ministryLeafTotals[g] = {};
          const leaves = MINISTRY_HIERARCHY[g] || [];
          for (const leaf of leaves) _ministryLeafTotals[g][leaf] = 0;
        }

        // Mission Support
        const msRows = inScope.filter(r => (r.category || "").trim().toLowerCase() === "mission support");
        _msBySubcat = {}; MISSION_SUPPORT_SUBCATS.forEach(n => { _msBySubcat[n] = 0; });
        _msOtherAmt = 0;

        // Outreach (groups + leaves)
        const outreachRows = inScope.filter(r => normKey(r.category) === "outreach support");
        _outreachGroupTotals = {};
        _outreachLeafTotals = {};
        for (const g of OUTREACH_GROUPS_ORDERED) {
          _outreachGroupTotals[g] = 0;
          _outreachLeafTotals[g] = {};
          const leaves = OUTREACH_HIERARCHY[g] || [];
          for (const leaf of leaves) _outreachLeafTotals[g][leaf] = 0;
        }

        // Pastoral Ministry Expenses
        const pmRows = inScope.filter(r => normKey(r.category) === "pastoral ministry expenses");
        _pmBySubcat = {}; PASTORAL_MINISTRY_SUBCATS.forEach(n => { _pmBySubcat[n] = 0; });
        _pmOtherAmt = 0;

        // Supplies Expenses
        const supRows = inScope.filter(r => catNormSup(r.category) === "supplies expenses");
        _supBySubcat = {}; SUPPLIES_EXPENSES_SUBCATS.forEach(n => { _supBySubcat[n] = 0; });
        _supOtherAmt = 0;

        // Admin
        for (const r of adminRows) {
          const name = (r.subcategory || "").trim() || "Other Miscellaneous";
          const amt = parseMoney(r.amount);
          if (ADMIN_DIRECT_SUBCATS.includes(name)) {
            _adminDirectBySubcat[name] += amt;
          } else if (ADMIN_OTHER_SUBCATS.includes(name)) {
            _adminOtherBySubcat[name] += amt;
          } else {
            _adminDirectBySubcat["Other Miscellaneous"] += amt;
          }
        }

        // Members
        for (const r of maRows) {
          const name = ((r.subcategory || "").trim()) || "Unspecified";
          const amt = parseMoney(r.amount);
          const match = MEMBERS_ASSIST_SUBCATS.find(s => s.toLowerCase() === name.toLowerCase());
          if (match) _maBySubcat[match] += amt; else _maOtherAmt += amt;
        }

        // Ministry
        for (const r of ministryRows) {
          const raw = normStr(r.subcategory || "");
          const rawNorm = normKey(raw);
          const noteNorm = normKey(r.note || "");
          const amt = parseMoney(r.amount);

          let matchedGroup = null, matchedLeaf = null;

          for (const g of MINISTRY_GROUPS_ORDERED) {
            const gNorm = normKey(g);
            if (rawNorm === gNorm || rawNorm.startsWith(gNorm)) {
              matchedGroup = g;
              const leaves = MINISTRY_HIERARCHY[g] || [];
              for (const leaf of leaves) {
                const leafNorm = normKey(leaf);
                if (rawNorm.includes(leafNorm) || noteNorm.includes(leafNorm)) {
                  matchedLeaf = leaf; break;
                }
              }
              break;
            }
          }
          if (!matchedGroup && raw) {
            outer: for (const g of MINISTRY_GROUPS_ORDERED) {
              const leaves = MINISTRY_HIERARCHY[g] || [];
              for (const leaf of leaves) {
                if (normKey(leaf) === rawNorm) { matchedGroup = g; matchedLeaf = leaf; break outer; }
              }
            }
          }

          if (matchedGroup && matchedLeaf) {
            _ministryGroupTotals[matchedGroup] += amt;
            _ministryLeafTotals[matchedGroup][matchedLeaf] =
              (_ministryLeafTotals[matchedGroup][matchedLeaf] || 0) + amt;
          } else if (matchedGroup) {
            _ministryGroupTotals[matchedGroup] += amt;
          }
        }

        // Mission Support
        for (const r of msRows) {
          const name = (r.subcategory || "").trim();
          const amt = parseFloat(r.amount) || 0;
          const match = MISSION_SUPPORT_SUBCATS.find(s => s.toLowerCase() === name.toLowerCase());
          if (match) _msBySubcat[match] += amt; else _msOtherAmt += amt;
        }

        // Outreach
        for (const r of outreachRows) {
          const raw = normStr(r.subcategory || "");
          const rawNorm = normKey(raw);
          const noteNorm = normKey(r.note || "");
          const amt = parseFloat(r.amount) || 0;

          let matchedGroup = null, matchedLeaf = null;

          for (const g of OUTREACH_GROUPS_ORDERED) {
            const gNorm = normKey(g);
            if (rawNorm === gNorm || rawNorm.startsWith(gNorm)) {
              matchedGroup = g;
              const leaves = OUTREACH_HIERARCHY[g] || [];
              for (const leaf of leaves) {
                const leafNorm = normKey(leaf);
                if (rawNorm.includes(leafNorm) || noteNorm.includes(leafNorm)) {
                  matchedLeaf = leaf; break;
                }
              }
              break;
            }
          }
          if (!matchedGroup && raw) {
            outer: for (const g of OUTREACH_GROUPS_ORDERED) {
              const leaves = OUTREACH_HIERARCHY[g] || [];
              for (const leaf of leaves) {
                if (normKey(leaf) === rawNorm) { matchedGroup = g; matchedLeaf = leaf; break outer; }
              }
            }
          }

          if (matchedGroup && matchedLeaf) {
            _outreachGroupTotals[matchedGroup] += amt;
            _outreachLeafTotals[matchedGroup][matchedLeaf] =
              (_outreachLeafTotals[matchedGroup][matchedLeaf] || 0) + amt;
          } else if (matchedGroup) {
            _outreachGroupTotals[matchedGroup] += amt;
          }
        }

        // Pastoral Ministry
        for (const r of pmRows) {
          const name = (r.subcategory || "").trim();
          const amt = parseFloat(r.amount) || 0;
          const match = PASTORAL_MINISTRY_SUBCATS.find(s => s.toLowerCase() === name.toLowerCase());
          if (match) _pmBySubcat[match] += amt; else _pmOtherAmt += amt;
        }

        // Supplies
        for (const r of supRows) {
          const name = (r.subcategory || "").trim();
          const amt = parseFloat(r.amount) || 0;
          const match = SUPPLIES_EXPENSES_SUBCATS.find(s => s.toLowerCase() === name.toLowerCase());
          if (match) _supBySubcat[match] += amt; else _supOtherAmt += amt;
        }

      } catch (e) {
        console.error("loadDailyDisbursementsWithAdminBreakdown error:", e);
        _dailyDisbTotal = 0;
        const zeros = {}; DISB_CATEGORY_ORDER.forEach(label => { zeros[label] = 0; });
        _dailyDisbByCategory = zeros;
        _adminDirectBySubcat = {}; _adminOtherBySubcat = {};
        _maBySubcat = {}; MEMBERS_ASSIST_SUBCATS.forEach(n => { _maBySubcat[n] = 0; });
        _maOtherAmt = 0;
      } finally {
        await renderReceiptsComputedCard();
      }
    }

    // ---- Offertory Export / Search / Sort ----
    const exportXLSXBtnOffertory = qs("#offertoryExportXLSX");
    const exportPDFBtnOffertory = qs("#offertoryExportPDF");
    const searchInputOffertory = qs("#offertorySearchName");
    const sortSelectOffertory = qs("#offertorySortBy");
    const roleSelectOffertory = qs("#offertoryRoleSort")
    const toggleSortOrderOffertory = qs("#offertoryToggleSortOrder");
    const receiptsTableOffertory = qs("#receiptsTable");
    const offReceiptsTbody = receiptsTableOffertory?.querySelector("tbody");
    let offSortOrder = "asc";

    const fmtCsvNum = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n === 0) return "";
      return String(Math.round(n * 100) / 100);
    };

    function isSundayISO(iso) {
      if (!iso) return false;
      const d = new Date(`${iso}T00:00:00`);
      return d.getDay() === 0;
    }

    function updateSundayOnlyExportOptions() {
      const show = isSundayISO(selectedOffertoryDate);

      ["#xlsxDropdown", "#pdfDropdown"].forEach(dropdownSel => {
        document
          .querySelectorAll(`${dropdownSel} .OP-dropdown-menu button`)
          .forEach(btn => {
            const label = (btn.textContent || "").trim().toLowerCase();
            if (label === "computed" || label === "week overall") {
              btn.style.display = show ? "" : "none";
            }
          });
      });
    }

    const applyOffertoryFilters = () => {
      if (!offReceiptsTbody) return;

      const q = (searchInputOffertory?.value || "").trim().toLowerCase();
      const roleFilter = (roleSelectOffertory?.value || "all").toLowerCase();

      const dataRows = Array.from(
        offReceiptsTbody.querySelectorAll(
          'tr:not(.receipt-action):not(.receipt-empty):not(.receipt-search-empty)'
        )
      );

      let any = false;

      dataRows.forEach(row => {
        const nameCell = row.querySelector("td:nth-child(1)");
        const roleCell = row.querySelector("td:nth-child(2)");

        const nameText = (nameCell?.textContent || "").trim().toLowerCase();
        const roleText = (roleCell?.textContent || "").trim().toLowerCase();

        const nameMatch = q ? nameText.includes(q) : true;
        const roleMatch =
          roleFilter === "all" ? true : roleText.includes(roleFilter);

        const match = nameMatch && roleMatch;

        row.style.display = match ? "" : "none";
        if (match) any = true;
      });

      offReceiptsTbody.querySelectorAll(".receipt-action").forEach(r => {
        r.style.display = q ? "none" : "";
      });

      offReceiptsTbody.querySelectorAll(".receipt-search-empty").forEach(r => r.remove());

      if ((q || roleFilter !== "all") && !any) {
        const tr = document.createElement("tr");
        tr.className = "receipt-search-empty";
        tr.innerHTML = '<td colspan="11">No matching receipts.</td>';
        offReceiptsTbody.appendChild(tr);
      }

      const table = receiptsTableOffertory;
      if (table && table.tFoot) {
        table.tFoot.style.display = q ? "none" : "";
      }
    };

    on(searchInputOffertory, "input", applyOffertoryFilters);
    on(roleSelectOffertory, "change", applyOffertoryFilters);


    // Sort receipts
    const offSortReceipts = () => {
      if (!offReceiptsTbody || !sortSelectOffertory) return;
      const by = sortSelectOffertory.value;
      const colIndex = { date_received: 11, username: 1, role: 2 }[by] ?? 1;

      const rows = Array.from(
        offReceiptsTbody.querySelectorAll(
          "tr:not(.receipt-action):not(.receipt-empty):not(.receipt-search-empty)"
        )
      );

      rows.sort((a, b) => {
        const aText = txt(a.querySelector(`td:nth-child(${colIndex})`));
        const bText = txt(b.querySelector(`td:nth-child(${colIndex})`));
        if (by === "date_received") {
          const da = preferDate(aText) || new Date(0);
          const db = preferDate(bText) || new Date(0);
          return offSortOrder === "asc" ? (da - db) : (db - da);
        }
        return offSortOrder === "asc" ? aText.localeCompare(bText) : bText.localeCompare(aText);
      });

      rows.forEach(r => offReceiptsTbody.appendChild(r));
    };

    delegate(receiptsTableOffertory, "click", "thead th[data-sort]", (e, th) => {
      const key = th.dataset.sort;
      if (sortSelectOffertory) sortSelectOffertory.value = key;
      offSortReceipts();
    });

    on(sortSelectOffertory, "change", offSortReceipts);
    on(toggleSortOrderOffertory, "click", () => {
      offSortOrder = offSortOrder === "asc" ? "desc" : "asc";
      if (toggleSortOrderOffertory) {
        toggleSortOrderOffertory.textContent = offSortOrder === "asc" ? "▲" : "▼";
      }
      offSortReceipts();
    });

    // Export dropdowns
    qsa(".OP-export-dropdown button[id]").forEach(btn => {
      on(btn, "click", e => {
        e.stopPropagation();
        const dropdown = btn.parentElement;
        qsa(".OP-export-dropdown").forEach(d => { if (d !== dropdown) d.classList.remove("OP-active"); });
        dropdown.classList.toggle("OP-active");
      });
    });

    on(document, "click", () => {
      qsa(".OP-export-dropdown").forEach(d => d.classList.remove("OP-active"));
    });

    qsa(".OP-dropdown-menu button").forEach(option => {
      on(option, "click", () => {
        const exportType = option.dataset.type; // expects: "today" | "computed" | etc.
        const parentId = option.closest(".OP-export-dropdown")?.id;

        if (parentId === "xlsxDropdown") {
          if (exportType === "today") {
            if (window.BCCSM_ReceiptsTabXlsx?.exportReceiptsTableXlsx) {
              window.BCCSM_ReceiptsTabXlsx.exportReceiptsTableXlsx(selectedOffertoryDate);
            } else {
              alert("Receipts XLSX exporter is not loaded.");
            }
          } else if (exportType === "computed") {
            if (window.BCCSM_ReceiptsTabXlsx?.exportComputedTableXlsx) {
              window.BCCSM_ReceiptsTabXlsx.exportComputedTableXlsx(selectedOffertoryDate);
            } else {
              alert("Computed XLSX exporter is not loaded.");
            }
          } else if (exportType === "week_overall") {
            if (window.BCCSM_ReceiptsTabXlsx?.exportWeekOverallXlsx) {
              window.BCCSM_ReceiptsTabXlsx.exportWeekOverallXlsx(selectedOffertoryDate);
            } else {
              alert("Week Overall XLSX exporter is not loaded.");
            }
          }
        }
        
        else if (parentId === "pdfDropdown") {
          if (exportType === "today") {
            if (window.BCCSM_ReceiptsTabPdf?.exportReceiptsTablePdf) {
              window.BCCSM_ReceiptsTabPdf.exportReceiptsTablePdf(selectedOffertoryDate);
            } else {
              alert("Receipts PDF exporter is not loaded.");
            }
          } else if (exportType === "computed") {
            if (window.BCCSM_ReceiptsTabPdf?.exportComputedTablePdf) {
              window.BCCSM_ReceiptsTabPdf.exportComputedTablePdf(selectedOffertoryDate);
            } else {
              alert("Computed PDF exporter is not loaded.");
            }
          } else if (exportType === "week_overall") {
            if (window.BCCSM_ReceiptsTabPdf?.exportWeekOverallPdf) {
              window.BCCSM_ReceiptsTabPdf.exportWeekOverallPdf(selectedOffertoryDate);
            } else {
              alert("Week Overall PDF exporter is not loaded.");
            }
          }
        }

        option.closest(".OP-export-dropdown")?.classList.remove("OP-active");
      });
    });

    /* =================== BCC Offertory: Single Source Module =================== */
    (function BCC_Offertory_Module() {
      const TABLE_SEL = "#receiptsTable";
      const CARD_SEL = "#receiptsComputedContainer";

      function initWhenReady() {
        const ok = document.querySelector(TABLE_SEL) && document.querySelector(CARD_SEL);
        if (!ok) return false;

        installTsrFooterObserver();
        scheduleRccSync();
        return true;
      }

      if (!initWhenReady()) {
        const mo = new MutationObserver(() => {
          if (initWhenReady()) mo.disconnect();
        });
        mo.observe(document.documentElement, { childList: true, subtree: true });
      }

      /* ---------- utils ---------- */
      const fmt = (n) => (Number(n) || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });
      const money = (s) => {
        const n = parseFloat(String(s || "").replace(/[^\d.\-]/g, ""));
        return Number.isFinite(n) ? n : 0;
      };
      const iso = (d) => {
        const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };
      const dOnly = (isoStr) => new Date(`${isoStr}T00:00:00`);

      function readTSRFromTable() {
        const table = document.querySelector("#receiptsTable");
        if (!table || !table.tFoot) return null;

        const tsr = Array.from(table.tFoot.querySelectorAll("tr.receipt-meta"))
          .find(tr => (tr.textContent || "").includes("TOTAL SOURCES OF REVENUE"));
        if (!tsr) return null;

        const td = tsr.querySelectorAll("td");

        const get = (i) => _numFromCellText(td[i]?.textContent);

        const out = {
          tithes: get(1),
          offering: get(2),
          pledge: get(3),
          es: get(4),
          others: get(5),
          construction: get(6),
          samar_leyte: get(7),
          overall: get(8)
        };

        out.total = out.overall;
        return out;
      }
      window.readTSRFromTable = readTSRFromTable;

      /* ---------- recompute footer for a given Sunday’s Mon→Sun ---------- */
      function weekFromSunday(sundayISO) {
        const sun = dOnly(sundayISO);
        const mon = new Date(sun); mon.setDate(sun.getDate() - 6);
        return [iso(mon), iso(sun)];
      }
      function computeWeekTotalsFromTable(monISO, sunISO) {
        const tbody = document.querySelector(`${TABLE_SEL} tbody`);
        if (!tbody) return null;
        const mon = dOnly(monISO), sun = dOnly(sunISO);
        sun.setHours(23, 59, 59, 999);

        const acc = { tithes: 0, offering: 0, pledge: 0, es: 0, others: 0, construction: 0, samar_leyte: 0, total: 0 };
        for (const tr of tbody.querySelectorAll("tr")) {
          const td = tr.querySelectorAll("td");
          if (td.length < 11) continue;
          const d = new Date((td[10]?.textContent || "").trim().replace(" ", "T"));
          if (+d < +mon || +d > +sun) continue;
          acc.tithes += money(td[2]?.textContent);
          acc.offering += money(td[3]?.textContent);
          acc.pledge += money(td[4]?.textContent);
          acc.es += money(td[5]?.textContent);
          acc.others += money(td[6]?.textContent);
          acc.construction += money(td[7]?.textContent);
          acc.samar_leyte += money(td[8]?.textContent);
          acc.total += money(td[9]?.textContent);
        }
        return acc;
      }
      function writeFooterForWeek(acc) {
        const tfoot = document.querySelector(`${TABLE_SEL} tfoot`);
        if (!tfoot) return;
        const findRow = (prefix) => Array.from(tfoot.querySelectorAll("tr"))
          .find(tr => ((tr.querySelector("td,th")?.textContent) || "").trim().toUpperCase().startsWith(prefix));
        const set8 = (tr, vals) => {
          if (!tr) return;
          const cells = Array.from(tr.querySelectorAll("td,th")).slice(-8);
          const keys = ["tithes", "offering", "pledge", "es", "others", "construction", "samar_leyte", "total"];
          cells.forEach((c, i) => c.textContent = fmt(vals[keys[i]] || 0));
        };

        set8(findRow("TOTAL COLLECTION"), acc);
        const addOff = findRow("ADD: OFFERING");
        if (addOff) {
          const cells = Array.from(addOff.querySelectorAll("td,th")).slice(-8);
          cells.forEach(c => c.textContent = ""); if (cells[1]) cells[1].textContent = fmt(acc.offering || 0);
        }
        set8(findRow("TOTAL SOURCES OF REVENUE"), acc);

      }

      window.renderAddReceiptsBlockSync = function (rowHTML) {
        const tsr = readTSRFromTable();

        if (!tsr) {
          return [
            rowHTML("ADD RECEIPTS", null, 0, true),

            rowHTML("TITHES (90%)", null, 24, true),
            rowHTML("TITHES (90%)", null, 40),
            rowHTML("MISSIONARY RESERVED FUND (10%)", null, 40),

            rowHTML("OFFERING", null, 24),
            rowHTML("SHORT TERM PLEDGES", null, 24),

            rowHTML("LONG TERM PLEDGES", null, 24),
            rowHTML("RESTRICTED PLEDGES", null, 24),

            rowHTML("OTHER RECEIPTS", null, 24, true),
            rowHTML("One Time Pledge/Offering", null, 40),
            rowHTML("Bank Interest/Other Income", null, 40),
            rowHTML("Pledge Outreach", null, 40),
            rowHTML("Kids Church", null, 40),
            rowHTML("Samar Leyte beg 5700", null, 40),
            rowHTML("Pledge -Worship Team", null, 40),
            rowHTML("Eskwela Suporta", null, 40),
            rowHTML("Donation fr Sis Criselda", null, 40),
            rowHTML("BCC CENTER", null, 40),
            rowHTML("Donation for Wellness Program", null, 40),
            rowHTML("Anniversary Pledge/Contibution", null, 40),
          ].join("");
        }

        const tithes90 = (tsr.tithes || 0) * 0.90;
        const mrf10 = (tsr.tithes || 0) * 0.10;

        const otherLeaves = {
          "One Time Pledge/Offering": tsr.others,
          "Bank Interest/Other Income": null,
          "Pledge Outreach": null,
          "Kids Church": null,
          "Samar Leyte beg 5700": tsr.samar_leyte,
          "Pledge -Worship Team": tsr.construction,
          "Eskwela Suporta": tsr.es,
          "Donation fr Sis Criselda": null,
          "BCC CENTER": null,
          "Donation for Wellness Program": null,
          "Anniversary Pledge/Contibution": null
        };

        const dateISO = (typeof selectedOffertoryDate === "string") ? selectedOffertoryDate : "";
        const ovMap = (window._rccOverridesByDate && dateISO) ? (window._rccOverridesByDate[dateISO] || {}) : {};
        const isZeroCents = (x) => Math.round((Number(x) || 0) * 100) === 0;

        for (const k of Object.keys(otherLeaves)) {
          const cur = Number(otherLeaves[k]);
          const hasCur = Number.isFinite(cur) && !isZeroCents(cur);
          if (!hasCur && Object.prototype.hasOwnProperty.call(ovMap, k)) {
            const n = Number(ovMap[k]);
            if (Number.isFinite(n) && !isZeroCents(n)) otherLeaves[k] = n;
          }
        }

        const otherGroup = Object.values(otherLeaves).reduce((a, v) => a + (Number(v) || 0), 0);

        const R = (label, val, pad = 24, strong = false) => rowHTML(label, val, pad, strong);

        return [
          R("ADD RECEIPTS", null, 0, true),

          // TITHES group
          R("TITHES", null, 24, true),

          R("TITHES (90%)", tithes90, 44, false),
          R("MISSIONARY RESERVED FUND (10%)", mrf10, 44, false),

          R("OFFERING", tsr.offering, 24),
          R("SHORT TERM PLEDGES", tsr.pledge, 24),

          // Temporarily label-only
          R("LONG TERM PLEDGES", null, 24),
          R("RESTRICTED PLEDGES", null, 24),

          R("OTHER RECEIPTS", otherGroup, 24, true),

          R("One Time Pledge/Offering", otherLeaves["One Time Pledge/Offering"], 44, false),
          R("Bank Interest/Other Income", otherLeaves["Bank Interest/Other Income"], 44, false),
          R("Pledge Outreach", otherLeaves["Pledge Outreach"], 44, false),
          R("Kids Church", otherLeaves["Kids Church"], 44, false),
          R("Samar Leyte beg 5700", otherLeaves["Samar Leyte beg 5700"], 44, false),
          R("Pledge -Worship Team", otherLeaves["Pledge -Worship Team"], 44, false),
          R("Eskwela Suporta", otherLeaves["Eskwela Suporta"], 44, false),
          R("Donation fr Sis Criselda", otherLeaves["Donation fr Sis Criselda"], 44, false),
          R("BCC CENTER", otherLeaves["BCC CENTER"], 44, false),
          R("Donation for Wellness Program", otherLeaves["Donation for Wellness Program"], 44, false),
          R("Anniversary Pledge/Contibution", otherLeaves["Anniversary Pledge/Contibution"], 44, false),
        ].join("");
      };

      function updateTotalCashReceiptsFromTSR() {

        return;
      }

      if (typeof window.renderReceiptsComputedCard === "function") {
        const orig = window.renderReceiptsComputedCard;
        window.renderReceiptsComputedCard = function patched() {
          const out = orig.apply(this, arguments);
          try { updateTotalCashReceiptsFromTSR(); } catch { }
          return out;
        };
      }

      const table = document.querySelector(`${TABLE_SEL}`);
      if (table) {
        const mo = new MutationObserver(() => {
          try {
            if (typeof window.renderReceiptsComputedCard === "function") {
              window.renderReceiptsComputedCard();
            } else {
              updateTotalCashReceiptsFromTSR();
            }
          } catch { }
        });
        mo.observe(table, { subtree: true, characterData: true, childList: true });
      }

      function scheduleRccSync() {
        clearTimeout(window.__rccSyncT);
        window.__rccSyncT = setTimeout(() => {
          try { updateTotalCashReceiptsFromTSR(); } catch (_) { }
        }, 0);
      }

      function installTsrFooterObserver() {
        const table = document.querySelector(TABLE_SEL);
        if (!table) return false;

        const target = table.tFoot || table;
        if (target._tsrObsInstalled) return true;
        target._tsrObsInstalled = true;

        const mo = new MutationObserver(() => scheduleRccSync());
        mo.observe(target, { childList: true, subtree: true, characterData: true });

        table._tsrFooterObserver = mo;

        return true;
      }

      installTsrFooterObserver();
      scheduleRccSync();
    })();

  })();
  // ---------- Offertory Summary (Weekly/Monthly) ----------
  (() => {
    const sumMonthInput = qs("#sumMonth");
    if (!sumMonthInput) return; // not on Summary tab

    const s = document.createElement("script");
    s.src = `assets/js/adminoffertory_summary.js?v=20260201`;
    s.async = false;
    document.head.appendChild(s);
  })();

  if (document.querySelector("#sumMonth")) {
    const existing = document.querySelector('script[data-summary-monthpicker="1"]');
    if (!existing) {
      const s = document.createElement("script");
      s.src = "assets/js/monthpicker_summary.js";
      s.defer = true;
      s.dataset.summaryMonthpicker = "1";
      document.head.appendChild(s);
    }
  }

});
(function () {
  if (typeof window.readTSRFromTable !== "function") {
    try { window.readTSRFromTable = readTSRFromTable; } catch (_) { }
  }

  const STATE = window.__BCC_OFFERTORY_STATE__ || (window.__BCC_OFFERTORY_STATE__ = {
    token: 0, loading: false, mo: null, monISO: null, sunISO: null
  });

  const f = window.readTSRFromTable;
  if (typeof f === "function" && !f.__wrappedForLoading) {
    const wrapped = function () {
      if (STATE.loading) return null;
      return f.apply(this, arguments);
    };
    wrapped.__wrappedForLoading = true;
    window.readTSRFromTable = wrapped;
  }

  if (typeof window.reflectSundayWeek !== "function" || !window.reflectSundayWeek.__tokenized) {
    window.reflectSundayWeek = function reflectSundayWeek(sundayISO) {
      const sun = new Date(`${sundayISO}T00:00:00`);
      const mon = new Date(sun); mon.setDate(sun.getDate() - 6);
      STATE.monISO = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
      STATE.sunISO = sundayISO;

      STATE.token += 1;
      const token = STATE.token;

      STATE.loading = true;
      if (typeof window.renderReceiptsComputedCard === "function") {
        try { window.renderReceiptsComputedCard(); } catch { }
      }

      const tbody = document.querySelector("#receiptsTable tbody");
      if (!tbody) return;

      if (STATE.mo) { STATE.mo.disconnect(); STATE.mo = null; }
      let timer = null;

      const applyIfCurrent = () => {
        if (token !== STATE.token) return;
        const compute = window.computeWeekTotalsFromTable || function (monISO, sunISO) {
          const tb = document.querySelector("#receiptsTable tbody");
          if (!tb) return null;
          const toD = (iso) => new Date(`${iso}T00:00:00`);
          const monD = toD(STATE.monISO), sunD = toD(STATE.sunISO); sunD.setHours(23, 59, 59, 999);
          const num = (s) => { const n = parseFloat(String(s || "").replace(/[^\d.\-]/g, "")); return Number.isFinite(n) ? n : 0; };
          const acc = { tithes: 0, offering: 0, pledge: 0, es: 0, others: 0, construction: 0, samar_leyte: 0, total: 0 };
          for (const tr of tb.querySelectorAll("tr")) {
            const td = tr.querySelectorAll("td"); if (td.length < 11) continue;
            const d = new Date((td[10]?.textContent || "").trim().replace(" ", "T"));
            if (!(d >= monD && d <= sunD)) continue;
            acc.tithes += num(td[2]?.textContent); acc.offering += num(td[3]?.textContent); acc.pledge += num(td[4]?.textContent);
            acc.es += num(td[5]?.textContent); acc.others += num(td[6]?.textContent); acc.construction += num(td[7]?.textContent);
            acc.samar_leyte += num(td[8]?.textContent); acc.total += num(td[9]?.textContent);
          }
          return acc;
        };
        const write = window.writeFooterForWeek;
        const acc = compute(STATE.monISO, STATE.sunISO);
        if (!acc) return;
        if (typeof write === "function") write(acc);

        STATE.loading = false; // leave skeleton mode
        if (typeof window.renderReceiptsComputedCard === "function") {
          try { window.renderReceiptsComputedCard(); } catch { }
        }
        if (typeof window.updateTotalCashReceiptsFromTSR === "function") {
          try { window.updateTotalCashReceiptsFromTSR(); } catch { }
        }
        if (STATE.mo) { STATE.mo.disconnect(); STATE.mo = null; }
      };

      STATE.mo = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(applyIfCurrent, 120);
      });
      STATE.mo.observe(tbody, { childList: true, subtree: true, characterData: true });

      if (timer) clearTimeout(timer);
      timer = setTimeout(applyIfCurrent, 150);
    };
    window.reflectSundayWeek.__tokenized = true;
  }

  (function setupReceiptsStickyLayout() {
    const receiptsContainer = document.querySelector("#receiptsContainer");
    const table = document.querySelector("#receiptsTable");
    if (!receiptsContainer || !table) return;

    const opFlex = receiptsContainer.querySelector("h3.OP-flex");
    const mainEl = document.querySelector("main");
    const root = document.documentElement;

    const setVar = (name, value) => root.style.setProperty(name, value);

    const updateStickyTop = () => {
      const padTop = mainEl ? parseFloat(getComputedStyle(mainEl).paddingTop || "0") : 16;
      setVar("--receipts-sticky-top", `${-Math.round(padTop)}px`);
    };

    const updateOpFlexH = () => {
      const h = opFlex ? opFlex.getBoundingClientRect().height : 0;
      setVar("--receipts-opflex-h", `${Math.max(0, Math.round(h))}px`);
    };

    const updateAll = () => {
      updateStickyTop();
      updateOpFlexH();
    };

    updateAll();
    window.addEventListener("resize", updateAll, { passive: true });

    try {
      new MutationObserver(updateAll).observe(receiptsContainer, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    } catch { }

    if ("ResizeObserver" in window) {
      try {
        if (mainEl) new ResizeObserver(updateStickyTop).observe(mainEl);
        if (opFlex) new ResizeObserver(updateOpFlexH).observe(opFlex);
      } catch { }
    }
  })();

  (function setupReceiptsFloatingHeader() {
    const receiptsContainer = document.querySelector("#receiptsContainer");
    const table = document.querySelector("#receiptsTable");
    const mainEl = document.querySelector("main");
    const opFlex = receiptsContainer ? receiptsContainer.querySelector("h3.OP-flex") : null;
    if (!receiptsContainer || !table || !table.tHead || !mainEl || !opFlex) return;

    let floating = document.getElementById("receiptsStickyHeader");
    if (!floating) {
      floating = document.createElement("div");
      floating.id = "receiptsStickyHeader";
      floating.className = "is-hidden";
      opFlex.insertAdjacentElement("afterend", floating);
    }

    let floatingTable = null;

    const buildClone = () => {
      floating.innerHTML = "";
      floatingTable = document.createElement("table");
      floatingTable.setAttribute("aria-hidden", "true");
      floatingTable.className = table.className || "";
      floatingTable.appendChild(table.tHead.cloneNode(true));
      floating.appendChild(floatingTable);
    };

    const syncWidths = () => {
      if (!floatingTable) return;
      const srcRow = table.tHead && table.tHead.rows && table.tHead.rows[0];
      if (!srcRow) return;

      const srcCells = Array.from(srcRow.cells || []);
      if (!srcCells.length) return;

      const tableWidth = table.getBoundingClientRect().width;
      floatingTable.style.width = `${Math.round(tableWidth)}px`;

      const widths = srcCells.map((c) => Math.max(0, Math.round(c.getBoundingClientRect().width)));

      let colgroup = floatingTable.querySelector("colgroup");
      if (!colgroup) {
        colgroup = document.createElement("colgroup");
        floatingTable.insertBefore(colgroup, floatingTable.firstChild);
      }
      colgroup.innerHTML = "";
      for (const w of widths) {
        const col = document.createElement("col");
        col.style.width = `${w}px`;
        colgroup.appendChild(col);
      }
    };

    const shouldShow = () => {
      if (getComputedStyle(receiptsContainer).display === "none") return false;

      const mainRect = mainEl.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const headRect = table.tHead.getBoundingClientRect();
      const opRect = opFlex.getBoundingClientRect();

      const tableInView = tableRect.bottom > mainRect.top && tableRect.top < mainRect.bottom;
      if (!tableInView) return false;

      const headerIsBehindOpFlex = headRect.top < opRect.bottom;

      const stillHasTableBelow = tableRect.bottom > opRect.bottom + 2;

      return headerIsBehindOpFlex && stillHasTableBelow;
    };

    let raf = 0;
    const update = () => {
      raf = 0;
      const show = shouldShow();
      floating.classList.toggle("is-hidden", !show);
      if (show) syncWidths();
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    buildClone();
    syncWidths();
    update();

    mainEl.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    try {
      if ("ResizeObserver" in window) new ResizeObserver(schedule).observe(table);
    } catch { }
  })();

})();