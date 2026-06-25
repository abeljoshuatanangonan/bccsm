/**
 * File: BCCSMOfficial/assets/js/adminoffertory_summary.js
 *
 * Summary-tab-only logic for admin-offertory.php?tab=summary.
 * Loaded dynamically by assets/js/admin-script.js when #sumMonth exists.
 */
(function initWhenReady(factory) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", factory, { once: true });
    } else {
        factory();
    }
})(() => {
    // ---------- Utils (local to Summary) ----------
    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

    function getCSRF() {
        if (window.CSRF_TOKEN) return window.CSRF_TOKEN;
        const m = document.querySelector('meta[name="csrf-token"]');
        if (m && m.content) return m.content;
        const h = document.querySelector('input[name="csrf_token"]');
        return h ? h.value : '';
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

    // Prefer shared helpers from admin-script.js if present, else local fallbacks.
    const jsonOrThrow = window.jsonOrThrow || (async (res) => {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error("Invalid JSON response");
        }
    });

    const iso = window.iso || ((d) => {
        const dt = (d instanceof Date) ? d : new Date(d);
        if (!Number.isFinite(dt.getTime())) return "";
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const day = String(dt.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    });

    const toISO = window.toISO || ((d) => iso(d));


    const fmtNumber = (v) => {
        const n = parseFloat(v);
        if (!Number.isFinite(n)) return "";
        return n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };


    // ---------- Offertory Summary (Weekly/Monthly) ----------
    (() => {
        const sumMonthInput = qs("#sumMonth");
        const weeklyTbody = qs("#summaryWeeklyTotalsTable tbody");
        const weeklyRangeEl = qs("#summaryWeeklyRange");

        const disbTbody = qs("#sumDisbTbody");
        const disbTotalEl = qs("#sumDisbGrandTotal");

        const exportCSVBtn = qs("#summaryExportCSV");
        const exportPDFBtn = qs("#summaryExportPDF");

        // ---- Disbursement categories in Excel order (match Receipts > Computed exactly) ----
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

        // Backward-compat for any Summary code still using DISB_CATEGORIES
        const DISB_CATEGORIES = DISB_CATEGORY_ORDER;

        // Summary scope helper (Receipts has its own scoped copy)
        const normStr = (s) => (s || "").trim().replace(/\s+/g, " ");
        const normKey = (s) => normStr(s).toLowerCase();

        // ---------- Import shared offertory constants (exported by admin-script.js) ----------
        const __SHARED = window.BCCSM_OFFERTORY_SHARED || window;

        const {
            ADMIN_DIRECT_SUBCATS = [],
            ADMIN_OTHER_SUBCATS = [],
            MEMBERS_ASSIST_SUBCATS = [],
            MINISTRY_HIERARCHY = {},
            MISSION_SUPPORT_SUBCATS = [],
            OUTREACH_HIERARCHY = {},
            PASTORAL_MINISTRY_SUBCATS = [],
            SUPPLIES_STANDALONE_CATS = [],
            SUPPLIES_EXPENSES_SUBCATS = [],
            SUPPLIES_DIRECT_SUBCATS = [],
            SUPPLIES_OTHER_SUBCATS = [],
        } = __SHARED;


        const MINISTRY_GROUPS_ORDERED = Object.keys(MINISTRY_HIERARCHY);
        const OUTREACH_GROUPS_ORDERED = Object.keys(OUTREACH_HIERARCHY);

        // ---------- Summary: per-Sunday (week_end) caches ----------
        let summaryWeeksCache = [];
        let summaryWeeksKey = "";
        let _sumDisbKey = "";
        let _summaryLoadSeq = 0;

        // Per-week disbursement aggregates: sundayISO -> agg object
        let _sumDisbBySunday = Object.create(null);
        // Prevent SummaryComputedTotals re-render while the user is selecting text.
        // Replacing innerHTML resets the selection range in Chromium.
        let _summarySelectionLocked = false;
        let _summarySelectionRecomputePending = false;

        function installSummarySelectionGuard(summaryBox) {
            if (!summaryBox || summaryBox._selectionGuardInstalled) return;
            summaryBox._selectionGuardInstalled = true;

            const lock = () => { _summarySelectionLocked = true; };
            const unlock = () => {
                setTimeout(() => {
                    _summarySelectionLocked = false;
                    if (_summarySelectionRecomputePending) {
                        _summarySelectionRecomputePending = false;
                        recomputeSummaryTotals();
                    }
                }, 0);
            };

            summaryBox.addEventListener("mousedown", lock, true);
            window.addEventListener("mouseup", unlock, true);

            summaryBox.addEventListener("touchstart", lock, { capture: true, passive: true });
            window.addEventListener("touchend", unlock, true);
        }

        const fmtCellBlankZero = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n) || n === 0) return "";
            return fmtNumber(n);
        };

        const SUMMARY_TOTAL_EXCLUDE_LABELS = new Set([]);
        const isSummaryTotalExcluded = (label) =>
            SUMMARY_TOTAL_EXCLUDE_LABELS.has(normKey(String(label || "")));

        function renderAmtGrid(series, colsLen, strong = false, blankTotal = false) {
            const weeks = Array.isArray(series?.weeks) ? series.weeks : [];
            const cells = [];


            for (let i = 0; i < colsLen; i++) {
                const text = fmtCellBlankZero(weeks[i] ?? 0);
                cells.push(`<span class="sum-amt-cell"${strong ? ' style="font-weight:600;"' : ""}>${text}</span>`);
            }

            const totalText = blankTotal ? "" : fmtCellBlankZero(series?.total ?? 0);
            cells.push(`<span class="sum-amt-cell"${strong ? ' style="font-weight:600;"' : ""}>${totalText}</span>`);

            return `<div class="sum-amt-grid" style="--cols:${colsLen + 1}">${cells.join("")}</div>`;
        }

        const sumNums = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

        const computeSundayOfTxn = (txnISO) => {
            // txn_date is YYYY-MM-DD (from get-disbursements.php)
            const d = new Date(`${txnISO}T00:00:00`);
            if (Number.isNaN(d.getTime())) return "";
            const add = (7 - d.getDay()) % 7; // 0 if Sunday, else days until next Sunday
            d.setDate(d.getDate() + add);
            return toISO(d);
        };

        function syncSummaryComputedStylesFromReceiptsTable() {
            const summaryBox = document.querySelector("#summaryComputedTotals");
            const receiptsBox = document.querySelector("#receiptsComputedContainer");
            if (!summaryBox || !receiptsBox) return;

            const normText = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

            const getLabel = (tr) => tr.querySelector("td:first-child")?.textContent || "";

            const getEffectiveBg = (el) => {
                let cur = el;
                while (cur) {
                    const bg = window.getComputedStyle(cur).getPropertyValue("background-color");
                    if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") return bg;
                    cur = cur.parentElement;
                }
                return "";
            };

            const copyRowVisuals = (srcRow, dstRow) => {
                if (!srcRow || !dstRow) return;

                const cs = window.getComputedStyle(srcRow);
                const styleBag = {
                    bg: getEffectiveBg(srcRow) || cs.getPropertyValue("background-color"),
                    color: cs.getPropertyValue("color"),
                    fw: cs.getPropertyValue("font-weight"),
                    bTop: cs.getPropertyValue("border-top"),
                    bBottom: cs.getPropertyValue("border-bottom"),
                };

                const apply = (el) => {
                    if (!el) return;
                    if (styleBag.bg) el.style.setProperty("background-color", styleBag.bg, "important");
                    if (styleBag.color) el.style.setProperty("color", styleBag.color, "important");
                    if (styleBag.fw) el.style.setProperty("font-weight", styleBag.fw, "important");
                    if (styleBag.bTop) el.style.setProperty("border-top", styleBag.bTop, "important");
                    if (styleBag.bBottom) el.style.setProperty("border-bottom", styleBag.bBottom, "important");
                };

                apply(dstRow);
                dstRow.querySelectorAll("td, th").forEach(apply);
                dstRow.querySelectorAll(".sum-amt-cell").forEach(apply);
            };

            const srcRows = Array.from(receiptsBox.querySelectorAll("tr"));
            const dstRows = Array.from(summaryBox.querySelectorAll("tr"));

            const srcByLabel = new Map();
            for (const tr of srcRows) {
                const key = normText(getLabel(tr));
                if (!key) continue;
                if (!srcByLabel.has(key)) srcByLabel.set(key, tr);
            }

            for (const dstRow of dstRows) {
                const key = normText(getLabel(dstRow));
                if (!key) continue;
                const srcRow = srcByLabel.get(key);
                if (srcRow) copyRowVisuals(srcRow, dstRow);
            }
        }

        const makeSeries = (weeksArr) => {
            const weeks = Array.isArray(weeksArr) ? weeksArr.map(v => Number(v) || 0) : [];
            return { weeks, total: sumNums(weeks) };
        };

        const blankSeries = (len) => ({ weeks: Array.from({ length: len }, () => 0), total: 0 });

        let sumDisbCatTotals = Object.fromEntries(DISB_CATEGORY_ORDER.map(c => [c, 0]));

        // Summary-tab disbursement breakdowns (mirror Receipts > Computed structure)
        let _sumDisbByCategory = Object.fromEntries(DISB_CATEGORY_ORDER.map(c => [c, 0]));
        let _sumAdminDirectBySubcat = Object.fromEntries(ADMIN_DIRECT_SUBCATS.map(n => [n, 0]));
        let _sumAdminOtherBySubcat = Object.fromEntries(ADMIN_OTHER_SUBCATS.map(n => [n, 0]));
        let _sumMaBySubcat = Object.fromEntries(MEMBERS_ASSIST_SUBCATS.map(n => [n, 0]));
        let _sumMaOtherAmt = 0;
        let _sumMinistryGroupTotals = {};
        let _sumMinistryLeafTotals = {};
        let _sumMsBySubcat = Object.fromEntries(MISSION_SUPPORT_SUBCATS.map(n => [n, 0]));
        let _sumMsOtherAmt = 0;
        let _sumOutreachGroupTotals = {};
        let _sumOutreachLeafTotals = {};
        let _sumPmBySubcat = Object.fromEntries(PASTORAL_MINISTRY_SUBCATS.map(n => [n, 0]));
        let _sumPmOtherAmt = 0;
        let _sumSupBySubcat = Object.fromEntries(SUPPLIES_EXPENSES_SUBCATS.map(n => [n, 0]));
        let _sumSupOtherAmt = 0;

        if (!sumMonthInput) return; // not on Summary tab

        const fmt = (v) => fmtNumber(v);

        function getMonthYear() {
            const val = sumMonthInput.value || (() => {
                const d = new Date();
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                return `${d.getFullYear()}-${mm}`;
            })();
            const [year, month] = val.split("-").map(Number);
            return { year, month };
        }

        function getSummaryComputedDomSignature() {
            const computedBox = document.querySelector("#summaryComputedTotals");
            if (!computedBox) return "";

            const html = computedBox.innerHTML || "";
            return html.trim();
        }

        function emitSummaryRendered(monthKey) {
            const detail = {
                ym: monthKey,
                hasWeekly: !!document.querySelector("#summaryWeeklyTotalsTable tbody tr"),
                hasComputed: !!document.querySelector("#summaryComputedTotals tbody tr"),
                computedSignature: getSummaryComputedDomSignature()
            };

            const dispatchTo = (target) => {
                try {
                    target.dispatchEvent(new CustomEvent("bcc:summary-rendered", { detail }));
                } catch (err) {
                    try {
                        const legacyEvent = document.createEvent("CustomEvent");
                        legacyEvent.initCustomEvent("bcc:summary-rendered", false, false, detail);
                        target.dispatchEvent(legacyEvent);
                    } catch (e) { }
                }
            };

            dispatchTo(window);
            dispatchTo(document);
        }

        // ---- Summary Cash Balance rows (mirror Receipts > Computed) ----
        const SUM_CB_GET_URL = "admin-functions/get-offertory-cash-balances.php";
        const _sumCbCache = new Map();
        const _sumCbLoading = new Set();
        const _sumCbPromises = new Map();

        async function ensureSummaryCashBalancesLoaded(sundayISO) {
            if (!sundayISO) return [];

            if (_sumCbCache.has(sundayISO)) {
                return _sumCbCache.get(sundayISO);
            }

            if (_sumCbPromises.has(sundayISO)) {
                return _sumCbPromises.get(sundayISO);
            }

            const promise = (async () => {
                _sumCbLoading.add(sundayISO);
                try {
                    const url = `${SUM_CB_GET_URL}?date=${encodeURIComponent(sundayISO)}`;
                    const j = await safeFetchJSON(url, {}, 10000);
                    const items = (j && j.success && Array.isArray(j.items)) ? j.items : [];
                    _sumCbCache.set(sundayISO, items);
                    return items;
                } catch (e) {
                    console.error("ensureSummaryCashBalancesLoaded():", e);
                    _sumCbCache.set(sundayISO, []);
                    return [];
                } finally {
                    _sumCbLoading.delete(sundayISO);
                    _sumCbPromises.delete(sundayISO);
                }
            })();

            _sumCbPromises.set(sundayISO, promise);
            return promise;
        }

        const SUM_SUNDAY_CARRY_URL = "admin-functions/get-offertory-sunday-carry.php";
        const _sumSundayCarryCache = new Map();
        const _sumSundayCarryPromises = new Map();

        async function ensureSummarySundayCarryLoaded(sundayISO) {
            const key = String(sundayISO || "").trim();
            if (!key) {
                return {
                    sunday: "",
                    beginning: 0,
                    receipts: 0,
                    disbursements: 0,
                    ending: 0,
                    seedSunday: "",
                    chain: []
                };
            }

            if (_sumSundayCarryCache.has(key)) {
                return _sumSundayCarryCache.get(key);
            }

            if (_sumSundayCarryPromises.has(key)) {
                return _sumSundayCarryPromises.get(key);
            }

            const promise = (async () => {
                try {
                    const url = `${SUM_SUNDAY_CARRY_URL}?sunday=${encodeURIComponent(key)}`;
                    const data = await safeFetchJSON(url, {}, 15000);

                    if (!data || data.success !== true || !data.target) {
                        throw new Error(data?.message || "Failed to compute Sunday carry chain.");
                    }

                    const result = {
                        sunday: String(data.target.sunday || key),
                        beginning: Number(data.target.beginning || 0),
                        receipts: Number(data.target.receipts || 0),
                        disbursements: Number(data.target.disbursements || 0),
                        ending: Number(data.target.ending || 0),
                        seedSunday: String(data.seed_sunday || ""),
                        chain: Array.isArray(data.chain) ? data.chain : []
                    };

                    _sumSundayCarryCache.set(key, result);
                    return result;
                } catch (e) {
                    console.error("ensureSummarySundayCarryLoaded():", e);
                    const fallback = {
                        sunday: key,
                        beginning: 0,
                        receipts: 0,
                        disbursements: 0,
                        ending: 0,
                        seedSunday: "",
                        chain: []
                    };
                    _sumSundayCarryCache.set(key, fallback);
                    return fallback;
                } finally {
                    _sumSundayCarryPromises.delete(key);
                }
            })();

            _sumSundayCarryPromises.set(key, promise);
            return promise;
        }

        // ---- Summary Month Beginning (for CASH BALANCE BEGINNING series) ----
        const SUM_MONTH_BEGIN_URL = "admin-functions/get-cash-beginning.php";
        const _sumMonthBeginCache = new Map(); // "YYYY-MM" -> number

        async function resolveSummaryMonthBeginning(year, month, monthBeginningRaw) {
            const direct = Number(monthBeginningRaw) || 0;
            if (direct > 0) return direct;

            // Fallback: previous month's last Sunday's ENDING (match receiptsComputedContainer behavior)
            try {
                const y = Number(year) || new Date().getFullYear();
                const m = Number(month) || (new Date().getMonth() + 1); // 1-12

                // JS Date month is 0-based; using (m - 1, 0) yields last day of previous month reliably
                const lastDayPrevMonth = new Date(y, m - 1, 0);
                const lastSundayPrevMonth = new Date(lastDayPrevMonth);
                lastSundayPrevMonth.setDate(lastDayPrevMonth.getDate() - lastDayPrevMonth.getDay());

                // Use existing helper in this file (NOT toISO)
                const prevISO = iso(lastSundayPrevMonth);

                const lsVal = (typeof window.__bcc_getEndingBalance === "function")
                    ? (Number(window.__bcc_getEndingBalance(prevISO)) || 0)
                    : 0;
                if (lsVal > 0) return lsVal;

                // Secondary fallback: cash balances endpoint for that previous Sunday
                const items = await ensureSummaryCashBalancesLoaded(prevISO);
                if (Array.isArray(items) && items.length) {
                    const pickAmt = (it) => Number(it?.amount ?? it?.amt ?? it?.value ?? it?.balance ?? 0) || 0;
                    const endingItem =
                        items.find(it => String(it?.code || "").toUpperCase() === "CB_ENDING") ||
                        items.find(it => /cash\s*balance/i.test(String(it?.name || "")) && /ending/i.test(String(it?.name || ""))) ||
                        items.find(it => /ending/i.test(String(it?.name || "")));
                    const endAmt = pickAmt(endingItem);
                    if (endAmt > 0) return endAmt;
                }
            } catch (e) {
                console.error("resolveSummaryMonthBeginning fallback error:", e);
            }

            return 0;
        }

        async function ensureSummaryMonthBeginningLoaded(year, month) {
            const y = Number(year) || new Date().getFullYear();
            const m = Number(month) || (new Date().getMonth() + 1);
            const key = `${y}-${String(m).padStart(2, "0")}`;
            if (_sumMonthBeginCache.has(key)) return Number(_sumMonthBeginCache.get(key)) || 0;
            try {
                const res = await safeFetch(`${SUM_MONTH_BEGIN_URL}?year=${y}&month=${m}`);
                const data = await jsonOrThrow(res);
                const amt = Number(data?.amount) || 0;
                _sumMonthBeginCache.set(key, amt);
                return amt;
            } catch (e) {
                console.error("ensureSummaryMonthBeginningLoaded error:", e);
                _sumMonthBeginCache.set(key, 0);
                return 0;
            }
        }



        function renderSummaryCashBalanceRowsHtml(items, endingNumber) {
            const rowHTMLCb = (label, val, padPx, strong, extraClass) => {
                const padVisual = Math.max(0, (padPx | 0));
                const yPadPx = 2;
                const n = Number(val);
                const hasValue = Number.isFinite(n) && n > 0;
                const amountCellHTML = hasValue ? fmtNumber(n) : "";

                return `
        <tr class="${extraClass || ""}">
          <td style="padding-top:${yPadPx}px;padding-bottom:${yPadPx}px;padding-left:${padVisual}px;${strong ? "font-weight:600;" : ""}">${label}</td>
          <td class="amount" style="padding-top:${yPadPx}px;padding-bottom:${yPadPx}px;">${amountCellHTML}</td>
        </tr>`;
            };

            // Fallback: still render the rows even if endpoint returns nothing
            if (!Array.isArray(items) || items.length === 0) {
                return [
                    rowHTMLCb("Cash Balance, Ending", Number(endingNumber) || 0, 0, true, "cb-ending-mirror rcc-gap-xl"),
                    rowHTMLCb("Cash on Hand", "", 24, false, "cb-cash-leaf"),
                    rowHTMLCb("Cash on Construction", "", 24, false, "cb-cash-leaf"),
                    rowHTMLCb("Cash on Samar Leyte", "", 24, false, "cb-cash-leaf"),
                    rowHTMLCb("COH - Sis Criselda", "", 24, false, "cb-cash-leaf"),
                    rowHTMLCb("COH - Anniversary", "", 24, false, "cb-cash-leaf"),
                    rowHTMLCb("COH - Sodexo", "", 24, false, "cb-cash-leaf"),
                    rowHTMLCb("Cash In bank", "", 24, true, "cb-bank-total"),
                    rowHTMLCb("PS BANK", "", 48, false, "cb-bank-leaf"),
                    rowHTMLCb("BDO-SAVINGS", "", 48, false, "cb-bank-leaf"),
                    rowHTMLCb("BDO-CHECKING fr BCC Marikina", "", 48, false, "cb-bank-leaf"),
                    rowHTMLCb("BDO-CHECKING Samar Leyte", "", 48, false, "cb-bank-leaf"),
                    rowHTMLCb("Samar Leyte", "", 48, false, "cb-bank-leaf"),
                    rowHTMLCb("GCASH", "", 48, false, "cb-bank-leaf"),
                    rowHTMLCb("For dep of Bro Ronald", "", 48, false, "cb-bank-leaf"),
                    rowHTMLCb("Cash for Wellness Program", "", 48, false, "cb-bank-leaf"),
                    rowHTMLCb("Cash for Worship Team", "", 48, false, "cb-bank-leaf"),
                    rowHTMLCb("Total Cash", "", 0, true, "cb-total-cash"),
                ].join("");
            }

            const cashInBank = items.find(it => it.code === "CASH_IN_BANK");
            const cashInBankId = cashInBank ? Number(cashInBank.id) : null;

            const leafInputs = items.filter(it => Number(it.is_input) === 1);
            const bankLeafInputs = leafInputs.filter(it => cashInBankId && Number(it.parent_id) === cashInBankId);

            const sum = (arr) => arr.reduce((s, it) => s + (Number(it.amount) || 0), 0);
            const bankTotal = sum(bankLeafInputs);
            const totalCash = sum(leafInputs);

            const sorted = items.slice().sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
            let html = "";

            for (const it of sorted) {
                const code = String(it.code || "");
                const name = String(it.name || "");
                const isInput = Number(it.is_input) === 1;

                if (code === "CB_ENDING") {
                    html += rowHTMLCb(name, Number(endingNumber) || 0, 0, true, "cb-ending-mirror rcc-gap-xl");
                    continue;
                }

                if (code === "CASH_IN_BANK") {
                    html += rowHTMLCb(name, bankTotal, 24, true, "cb-bank-total");
                    continue;
                }

                if (code === "TOTAL_CASH") {
                    html += rowHTMLCb(name, totalCash, 0, true, "cb-total-cash");
                    continue;
                }

                if (isInput) {
                    const pad = it.parent_id ? 48 : 24;
                    html += rowHTMLCb(name, Number(it.amount) || 0, pad, false, it.parent_id ? "cb-bank-leaf" : "cb-cash-leaf");
                }
            }

            return html;
        }

        let summaryMonthlyTotalsCache = null;

        function resetSummaryMonthState(monthKey = "") {
            summaryWeeksCache = [];
            summaryWeeksKey = monthKey || "";
            summaryMonthlyTotalsCache = null;

            _sumDisbBySunday = Object.create(null);
            _sumDisbKey = "";

            _sumCbCache.clear();
            _sumCbLoading.clear();
            _sumCbPromises.clear();

            sumDisbCatTotals = Object.fromEntries(DISB_CATEGORY_ORDER.map(c => [c, 0]));
            _sumDisbByCategory = Object.fromEntries(DISB_CATEGORY_ORDER.map(c => [c, 0]));
        }

        async function loadWeeklyTotals() {
            const { month, year } = getMonthYear();
            const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
            const monthKey = `${year}-${String(month).padStart(2, "0")}`;
            const seq = ++_summaryLoadSeq;

            try {
                // Fetch weekly + monthly in parallel
                const [weeklyRes, monthlyRes] = await Promise.all([
                    safeFetch(`admin-functions/get-offertory-weekly-totals.php?month=${month}&year=${year}`),
                    fetch(`admin-functions/get-offertory-monthly-totals.php?month=${month}&year=${year}`)
                ]);

                const weeklyData = await jsonOrThrow(weeklyRes);
                const monthlyData = await monthlyRes.json();

                if (seq !== _summaryLoadSeq) return;

                // cache weeks for computed totals grid (per Sunday columns)
                summaryWeeksKey = monthKey;
                summaryWeeksCache = (weeklyData && weeklyData.success && Array.isArray(weeklyData.weeks)) ? weeklyData.weeks : [];

                if (weeklyRangeEl) weeklyRangeEl.textContent = `${monthName} ${year}`;

                // Weekly rows
                const isBlankTotalsRow = (totals) => {
                    if (!totals) return true;

                    const hasUpdated = Boolean((totals.last_updated || "").trim());
                    const keys = [
                        "tithes",
                        "offering",
                        "pledge",
                        "eskwela_suporta",
                        "others",
                        "construction",
                        "samarleyte_pledge",
                        "total"
                    ];

                    const hasAnyAmount = keys.some((k) => {
                        const n = parseFloat(totals[k]);
                        return Number.isFinite(n) && n !== 0;
                    });

                    // “Blank row” = no last_updated AND all totals are zero
                    return !hasUpdated && !hasAnyAmount;
                };

                const fmtCell = (v) => {
                    const n = parseFloat(v);
                    if (!Number.isFinite(n) || n === 0) return "";
                    return fmtNumber(n);
                };

                let weeklyHtml = "";

                if (weeklyData.success && weeklyData.weeks?.length) {
                    weeklyHtml = weeklyData.weeks.map(week => {
                        const t = week.totals;
                        const isBlank = isBlankTotalsRow(t);

                        return `
                <tr>
                  <td>${week.row_label}</td>
                  <td>${fmtCell(t.tithes)}</td>
                  <td>${fmtCell(t.offering)}</td>
                  <td>${fmtCell(t.pledge)}</td>
                  <td>${fmtCell(t.eskwela_suporta)}</td>
                  <td>${fmtCell(t.others)}</td>
                  <td>${fmtCell(t.construction)}</td>
                  <td>${fmtCell(t.samarleyte_pledge)}</td>
                  <td>${fmtCell(t.total)}</td>
                  <td>${t.last_updated || ""}</td>
                </tr>
              `;
                    }).join("");
                } else {
                    weeklyHtml = `<tr><td colspan="10">No weekly totals found.</td></tr>`;
                }

                // Monthly totals row appended to weekly table
                if (monthlyData?.success && monthlyData?.totals) {
                    const t = monthlyData.totals;

                    // cache for computed totals section
                    summaryMonthlyTotalsCache = { totals: t, monthName, year };

                    weeklyHtml += `
          <tr class="summary-monthly-total-row">
            <td><strong>${monthName}</strong></td>
            <td><strong>${fmtCell(t.tithes)}</strong></td>
            <td><strong>${fmtCell(t.offering)}</strong></td>
            <td><strong>${fmtCell(t.pledge)}</strong></td>
            <td><strong>${fmtCell(t.eskwela_suporta)}</strong></td>
            <td><strong>${fmtCell(t.others)}</strong></td>
            <td><strong>${fmtCell(t.construction)}</strong></td>
            <td><strong>${fmtCell(t.samarleyte_pledge)}</strong></td>
            <td><strong>${fmtCell(t.total)}</strong></td>
            <td><strong>${t.last_updated || ""}</strong></td>
          </tr>
        `;
                } else {
                    summaryMonthlyTotalsCache = null;
                    // optional: show a “no monthly totals” row at bottom
                    weeklyHtml += `
          <tr class="summary-monthly-total-row">
            <td><strong>${monthName}</strong></td>
            <td colspan="9">No monthly totals found.</td>
          </tr>
        `;
                }

                weeklyTbody.innerHTML = weeklyHtml;

                // computed totals depends on monthly receipts
                recomputeSummaryTotals();

            } catch (err) {
                if (seq !== _summaryLoadSeq) return;
                console.error("Summary loadWeeklyTotals error:", err);
                weeklyTbody.innerHTML = `<tr><td colspan="10">Error loading weekly totals.</td></tr>`;
                summaryMonthlyTotalsCache = null;
                summaryWeeksCache = [];
                summaryWeeksKey = monthKey;
            }
        }

        function readMonthlyOverallTotal() {
            const t = summaryMonthlyTotalsCache?.totals;
            const overall = t?.total ?? 0;
            return parseFloat(overall) || 0;
        }

        function renderAmtHeaderGrid(labels, totalLabel = "Total") {
            const safe = Array.isArray(labels) ? labels : [];
            const cells = safe.map(l => `<span class="sum-amt-cell">${l ?? ""}</span>`);
            cells.push(`<span class="sum-amt-cell">${totalLabel ?? "Total"}</span>`);
            return `<div class="sum-amt-grid sum-amt-header" style="--cols:${safe.length + 1}">${cells.join("")}</div>`;
        }

        async function recomputeSummaryTotals() {
            const { month, year } = getMonthYear();
            const monthKey = `${year}-${String(month).padStart(2, "0")}`;
            const monthName = new Date(year, (month || 1) - 1, 1).toLocaleDateString("en-US", { month: "long" });
            const monthBeginningRaw = await ensureSummaryMonthBeginningLoaded(year, month);
            const monthBeginning = await resolveSummaryMonthBeginning(year, month, monthBeginningRaw);
            const beginning = monthBeginning;
            const t = summaryMonthlyTotalsCache?.totals || null;
            const tsr = t ? {
                tithes: parseFloat(t.tithes) || 0,
                offering: parseFloat(t.offering) || 0,
                pledge: parseFloat(t.pledge) || 0,
                es: parseFloat(t.eskwela_suporta) || 0,
                others: parseFloat(t.others) || 0,
                construction: parseFloat(t.construction) || 0,
                samar: parseFloat(t.samarleyte_pledge) || 0,
                overall: parseFloat(t.total) || 0,
            } : null;

            const receipts = tsr ? (tsr.overall || 0) : 0;

            const disbGrand = Object.values(sumDisbCatTotals).reduce((a, b) => a + (parseFloat(b) || 0), 0);
            const totalAvailable = beginning + receipts;
            const ending = totalAvailable - disbGrand;

            if (_summarySelectionLocked) {
                _summarySelectionRecomputePending = true;
                return;
            }

            let box = qs("#summaryComputedTotals");
            if (!box) {
                const container = qs("#summaryWeeklyTotalsContainer");
                if (container) {
                    box = document.createElement("div");
                    box.id = "summaryComputedTotals";
                    box.className = "table-container";
                    box.style.marginTop = "16px";
                    container.insertAdjacentElement("afterend", box);
                }
            }
            if (!box) return;
            installSummarySelectionGuard(box);
            // Put this inside recomputeSummaryTotals(), right after: if (!box) return;
            (function watchSummaryTotalsForRerender() {
                const summaryBox = box;
                if (!summaryBox || summaryBox._disbStyleObsInstalled) return;
                summaryBox._disbStyleObsInstalled = true;

                syncSummaryComputedStylesFromReceiptsTable();

                const mo = new MutationObserver(() => syncSummaryComputedStylesFromReceiptsTable());
                mo.observe(summaryBox, { childList: true, subtree: true });
            })();

            if (!box.classList.contains("table-container")) box.classList.add("table-container");

            let cbItems = [];
            try {
                const lastDay = new Date(year, month, 0);
                const lastSunday = new Date(lastDay);
                lastSunday.setDate(lastDay.getDate() - lastDay.getDay());
                const sundayISO = toISO(lastSunday);

                cbItems = await ensureSummaryCashBalancesLoaded(sundayISO);
            } catch (e) {
                cbItems = [];
            }

            const weeks = Array.isArray(summaryWeeksCache) ? summaryWeeksCache : [];
            const weekEnds = weeks.map(w => w.week_end).filter(Boolean);
            const activeMonthKey = `${year}-${String(month).padStart(2, "0")}`;
            if (
                weekEnds.length &&
                (
                    !_sumDisbBySunday ||
                    Object.keys(_sumDisbBySunday).length === 0 ||
                    _sumDisbKey !== activeMonthKey
                )
            ) {
                if (!window.__SUMMARY_DISB_LOADING) {
                    window.__SUMMARY_DISB_LOADING = true;
                    try {
                        await loadDisbursements();
                    } finally {
                        window.__SUMMARY_DISB_LOADING = false;
                    }
                }
            }
            const weekLabels = weeks.map(w => {
                // show "M j" from the Sunday (week_end)
                const d = new Date(`${w.week_end}T00:00:00`);
                if (Number.isNaN(d.getTime())) return w.row_label || w.week_end || "";
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            });
            const colsLen = weekEnds.length;
            const seriesFromWeeks = (fn) => makeSeries(weekEnds.map((sunISO, i) => {
                const w = weeks[i];
                return fn(w, sunISO) ?? 0;
            }));

            const mirroredBySunday = (typeof window.getReceiptsComputedSnapshotsForSundays === "function")
                ? await window.getReceiptsComputedSnapshotsForSundays(weekEnds)
                : Object.create(null);

            const hasMirrors = Object.keys(mirroredBySunday).length > 0;

            const findMirroredRow = (sunISO, { label = "", cat = "", group = "", startsWith = false } = {}) => {
                const rows = Array.isArray(mirroredBySunday?.[sunISO]) ? mirroredBySunday[sunISO] : [];
                const wantLabel = normKey(label);
                const wantCat = normKey(cat);
                const wantGroup = normKey(group);

                return rows.find(r => {
                    const rowLabel = normKey(r.label || "");
                    const rowCat = normKey(r.cat || "");
                    const rowGroup = normKey(r.group || "");

                    const labelOk = startsWith ? rowLabel.startsWith(wantLabel) : rowLabel === wantLabel;
                    const catOk = !cat || rowCat === wantCat;
                    const groupOk = !group || rowGroup === wantGroup;

                    return labelOk && catOk && groupOk;
                }) || null;
            };

            const mirroredSeries = ({ label = "", cat = "", group = "", startsWith = false, totalMode = "sum" } = {}) => {
                const weeksVals = weekEnds.map((sunISO) => {
                    const row = findMirroredRow(sunISO, { label, cat, group, startsWith });
                    return Number(row?.value) || 0;
                });

                return {
                    weeks: weeksVals,
                    total: totalMode === "first" ? (Number(weeksVals[0]) || 0) : sumNums(weeksVals)
                };
            };

            // Receipts per Sunday
            const receiptsTotalSeries = hasMirrors
                ? mirroredSeries({ label: "TOTAL CASH RECEIPTS", startsWith: true })
                : seriesFromWeeks((w) => Number(w?.totals?.total) || 0);

            // For the Add Receipts block, use the same Sunday totals source that Receipts uses.
            // This is more reliable than DOM mirroring for these rows.
            const tithesSeries = seriesFromWeeks((w) => Number(w?.totals?.tithes) || 0);
            const tithes90Series = seriesFromWeeks((w) => (Number(w?.totals?.tithes) || 0) * 0.9);
            const mrf10Series = seriesFromWeeks((w) => (Number(w?.totals?.tithes) || 0) * 0.1);
            const offeringSeries = seriesFromWeeks((w) => Number(w?.totals?.offering) || 0);
            const stPledgeSeries = seriesFromWeeks((w) => Number(w?.totals?.pledge) || 0);
            const esSeries = seriesFromWeeks((w) => Number(w?.totals?.eskwela_suporta) || 0);
            const oneTimeSeries = seriesFromWeeks((w) => Number(w?.totals?.others) || 0);
            const worshipTeamSeries = seriesFromWeeks((w) => Number(w?.totals?.construction) || 0);
            const samarBegSeries = seriesFromWeeks((w) => Number(w?.totals?.samarleyte_pledge) || 0);

            const otherReceiptsSeries = makeSeries(weekEnds.map((_, i) =>
                (Number(oneTimeSeries.weeks[i]) || 0) +
                (Number(samarBegSeries.weeks[i]) || 0) +
                (Number(worshipTeamSeries.weeks[i]) || 0) +
                (Number(esSeries.weeks[i]) || 0)
            ));

            // Disbursements per Sunday (keep existing Summary bucket logic)
            const disbCatSeries = (cat) => makeSeries(weekEnds.map((sunISO) => {
                const agg = _sumDisbBySunday?.[sunISO];
                return Number(agg?.catTotals?.[cat]) || 0;
            }));
            const disbGrandSeries = makeSeries(weekEnds.map((sunISO) => {
                const agg = _sumDisbBySunday?.[sunISO];
                return agg ? sumNums(Object.values(agg.catTotals || {})) : 0;
            }));

            const summaryCarryBySunday = Object.create(null);
            await Promise.all(
                weekEnds.map(async (sunISO) => {
                    summaryCarryBySunday[sunISO] = await ensureSummarySundayCarryLoaded(sunISO);
                })
            );

            const beginWeeks = weekEnds.map((sunISO) =>
                Number(summaryCarryBySunday?.[sunISO]?.beginning) || 0
            );

            const totalAvailWeeks = [];
            const endWeeks = [];
            for (let i = 0; i < colsLen; i++) {
                const b = Number(beginWeeks[i]) || 0;
                const r = Number(receiptsTotalSeries?.weeks?.[i]) || 0;
                const d = Number(disbGrandSeries?.weeks?.[i]) || 0;
                const ta = b + r;
                const e = ta - d;
                totalAvailWeeks.push(ta);
                endWeeks.push(e);
            }

            const mirrorTopOrFallback = (label, fallbackSeries, totalMode = "sum") =>
                hasMirrors ? mirroredSeries({ label, totalMode }) : fallbackSeries;

            const beginningSeries = {
                weeks: beginWeeks,
                total: Number(beginWeeks[0]) || 0
            };
            const totalReceiptsSeries = mirrorTopOrFallback(
                "TOTAL CASH RECEIPTS",
                receiptsTotalSeries
            );

            const totalAvailableFallback = makeSeries(totalAvailWeeks);

            const totalAvailableSeries = {
                weeks: Array.isArray(totalAvailableFallback.weeks) ? totalAvailableFallback.weeks : [],
                total: (Number(beginningSeries?.total) || 0) + (Number(totalReceiptsSeries?.total) || 0)
            };

            const totalDisbursementsSeries = mirrorTopOrFallback(
                "TOTAL DISBURSEMENTS",
                disbGrandSeries
            );

            const endingSeriesBase = mirrorTopOrFallback(
                "TOTAL ENDING BALANCE",
                makeSeries(endWeeks)
            );

            const endingSeries = {
                weeks: Array.isArray(endingSeriesBase?.weeks) ? endingSeriesBase.weeks : [],
                total: (Number(totalAvailableSeries?.total) || 0) - (Number(totalDisbursementsSeries?.total) || 0)
            };

            const rowHTML = (label, seriesOrBlank, padPx = 0, strong = false, extraClass = "") => {
                const yPadPx = 2;
                const padVisual = Math.max(0, (padPx | 0));
                const s = seriesOrBlank && typeof seriesOrBlank === "object" && Array.isArray(seriesOrBlank.weeks)
                    ? seriesOrBlank
                    : blankSeries(colsLen);
                return `
            <tr class="${extraClass || ""}">
            <td style="padding-top:${yPadPx}px;padding-bottom:${yPadPx}px;padding-left:${padVisual}px;${strong ? "font-weight:600;" : ""}">${label}</td>
            <td class="amount">${renderAmtGrid(s, colsLen, strong, isSummaryTotalExcluded(label))}</td>
            </tr>`;
            };

            const SUMMARY_CASH_BALANCE_LABELS = [
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

            const getSummaryCashBalanceValueFromItems = (items, prevItems, label, endingNumber = 0) => {
                const want = normKey(label);
                const safeItems = Array.isArray(items) ? items : [];
                const safePrevItems = Array.isArray(prevItems) ? prevItems : [];

                const prevMap = new Map(
                    safePrevItems.map(it => [normKey(String(it?.name || "")), Number(it?.amount) || 0])
                );

                const effectiveAmount = (it) => {
                    const key = normKey(String(it?.name || ""));
                    const hasExplicitCurrent =
                        it?.amount !== null &&
                        it?.amount !== undefined &&
                        String(it?.amount) !== "";

                    const curr = hasExplicitCurrent ? (Number(it.amount) || 0) : null;
                    const prev = Number(prevMap.get(key)) || 0;

                    // Carry forward only when current Sunday is truly unset (NULL),
                    // not when the current Sunday was intentionally saved as blank/zero.
                    if (curr === null && Math.round(prev * 100) !== 0) {
                        return prev;
                    }

                    return curr === null ? 0 : curr;
                };

                if (!safeItems.length) {
                    if (want === normKey("Cash Balance, Ending")) return Number(endingNumber) || 0;

                    const prevDirect = safePrevItems.find(it => normKey(String(it?.name || "")) === want);
                    return Number(prevDirect?.amount) || 0;
                }

                const cashInBank = safeItems.find(it => String(it?.code || "") === "CASH_IN_BANK");
                const cashInBankId = cashInBank ? Number(cashInBank.id) : null;

                const leafInputs = safeItems.filter(it => Number(it?.is_input) === 1);
                const bankLeafInputs = leafInputs.filter(it => cashInBankId && Number(it?.parent_id) === cashInBankId);

                const sumEffective = (arr) => arr.reduce((s, it) => s + effectiveAmount(it), 0);

                if (want === normKey("Cash Balance, Ending")) return Number(endingNumber) || 0;
                if (want === normKey("Cash In bank")) return sumEffective(bankLeafInputs);
                if (want === normKey("Total Cash")) return sumEffective(leafInputs);

                const direct =
                    leafInputs.find(it => normKey(String(it?.name || "")) === want) ||
                    safeItems.find(it => normKey(String(it?.name || "")) === want);

                return direct ? effectiveAmount(direct) : (Number(prevMap.get(want)) || 0);
            };

            const buildSummaryCashBalanceSeriesMap = async () => {
                const byLabelSeries = Object.create(null);
                const cacheBySunday = Object.create(null);

                const getItemsForSunday = async (sunISO) => {
                    if (!sunISO) return [];
                    if (Object.prototype.hasOwnProperty.call(cacheBySunday, sunISO)) return cacheBySunday[sunISO];
                    cacheBySunday[sunISO] = await ensureSummaryCashBalancesLoaded(sunISO);
                    return cacheBySunday[sunISO];
                };

                const prevSundayISO = (sunISO) => {
                    const d = new Date(`${sunISO}T00:00:00`);
                    if (Number.isNaN(d.getTime())) return "";
                    d.setDate(d.getDate() - 7);
                    return toISO(d);
                };

                const makeLastSundayMirrorSeries = (weeksVals) => {
                    const safeWeeks = Array.isArray(weeksVals) ? weeksVals.map(v => Number(v) || 0) : [];
                    return {
                        weeks: safeWeeks,
                        total: safeWeeks.length ? (Number(safeWeeks[safeWeeks.length - 1]) || 0) : 0
                    };
                };

                for (const label of SUMMARY_CASH_BALANCE_LABELS) {
                    const weeksVals = [];

                    for (const sunISO of weekEnds) {
                        const row = findMirroredRow(sunISO, { label });
                        const mirroredVal = Number(row?.value);

                        if (Number.isFinite(mirroredVal) && mirroredVal !== 0) {
                            weeksVals.push(mirroredVal);
                            continue;
                        }

                        const items = await getItemsForSunday(sunISO);
                        const prevItems = await getItemsForSunday(prevSundayISO(sunISO));

                        const fallbackVal = getSummaryCashBalanceValueFromItems(
                            items,
                            prevItems,
                            label,
                            Number(endingSeries?.weeks?.[weekEnds.indexOf(sunISO)]) || 0
                        );

                        weeksVals.push(Number(fallbackVal) || 0);
                    }

                    byLabelSeries[label] = makeLastSundayMirrorSeries(weeksVals);
                }

                return byLabelSeries;
            };

            const cashSeriesMap = await buildSummaryCashBalanceSeriesMap();

            const renderSummaryCashBalanceRowsWeekly = () => [
                rowHTML("Cash Balance, Ending", cashSeriesMap["Cash Balance, Ending"] || endingSeries, 0, true, "cb-ending-mirror rcc-gap-xl"),
                rowHTML("Cash on Hand", cashSeriesMap["Cash on Hand"] || blankSeries(colsLen), 24, false, "cb-cash-leaf"),
                rowHTML("Cash on Construction", cashSeriesMap["Cash on Construction"] || blankSeries(colsLen), 24, false, "cb-cash-leaf"),
                rowHTML("Cash on Samar Leyte", cashSeriesMap["Cash on Samar Leyte"] || blankSeries(colsLen), 24, false, "cb-cash-leaf"),
                rowHTML("COH - Sis Criselda", cashSeriesMap["COH - Sis Criselda"] || blankSeries(colsLen), 24, false, "cb-cash-leaf"),
                rowHTML("COH - Anniversary", cashSeriesMap["COH - Anniversary"] || blankSeries(colsLen), 24, false, "cb-cash-leaf"),
                rowHTML("COH - Sodexo", cashSeriesMap["COH - Sodexo"] || blankSeries(colsLen), 24, false, "cb-cash-leaf"),

                rowHTML("Cash In bank", cashSeriesMap["Cash In bank"] || blankSeries(colsLen), 24, true, "cb-bank-total"),
                rowHTML("PS BANK", cashSeriesMap["PS BANK"] || blankSeries(colsLen), 48, false, "cb-bank-leaf"),
                rowHTML("BDO-SAVINGS", cashSeriesMap["BDO-SAVINGS"] || blankSeries(colsLen), 48, false, "cb-bank-leaf"),
                rowHTML("BDO-CHECKING fr BCC Marikina", cashSeriesMap["BDO-CHECKING fr BCC Marikina"] || blankSeries(colsLen), 48, false, "cb-bank-leaf"),
                rowHTML("BDO-CHECKING Samar Leyte", cashSeriesMap["BDO-CHECKING Samar Leyte"] || blankSeries(colsLen), 48, false, "cb-bank-leaf"),
                rowHTML("Samar Leyte", cashSeriesMap["Samar Leyte"] || blankSeries(colsLen), 48, false, "cb-bank-leaf"),
                rowHTML("GCASH", cashSeriesMap["GCASH"] || blankSeries(colsLen), 48, false, "cb-bank-leaf"),
                rowHTML("For dep of Bro Ronald", cashSeriesMap["For dep of Bro Ronald"] || blankSeries(colsLen), 48, false, "cb-bank-leaf"),
                rowHTML("Cash for Wellness Program", cashSeriesMap["Cash for Wellness Program"] || blankSeries(colsLen), 48, false, "cb-bank-leaf"),
                rowHTML("Cash for Worship Team", cashSeriesMap["Cash for Worship Team"] || blankSeries(colsLen), 48, false, "cb-bank-leaf"),

                rowHTML("Total Cash", cashSeriesMap["Total Cash"] || blankSeries(colsLen), 0, true, "cb-total-cash"),
            ].join("");

            const cashBalanceRowsHtml = renderSummaryCashBalanceRowsWeekly();

            const renderSummaryAddReceiptsBlockWeekly = () => {
                const R = (label, series, pad = 24, strong = false) => rowHTML(label, series, pad, strong);

                return [
                    // Structural row in Receipts; keep blank
                    R("ADD RECEIPTS", blankSeries(colsLen), 0, true),

                    // This row should show total Tithes before the 90/10 split
                    R("TITHES", tithesSeries, 24, true),
                    R("TITHES (90%)", tithes90Series, 44, false),
                    R("MISSIONARY RESERVED FUND (10%)", mrf10Series, 44, false),

                    R("OFFERING", offeringSeries, 24, false),
                    R("SHORT TERM PLEDGES", stPledgeSeries, 24, false),

                    // Still blank in Receipts unless you later add actual source fields for them
                    R("LONG TERM PLEDGES", blankSeries(colsLen), 24, false),
                    R("RESTRICTED PLEDGES", blankSeries(colsLen), 24, false),

                    R("OTHER RECEIPTS", otherReceiptsSeries, 24, true),
                    R("One Time Pledge/Offering", oneTimeSeries, 44, false),

                    // These are still blank in the current Receipts source block
                    R("Bank Interest/Other Income", blankSeries(colsLen), 44, false),
                    R("Pledge Outreach", blankSeries(colsLen), 44, false),
                    R("Kids Church", blankSeries(colsLen), 44, false),

                    R("Samar Leyte beg 5700", samarBegSeries, 44, false),
                    R("Pledge -Worship Team", worshipTeamSeries, 44, false),
                    R("Eskwela Suporta", esSeries, 44, false),

                    // These are also blank in the current Receipts source block
                    R("Donation fr Sis Criselda", blankSeries(colsLen), 44, false),
                    R("BCC CENTER", blankSeries(colsLen), 44, false),
                    R("Donation for Wellness Program", blankSeries(colsLen), 44, false),
                    R("Anniversary Pledge/Contibution", blankSeries(colsLen), 44, false),
                ].join("");
            };

            const _normSumLabel = (s) => String(s ?? "").trim().toLowerCase();
            const _summaryBlueRowsByCategory = {
                "Administrative Expenses": new Set([
                    "Food Expenses",
                    "Medical Expenses",
                    "Philhealth",
                    "SSS Contribution",
                    "Communications Expense",
                    "Love Gift (deducted from MRF)",
                    "Other Miscellaneous",
                ].map(_normSumLabel)),
                "Members Assistance": new Set([
                    "Financial Assistance",
                    "Funeral Assistance",
                    "Educational Assistance",
                    "Other Assistance",
                ].map(_normSumLabel)),
                "Ministry Expenses": new Set([
                    "Worship Ministry",
                    "Sunday School",
                    "Worker's meeting",
                    "Buso Buso",
                    "ALS",
                    "Timothites",
                    "VOICE",
                ].map(_normSumLabel)),
                "Mission Support": new Set([
                    "Mission Support - Ptr M",
                    "Love Gift-Ptr A & Sis Neneng",
                    "Love Gift - Sis Criselda",
                    "Other Mission Support",
                ].map(_normSumLabel)),
                "Outreach Support": new Set([
                    "Maly Outreach",
                    "Burgos Outreach",
                    "Guinayang Outreach",
                    "Parang. Marikina Outreach",
                    "Banaba & Moises Outreach",
                    "Samar Leyte Outreach",
                    "Manggahan Outreach",
                ].map(_normSumLabel)),
                "Pastoral Ministry Expenses": new Set([
                    "Transportation",
                    "Food",
                    "Other Pastoral Ministry",
                ].map(_normSumLabel)),
                "Supplies Expenses": new Set([
                    "Office Supplies Expense",
                    "Cleaning Materials",
                ].map(_normSumLabel)),
            };

            const _sumRowClass = (category, rowLabel) => {
                const key = _normSumLabel(rowLabel);
                return _summaryBlueRowsByCategory[category]?.has(key) ? "disb-subcat-row" : "";
            };

            const categoryRowsHtml = DISB_CATEGORY_ORDER.map(label => {
                const s = disbCatSeries(label);
                if (label === "Administrative Expenses") {
                    const directRows = ADMIN_DIRECT_SUBCATS.map(name => {
                        const series = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.adminDirect?.[name]) || 0));
                        return rowHTML(name, series, 34, false, _sumRowClass(label, name));
                    }).join("");
                    const otherRows = ADMIN_OTHER_SUBCATS.map(name => {
                        const series = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.adminOther?.[name]) || 0));
                        return rowHTML(name, series, 34, false, _sumRowClass(label, name));
                    }).join("");
                    return [rowHTML(label, s, 0, false, "disb-cat-row admin-cat-row"), directRows, otherRows].join("");
                }

                if (label === "Members Assistance") {
                    const fixedRows = MEMBERS_ASSIST_SUBCATS.map(n => {
                        const series = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.maBySubcat?.[n]) || 0));
                        return rowHTML(n, series, 34, false, _sumRowClass(label, n));
                    }).join("");

                    const otherSeries = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.maOther) || 0));
                    const otherRow = (otherSeries.total !== 0)
                        ? rowHTML("Other Assistance", otherSeries, 44, false, _sumRowClass(label, "Other Assistance"))
                        : "";

                    return [rowHTML(label, s, 0, false, "disb-cat-row members-cat-row"), fixedRows, otherRow].join("");
                }

                if (label === "Ministry Expenses") {
                    const groupRows = MINISTRY_GROUPS_ORDERED.map(g => {
                        const gs = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.ministryGroup?.[g]) || 0));
                        const leafRows = (MINISTRY_HIERARCHY[g] || []).map(leaf => {
                            const ls = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.ministryLeaf?.[g]?.[leaf]) || 0));
                            return rowHTML(leaf, ls, 60, false);
                        }).join("");
                        return [rowHTML(g, gs, 34, false, "disb-subcat-row ministry-group-row"), leafRows].join("");
                    }).join("");
                    return [rowHTML(label, s, 0, false, "disb-cat-row ministry-cat-row"), groupRows].join("");
                }

                if (label === "Mission Support") {
                    const fixedRows = MISSION_SUPPORT_SUBCATS.map(n => {
                        const series = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.msBySubcat?.[n]) || 0));
                        return rowHTML(n, series, 34, false, _sumRowClass(label, n));
                    }).join("");

                    const otherSeries = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.msOther) || 0));
                    const otherRow = (otherSeries.total !== 0)
                        ? rowHTML("Other Mission Support", otherSeries, 44, false, _sumRowClass(label, "Other Mission Support"))
                        : "";

                    return [rowHTML(label, s, 0, false, "disb-cat-row mission-cat-row"), fixedRows, otherRow].join("");
                }

                if (label === "Outreach Support") {
                    const groupRows = OUTREACH_GROUPS_ORDERED.map(g => {
                        const gs = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.outreachGroup?.[g]) || 0));
                        const leafRows = (OUTREACH_HIERARCHY[g] || []).map(leaf => {
                            const ls = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.outreachLeaf?.[g]?.[leaf]) || 0));
                            return rowHTML(leaf, ls, 60, false);
                        }).join("");
                        return [rowHTML(g, gs, 34, false, "disb-subcat-row outreach-group-row"), leafRows].join("");
                    }).join("");
                    return [rowHTML(label, s, 0, false, "disb-cat-row outreach-cat-row"), groupRows].join("");
                }

                if (label === "Pastoral Ministry Expenses") {
                    const fixedRows = PASTORAL_MINISTRY_SUBCATS.map(n => {
                        const series = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.pmBySubcat?.[n]) || 0));
                        return rowHTML(n, series, 34, false, _sumRowClass(label, n));
                    }).join("");

                    const otherSeries = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.pmOther) || 0));
                    const otherRow = (otherSeries.total !== 0)
                        ? rowHTML("Other Pastoral Ministry", otherSeries, 44, false, _sumRowClass(label, "Other Pastoral Ministry"))
                        : "";

                    return [rowHTML(label, s, 0, false, "disb-cat-row pastoral-cat-row"), fixedRows, otherRow].join("");
                }

                if (label === "Supplies Expenses") {
                    const directRows = SUPPLIES_DIRECT_SUBCATS.map(n => {
                        const series = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.supBySubcat?.[n]) || 0));
                        return rowHTML(n, series, 34, false, _sumRowClass(label, n));
                    }).join("");

                    const otherRows = SUPPLIES_OTHER_SUBCATS.map(n => {
                        const series = makeSeries(weekEnds.map(sunISO => Number(_sumDisbBySunday?.[sunISO]?.supBySubcat?.[n]) || 0));
                        return rowHTML(n, series, 34, false, _sumRowClass(label, n));
                    }).join("");

                    return [rowHTML(label, s, 0, false, "disb-cat-row supplies-cat-row"), directRows, otherRows].join("");
                }

                return rowHTML(label, s, 0, false, "disb-cat-row");
            }).join("");

            box.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>Computed</th>
                <th class="amount">${renderAmtHeaderGrid(weekLabels, monthName)}</th>
              </tr>
            </thead>
            <tbody>
              ${rowHTML("CASH BALANCE BEGINNING", beginningSeries, 0, false, "rcc-begin")}
              ${renderSummaryAddReceiptsBlockWeekly()}
              ${rowHTML(`TOTAL CASH RECEIPTS (${monthName.toUpperCase()})`, totalReceiptsSeries, 0, false, "rcc-total-receipts")}
              ${rowHTML("TOTAL CASH AVAILABLE", totalAvailableSeries, 0, true, "rcc-total-available rcc-gap")}
              ${rowHTML("LESS: DISBURSEMENTS", blankSeries(colsLen), 0, false, "rcc-gap")}
              ${categoryRowsHtml}
              ${rowHTML("TOTAL DISBURSEMENTS", totalDisbursementsSeries, 0, true, "disb-total-row rcc-gap")}
              ${rowHTML("TOTAL ENDING BALANCE", endingSeries, 0, true, "rcc-ending rcc-gap")}
              ${cashBalanceRowsHtml}
            </tbody>
          </table>
        `;

            requestAnimationFrame(() => {
                try { syncSummaryComputedStylesFromReceiptsTable(); } catch (e) { }

                requestAnimationFrame(() => {
                    emitSummaryRendered(monthKey);
                });
            });
        }

        // Initialize month input to current month
        (async () => {
            const now = new Date();
            const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            if (!sumMonthInput.value) sumMonthInput.value = ym;

            const { month, year } = getMonthYear();
            const monthKey = `${year}-${String(month).padStart(2, "0")}`;

            resetSummaryMonthState(monthKey);

            await loadWeeklyTotals();
            await loadDisbursements();
        })();

        on(sumMonthInput, "change", async () => {
            const { month, year } = getMonthYear();
            const monthKey = `${year}-${String(month).padStart(2, "0")}`;

            resetSummaryMonthState(monthKey);
            if (weeklyTbody) {
                weeklyTbody.innerHTML = `<tr><td colspan="10">Loading...</td></tr>`;
            }
            if (disbTbody) {
                disbTbody.innerHTML = `<tr><td colspan="3">Loading...</td></tr>`;
            }
            if (disbTotalEl) disbTotalEl.textContent = "";

            await loadWeeklyTotals();
            await loadDisbursements();
        });

        function initWeekAgg() {
            const agg = {
                catTotals: Object.fromEntries(DISB_CATEGORY_ORDER.map(c => [c, 0])),

                adminDirect: Object.fromEntries(ADMIN_DIRECT_SUBCATS.map(n => [n, 0])),
                adminOther: Object.fromEntries(ADMIN_OTHER_SUBCATS.map(n => [n, 0])),

                maBySubcat: Object.fromEntries(MEMBERS_ASSIST_SUBCATS.map(n => [n, 0])),
                maOther: 0,

                ministryGroup: {},
                ministryLeaf: {},

                msBySubcat: Object.fromEntries(MISSION_SUPPORT_SUBCATS.map(n => [n, 0])),
                msOther: 0,

                outreachGroup: {},
                outreachLeaf: {},

                pmBySubcat: Object.fromEntries(PASTORAL_MINISTRY_SUBCATS.map(n => [n, 0])),
                pmOther: 0,

                supBySubcat: Object.fromEntries(SUPPLIES_EXPENSES_SUBCATS.map(n => [n, 0])),
                supOther: 0,
            };

            for (const g of MINISTRY_GROUPS_ORDERED) {
                agg.ministryGroup[g] = 0;
                agg.ministryLeaf[g] = {};
                for (const leaf of (MINISTRY_HIERARCHY[g] || [])) agg.ministryLeaf[g][leaf] = 0;
            }

            for (const g of OUTREACH_GROUPS_ORDERED) {
                agg.outreachGroup[g] = 0;
                agg.outreachLeaf[g] = {};
                for (const leaf of (OUTREACH_HIERARCHY[g] || [])) agg.outreachLeaf[g][leaf] = 0;
            }

            return agg;
        }

        async function loadDisbursements() {
            const { month, year } = getMonthYear();
            const monthKey = `${year}-${String(month).padStart(2, "0")}`;
            const seq = _summaryLoadSeq;

            // reset totals each load (mirror Receipts > Computed ordering)
            sumDisbCatTotals = Object.fromEntries(DISB_CATEGORY_ORDER.map(c => [c, 0]));
            _sumDisbByCategory = Object.fromEntries(DISB_CATEGORY_ORDER.map(c => [c, 0]));

            _sumAdminDirectBySubcat = Object.fromEntries(ADMIN_DIRECT_SUBCATS.map(n => [n, 0]));
            _sumAdminOtherBySubcat = Object.fromEntries(ADMIN_OTHER_SUBCATS.map(n => [n, 0]));

            _sumMaBySubcat = Object.fromEntries(MEMBERS_ASSIST_SUBCATS.map(n => [n, 0]));
            _sumMaOtherAmt = 0;

            _sumMinistryGroupTotals = {};
            _sumMinistryLeafTotals = {};
            for (const g of MINISTRY_GROUPS_ORDERED) {
                _sumMinistryGroupTotals[g] = 0;
                _sumMinistryLeafTotals[g] = {};
                const leaves = MINISTRY_HIERARCHY[g] || [];
                for (const leaf of leaves) _sumMinistryLeafTotals[g][leaf] = 0;
            }

            _sumMsBySubcat = Object.fromEntries(MISSION_SUPPORT_SUBCATS.map(n => [n, 0]));
            _sumMsOtherAmt = 0;

            _sumOutreachGroupTotals = {};
            _sumOutreachLeafTotals = {};
            for (const g of OUTREACH_GROUPS_ORDERED) {
                _sumOutreachGroupTotals[g] = 0;
                _sumOutreachLeafTotals[g] = {};
                const leaves = OUTREACH_HIERARCHY[g] || [];
                for (const leaf of leaves) _sumOutreachLeafTotals[g][leaf] = 0;
            }

            _sumPmBySubcat = Object.fromEntries(PASTORAL_MINISTRY_SUBCATS.map(n => [n, 0]));
            _sumPmOtherAmt = 0;

            _sumSupBySubcat = Object.fromEntries(SUPPLIES_EXPENSES_SUBCATS.map(n => [n, 0]));
            _sumSupOtherAmt = 0;

            try {
                const res = await fetch(`admin-functions/get-disbursements.php?month=${month}&year=${year}`);
                const data = await res.json();
                if (seq !== _summaryLoadSeq) return;
                if (!data.success) throw new Error(data.message || "Failed");

                const rows = Array.isArray(data.items) ? data.items : [];

                // init per-week buckets using cached Sundays; fallback: from current weekly table cache
                const weeks = Array.isArray(summaryWeeksCache) ? summaryWeeksCache : [];
                const sundayList = weeks.map(w => w.week_end).filter(Boolean);
                const sundaySet = new Set(sundayList);
                _sumDisbBySunday = Object.create(null);
                for (const sunISO of sundayList) _sumDisbBySunday[sunISO] = initWeekAgg();
                _sumDisbKey = monthKey;

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

                const findCI = (arr, name) => arr.find(s => (s || "").toLowerCase() === (name || "").toLowerCase());

                rows.forEach(r => {
                    const amt = parseFloat(r.amount) || 0;

                    const catNorm = normKey(r.category || "");
                    const cat = labelByNorm[catNorm] || normStr(r.category || "");

                    // week bucket
                    const txnISO = (r.txn_date || "").slice(0, 10);
                    const sundayISO = computeSundayOfTxn(txnISO);
                    const wAgg = sundaySet.has(sundayISO) ? _sumDisbBySunday[sundayISO] : null;

                    if (cat && cat in sumDisbCatTotals) {
                        sumDisbCatTotals[cat] += amt;
                        _sumDisbByCategory[cat] += amt;
                    }
                    if (wAgg && cat && cat in wAgg.catTotals) wAgg.catTotals[cat] += amt;

                    if (cat === "Administrative Expenses") {
                        const name = (r.subcategory || "").trim() || "Other Miscellaneous";
                        if (ADMIN_DIRECT_SUBCATS.includes(name)) _sumAdminDirectBySubcat[name] += amt;
                        else if (ADMIN_OTHER_SUBCATS.includes(name)) _sumAdminOtherBySubcat[name] += amt;
                        else _sumAdminDirectBySubcat["Other Miscellaneous"] += amt;

                        if (wAgg) {
                            if (ADMIN_DIRECT_SUBCATS.includes(name)) wAgg.adminDirect[name] += amt;
                            else if (ADMIN_OTHER_SUBCATS.includes(name)) wAgg.adminOther[name] += amt;
                            else wAgg.adminDirect["Other Miscellaneous"] += amt;
                        }
                    }

                    if (cat === "Members Assistance") {
                        const name = ((r.subcategory || "").trim()) || "Unspecified";
                        const match = findCI(MEMBERS_ASSIST_SUBCATS, name);
                        if (match) _sumMaBySubcat[match] += amt;
                        else _sumMaOtherAmt += amt;

                        if (wAgg) {
                            if (match) wAgg.maBySubcat[match] += amt;
                            else wAgg.maOther += amt;
                        }
                    }

                    if (cat === "Ministry Expenses") {
                        const raw = normStr(r.subcategory || "");
                        const rawNorm = normKey(raw);
                        const noteNorm = normKey(r.note || "");

                        let matchedGroup = null, matchedLeaf = null;

                        for (const g of MINISTRY_GROUPS_ORDERED) {
                            const gNorm = normKey(g);
                            if (rawNorm === gNorm || rawNorm.startsWith(gNorm)) {
                                matchedGroup = g;
                                const leaves = MINISTRY_HIERARCHY[g] || [];
                                for (const leaf of leaves) {
                                    const leafNorm = normKey(leaf);
                                    if (rawNorm.includes(leafNorm) || noteNorm.includes(leafNorm)) {
                                        matchedLeaf = leaf;
                                        break;
                                    }
                                }
                                break;
                            }
                        }

                        if (!matchedGroup && raw) {
                            outer: for (const g of MINISTRY_GROUPS_ORDERED) {
                                const leaves = MINISTRY_HIERARCHY[g] || [];
                                for (const leaf of leaves) {
                                    if (normKey(leaf) === rawNorm) {
                                        matchedGroup = g;
                                        matchedLeaf = leaf;
                                        break outer;
                                    }
                                }
                            }
                        }

                        if (matchedGroup && matchedLeaf) {
                            _sumMinistryGroupTotals[matchedGroup] += amt;
                            _sumMinistryLeafTotals[matchedGroup][matchedLeaf] =
                                (_sumMinistryLeafTotals[matchedGroup][matchedLeaf] || 0) + amt;
                        } else if (matchedGroup) {
                            _sumMinistryGroupTotals[matchedGroup] += amt;
                        }

                        if (wAgg) {
                            if (matchedGroup && matchedLeaf) {
                                wAgg.ministryGroup[matchedGroup] += amt;
                                wAgg.ministryLeaf[matchedGroup][matchedLeaf] =
                                    (wAgg.ministryLeaf[matchedGroup][matchedLeaf] || 0) + amt;
                            } else if (matchedGroup) {
                                wAgg.ministryGroup[matchedGroup] += amt;
                            }
                        }
                    }

                    if (cat === "Mission Support") {
                        const name = (r.subcategory || "").trim();
                        const match = findCI(MISSION_SUPPORT_SUBCATS, name);
                        if (match) _sumMsBySubcat[match] += amt;
                        else _sumMsOtherAmt += amt;

                        if (wAgg) {
                            if (match) wAgg.msBySubcat[match] += amt;
                            else wAgg.msOther += amt;
                        }
                    }

                    if (cat === "Outreach Support") {
                        const raw = normStr(r.subcategory || "");
                        const rawNorm = normKey(raw);
                        const noteNorm = normKey(r.note || "");

                        let matchedGroup = null, matchedLeaf = null;

                        for (const g of OUTREACH_GROUPS_ORDERED) {
                            const gNorm = normKey(g);
                            if (rawNorm === gNorm || rawNorm.startsWith(gNorm)) {
                                matchedGroup = g;
                                const leaves = OUTREACH_HIERARCHY[g] || [];
                                for (const leaf of leaves) {
                                    const leafNorm = normKey(leaf);
                                    if (rawNorm.includes(leafNorm) || noteNorm.includes(leafNorm)) {
                                        matchedLeaf = leaf;
                                        break;
                                    }
                                }
                                break;
                            }
                        }

                        if (!matchedGroup && raw) {
                            outer: for (const g of OUTREACH_GROUPS_ORDERED) {
                                const leaves = OUTREACH_HIERARCHY[g] || [];
                                for (const leaf of leaves) {
                                    if (normKey(leaf) === rawNorm) {
                                        matchedGroup = g;
                                        matchedLeaf = leaf;
                                        break outer;
                                    }
                                }
                            }
                        }

                        if (matchedGroup && matchedLeaf) {
                            _sumOutreachGroupTotals[matchedGroup] += amt;
                            _sumOutreachLeafTotals[matchedGroup][matchedLeaf] =
                                (_sumOutreachLeafTotals[matchedGroup][matchedLeaf] || 0) + amt;
                        } else if (matchedGroup) {
                            _sumOutreachGroupTotals[matchedGroup] += amt;
                        }
                        if (wAgg) {
                            if (matchedGroup && matchedLeaf) {
                                wAgg.outreachGroup[matchedGroup] += amt;
                                wAgg.outreachLeaf[matchedGroup][matchedLeaf] =
                                    (wAgg.outreachLeaf[matchedGroup][matchedLeaf] || 0) + amt;
                            } else if (matchedGroup) {
                                wAgg.outreachGroup[matchedGroup] += amt;
                            }
                        }
                    }

                    if (cat === "Pastoral Ministry Expenses") {
                        const name = (r.subcategory || "").trim();
                        const match = findCI(PASTORAL_MINISTRY_SUBCATS, name);
                        if (match) _sumPmBySubcat[match] += amt;
                        else _sumPmOtherAmt += amt;

                        if (wAgg) {
                            if (match) wAgg.pmBySubcat[match] += amt;
                            else wAgg.pmOther += amt;
                        }
                    }

                    if (cat === "Supplies Expenses") {
                        const name = (r.subcategory || "").trim();
                        const match = findCI(SUPPLIES_EXPENSES_SUBCATS, name);
                        if (match) _sumSupBySubcat[match] += amt;
                        else _sumSupOtherAmt += amt;

                        if (wAgg) {
                            if (match) wAgg.supBySubcat[match] += amt;
                            else wAgg.supOther += amt;
                        }
                    }
                });

                if (seq === _summaryLoadSeq) recomputeSummaryTotals();
            } catch (err) {
                if (seq !== _summaryLoadSeq) return;
                console.error("loadDisbursements error:", err);
                disbTbody.innerHTML = `<tr><td colspan="3">Error loading disbursements.</td></tr>`;
                disbTotalEl.textContent = "";

                _sumDisbBySunday = Object.create(null);
                _sumDisbKey = "";

                if (seq === _summaryLoadSeq) recomputeSummaryTotals();
            }
        }


        if (disbTbody) {
            disbTbody.addEventListener("click", async (e) => {
                const btn = e.target.closest(".disb-del");
                if (!btn) return;
                const tr = btn.closest("tr");
                const id = parseInt(tr?.dataset.id || "0", 10);
                if (!id) return;
                if (!confirm("Delete this disbursement?")) return;

                try {
                    const res = await safeFetch('admin-functions/delete-disbursement.php', {
                        method: "POST",
                        body: addCSRF(new URLSearchParams({ id }))
                    });

                    const data = await res.json();
                    if (data.success) {
                        tr.remove();
                        loadDisbursements();
                    } else {
                        alert(data.message || "Delete failed");
                    }
                } catch (err) {
                    console.error(err);
                    alert("Network error.");
                }
            });
        }

        function getSummaryMonthlyTotalsExportRow() {
            // Prefer server-derived cache from loadWeeklyTotals() to avoid DOM dependency.
            const t = summaryMonthlyTotalsCache?.totals;
            if (t) {
                const monthLabel = summaryMonthlyTotalsCache.monthName || "Month";
                return [
                    monthLabel,
                    fmtNumber(t.tithes),
                    fmtNumber(t.offering),
                    fmtNumber(t.pledge),
                    fmtNumber(t.eskwela_suporta),
                    fmtNumber(t.others),
                    fmtNumber(t.construction),
                    fmtNumber(t.samarleyte_pledge),
                    fmtNumber(t.total),
                    t.last_updated || ""
                ];
            }

            // Fallback: read the appended monthly row from the weekly table.
            const row = qs("#summaryWeeklyTotalsTable tbody tr.summary-monthly-total-row");
            if (!row) return null;
            const cells = Array.from(row.querySelectorAll("td"));
            if (cells.length < 10) return null;
            return cells.map(td => (td.textContent || "").trim());
        }

        function summaryLabel() {
            return (weeklyRangeEl?.textContent || "").trim();
        }

        // ===== CSV exports (summary) =====
        function exportSummaryWeeklyCSV() {
            const rangeLabel = summaryLabel();
            const row = getSummaryMonthlyTotalsExportRow();
            if (!row) return alert("No monthly totals available.");

            let csv = `WEEKLY TOTALS FOR ${rangeLabel}\n`;
            csv += ["Week", "", "Tithes", "Offering", "Pledge", "ES", "Others", "Construction", "Samar Leyte", "Overall Total", "Last Updated"].join(",") + "\n";

            const raw = row.map((v, i) => {
                let val = (v || "").trim();
                if (i >= 1 && i <= 8) val = val.replace(/₱/g, "");
                return val;
            });
            raw.splice(1, 0, "");
            const vals = raw.map(v => `"${v.replace(/"/g, '""')}"`);
            csv += vals.join(",") + "\n";

            const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Offertory_Weekly_${rangeLabel}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function exportSummaryMonthlyCSV() {
            const rangeLabel = (monthlyRangeEl?.textContent || "").trim();
            let csv = `MONTHLY TOTALS FOR ${rangeLabel}\n`;
            csv += ["Month", "", "Tithes", "Offering", "Pledge", "ES", "Others", "Construction", "Samar Leyte", "Overall Total", "Last Updated"].join(",") + "\n";

            qsa("#summaryMonthlyTotalsTable tbody tr").forEach(row => {
                if (row.style.display === "none") return;
                const cells = row.querySelectorAll("td");
                const raw = Array.from(cells).map((td, i) => {
                    let v = (td.textContent || "").trim();
                    if (i >= 1 && i <= 8) v = v.replace(/₱/g, "");
                    return v;
                });
                raw.splice(1, 0, "");
                const vals = raw.map(v => `"${v.replace(/"/g, '""')}"`);
                csv += vals.join(",") + "\n";
            });

            const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Offertory_Monthly_${rangeLabel}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function exportSummaryOverallCSV() {
            const monthLabel = summaryLabel();
            let csv = `OVERALL RECEIPTS FOR ${monthLabel}\n`;

            // Weekly section
            csv += `\nWEEKLY TOTALS FOR ${monthLabel}\n`;
            csv += ["Week", "", "Tithes", "Offering", "Pledge", "ES", "Others", "Construction", "Samar Leyte", "Overall Total", "Last Updated"].join(",") + "\n";
            qsa("#summaryWeeklyTotalsTable tbody tr").forEach(row => {
                if (row.style.display === "none") return;
                if (row.classList.contains("summary-monthly-total-row")) return;
                const cells = row.querySelectorAll("td");
                const raw = Array.from(cells).map((td, i) => {
                    let v = (td.textContent || "").trim();
                    if (i > 0 && i < 9) v = v.replace(/₱/g, "");
                    return v;
                });
                raw.splice(1, 0, "");
                const vals = raw.map(v => `"${v.replace(/"/g, '""')}"`);
                csv += vals.join(",") + "\n";
            });

            // Monthly section (single row)
            const mrow = getSummaryMonthlyTotalsExportRow();
            csv += `\nMONTHLY TOTALS FOR ${monthLabel}\n`;
            csv += ["Month", "", "Tithes", "Offering", "Pledge", "ES", "Others", "Construction", "Samar Leyte", "Overall Total", "Last Updated"].join(",") + "\n";

            if (mrow) {
                const raw = mrow.map((v, i) => {
                    let val = (v || "").trim();
                    if (i >= 1 && i <= 8) val = val.replace(/₱/g, "");
                    return val;
                });
                raw.splice(1, 0, "");
                const vals = raw.map(v => `"${v.replace(/"/g, '""')}"`);
                csv += vals.join(",") + "\n";
            } else {
                csv += `"${monthLabel}","","No monthly totals found."\n`;
            }

            const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Offertory_Overall_${monthLabel.replace(/\s+/g, "_")}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // ===== PDF exports (summary) =====
        function exportSummaryWeeklyPDF() {
            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) return alert("jsPDF not loaded");

            const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
            if (typeof doc.autoTable !== "function") return alert("jsPDF autoTable plugin not loaded");

            const margin = 32;
            let y = margin;

            const rangeLabel = (weeklyRangeEl?.textContent || "").trim();
            doc.setFontSize(14);
            doc.text(`Weekly Totals for ${rangeLabel}`, margin, y);
            y += 12;

            const head = Array.from(qsa("#summaryWeeklyTotalsTable thead th")).map(th => th.textContent.trim());
            const body = [];
            qsa("#summaryWeeklyTotalsTable tbody tr").forEach(row => {
                if (row.style.display === "none") return;
                const arr = Array.from(row.querySelectorAll("td")).map((td, i) => {
                    let v = (td.textContent || "").trim();
                    if (i > 0 && i < 9) v = v.replace(/₱/g, "");
                    return v;
                });
                body.push(arr);
            });

            doc.autoTable({
                head: [head],
                body,
                startY: y,
                margin: { left: margin, right: margin },
                styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", textColor: [0, 0, 0] },
                headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }
            });

            doc.save(`Offertory_Weekly_${rangeLabel}.pdf`);
        }

        function exportSummaryMonthlyPDF() {
            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) return alert("jsPDF not loaded");

            const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
            if (typeof doc.autoTable !== "function") return alert("jsPDF autoTable plugin not loaded");

            const margin = 32;
            let y = margin;

            const rangeLabel = summaryLabel();
            const row = getSummaryMonthlyTotalsExportRow();
            if (!row) return alert("No monthly totals available.");

            doc.setFontSize(14);
            doc.text(`Monthly Totals for ${rangeLabel}`, margin, y);
            y += 12;

            const head = ["Month", "Tithes", "Offering", "Pledge", "ES", "Others", "Construction", "Samar Leyte", "Overall Total", "Last Updated"];
            const body = [row.map((v, i) => {
                let val = (v || "").trim();
                if (i >= 1 && i <= 8) val = val.replace(/₱/g, "");
                return val;
            })];

            doc.autoTable({
                head: [head],
                body,
                startY: y,
                margin: { left: margin, right: margin },
                styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", textColor: [0, 0, 0] },
                headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }
            });

            doc.save(`Offertory_Monthly_${rangeLabel}.pdf`);
        }

        function exportSummaryOverallPDF() {
            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) return alert("jsPDF not loaded");

            const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
            if (typeof doc.autoTable !== "function") return alert("jsPDF autoTable plugin not loaded");

            const margin = 32;
            let y = margin;

            const monthLabel = summaryLabel();

            // Weekly
            doc.setFontSize(14);
            doc.text(`Weekly Totals for ${monthLabel}`, margin, y);
            y += 12;
            (function () {
                const head = Array.from(qsa("#summaryWeeklyTotalsTable thead th")).map(th => th.textContent.trim());
                const body = [];
                qsa("#summaryWeeklyTotalsTable tbody tr").forEach(row => {
                    if (row.style.display === "none") return;
                    if (row.classList.contains("summary-monthly-total-row")) return;
                    const arr = Array.from(row.querySelectorAll("td")).map((td, i) => {
                        let v = (td.textContent || "").trim();
                        if (i > 0 && i < 9) v = v.replace(/₱/g, "");
                        return v;
                    });
                    body.push(arr);
                });
                doc.autoTable({
                    head: [head],
                    body,
                    startY: y,
                    margin: { left: margin, right: margin },
                    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", textColor: [0, 0, 0] },
                    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }
                });
                y = doc.lastAutoTable.finalY + 20;
            })();

            // Monthly
            doc.setFontSize(14);
            doc.text(`Monthly Totals for ${monthLabel}`, margin, y);
            y += 12;
            (function () {
                const row = getSummaryMonthlyTotalsExportRow();
                const head = ["Month", "Tithes", "Offering", "Pledge", "ES", "Others", "Construction", "Samar Leyte", "Overall Total", "Last Updated"];
                const body = row ? [row.map((v, i) => {
                    let val = (v || "").trim();
                    if (i >= 1 && i <= 8) val = val.replace(/₱/g, "");
                    return val;
                })] : [["(none)", "", "", "", "", "", "", "", "", ""]];

                doc.autoTable({
                    head: [head],
                    body,
                    startY: y,
                    margin: { left: margin, right: margin },
                    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", textColor: [0, 0, 0] },
                    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }
                });
            })();

            doc.save(`Offertory_Overall_${monthLabel.replace(/\s+/g, "_")}.pdf`);
        }

        // Dropdown open/close (reuse same pattern)
        qsa("#summaryCsvDropdown > button, #summaryPdfDropdown > button").forEach(btn => {
            on(btn, "click", (e) => {
                e.stopPropagation();
                const dropdown = btn.parentElement;
                qsa(".OP-export-dropdown").forEach(d => { if (d !== dropdown) d.classList.remove("OP-active"); });
                dropdown.classList.toggle("OP-active");
            });
        });
        on(document, "click", () => qsa(".OP-export-dropdown").forEach(d => d.classList.remove("OP-active")));

        // Wire export actions (summary)
        qsa("#summaryCsvDropdown .OP-dropdown-menu button").forEach(opt => {
            on(opt, "click", () => {
                const t = opt.dataset.type;
                if (t === "week") exportSummaryWeeklyCSV();
                if (t === "month") exportSummaryMonthlyCSV();
                if (t === "month_overall") exportSummaryOverallCSV();
                opt.closest(".OP-export-dropdown")?.classList.remove("OP-active");
            });
        });
        qsa("#summaryPdfDropdown .OP-dropdown-menu button").forEach(opt => {
            on(opt, "click", () => {
                const t = opt.dataset.type;
                if (t === "week") exportSummaryWeeklyPDF();
                if (t === "month") exportSummaryMonthlyPDF();
                if (t === "month_overall") exportSummaryOverallPDF();
                opt.closest(".OP-export-dropdown")?.classList.remove("OP-active");
            });
        });
    })();
});
