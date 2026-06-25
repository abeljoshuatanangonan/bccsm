/**
 * File: BCCSMOfficial/assets/js/adminoffertory_memberrecords.js
 *
 * Member Records-tab-only logic for admin-offertory.php?tab=records.
 * Migrated out of assets/js/admin-script.js.
 */
(function initWhenReady(factory) {
    const run = () => setTimeout(factory, 0);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
        run();
    }
})(() => {
    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);
    const delegate = (root, evt, sel, handler) => on(root, evt, e => {
        const target = e.target.closest(sel);
        if (target && root.contains(target)) handler(e, target);
    });

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

    const safeFetchAdmin = async (endpoint, opts = {}) => {
        if (typeof window.safeFetchAdmin === "function") {
            return window.safeFetchAdmin(endpoint, opts);
        }
        const ep = typeof endpoint === "string" ? endpoint : String(endpoint ?? "");

        const makeCandidates = (s) => {
            const hasAdminFunctions = s.includes("admin-functions/");
            const hasAdminFuncitons = s.includes("admin-funcitons/");
            if (hasAdminFunctions) return [s, s.replace("admin-functions/", "admin-funcitons/")];
            if (hasAdminFuncitons) return [s, s.replace("admin-funcitons/", "admin-functions/")];
            return [`admin-functions/${s}`, `admin-funcitons/${s}`, s];
        };

        let lastErr = null;
        for (const url of makeCandidates(ep)) {
            try {
                return await safeFetch(url, opts);
            } catch (err) {
                lastErr = err;
            }
        }
        throw lastErr || new Error("safeFetchAdmin failed");
    };

    const jsonOrThrow = async (res) => {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error("Invalid JSON response");
        }
    };

    const fmtNumber = (v) => {
        const n = parseFloat(v);
        if (!Number.isFinite(n)) return "";
        return n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    if (!qs("#memberRecordsTable") && !qs("#memberRecordsCalendar")) return;

    async function openMemberReceiptsModal(username, dateISO) {
        const modal = qs("#memberReceiptsModal");
        const closeBtn = qs("#closeMemberReceiptsModal");
        const titleEl = qs("#memberReceiptsTitle");
        const tbody = qs("#memberReceiptsTable tbody");

        if (!modal || !closeBtn || !titleEl || !tbody) return;

        const d = new Date(dateISO + "T00:00:00");
        const dateLabel = d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        titleEl.textContent = `Receipts of ${username} on ${dateLabel}`;

        try {
            const res = await safeFetchAdmin(`get-offertory-by-member-and-date.php?username=${encodeURIComponent(username)}&date=${encodeURIComponent(dateISO)}`);
            const data = await jsonOrThrow(res);

            if (!data || data.success !== true) {
                throw new Error(data && data.message ? data.message : "Failed to load receipts");
            }

            const daily = data.daily || data.totals || {};
            const overall = data.overall || data.totals || {};

            const sumTotals = (t) => {
                const tithes = Number(t.tithes ?? 0);
                const offering = Number(t.offering ?? 0);
                const pledge = Number(t.pledge ?? 0);
                const es = Number(t.eskwela_suporta ?? 0);
                const others = Number(t.others ?? 0);
                const construction = Number(t.construction ?? 0);
                const samar = Number(t.samarleyte_pledge ?? 0);
                return tithes + offering + pledge + es + others + construction + samar;
            };

            const dailyTotal = "overall_total" in daily ? daily.overall_total : sumTotals(daily);
            const overallTotal = "overall_total" in overall ? overall.overall_total : sumTotals(overall);

            const fmt = (v) => (typeof fmtNumber === "function" ? fmtNumber(v) : String(v ?? ""));

            tbody.innerHTML = `
      <tr>
        <td>Receipts on ${dateLabel}</td>
        <td>${fmt(daily.tithes)}</td>
        <td>${fmt(daily.offering)}</td>
        <td>${fmt(daily.pledge)}</td>
        <td>${fmt(daily.eskwela_suporta)}</td>
        <td>${fmt(daily.others)}</td>
        <td>${fmt(daily.construction)}</td>
        <td>${fmt(daily.samarleyte_pledge)}</td>
        <td>${fmt(dailyTotal)}</td>
      </tr>
      <tr>
        <td>Present Overall Total</td>
        <td>${fmt(overall.tithes)}</td>
        <td>${fmt(overall.offering)}</td>
        <td>${fmt(overall.pledge)}</td>
        <td>${fmt(overall.eskwela_suporta)}</td>
        <td>${fmt(overall.others)}</td>
        <td>${fmt(overall.construction)}</td>
        <td>${fmt(overall.samarleyte_pledge)}</td>
        <td>${fmt(overallTotal)}</td>
      </tr>
    `;

            modal.style.display = "flex";

            if (typeof wireMemberHistoryExports === "function") wireMemberHistoryExports();

            on(closeBtn, "click", () => {
                modal.style.display = "none";
            });
            on(modal, "click", (evt) => {
                if (evt.target === modal) modal.style.display = "none";
            });
            on(
                document,
                "keydown",
                (evt) => {
                    if (evt.key === "Escape") modal.style.display = "none";
                },
                { once: true }
            );
        } catch (err) {
            console.error("Failed to load member receipts for modal:", err);
            alert("Failed to load receipts for this date.");
        }
    }

    // ---------- Member Records Tab (Offertory page) ----------
    (() => {
        const memberSearchInput = qs("#memberSearchName");
        const memberToggleSortOrder = qs("#memberToggleSortOrder");
        const memberRecordsTable = qs("#memberRecordsTable");
        const memberRecordsTbody = memberRecordsTable ? memberRecordsTable.querySelector("tbody") : null;
        let memberSortOrder = "asc";

        if (!memberRecordsTbody) return;

        const applyMemberFilters = () => {
            const q = (memberSearchInput?.value || "").trim().toLowerCase();
            const rows = Array.from(memberRecordsTbody.querySelectorAll("tr"));

            rows.forEach(row => {
                const nameCell = row.querySelector("td:first-child");
                const nameText = (nameCell?.textContent || "").trim().toLowerCase();
                const match = q ? nameText.includes(q) : true;
                row.style.display = match ? "" : "none";
            });
        };

        const sortMemberRows = () => {
            const rows = Array.from(memberRecordsTbody.querySelectorAll("tr"));
            rows.sort((a, b) => {
                const aName = (a.querySelector("td:first-child")?.textContent || "").trim().toLowerCase();
                const bName = (b.querySelector("td:first-child")?.textContent || "").trim().toLowerCase();
                if (aName < bName) return memberSortOrder === "asc" ? -1 : 1;
                if (aName > bName) return memberSortOrder === "asc" ? 1 : -1;
                return 0;
            });
            rows.forEach(row => memberRecordsTbody.appendChild(row));
        };

        applyMemberFilters();

        on(memberSearchInput, "input", () => {
            applyMemberFilters();
        });

        on(memberToggleSortOrder, "click", () => {
            memberSortOrder = memberSortOrder === "asc" ? "desc" : "asc";
            if (memberToggleSortOrder) {
                memberToggleSortOrder.textContent = memberSortOrder === "asc" ? "▲" : "▼";
            }
            sortMemberRows();
            applyMemberFilters();
        });
    })();

    // ---------- Member Records Calendar (independent from Receipts) ----------
    (() => {
        const calendarEl = qs("#memberRecordsCalendar");
        if (!calendarEl || typeof FullCalendar === "undefined") return;

        const pad = (n) => String(n).padStart(2, "0");

        const now = new Date();
        const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const today = new Date(`${todayISO}T00:00:00`);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowISO = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

        let lastSelectedCell = null;

        const memberCalendar = new FullCalendar.Calendar(calendarEl, {
            initialView: "dayGridMonth",
            selectable: true,
            height: "auto",
            validRange: {
                end: tomorrowISO,
            },
            eventDisplay: "block",
            eventContent(info) {
                const dot = document.createElement("span");
                dot.className = "member-offertory-dot";
                return { domNodes: [dot] };
            },
            dateClick(info) {
                const clicked = new Date(info.dateStr + "T00:00:00");
                if (clicked > today) return;

                if (lastSelectedCell) {
                    lastSelectedCell.classList.remove("OP-selected-date");
                }
                if (info.dayEl) {
                    info.dayEl.classList.add("OP-selected-date");
                    lastSelectedCell = info.dayEl;
                }

                const username = window.memberRecordsSelectedUsername || "";
                if (!username) return;

                const events = memberCalendar.getEvents();
                const hasEvent = events.some((e) => {
                    const d = e.start;
                    if (!d) return false;

                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    const isoLocal = `${y}-${m}-${day}`;

                    return isoLocal === info.dateStr;
                });

                if (!hasEvent) return;

                openMemberReceiptsModal(username, info.dateStr);
            },
        });

        memberCalendar.render();
        window.memberRecordsCalendarInstance = memberCalendar;

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
    })();

    // ---------- Member Records: row selection + calendar dots + "View All" ----------
    (() => {
        const table = qs("#memberRecordsTable");
        if (!table) return;

        const tbody = table.querySelector("tbody");
        if (!tbody) return;

        const memberCalendar = window.memberRecordsCalendarInstance || null;

        async function loadMemberCalendarDots(username) {
            if (!memberCalendar || !username) return;

            try {
                const res = await safeFetchAdmin(`get-offertory-dates-by-member.php?username=${encodeURIComponent(username)}`);
                const data = await jsonOrThrow(res);

                if (!data || data.success !== true || !Array.isArray(data.dates)) {
                    throw new Error(data && data.message ? data.message : "Failed to load dates");
                }

                const events = data.dates.map((d) => ({
                    start: d,
                    allDay: true,
                }));

                memberCalendar.removeAllEvents();
                memberCalendar.addEventSource(events);
            } catch (err) {
                console.error("Failed to load member offertory dates:", err);
            }
        }

        async function openMemberHistoryModal(username) {
            const modal = qs("#memberHistoryModal");
            const closeBtn = qs("#closeMemberHistoryModal");
            const titleEl = qs("#memberHistoryTitle");
            const tbodyEl = qs("#memberHistoryTable tbody");

            if (!modal || !closeBtn || !titleEl || !tbodyEl) return;

            titleEl.textContent = `${username}'s Receipt History`;

            try {
                const res = await safeFetchAdmin(
                    `get-offertory-by-member-and-dates.php?username=${encodeURIComponent(username)}&mode=history`
                );

                const data = await jsonOrThrow(res);

                if (!data || data.success !== true || !Array.isArray(data.rows)) {
                    throw new Error(data && data.message ? data.message : "Failed to load history");
                }

                const rows = data.rows.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
                if (!rows.length) {
                    tbodyEl.innerHTML = `<tr><td colspan="10">${username} has no receipts yet.</td></tr>`;
                } else {
                    const fmt = (v) => {
                        const n = Number(v);
                        if (!Number.isFinite(n) || n === 0) {
                            return "";
                        }
                        return typeof fmtNumber === "function"
                            ? fmtNumber(n)
                            : n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                    };

                    const num = (v) => {
                        const n = Number(v);
                        return Number.isFinite(n) ? n : 0;
                    };

                    const html = rows
                        .map((r) => {
                            const iso = r.date;
                            const d = new Date(iso + "T00:00:00");
                            const dateLabel = d.toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            });

                            const tithes = num(r.tithes);
                            const offering = num(r.offering);
                            const pledge = num(r.pledge);
                            const es = num(r.eskwela_suporta);
                            const others = num(r.others);
                            const construction = num(r.construction);
                            const samar = num(r.samarleyte_pledge);

                            const total =
                                r.overall_total != null
                                    ? num(r.overall_total)
                                    : tithes + offering + pledge + es + others + construction + samar;

                            const entryType = r.entry_type || "Single";

                            return `
                <tr>
                  <td>${dateLabel}</td>
                  <td>${entryType}</td>
                  <td>${fmt(tithes)}</td>
                  <td>${fmt(offering)}</td>
                  <td>${fmt(pledge)}</td>
                  <td>${fmt(es)}</td>
                  <td>${fmt(others)}</td>
                  <td>${fmt(construction)}</td>
                  <td>${fmt(samar)}</td>
                  <td>${fmt(total)}</td>
                </tr>
              `;
                        })
                        .join("");

                    const totals = rows.reduce(
                        (acc, r) => {
                            acc.tithes += num(r.tithes);
                            acc.offering += num(r.offering);
                            acc.pledge += num(r.pledge);
                            acc.es += num(r.eskwela_suporta);
                            acc.others += num(r.others);
                            acc.construction += num(r.construction);
                            acc.samar += num(r.samarleyte_pledge);

                            const rowTotal =
                                r.overall_total != null
                                    ? num(r.overall_total)
                                    : num(r.tithes) + num(r.offering) + num(r.pledge) + num(r.eskwela_suporta) +
                                    num(r.others) + num(r.construction) + num(r.samarleyte_pledge);

                            acc.total += rowTotal;
                            return acc;
                        },
                        { tithes: 0, offering: 0, pledge: 0, es: 0, others: 0, construction: 0, samar: 0, total: 0 }
                    );

                    const overallRow = `
            <tr class="member-history-overall-row">
              <td colspan="2">Overall Total</td>
              <td>${fmt(totals.tithes)}</td>
              <td>${fmt(totals.offering)}</td>
              <td>${fmt(totals.pledge)}</td>
              <td>${fmt(totals.es)}</td>
              <td>${fmt(totals.others)}</td>
              <td>${fmt(totals.construction)}</td>
              <td>${fmt(totals.samar)}</td>
              <td>${fmt(totals.total)}</td>
            </tr>
          `;

                    tbodyEl.innerHTML = html + overallRow;
                }

                modal.style.display = "flex";

                if (typeof wireMemberHistoryExports === "function") wireMemberHistoryExports();

                const onOverlayClick = (ev) => {
                    if (ev.target === modal) {
                        modal.style.display = "none";
                        modal.removeEventListener("click", onOverlayClick);
                    }
                };

                const onKeyDown = (ev) => {
                    if (ev.key === "Escape") {
                        modal.style.display = "none";
                        document.removeEventListener("keydown", onKeyDown);
                    }
                };

                on(closeBtn, "click", () => {
                    modal.style.display = "none";
                });
                on(modal, "click", onOverlayClick);
                document.addEventListener("keydown", onKeyDown, { once: true });
            } catch (err) {
                console.error("Failed to load member history:", err);
                alert("Failed to load receipt history.");
            }
        }

        function exportMemberHistoryCSV(username) {
            const table = qs("#memberHistoryTable");
            if (!table) return alert("History table not found.");
            const thead = table.querySelector("thead");
            const tbody = table.querySelector("tbody");
            const headCells = Array.from(thead.querySelectorAll("th")).map(th => (th.textContent || "").trim());
            const rows = Array.from(tbody.querySelectorAll("tr")).map(tr =>
                Array.from(tr.querySelectorAll("td")).map(td => {
                    let v = (td.textContent || "").trim();
                    if (v.startsWith("₱")) v = v.replace(/₱/g, "");
                    return v;
                })
            );

            const escapeCsv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
            let csv = "\uFEFF";
            csv += headCells.map(escapeCsv).join(",") + "\n";
            rows.forEach(r => { csv += r.map(escapeCsv).join(",") + "\n"; });

            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ReceiptHistory_${String(username || "Member").replace(/\s+/g, "_")}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function exportMemberHistoryPDF(username) {
            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) return alert("jsPDF not loaded");
            const table = qs("#memberHistoryTable");
            if (!table) return alert("History table not found.");

            const title = `${username || "Member"}'s Receipt History`;
            const headCells = Array.from(table.querySelectorAll("thead th")).map(th => (th.textContent || "").trim());
            const bodyRows = Array.from(table.querySelectorAll("tbody tr")).map(tr =>
                Array.from(tr.querySelectorAll("td")).map(td => {
                    let v = (td.textContent || "").trim();
                    if (v.startsWith("₱")) v = v.replace(/₱/g, "");
                    return v;
                })
            );

            const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text(title, 40, 40);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);

            doc.autoTable({
                head: [headCells],
                body: bodyRows,
                startY: 60,
                styles: { font: "helvetica", fontSize: 9, cellPadding: 4 },
                headStyles: { fillColor: [0, 0, 0], textColor: 255, halign: "center" },
                bodyStyles: { halign: "right" },
                columnStyles: { 0: { halign: "left" } },
                margin: { left: 40, right: 40 },
            });

            doc.save(`ReceiptHistory_${String(username || "Member").replace(/\s+/g, "_")}.pdf`);
        }

        const wireMemberHistoryExports = () => {
            const csvDD = qs("#memberHistoryCsvDropdown");
            const pdfDD = qs("#memberHistoryPdfDropdown");
            if (!csvDD || !pdfDD) return;

            if (csvDD.dataset.wired === "1" && pdfDD.dataset.wired === "1") return;
            csvDD.dataset.wired = "1";
            pdfDD.dataset.wired = "1";

            const getUsername = () =>
                (qs("#memberHistoryTitle")?.textContent || "")
                    .replace(/'s Receipt History$/, "")
                    .trim();

            const csvMenuBtns = qsa("#memberHistoryCsvDropdown .OP-dropdown-menu button");
            const pdfMenuBtns = qsa("#memberHistoryPdfDropdown .OP-dropdown-menu button");

            if (csvMenuBtns.length || pdfMenuBtns.length) {
                [csvDD, pdfDD].forEach(dd => {
                    const btn = dd.querySelector("button");
                    on(btn, "click", (e) => {
                        e.stopPropagation();
                        qsa(".OP-export-dropdown").forEach(d => { if (d !== dd) d.classList.remove("OP-active"); });
                        dd.classList.toggle("OP-active");
                    });
                });

                csvMenuBtns.forEach(opt => {
                    on(opt, "click", (e) => {
                        e.stopPropagation();
                        exportMemberHistoryCSV(getUsername());
                        opt.closest(".OP-export-dropdown")?.classList.remove("OP-active");
                    });
                });

                pdfMenuBtns.forEach(opt => {
                    on(opt, "click", (e) => {
                        e.stopPropagation();
                        exportMemberHistoryPDF(getUsername());
                        opt.closest(".OP-export-dropdown")?.classList.remove("OP-active");
                    });
                });

                return;
            }

            const csvBtn = qs("#memberHistoryExportCSV");
            const pdfBtn = qs("#memberHistoryExportPDF");

            on(csvBtn, "click", (e) => {
                e.preventDefault();
                exportMemberHistoryCSV(getUsername());
            });

            on(pdfBtn, "click", (e) => {
                e.preventDefault();
                exportMemberHistoryPDF(getUsername());
            });
        };

        wireMemberHistoryExports();

        function showViewAllButton(row, username) {
            qsa("td.member-view-all-cell", tbody).forEach((cell) => {
                cell.innerHTML = "";
            });

            let cell = row.querySelector("td.member-view-all-cell");
            if (!cell) {
                cell = document.createElement("td");
                cell.className = "member-view-all-cell";
                row.appendChild(cell);
            }

            cell.innerHTML = `
        <div class="fc-toolbar-chunk">
          <button type="button" class="member-view-all-btn">View All</button>
        </div>
      `;

            row.dataset.username = username;
        }

        delegate(tbody, "click", "tr", (e, row) => {
            if (e.target.closest(".member-view-all-btn")) return;

            qsa("tr.member-record-selected", tbody).forEach((r) => {
                r.classList.remove("member-record-selected");
            });

            row.classList.add("member-record-selected");

            const nameCell = row.querySelector("td:first-child");
            const username = (nameCell?.textContent || "").trim();
            if (username) {
                window.memberRecordsSelectedUsername = username;
                loadMemberCalendarDots(username);
                showViewAllButton(row, username);
            }
        });

        delegate(tbody, "click", ".member-view-all-btn", (e, btn) => {
            e.stopPropagation();
            const row = btn.closest("tr");
            if (!row) return;

            const username =
                (row.dataset.username || row.querySelector("td:first-child")?.textContent || "").trim();
            if (!username) return;

            openMemberHistoryModal(username);
        });
    })();

});