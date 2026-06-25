document.addEventListener("DOMContentLoaded", () => {
    const ReceiptsTabPdf = (() => {
        const qs = (sel, root = document) => root.querySelector(sel);
        const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

        const getSelectedDate = (dateISOFromCaller = "") => {
            const rawCaller = String(dateISOFromCaller || "").trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawCaller)) return rawCaller;

            const selectedDateEl = qs("#selectedDate");
            const rawText = String(selectedDateEl?.textContent || "").trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawText)) return rawText;

            const rawDataDate =
                String(selectedDateEl?.dataset?.date || "").trim() ||
                String(
                    qs("#calendar [data-date].selected, #calendar [data-date].active, #calendar [data-date].selected-day")
                        ?.dataset?.date || ""
                ).trim();

            if (/^\d{4}-\d{2}-\d{2}$/.test(rawDataDate)) return rawDataDate;

            throw new Error("Unable to resolve selected offertory date for PDF export.");
        };

        const getFormattedDateLabel = (dateISO) => {
            const safe = /^\d{4}-\d{2}-\d{2}$/.test(dateISO)
                ? `${dateISO}T00:00:00`
                : dateISO;

            const d = new Date(safe);
            if (Number.isNaN(d.getTime())) return dateISO;

            return d.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric"
            });
        };

        const normalizeDisplayValue = (value) => {
            const cleaned = String(value || "")
                .replace(/\u00a0/g, " ")
                .replace(/₱/g, "")
                .replace(/\s+/g, " ")
                .trim();

            if (cleaned === "0") return "";
            if (cleaned === "0.00") return "";
            return cleaned;
        };

        const readCellText = (cell) => {
            if (!cell) return "";

            const input = cell.querySelector("input, textarea, select");
            if (input) return normalizeDisplayValue(String(input.value || "").trim());

            const actions = cell.querySelector(".actions");
            if (actions) {
                const clone = cell.cloneNode(true);
                clone.querySelector(".actions")?.remove();
                return normalizeDisplayValue(clone.textContent || "");
            }

            return normalizeDisplayValue(cell.textContent || "");
        };

        const getVisibleReceiptBodyRows = (table) => {
            return qsa("tbody tr", table).filter((row) => {
                if (row.classList.contains("receipt-action")) return false;
                if (row.classList.contains("receipt-empty")) return false;
                if (row.classList.contains("receipt-search-empty")) return false;
                if (row.style.display === "none") return false;
                return true;
            });
        };

        const normalizeFooterRow = (cells, expectedLength) => {
            const label = String(cells[0] || "").trim().toUpperCase();

            const needsShiftRight =
                label === "TOTAL COLLECTION" ||
                label === "ADD: OFFERING" ||
                label === "TOTAL SOURCES OF REVENUE";

            if (!needsShiftRight) {
                const out = cells.slice();
                while (out.length < expectedLength) out.push("");
                return out.slice(0, expectedLength);
            }

            const out = [cells[0] || "", "", "", "", ...cells.slice(1)];
            while (out.length < expectedLength) out.push("");
            return out.slice(0, expectedLength);
        };

        const buildWeekOverallReceiptsRows = (dateISO, formattedDate) => {
            const table = qs("#receiptsTable");
            if (!table) {
                alert("Receipts table not found.");
                return null;
            }

            const rowsOut = [];
            rowsOut.push([`RECEIPTS FOR ${formattedDate}`]);

            const header = qsa("thead th", table).map((th) => normalizeDisplayValue(th.textContent || ""));
            rowsOut.push(header);

            getVisibleReceiptBodyRows(table).forEach((row) => {
                rowsOut.push(qsa("td", row).map(readCellText));
            });

            const expectedLength = Math.max(header.length, 13);

            qsa("tfoot tr", table).forEach((row) => {
                const cells = qsa("td", row).map(readCellText);
                rowsOut.push(normalizeFooterRow(cells, expectedLength));
            });

            return rowsOut;
        };

        const buildWeekOverallComputedRows = (dateISO, formattedDate) => {
            const table = qs("#receiptsComputedContainer table");
            if (!table) {
                alert("Computed table not found.");
                return null;
            }

            const rowsOut = [];

            const readAmountText = (amountTd) => {
                if (!amountTd) return "";
                const inp = amountTd.querySelector("input");
                if (inp) return (inp.value || "").trim();
                return (amountTd.textContent || "").trim();
            };

            const normalizeAmount = (raw) => {
                const cleaned = String(raw || "").replace(/₱/g, "").replace(/,/g, "").trim();
                const num = Number(cleaned);
                if (cleaned === "" || !Number.isFinite(num) || num === 0) return "";
                return cleaned;
            };

            const readPadLeft = (labelTd) => {
                const padLeftRaw =
                    labelTd?.style?.paddingLeft || (labelTd ? getComputedStyle(labelTd).paddingLeft : "0");
                return parseInt(String(padLeftRaw || "0"), 10) || 0;
            };

            const blankRow = () => ["", "", "", "", ""];

            rowsOut.push([`RECEIPTS FOR ${formattedDate}`, "", "", "", ""]);
            rowsOut.push(["Computed", "", "", "", "Amount"]);

            let inDisbursements = false;

            qsa("tbody tr", table).forEach((tr) => {
                if (tr.style.display === "none") return;

                const tds = tr.querySelectorAll("td");
                const labelTd = tds[0];
                const amountTd = tds[1];

                const label = (labelTd?.textContent || "").trim();
                const padLeft = readPadLeft(labelTd);
                const amount = normalizeAmount(readAmountText(amountTd));

                let c1 = "";
                let c2 = "";
                let c3 = "";
                let c4 = "";

                if (label === "LESS: DISBURSEMENTS" || label === "TOTAL DISBURSEMENTS") {
                    c1 = label;
                } else if (!inDisbursements) {
                    if (padLeft >= 40) c3 = label;
                    else if (padLeft >= 20) c2 = label;
                    else c1 = label;
                } else {
                    if (tr.classList.contains("disb-cat-row") || padLeft < 20) c2 = label;
                    else if (padLeft >= 50) c4 = label;
                    else c3 = label;
                }

                rowsOut.push([c1, c2, c3, c4, amount]);

                if (/^TOTAL CASH RECEIPTS\b/.test(label)) rowsOut.push(blankRow());
                if (label === "TOTAL CASH AVAILABLE") rowsOut.push(blankRow());
                if (label === "TOTAL DISBURSEMENTS") {
                    rowsOut.push(blankRow());
                    inDisbursements = false;
                }
                if (label === "TOTAL ENDING BALANCE") {
                    rowsOut.push(blankRow());
                    rowsOut.push(blankRow());
                    rowsOut.push(blankRow());
                }

                if (label === "LESS: DISBURSEMENTS") inDisbursements = true;
            });

            return rowsOut;
        };

        const makeComputedPdfBody = (computedRows) => {
            const rawBody = computedRows.slice(2);

            const NBSP = "\u00A0";
            const indent = (level) => NBSP.repeat(level * 10);

            return rawBody.map((r) => {
                const row = Array.isArray(r) ? r : [];
                const c0 = (row[0] ?? "").toString().trim();
                const c1 = (row[1] ?? "").toString().trim();
                const c2 = (row[2] ?? "").toString().trim();
                const c3 = (row[3] ?? "").toString().trim();
                const amt = (row[4] ?? "").toString().trim();

                if (!c0 && !c1 && !c2 && !c3 && !amt) return ["", ""];

                let label = c0;
                let level = 0;

                if (c1) {
                    label = c1;
                    level = 1;
                }
                if (c2) {
                    label = c2;
                    level = 2;
                }
                if (c3) {
                    label = c3;
                    level = 3;
                }

                return [label ? indent(level) + label : "", amt];
            });
        };

        const exportReceiptsTablePdf = (dateISOFromCaller = "") => {
            try {
                const { jsPDF } = window.jspdf || {};
                if (!jsPDF) return alert("jsPDF not loaded");

                const dateISO = getSelectedDate(dateISOFromCaller);
                const dayLabel = getFormattedDateLabel(dateISO);
                const rows = buildWeekOverallReceiptsRows(dateISO, dayLabel);

                if (!rows || rows.length < 2) return alert("Receipts table has no rows.");

                const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
                if (typeof doc.autoTable !== "function") return alert("jsPDF autoTable plugin not loaded");

                const margin = 32;
                let y = margin;

                doc.setFontSize(14);
                doc.text(`Receipts for ${dayLabel}`, margin, y);
                y += 12;

                doc.autoTable({
                    head: [rows[1]],
                    body: rows.slice(2),
                    startY: y,
                    margin: { left: margin, right: margin },
                    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", textColor: [0, 0, 0] },
                    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }
                });

                doc.save(`Offertory_${dateISO}.pdf`);
            } catch (err) {
                console.error("Receipts PDF export failed:", err);
                alert("Failed to export Receipts PDF.");
            }
        };

        const exportComputedTablePdf = (dateISOFromCaller = "") => {
            try {
                const { jsPDF } = window.jspdf || {};
                if (!jsPDF) return alert("jsPDF not loaded");

                const dateISO = getSelectedDate(dateISOFromCaller);
                const dayLabel = getFormattedDateLabel(dateISO);

                const rows = buildWeekOverallComputedRows(dateISO, dayLabel);
                if (!rows || rows.length < 3) return alert("Computed table has no rows.");

                const body = makeComputedPdfBody(rows);

                const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
                if (typeof doc.autoTable !== "function") return alert("jsPDF autoTable plugin not loaded");

                const margin = 32;
                let y = margin;

                doc.setFontSize(14);
                doc.text(`Computed receipts for ${dayLabel}`, margin, y);
                y += 16;

                const pageW = doc.internal.pageSize.getWidth();
                const usableW = pageW - margin * 2;
                const halfW = usableW / 2;

                doc.autoTable({
                    head: [["Computed", "Amount"]],
                    body,
                    startY: y,
                    margin: { left: margin, right: margin },
                    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", textColor: [0, 0, 0] },
                    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], halign: "center" },
                    columnStyles: {
                        0: { cellWidth: halfW },
                        1: {
                            cellWidth: halfW,
                            halign: "left",
                            cellPadding: { top: 3, right: 3, bottom: 3, left: 14 }
                        }
                    }
                });

                doc.save(`Offertory_Computed_${dateISO}.pdf`);
            } catch (err) {
                console.error("Computed PDF export failed:", err);
                alert("Failed to export Computed PDF.");
            }
        };

        const exportWeekOverallPdf = (dateISOFromCaller = "") => {
            try {
                const { jsPDF } = window.jspdf || {};
                if (!jsPDF) return alert("jsPDF not loaded");

                const dateISO = getSelectedDate(dateISOFromCaller);
                const dayLabel = getFormattedDateLabel(dateISO);

                const receiptsRows = buildWeekOverallReceiptsRows(dateISO, dayLabel);
                const computedRows = buildWeekOverallComputedRows(dateISO, dayLabel);

                if (!receiptsRows || receiptsRows.length < 2) return alert("Week Overall receipts has no rows.");
                if (!computedRows || computedRows.length < 2) return alert("Week Overall computed has no rows.");

                const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
                if (typeof doc.autoTable !== "function") return alert("jsPDF autoTable plugin not loaded");

                const margin = 32;
                let y = margin;

                doc.setFontSize(14);
                doc.text(`Week Overall for ${dayLabel}`, margin, y);
                y += 12;

                const commonStyles = {
                    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", textColor: [0, 0, 0] },
                    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }
                };

                doc.autoTable({
                    head: [receiptsRows[1]],
                    body: receiptsRows.slice(2),
                    startY: y,
                    margin: { left: margin, right: margin },
                    ...commonStyles
                });

                const y2 = (doc.lastAutoTable?.finalY || y) + 18;
                const body = makeComputedPdfBody(computedRows);

                const pageW = doc.internal.pageSize.getWidth();
                const usableW = pageW - margin * 2;
                const halfW = usableW / 2;

                doc.autoTable({
                    head: [["Computed", "Amount"]],
                    body,
                    startY: y2,
                    margin: { left: margin, right: margin },
                    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", textColor: [0, 0, 0] },
                    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], halign: "center" },
                    columnStyles: {
                        0: { cellWidth: halfW },
                        1: {
                            cellWidth: halfW,
                            halign: "left",
                            cellPadding: { top: 3, right: 3, bottom: 3, left: 14 }
                        }
                    }
                });

                doc.save(`Offertory_WeekOverall_${dateISO}.pdf`);
            } catch (err) {
                console.error("Week Overall PDF export failed:", err);
                alert("Failed to export Week Overall PDF.");
            }
        };

        return {
            exportReceiptsTablePdf,
            exportComputedTablePdf,
            exportWeekOverallPdf
        };
    })();

    window.BCCSM_ReceiptsTabPdf = ReceiptsTabPdf;
});