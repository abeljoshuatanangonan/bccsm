/**
 * File: BCCSMOfficial/assets/js/monthpicker_summary.js
 *
 * Summary multi-month picker driver.
 * Reuses the existing single-month Summary renderer through the hidden #sumMonth.
 */
(function initSummaryMonthPicker() {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }

    function boot() {
        const sumMonthInput = document.querySelector("#sumMonth");
        const pickerRoot = document.querySelector("#summaryMonthPicker");
        const toggleBtn = document.querySelector("#sumMonthPickerToggle");
        const chipsBox = document.querySelector("#summaryMonthChips");
        const panel = document.querySelector("#summaryMonthPickerPanel");
        const yearSelect = document.querySelector("#summaryMonthPickerYear");
        const monthsBox = document.querySelector("#summaryMonthPickerMonths");
        const applyBtn = document.querySelector("#summaryMonthApplyBtn");
        const applySpinner = document.querySelector("#summaryMonthApplySpinner");
        const viewport = document.querySelector("#summaryMultiMonthsViewport");
        const track = document.querySelector("#summaryMultiMonthsTrack");
        const stickyScrollbar = document.querySelector("#summaryMultiMonthsScrollbar");
        const stickyScrollbarInner = document.querySelector("#summaryMultiMonthsScrollbarInner");
        const weeklyContainer = document.querySelector("#summaryWeeklyTotalsContainer");

        if (
            !sumMonthInput ||
            !pickerRoot ||
            !toggleBtn ||
            !chipsBox ||
            !panel ||
            !yearSelect ||
            !monthsBox ||
            !applyBtn ||
            !viewport ||
            !track ||
            !stickyScrollbar ||
            !stickyScrollbarInner
        ) {
            return;
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const years = [currentYear, currentYear - 1, currentYear - 2];
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        let selected = new Set();
        let applying = false;

        const setApplyLoading = (isLoading) => {
            if (applySpinner) {
                applySpinner.hidden = !isLoading;
            }
            if (applyBtn) {
                applyBtn.disabled = isLoading;
            }
            if (toggleBtn) {
                toggleBtn.disabled = isLoading;
            }
        };

        const isoMonth = (year, month) =>
            `${year}-${String(month).padStart(2, "0")}`;

        const prettyMonth = (ym) => {
            const [y, m] = ym.split("-").map(Number);
            return `${monthNames[(m || 1) - 1].slice(0, 3)} ${y}`;
        };

        const sortSelected = () =>
            Array.from(selected).sort((a, b) => a.localeCompare(b));

        const getLiveContainers = () => {
            return {
                weekly: document.querySelector("#summaryWeeklyTotalsContainer"),
                computed: document.querySelector("#summaryComputedTotals")
            };
        };

        const populateYears = () => {
            yearSelect.innerHTML = years
                .map((y) => `<option value="${y}">${y}</option>`)
                .join("");
        };

        const renderMonthOptions = () => {
            const year = Number(yearSelect.value) || currentYear;
            const maxMonth = year === currentYear ? currentMonth : 12;

            monthsBox.innerHTML = Array.from({ length: maxMonth }, (_, i) => i + 1)
                .map((month) => {
                    const ym = isoMonth(year, month);
                    const checked = selected.has(ym) ? "checked" : "";
                    return `
            <label class="summary-monthpicker-month">
              <input type="checkbox" value="${ym}" ${checked}>
              <span>${monthNames[month - 1]}</span>
            </label>
          `;
                })
                .join("");
        };

        const renderChips = () => {
            const values = sortSelected();
            chipsBox.innerHTML = values.map((ym) => `
                <span class="summary-month-chip" data-ym="${ym}">
                <span>${prettyMonth(ym)}</span>
                </span>
                `).join("");

            toggleBtn.textContent = values.length
                ? `Selected: ${values.length} month${values.length > 1 ? "s" : ""}`
                : "Select month(s)";
        };

        const syncSelectedFromCheckboxes = () => {
            const checked = Array.from(
                monthsBox.querySelectorAll('input[type="checkbox"]:checked')
            ).map((el) => el.value);

            const currentYearValue = String(yearSelect.value);
            for (const ym of Array.from(selected)) {
                if (ym.startsWith(`${currentYearValue}-`)) selected.delete(ym);
            }
            checked.forEach((ym) => selected.add(ym));
        };

        const openPanel = () => {
            panel.hidden = false;
        };

        const closePanel = () => {
            panel.hidden = true;
        };

        const syncStickyScrollbarMetrics = () => {
            const trackWidth = track.scrollWidth;
            const viewportWidth = viewport.clientWidth;

            stickyScrollbarInner.style.width = `${trackWidth}px`;

            const shouldShow = !viewport.hidden && trackWidth > viewportWidth + 2;
            stickyScrollbar.hidden = !shouldShow;
        };

        const bindStickyScrollbarSync = () => {
            let syncingFromViewport = false;
            let syncingFromSticky = false;

            viewport.addEventListener("scroll", () => {
                if (syncingFromSticky) return;
                syncingFromViewport = true;
                stickyScrollbar.scrollLeft = viewport.scrollLeft;
                syncingFromViewport = false;
            });

            stickyScrollbar.addEventListener("scroll", () => {
                if (syncingFromViewport) return;
                syncingFromSticky = true;
                viewport.scrollLeft = stickyScrollbar.scrollLeft;
                syncingFromSticky = false;
            });

            window.addEventListener("resize", syncStickyScrollbarMetrics);
        };

        const getComputedDomSignature = () => {
            const computedHtml = document.querySelector("#summaryComputedTotals")?.innerHTML || "";
            return computedHtml.trim();
        };

        const waitForSummaryRender = async (ym, beforeComputedSignature = "") => {
            const deadline = Date.now() + 30000;

            return await new Promise((resolve, reject) => {
                let done = false;
                let sawComputedMutation = false;
                let lastSignature = "";
                let stableHits = 0;
                let expectedEventSignature = "";

                const computedBox = document.querySelector("#summaryComputedTotals");
                const observer = computedBox
                    ? new MutationObserver(() => {
                        sawComputedMutation = true;
                        stableHits = 0;
                    })
                    : null;

                const getRenderState = () => {
                    const currentYM = String(document.querySelector("#sumMonth")?.value || "").trim();
                    const computedRows = document.querySelectorAll("#summaryComputedTotals tbody tr").length;
                    const currentComputedSignature = getComputedDomSignature();

                    return {
                        currentYM,
                        computedRows,
                        currentComputedSignature
                    };
                };

                const isStableRenderedState = () => {
                    const {
                        currentYM,
                        computedRows,
                        currentComputedSignature
                    } = getRenderState();

                    if (currentYM !== ym) return false;
                    if (computedRows <= 0) return false;
                    if (!currentComputedSignature) return false;
                    if (currentComputedSignature === beforeComputedSignature) return false;

                    if (expectedEventSignature && currentComputedSignature !== expectedEventSignature) {
                        return false;
                    }

                    if (currentComputedSignature !== lastSignature) {
                        lastSignature = currentComputedSignature;
                        stableHits = 1;
                        return false;
                    }

                    stableHits += 1;
                    return stableHits >= 3;
                };

                const cleanup = () => {
                    window.removeEventListener("bcc:summary-rendered", onRendered);
                    document.removeEventListener("bcc:summary-rendered", onRendered);
                    clearInterval(fallbackId);
                    clearTimeout(timeoutId);
                    if (observer) observer.disconnect();
                };

                const finish = async () => {
                    if (done) return;
                    done = true;
                    cleanup();

                    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

                    resolve();
                };

                const onRendered = async (evt) => {
                    const renderedYM = String(evt?.detail?.ym || "").trim();
                    if (renderedYM !== ym) return;

                    expectedEventSignature = String(evt?.detail?.computedSignature || "").trim();

                    if (isStableRenderedState()) {
                        await finish();
                    }
                };

                if (observer && computedBox) {
                    observer.observe(computedBox, {
                        childList: true,
                        subtree: true,
                        characterData: true
                    });
                }

                const fallbackId = setInterval(async () => {
                    if (Date.now() >= deadline || done) return;

                    if (isStableRenderedState()) {
                        await finish();
                    }
                }, 100);

                const timeoutId = setTimeout(() => {
                    if (done) return;
                    cleanup();
                    reject(new Error(`Summary render timeout for ${ym}`));
                }, Math.max(0, deadline - Date.now()));

                window.addEventListener("bcc:summary-rendered", onRendered);
                document.addEventListener("bcc:summary-rendered", onRendered);
            });
        };

        const requestSummaryRender = async (ym) => {
            const beforeComputedSignature = getComputedDomSignature();
            const waitPromise = waitForSummaryRender(ym, beforeComputedSignature);

            sumMonthInput.value = ym;
            sumMonthInput.dispatchEvent(new Event("change", { bubbles: true }));

            await waitPromise;
        };

        const copyComputedCloneRowStyles = (computedCloneRoot) => {
            const liveComputed = document.querySelector("#summaryComputedTotals");
            if (!liveComputed || !computedCloneRoot) return;

            const normText = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
            const getLabel = (tr) => tr.querySelector("td:first-child, th:first-child")?.textContent || "";

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

                const isTransparentBg = (bg) =>
                    !bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)";

                const rowCs = window.getComputedStyle(srcRow);
                const rowBg = getEffectiveBg(srcRow) || rowCs.getPropertyValue("background-color");
                const rowColor = rowCs.getPropertyValue("color");
                const rowFw = rowCs.getPropertyValue("font-weight");

                const applyCommonTextVisuals = (srcEl, dstEl) => {
                    if (!srcEl || !dstEl) return;
                    const cs = window.getComputedStyle(srcEl);
                    const color = cs.getPropertyValue("color");
                    const fw = cs.getPropertyValue("font-weight");
                    const bg = getEffectiveBg(srcEl) || cs.getPropertyValue("background-color");

                    if (!isTransparentBg(bg)) {
                        dstEl.style.setProperty("background-color", bg, "important");
                    } else {
                        dstEl.style.removeProperty("background-color");
                    }

                    if (color) dstEl.style.setProperty("color", color, "important");
                    if (fw) dstEl.style.setProperty("font-weight", fw, "important");

                    dstEl.style.removeProperty("border-top");
                    dstEl.style.removeProperty("border-bottom");
                };

                if (!isTransparentBg(rowBg)) {
                    dstRow.style.setProperty("background-color", rowBg, "important");
                } else {
                    dstRow.style.removeProperty("background-color");
                }
                if (rowColor) dstRow.style.setProperty("color", rowColor, "important");
                if (rowFw) dstRow.style.setProperty("font-weight", rowFw, "important");
                dstRow.style.removeProperty("border-top");
                dstRow.style.removeProperty("border-bottom");

                const srcCells = Array.from(srcRow.querySelectorAll(":scope > td, :scope > th"));
                const dstCells = Array.from(dstRow.querySelectorAll(":scope > td, :scope > th"));

                dstCells.forEach((dstCell, i) => {
                    const srcCell = srcCells[i] || srcCells[0];
                    if (!srcCell) return;
                    applyCommonTextVisuals(srcCell, dstCell);
                });

                const srcAmtCells = Array.from(srcRow.querySelectorAll(".sum-amt-cell"));
                const dstAmtCells = Array.from(dstRow.querySelectorAll(".sum-amt-cell"));

                dstAmtCells.forEach((dstAmtCell, i) => {
                    const srcAmtCell = srcAmtCells[i] || srcAmtCells[0];
                    if (!srcAmtCell) return;
                    applyCommonTextVisuals(srcAmtCell, dstAmtCell);
                });
            };
            const srcRows = Array.from(liveComputed.querySelectorAll("tr"));
            const dstRows = Array.from(computedCloneRoot.querySelectorAll("tr"));

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
        };

        const cloneMonthPanel = (ym) => {
            const [year, month] = ym.split("-").map(Number);
            const title = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric"
            });

            const { weekly, computed } = getLiveContainers();
            if (!weekly || !computed) {
                throw new Error("Summary containers not found for cloning.");
            }

            const panelEl = document.createElement("div");
            panelEl.className = "summary-month-panel";
            panelEl.dataset.ym = ym;

            const titleEl = document.createElement("div");
            titleEl.className = "summary-month-panel-title";
            titleEl.textContent = title;

            const weeklyWrap = document.createElement("div");
            weeklyWrap.className = "summary-clone-weekly";

            const computedWrap = document.createElement("div");
            computedWrap.className = "summary-clone-computed";

            const weeklyClone = weekly.cloneNode(true);
            weeklyClone.removeAttribute("id");

            const computedSnapshot = document.createElement("div");
            computedSnapshot.innerHTML = computed.innerHTML;

            const computedRoot = computedSnapshot.firstElementChild || computedSnapshot;
            if (computedRoot && computedRoot.removeAttribute) {
                computedRoot.removeAttribute("id");
            }

            const weeklyTable = weeklyClone.querySelector("table");
            if (weeklyTable) weeklyTable.classList.add("summary-clone-weekly-table");

            const computedTable = computedSnapshot.querySelector("table");
            if (computedTable) computedTable.classList.add("summary-clone-computed-table");

            weeklyWrap.appendChild(weeklyClone);

            while (computedSnapshot.firstChild) {
                computedWrap.appendChild(computedSnapshot.firstChild);
            }

            copyComputedCloneRowStyles(computedWrap);

            panelEl.appendChild(titleEl);
            panelEl.appendChild(weeklyWrap);
            panelEl.appendChild(computedWrap);

            return panelEl;
        };

        const normalizeMonthPanelWidths = (panelEl) => {
            const weeklyWrap = panelEl.querySelector(".summary-clone-weekly");
            const computedWrap = panelEl.querySelector(".summary-clone-computed");
            const weeklyTable = panelEl.querySelector(".summary-clone-weekly-table") || weeklyWrap?.querySelector("table");
            const computedTable = panelEl.querySelector(".summary-clone-computed-table") || computedWrap?.querySelector("table");

            if (!weeklyWrap || !computedWrap || !weeklyTable || !computedTable) return;

            panelEl.style.width = "";
            panelEl.style.minWidth = "";
            weeklyWrap.style.width = "";
            computedWrap.style.width = "";

            const weeklyWidth = Math.ceil(weeklyTable.scrollWidth || weeklyTable.getBoundingClientRect().width || 0);
            const computedWidth = Math.ceil(computedTable.scrollWidth || computedTable.getBoundingClientRect().width || 0);

            const targetWidth = Math.max(weeklyWidth, computedWidth);

            if (targetWidth > 0) {
                panelEl.style.width = `${targetWidth}px`;
                panelEl.style.minWidth = `${targetWidth}px`;
                weeklyWrap.style.width = "100%";
                computedWrap.style.width = "100%";
            }
        };

        const stretchComputedCloneGrid = (panelEl) => {
            const computedWrap = panelEl.querySelector(".summary-clone-computed");
            if (!computedWrap) return;

            const rows = Array.from(
                computedWrap.querySelectorAll("tr")
            ).filter((tr) => tr.children.length >= 2);

            if (!rows.length) return;

            let firstColWidth = 0;

            for (const tr of rows) {
                const firstCell = tr.children[0];
                if (!firstCell) continue;
                firstColWidth = Math.max(
                    firstColWidth,
                    Math.ceil(firstCell.getBoundingClientRect().width || 0)
                );
            }

            const wrapWidth = Math.ceil(computedWrap.getBoundingClientRect().width || 0);
            if (!wrapWidth || !firstColWidth || wrapWidth <= firstColWidth) return;

            const amountWidth = wrapWidth - firstColWidth;

            for (const tr of rows) {
                const amountCell = tr.querySelector("td.amount, th.amount");
                const grid = amountCell?.querySelector(".sum-amt-grid");
                if (!amountCell || !grid) continue;

                amountCell.style.width = `${amountWidth}px`;
                amountCell.style.minWidth = `${amountWidth}px`;

                grid.style.width = `${amountWidth}px`;
                grid.style.minWidth = `${amountWidth}px`;
            }
        };

        const renderSingleMonthMode = async (ym) => {
            document.body.classList.remove("summary-multi-mode");
            document.documentElement.classList.remove("summary-multi-active");
            viewport.hidden = true;
            stickyScrollbar.hidden = true;
            track.innerHTML = "";

            await requestSummaryRender(ym);
        };

        const renderMultiMonthMode = async (months) => {
            document.body.classList.remove("summary-multi-mode");
            document.documentElement.classList.remove("summary-multi-active");
            viewport.hidden = true;
            stickyScrollbar.hidden = true;
            track.innerHTML = "";

            const fragments = [];

            for (const ym of months) {
                await requestSummaryRender(ym);
                fragments.push(cloneMonthPanel(ym));
            }

            track.innerHTML = "";
            fragments.forEach((panelEl) => track.appendChild(panelEl));

            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            fragments.forEach((panelEl) => normalizeMonthPanelWidths(panelEl));

            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            fragments.forEach((panelEl) => stretchComputedCloneGrid(panelEl));

            document.body.classList.add("summary-multi-mode");
            document.documentElement.classList.add("summary-multi-active");
            viewport.hidden = false;
            viewport.scrollLeft = 0;
            stickyScrollbar.scrollLeft = 0;

            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            syncStickyScrollbarMetrics();
        };

        const applySelection = async () => {
            if (applying) return;

            let months = sortSelected();
            if (!months.length) {
                months = [isoMonth(currentYear, currentMonth)];
                selected = new Set(months);
                renderMonthOptions();
                renderChips();
            }

            applying = true;
            setApplyLoading(true);

            try {
                if (months.length === 1) {
                    await renderSingleMonthMode(months[0]);
                } else {
                    await renderMultiMonthMode(months);
                }
                closePanel();
            } catch (err) {
                console.error("Summary month picker apply failed:", err);
                alert("Failed to render selected month(s).");
            } finally {
                applying = false;
                setApplyLoading(false);
            }
        };

        populateYears();

        const initialMonth = sumMonthInput.value || isoMonth(currentYear, currentMonth);
        selected = new Set([initialMonth]);
        yearSelect.value = initialMonth.slice(0, 4);

        renderMonthOptions();
        renderChips();
        bindStickyScrollbarSync();

        toggleBtn.addEventListener("click", () => {
            if (panel.hidden) openPanel();
            else closePanel();
        });

        yearSelect.addEventListener("change", () => {
            renderMonthOptions();
        });

        monthsBox.addEventListener("change", (e) => {
            const input = e.target.closest('input[type="checkbox"]');
            if (!input) return;
            syncSelectedFromCheckboxes();
            renderChips();
        });

        applyBtn.addEventListener("click", applySelection);

        document.addEventListener("click", (e) => {
            if (!pickerRoot.contains(e.target)) closePanel();
        });

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closePanel();
        });




        // Keep existing single-month startup intact.
        // This script only enhances the picker after the page has loaded.
    }
})();