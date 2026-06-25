document.addEventListener("DOMContentLoaded", () => {
    const ReceiptsTabXlsx = (() => {
        const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
        const qs = (sel, root = document) => root.querySelector(sel);

        const EXCEL_MIME =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        const getSelectedDate = (dateISOFromCaller = "") => {
            const rawCaller = String(dateISOFromCaller || "").trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawCaller)) {
                return rawCaller;
            }

            const selectedDateEl = qs("#selectedDate");
            const rawText = String(selectedDateEl?.textContent || "").trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawText)) {
                return rawText;
            }

            const rawDataDate =
                String(selectedDateEl?.dataset?.date || "").trim() ||
                String(
                    qs(
                        "#calendar [data-date].selected, #calendar [data-date].active, #calendar [data-date].selected-day"
                    )?.dataset?.date || ""
                ).trim();

            if (/^\d{4}-\d{2}-\d{2}$/.test(rawDataDate)) {
                return rawDataDate;
            }

            throw new Error("Unable to resolve selected offertory date for XLSX export.");
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
            if (input) {
                return normalizeDisplayValue(String(input.value || "").trim());
            }

            const actions = cell.querySelector(".actions");
            if (actions) {
                const clone = cell.cloneNode(true);
                clone.querySelector(".actions")?.remove();
                return normalizeDisplayValue(clone.textContent || "");
            }

            return normalizeDisplayValue(cell.textContent || "");
        };

        const getVisibleBodyRows = (table) => {
            return qsa("tbody tr", table).filter((row) => {
                if (row.classList.contains("receipt-action")) return false;
                if (row.classList.contains("receipt-empty")) return false;
                if (row.classList.contains("receipt-search-empty")) return false;
                if (row.style.display === "none") return false;
                return true;
            });
        };

        const getVisibleTableRows = (table) => {
            return qsa("tbody tr", table).filter((row) => row.style.display !== "none");
        };

        const COMPUTED_COL1_LABELS = new Set([
            "CASH BALANCE BEGINNING",
            "ADD RECEIPTS"
        ]);

        const COMPUTED_COL2_LABELS = new Set([
            "TITHES",
            "OFFERING",
            "SHORT TERM PLEDGES",
            "LONG TERM PLEDGES",
            "RESTRICTED PLEDGES",
            "OTHER RECEIPTS"
        ]);

        const COMPUTED_COL3_LABELS = new Set([
            "TITHES (90%)",
            "MISSIONARY RESERVED FUND (10%)",
            "ONE TIME PLEDGE/OFFERING",
            "BANK INTEREST/OTHER INCOME",
            "PLEDGE OUTREACH",
            "KIDS CHURCH",
            "SAMAR LEYTE BEG 5700",
            "PLEDGE -WORSHIP TEAM",
            "ESKWELA SUPORTA",
            "DONATION FR SIS CRISELDA",
            "BCC CENTER",
            "DONATION FOR WELLNESS PROGRAM",
            "ANNIVERSARY PLEDGE/CONTIBUTION"
        ]);

        const readPaddingLeftPx = (cell) => {
            if (!cell) return 0;
            const raw = cell.style?.paddingLeft || getComputedStyle(cell).paddingLeft || "0";
            const parsed = parseInt(String(raw || "0"), 10);
            return Number.isFinite(parsed) ? parsed : 0;
        };

        const mapComputedHierarchyRow = (labelText, labelCell) => {
            const label = String(labelText || "").trim();
            const upper = label.toUpperCase();

            if (!label) {
                return [null, null, null];
            }

            if (COMPUTED_COL1_LABELS.has(upper)) {
                return [label, null, null];
            }

            if (COMPUTED_COL2_LABELS.has(upper)) {
                return [null, label, null];
            }

            if (COMPUTED_COL3_LABELS.has(upper)) {
                return [null, null, label];
            }

            const padLeft = readPaddingLeftPx(labelCell);

            if (padLeft >= 40) {
                return [null, null, label];
            }

            if (padLeft >= 20) {
                return [null, label, null];
            }

            return [label, null, null];
        };

        const buildComputedWorksheetData = (dateISOFromCaller = "") => {
            const table = qs("#receiptsComputedContainer table");
            if (!table) {
                throw new Error("Computed table not found.");
            }

            const dateISO = getSelectedDate(dateISOFromCaller);
            const formattedDate = getFormattedDateLabel(dateISO);

            const rows = [];
            rows.push([`COMPUTED RECEIPTS FOR ${formattedDate}`]);

            const bodyRows = getVisibleTableRows(table);
            bodyRows.forEach((row) => {
                const tds = qsa("td", row);
                const labelCell = tds[0] || null;
                const amountCell = tds[1] || null;

                const labelText = readCellText(labelCell);
                const amountText = readCellText(amountCell);

                if (!labelText && !amountText) {
                    rows.push([null, null, null, null]);
                    return;
                }

                const hierarchyCols = mapComputedHierarchyRow(labelText, labelCell);
                rows.push([...hierarchyCols, amountText]);
            });

            return { rows, dateISO };
        };

        const buildReceiptsWorksheetData = (dateISOFromCaller = "") => {
            const table = qs("#receiptsTable");
            if (!table) {
                throw new Error("Receipts table not found.");
            }

            const dateISO = getSelectedDate(dateISOFromCaller);
            const formattedDate = getFormattedDateLabel(dateISO);

            const rows = [];
            rows.push([`RECEIPTS FOR ${formattedDate}`]);

            const header = qsa("thead th", table).map((th) =>
                normalizeDisplayValue(th.textContent || "")
            );
            rows.push(header);

            const bodyRows = getVisibleBodyRows(table);
            bodyRows.forEach((row) => {
                rows.push(qsa("td", row).map(readCellText));
            });

            const normalizeFooterRow = (cells, expectedLength) => {
                const label = String(cells[0] || "").trim().toUpperCase();

                const needsShiftRightBy2 =
                    label === "TOTAL COLLECTION" ||
                    label === "ADD: OFFERING" ||
                    label === "TOTAL SOURCES OF REVENUE";

                if (!needsShiftRightBy2) {
                    const out = cells.slice();
                    while (out.length < expectedLength) out.push(null);
                    return out.slice(0, expectedLength);
                }

                const labelCell = cells[0] || "";
                const valueCells = cells.slice(1);

                const out = [labelCell, null, null, null, ...valueCells];
                while (out.length < expectedLength) out.push(null);
                return out.slice(0, expectedLength);
            };

            const footerRows = qsa("tfoot tr", table);
            const expectedLength = Math.max(header.length, 12);

            footerRows.forEach((row) => {
                const cells = qsa("td", row).map(readCellText);
                rows.push(normalizeFooterRow(cells, expectedLength));
            });

            return { rows, dateISO };
        };

        const autoFitColumns = (rows, minW = 10, maxW = 40) => {
            const widths = [];

            rows.forEach((row) => {
                row.forEach((value, idx) => {
                    const text = String(value ?? "");
                    const lineWidth = text
                        .split(/\r?\n/)
                        .reduce((m, part) => Math.max(m, part.length), 0);
                    widths[idx] = Math.max(widths[idx] || minW, Math.min(lineWidth + 2, maxW));
                });
            });

            return widths;
        };

        const applyWorkbookStyles = (worksheet, rows, options = {}) => {
            const { hasHeaderRow = true } = options;

            const colWidths = autoFitColumns(rows, 10, 40);
            worksheet.columns = colWidths.map((width) => ({ width }));

            const totalColumns = Math.max(...rows.map((r) => r.length), 1);
            if (totalColumns > 1) {
                worksheet.mergeCells(1, 1, 1, totalColumns);
            }

            worksheet.getRow(1).height = 24;
            worksheet.getRow(1).font = { bold: true, size: 12 };
            worksheet.getRow(1).alignment = {
                horizontal: "left",
                vertical: "middle"
            };

            if (hasHeaderRow) {
                worksheet.getRow(2).font = { bold: true };
                worksheet.getRow(2).alignment = {
                    horizontal: "center",
                    vertical: "middle"
                };
            }

            worksheet.eachRow((row, rowNumber) => {
                const dataStartRow = hasHeaderRow ? 3 : 2;

                if (rowNumber >= dataStartRow) {
                    row.alignment = { vertical: "top" };
                }

                row.eachCell((cell) => {
                    cell.alignment = {
                        ...(cell.alignment || {}),
                        vertical: "top"
                    };

                    if (hasHeaderRow && rowNumber === 2) {
                        cell.font = { bold: true };
                    }

                    if (rowNumber >= 2) {
                        cell.border = {
                            top: { style: "thin", color: { argb: "FFD9D9D9" } },
                            left: { style: "thin", color: { argb: "FFD9D9D9" } },
                            bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
                            right: { style: "thin", color: { argb: "FFD9D9D9" } }
                        };
                    }
                });
            });
        };

        const downloadWorkbook = async (workbook, filename) => {
            if (!window.saveAs) {
                throw new Error("FileSaver is not loaded.");
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: EXCEL_MIME });
            window.saveAs(blob, filename);
        };

        const buildWorkbookFromRows = async (sheetName, rows, filename, styleOptions = {}) => {
            if (!window.ExcelJS) {
                throw new Error("ExcelJS is not loaded.");
            }

            const workbook = new window.ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(sheetName);

            rows.forEach((row) => {
                worksheet.addRow(row);
            });

            applyWorkbookStyles(worksheet, rows, styleOptions);
            await downloadWorkbook(workbook, filename);
        };

        const buildWorkbookFromMultipleSheets = async (sheets, filename) => {
            if (!window.ExcelJS) {
                throw new Error("ExcelJS is not loaded.");
            }

            const workbook = new window.ExcelJS.Workbook();

            sheets.forEach(({ sheetName, rows, styleOptions = {} }) => {
                const worksheet = workbook.addWorksheet(sheetName);
                rows.forEach((row) => {
                    worksheet.addRow(row);
                });
                applyWorkbookStyles(worksheet, rows, styleOptions);
            });

            await downloadWorkbook(workbook, filename);
        };

        const exportReceiptsTableXlsx = async (dateISOFromCaller = "") => {
            try {
                const { rows, dateISO } = buildReceiptsWorksheetData(dateISOFromCaller);
                await buildWorkbookFromRows("Receipts", rows, `Offertory_${dateISO}.xlsx`);
            } catch (err) {
                console.error("Receipts XLSX export failed:", err);
                alert("Failed to export Receipts XLSX.");
            }
        };

        const exportComputedTableXlsx = async (dateISOFromCaller = "") => {
            try {
                const { rows, dateISO } = buildComputedWorksheetData(dateISOFromCaller);
                await buildWorkbookFromRows(
                    "Computed",
                    rows,
                    `Offertory_Computed_${dateISO}.xlsx`,
                    { hasHeaderRow: false }
                );
            } catch (err) {
                console.error("Computed XLSX export failed:", err);
                alert("Failed to export Computed XLSX.");
            }
        };

        const exportWeekOverallXlsx = async (dateISOFromCaller = "") => {
            try {
                const receiptsData = buildReceiptsWorksheetData(dateISOFromCaller);
                const computedData = buildComputedWorksheetData(dateISOFromCaller);

                const dateISO = receiptsData.dateISO || computedData.dateISO;

                await buildWorkbookFromMultipleSheets(
                    [
                        {
                            sheetName: "Receipts",
                            rows: receiptsData.rows,
                            styleOptions: { hasHeaderRow: true }
                        },
                        {
                            sheetName: "Computed",
                            rows: computedData.rows,
                            styleOptions: { hasHeaderRow: false }
                        }
                    ],
                    `Offertory_Week_Overall_${dateISO}.xlsx`
                );
            } catch (err) {
                console.error("Week Overall XLSX export failed:", err);
                alert("Failed to export Week Overall XLSX.");
            }
        };

        return {
            exportReceiptsTableXlsx,
            exportComputedTableXlsx,
            exportWeekOverallXlsx
        };
    })();

    window.BCCSM_ReceiptsTabXlsx = ReceiptsTabXlsx;
});