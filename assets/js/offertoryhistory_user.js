document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("offertoryHistoryBtn");
    const modal = document.getElementById("userMemberHistoryModal");
    const closeBtn = document.getElementById("closeUserMemberHistoryModal");
    const titleEl = document.getElementById("userMemberHistoryTitle");
    const table = document.getElementById("userMemberHistoryTable");
    const tbody = table ? table.querySelector("tbody") : null;
    const csvBtn = document.getElementById("userMemberHistoryExportCSV");
    const pdfBtn = document.getElementById("userMemberHistoryExportPDF");

    if (!button || !modal || !closeBtn || !titleEl || !table || !tbody) {
        return;
    }

    let currentUsername = (button.dataset.username || "").trim();

    const fmtNumber = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n === 0) {
            return "";
        }
        return n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    const escapeHtml = (value) =>
        String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    const openModal = () => {
        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    };

    const closeModal = () => {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    };

    const buildNoRows = (username) => {
        tbody.innerHTML = `<tr><td colspan="10">${escapeHtml(username || "Member")} has no receipts yet.</td></tr>`;
    };

    const buildRows = (rows) => {
        if (!Array.isArray(rows) || !rows.length) {
            buildNoRows(currentUsername);
            return;
        }

        const num = (value) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : 0;
        };

        const sortedRows = rows.slice().sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

        const html = sortedRows
            .map((row) => {
                const iso = String(row.date || "");
                const d = iso ? new Date(`${iso}T00:00:00`) : null;
                const dateLabel = d && !Number.isNaN(d.getTime())
                    ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                    : "";

                const tithes = num(row.tithes);
                const offering = num(row.offering);
                const pledge = num(row.pledge);
                const es = num(row.eskwela_suporta);
                const others = num(row.others);
                const construction = num(row.construction);
                const samar = num(row.samarleyte_pledge);
                const total = row.overall_total != null
                    ? num(row.overall_total)
                    : tithes + offering + pledge + es + others + construction + samar;

                return `
          <tr>
            <td>${escapeHtml(dateLabel)}</td>
            <td>${escapeHtml(row.entry_type || "Single")}</td>
            <td>${escapeHtml(fmtNumber(tithes))}</td>
            <td>${escapeHtml(fmtNumber(offering))}</td>
            <td>${escapeHtml(fmtNumber(pledge))}</td>
            <td>${escapeHtml(fmtNumber(es))}</td>
            <td>${escapeHtml(fmtNumber(others))}</td>
            <td>${escapeHtml(fmtNumber(construction))}</td>
            <td>${escapeHtml(fmtNumber(samar))}</td>
            <td>${escapeHtml(fmtNumber(total))}</td>
          </tr>
        `;
            })
            .join("");

        const totals = sortedRows.reduce(
            (acc, row) => {
                acc.tithes += num(row.tithes);
                acc.offering += num(row.offering);
                acc.pledge += num(row.pledge);
                acc.es += num(row.eskwela_suporta);
                acc.others += num(row.others);
                acc.construction += num(row.construction);
                acc.samar += num(row.samarleyte_pledge);
                acc.total += row.overall_total != null
                    ? num(row.overall_total)
                    : num(row.tithes) +
                    num(row.offering) +
                    num(row.pledge) +
                    num(row.eskwela_suporta) +
                    num(row.others) +
                    num(row.construction) +
                    num(row.samarleyte_pledge);
                return acc;
            },
            { tithes: 0, offering: 0, pledge: 0, es: 0, others: 0, construction: 0, samar: 0, total: 0 }
        );

        const overallRow = `
      <tr class="offertory-history-overall-row">
        <td colspan="2">Overall Total</td>
        <td>${escapeHtml(fmtNumber(totals.tithes))}</td>
        <td>${escapeHtml(fmtNumber(totals.offering))}</td>
        <td>${escapeHtml(fmtNumber(totals.pledge))}</td>
        <td>${escapeHtml(fmtNumber(totals.es))}</td>
        <td>${escapeHtml(fmtNumber(totals.others))}</td>
        <td>${escapeHtml(fmtNumber(totals.construction))}</td>
        <td>${escapeHtml(fmtNumber(totals.samar))}</td>
        <td>${escapeHtml(fmtNumber(totals.total))}</td>
      </tr>
    `;

        tbody.innerHTML = html + overallRow;
    };

    const loadHistory = async () => {
        tbody.innerHTML = `<tr><td colspan="10">Loading...</td></tr>`;

        const response = await fetch("offertory-history-modal-user.php", {
            method: "GET",
            credentials: "same-origin",
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
        });

        const text = await response.text();
        let data = null;

        try {
            data = JSON.parse(text);
        } catch (error) {
            throw new Error("Server returned invalid JSON.");
        }

        if (!response.ok || !data || data.success !== true || !Array.isArray(data.rows)) {
            throw new Error((data && data.message) || "Failed to load history.");
        }

        currentUsername = String(data.username || currentUsername || "Member").trim();
        titleEl.textContent = `${currentUsername}'s Receipt History`;
        buildRows(data.rows);
    };

    const getTableData = () => {
        const headCells = Array.from(table.querySelectorAll("thead th")).map((th) => (th.textContent || "").trim());
        const bodyRows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
            Array.from(tr.querySelectorAll("td")).map((td) => {
                let value = (td.textContent || "").trim();
                if (value.startsWith("₱")) {
                    value = value.replace(/₱/g, "");
                }
                return value;
            })
        );

        return { headCells, bodyRows };
    };

    const exportCsv = () => {
        const { headCells, bodyRows } = getTableData();
        const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

        let csv = "\uFEFF";
        csv += headCells.map(escapeCsv).join(",") + "\n";
        bodyRows.forEach((row) => {
            csv += row.map(escapeCsv).join(",") + "\n";
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ReceiptHistory_${String(currentUsername || "Member").replace(/\s+/g, "_")}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportPdf = () => {
        const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
        if (!jsPDFCtor) {
            alert("jsPDF not loaded");
            return;
        }

        const { headCells, bodyRows } = getTableData();
        const doc = new jsPDFCtor({ orientation: "landscape", unit: "pt", format: "a4" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(`${currentUsername || "Member"}'s Receipt History`, 40, 40);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        doc.autoTable({
            head: [headCells],
            body: bodyRows,
            startY: 60,
            styles: { font: "helvetica", fontSize: 9, cellPadding: 4 },
            headStyles: { fillColor: [0, 0, 0], textColor: 255, halign: "center" },
            bodyStyles: { halign: "right" },
            columnStyles: {
                0: { halign: "left" },
                1: { halign: "left" }
            },
            margin: { left: 40, right: 40 }
        });

        doc.save(`ReceiptHistory_${String(currentUsername || "Member").replace(/\s+/g, "_")}.pdf`);
    };

    button.addEventListener("click", async () => {
        openModal();
        titleEl.textContent = `${currentUsername || "Member"}'s Receipt History`;

        try {
            await loadHistory();
        } catch (error) {
            console.error("Failed to load user offertory history:", error);
            tbody.innerHTML = `<tr><td colspan="10">${escapeHtml(error.message || "Failed to load history.")}</td></tr>`;
        }
    });

    closeBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.style.display === "flex") {
            closeModal();
        }
    });

    csvBtn.addEventListener("click", (event) => {
        event.preventDefault();
        exportCsv();
    });

    pdfBtn.addEventListener("click", (event) => {
        event.preventDefault();
        exportPdf();
    });
});