document.addEventListener("DOMContentLoaded", () => {
    // ---------- Minimal shared helpers ----------
    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

    const delegate = (root, evt, sel, handler) =>
        on(root, evt, (e) => {
            const target = e.target.closest(sel);
            if (target && root.contains(target)) handler(e, target);
        });

    const txt = (node) => (node?.textContent || "").trim();

    const preferDate = (s) => {
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d;
    };

    const formatDisplayDate = (value) => {
        const raw = (value || "").trim();
        if (!raw || raw === "0000-00-00") return "-";

        const normalized = raw.length <= 10 ? `${raw}T00:00:00` : raw;
        const date = new Date(normalized);

        if (Number.isNaN(date.getTime())) return raw;

        return date.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };

    const formatDisplayDateTime = (value) => {
        const raw = (value || "").trim();
        if (!raw || raw === "0000-00-00" || raw === "0000-00-00 00:00:00") return "-";

        const normalized = raw.replace(" ", "T");
        const date = new Date(normalized);

        if (Number.isNaN(date.getTime())) return raw;

        return date.toLocaleString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    function getCSRF() {
        if (window.CSRF_TOKEN) return window.CSRF_TOKEN;
        const m = document.querySelector('meta[name="csrf-token"]');
        if (m && m.content) return m.content;
        const h = document.querySelector('input[name="csrf_token"]');
        return h ? h.value : "";
    }

    function addCSRF(body) {
        const t = window.CSRF_TOKEN || getCSRF();
        if (!t) return body;

        if (body instanceof FormData) {
            if (!body.has("csrf_token")) body.append("csrf_token", t);
            return body;
        }
        if (body instanceof URLSearchParams) {
            if (!body.has("csrf_token")) body.append("csrf_token", t);
            return body;
        }
        const params = new URLSearchParams();
        if (body && typeof body === "object") {
            for (const [k, v] of Object.entries(body)) params.append(k, v);
        }
        params.append("csrf_token", t);
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

    const jsonOrThrow = async (res) => {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error("Invalid JSON response");
        }
    };

    const fieldLabels = {
        username: "Username",
        surname: "Surname",
        first_name: "First Name",
        middle_name: "Middle Name",
        suffix: "Suffix",
        gender: "Gender",
        contact: "Contact",
        email: "Email",
        birthday: "Birthday",
        home_address: "Home Address",
        residential_address: "Residential Address",
        marital_status: "Marital Status",
        spouse: "Spouse",
        wedding_date: "Wedding Date",
        children: "Child/Children Name(s)",
        emergency_contact: "Emergency Contact",
        emergency_mobile: "Emergency Mobile",
        bcc_branch: "BCC Branch",
        group: "Group",
        baptism_date: "Baptism Date",
        baptism_location: "Baptism Location",
        membership_date: "Membership Date",
        role: "Role",
        status: "Status",
    };

    const personalFields = [
        "username",
        "surname",
        "first_name",
        "middle_name",
        "suffix",
        "gender",
        "contact",
        "email",
        "birthday",
        "home_address",
        "residential_address",
        "marital_status",
        "spouse",
        "wedding_date",
        "children",
        "emergency_contact",
        "emergency_mobile",
    ];

    const churchFields = [
        "bcc_branch",
        "group",
        "baptism_date",
        "baptism_location",
        "membership_date",
        "role",
        "status",
    ];

    const optionSets = {
        gender: ["Male", "Female"],
        marital_status: ["Single", "Married", "Widowed"],
        bcc_branch: ["San Mateo", "Leyte"],
        group: ["", "Kids", "Youth", "Young Adult", "Mid Adult", "Late Adult", "Mothers", "Fathers"],
        role: ["member", "admin"],
        status: ["pending", "approved", "rejected"],
    };

    const escapeHtml = (value) =>
        String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    const formatModalValue = (field, value) => {
        if (!value) return "-";
        if (["birthday", "wedding_date", "baptism_date", "membership_date"].includes(field)) {
            return formatDisplayDate(value);
        }
        return escapeHtml(value);
    };

    const buildInput = (field, value, data = {}) => {
        const safeValue = escapeHtml(value ?? "");

        if (field === "spouse") {
            const spouseId = escapeHtml(data.spouse_id ?? "");
            return `
                <div class="admin-spouse-field-wrap">
                    <input type="hidden" data-field="spouse_id" value="${spouseId}">
                    <input
                        type="text"
                        data-field="spouse"
                        value="${safeValue}"
                        data-selected-id="${spouseId}"
                        autocomplete="off"
                        placeholder="${data.marital_status === "Married" ? "Type and select married username" : "Available only for Married status"}"
                        ${data.marital_status === "Married" ? "" : "disabled"}
                    >
                    <div class="admin-spouse-suggestions" style="display:none;"></div>
                </div>
            `;
        }

        if (optionSets[field]) {
            const options = optionSets[field]
                .map((opt) => `<option value="${escapeHtml(opt)}" ${String(opt) === String(value ?? "") ? "selected" : ""}>${escapeHtml(opt || "Select")}</option>`)
                .join("");
            return `<select data-field="${field}">${options}</select>`;
        }

        const type = ["birthday", "wedding_date", "baptism_date", "membership_date"].includes(field) ? "date" : "text";
        return `<input type="${type}" data-field="${field}" value="${safeValue}">`;
    };

    const renderDetailsView = (container, fields, data, editable = false) => {
        container.innerHTML = "";
        fields.forEach((field) => {
            let content = "";

            if (editable) {
                content = buildInput(field, field === "spouse" ? (data.spouse_username ?? "") : (data[field] ?? ""), data);
            } else {
                content = formatModalValue(field, field === "spouse" ? (data.spouse_username ?? "") : (data[field] ?? ""));
            }

            container.insertAdjacentHTML(
                "beforeend",
                `<div>
                    <strong class="detail-row-label">${fieldLabels[field] || field}:</strong>
                    <div class="detail-row-value">${content}</div>
                </div>`
            );
        });
    };

    const collectModalData = (container, fields) => {
        const out = {};
        fields.forEach((field) => {
            if (field === "spouse") {
                const spouseName = container.querySelector('[data-field="spouse"]');
                const spouseId = container.querySelector('[data-field="spouse_id"]');
                out.spouse = spouseName ? spouseName.value.trim() : "";
                out.spouse_id = spouseId ? spouseId.value.trim() : "";
                return;
            }

            const input = container.querySelector(`[data-field="${field}"]`);
            out[field] = input ? input.value.trim() : "";
        });
        return out;
    };

    const hideAdminSpouseSuggestions = (wrap) => {
        const box = wrap?.querySelector(".admin-spouse-suggestions");
        if (!box) return;
        box.innerHTML = "";
        box.style.display = "none";
    };

    const setAdminSpouseFieldState = (personalDetails) => {
        const maritalSelect = personalDetails?.querySelector('[data-field="marital_status"]');
        const spouseInput = personalDetails?.querySelector('[data-field="spouse"]');
        const spouseIdInput = personalDetails?.querySelector('[data-field="spouse_id"]');

        if (!maritalSelect || !spouseInput || !spouseIdInput) return;

        const isMarried = maritalSelect.value === "Married";
        spouseInput.disabled = !isMarried;

        if (!isMarried) {
            spouseInput.value = "";
            spouseInput.dataset.selectedId = "";
            spouseIdInput.value = "";
            spouseInput.placeholder = "Available only for Married status";
            hideAdminSpouseSuggestions(spouseInput.closest(".admin-spouse-field-wrap"));
        } else {
            spouseInput.placeholder = "Type and select married username";
        }
    };

    const wireAdminSpouseAutocomplete = (personalDetails, memberId) => {
        const spouseInput = personalDetails?.querySelector('[data-field="spouse"]');
        const spouseIdInput = personalDetails?.querySelector('[data-field="spouse_id"]');
        const maritalSelect = personalDetails?.querySelector('[data-field="marital_status"]');
        const wrap = spouseInput?.closest(".admin-spouse-field-wrap");
        const box = wrap?.querySelector(".admin-spouse-suggestions");

        if (!spouseInput || !spouseIdInput || !maritalSelect || !wrap || !box) return;

        let requestId = 0;

        const search = async (keyword) => {
            const trimmed = keyword.trim();

            if (maritalSelect.value !== "Married" || trimmed === "") {
                hideAdminSpouseSuggestions(wrap);
                return;
            }

            const currentRequestId = ++requestId;

            try {
                const res = await safeFetch(`admin-functions/admin-search-spouse.php?member_id=${encodeURIComponent(memberId)}&q=${encodeURIComponent(trimmed)}`);
                const data = await jsonOrThrow(res);

                if (currentRequestId !== requestId) return;

                if (!data.success || !Array.isArray(data.items)) {
                    throw new Error(data.message || "Failed to search spouses");
                }

                if (data.items.length === 0) {
                    box.innerHTML = `<div class="admin-spouse-suggestion-empty">No matching married usernames found.</div>`;
                    box.style.display = "block";
                    return;
                }

                box.innerHTML = data.items.map((item) => `
                    <button
                        type="button"
                        class="admin-spouse-suggestion-item"
                        data-id="${item.id}"
                        data-username="${escapeHtml(item.username)}"
                    >${escapeHtml(item.username)}</button>
                `).join("");

                box.style.display = "block";

                box.querySelectorAll(".admin-spouse-suggestion-item").forEach((btn) => {
                    btn.addEventListener("click", () => {
                        spouseInput.value = btn.dataset.username || "";
                        spouseInput.dataset.selectedId = btn.dataset.id || "";
                        spouseIdInput.value = btn.dataset.id || "";
                        hideAdminSpouseSuggestions(wrap);
                    });
                });
            } catch (err) {
                console.error("Admin spouse search failed:", err);
                hideAdminSpouseSuggestions(wrap);
            }
        };

        maritalSelect.addEventListener("change", () => {
            setAdminSpouseFieldState(personalDetails);
        });

        spouseInput.addEventListener("input", () => {
            if (maritalSelect.value !== "Married") return;
            spouseInput.dataset.selectedId = "";
            spouseIdInput.value = "";
            search(spouseInput.value);
        });

        spouseInput.addEventListener("focus", () => {
            if (spouseInput.value.trim() !== "") {
                search(spouseInput.value);
            }
        });

        document.addEventListener("click", (event) => {
            if (!wrap.contains(event.target)) {
                hideAdminSpouseSuggestions(wrap);
            }
        });

        setAdminSpouseFieldState(personalDetails);
    };

    const updateTableRowFromMember = (memberId, member) => {
        const row = membersTableBody?.querySelector(`.view-details[data-id="${memberId}"]`)?.closest("tr");
        if (!row) return;

        if (row.cells[1]) row.cells[1].textContent = member.username ?? "-";

        if (row.cells[2]) {
            row.cells[2].dataset.sortValue = member.birthday || "";
            row.cells[2].textContent = formatDisplayDate(member.birthday);
        }

        if (row.cells[3]) row.cells[3].textContent = member.group || "-";

        if (row.cells[4]) {
            row.cells[4].dataset.sortValue = member.membership_date || "";
            row.cells[4].textContent = formatDisplayDate(member.membership_date);
        }

        if (row.cells[5]) {
            row.cells[5].dataset.sortValue = member.baptism_date || "";
            row.cells[5].textContent = formatDisplayDate(member.baptism_date);
        }
    };
    // ---------- Members ----------
    const membersTable = qs("#membersTable");
    const membersTableBody = qs("#membersTable tbody");
    const sortBySelectMembers = qs("#sortBy");
    const toggleSortOrderBtn = qs("#toggleSortOrder");
    const searchNameInput = qs("#searchName");
    const exportCSVBtn = qs("#exportCSV");
    const exportPDFBtn = qs("#exportPDF");
    const branchButtons = qsa(".bcc-branch-btn");
    const statusTabs = qsa(".status-tab");

    if (!membersTable) return;

    const renumberVisibleRows = () => {
        if (!membersTableBody) return;

        let counter = 1;
        Array.from(membersTableBody.querySelectorAll("tr")).forEach((row) => {
            if (row.style.display === "none") return;
            const firstCell = row.cells[0];
            if (firstCell) {
                firstCell.textContent = counter++;
            }
        });
    };

    const getDateConfig = (status) => {
        switch ((status || "").toLowerCase()) {
            case "pending":
                return { label: "Date Created", value: "date_created" };
            case "rejected":
                return { label: "Date Rejected", value: "date_rejected" };
            default:
                return { label: "Date Approved", value: "date_approved" };
        }
    };
    const updateSortDropdown = (status) => {
        if (!sortBySelectMembers) return;
        const firstOption = sortBySelectMembers.options?.[0];
        if (!firstOption) return;
        const config = getDateConfig(status);
        firstOption.textContent = config.label;
        firstOption.value = config.value;
    };

    const renderMemberRows = (rows, status) => {
        if (!membersTableBody) return;

        if (!rows?.length) {
            membersTableBody.innerHTML = `<tr><td colspan="8">No requests found.</td></tr>`;
            return;
        }

        membersTableBody.innerHTML = rows
            .map(
                (row, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${row.username}</td>
                    <td data-sort-value="${row.birthday || ""}">${formatDisplayDate(row.birthday)}</td>
                    <td>${row.group}</td>
                    <td data-sort-value="${row.membership_date || ""}">${formatDisplayDate(row.membership_date)}</td>
                    <td data-sort-value="${row.baptism_date || ""}">${formatDisplayDate(row.baptism_date)}</td>
                    <td data-sort-value="${row.date_display || ""}">${formatDisplayDateTime(row.date_display)}</td>
                    <td>
                        <span class="actions">
                            <button class="view-details" data-id="${row.id}">📄</button>
                            ${status === "pending"
                        ? `
                                    <button class="btn-approve" data-id="${row.id}">✓</button>
                                    <button class="btn-reject" data-id="${row.id}">✕</button>
                                  `
                        : ""
                    }
                            ${status === "approved"
                        ? `
                                    <button class="role-change" data-id="${row.id}">🔑</button>
                                    <button class="delete-row" data-id="${row.id}">✕</button>
                                  `
                        : ""
                    }
                        </span>
                    </td>
                </tr>
            `
            )
            .join("");

        renumberVisibleRows();
    };

    const setDateHeaderLabel = (status) => {
        const th = qs("#dateHeader");
        if (th) th.textContent = getDateConfig(status).label;
    };

    const currentBranch = () => qs(".bcc-branch-btn.active")?.dataset.branch || "";
    const currentStatus = () => qs(".status-tab.active")?.dataset.status || "approved";

    const loadMembers = async (branch, status) => {
        setDateHeaderLabel(status);
        try {
            const res = await safeFetch(
                `get-members.php?branch=${encodeURIComponent(branch)}&status=${encodeURIComponent(status)}`
            );
            const data = await jsonOrThrow(res);
            renderMemberRows(data, status);
        } catch (err) {
            console.error("Error loading members:", err);
            if (membersTableBody) {
                membersTableBody.innerHTML = `<tr><td colspan="8">Error loading members</td></tr>`;
            }
        }
    };
    // Initial load
    {
        const activeBranchBtn = qs(".bcc-branch-btn.active");
        const activeStatusTab = qs(".status-tab.active");
        const initialBranch = activeBranchBtn?.dataset.branch;
        const initialStatus = activeStatusTab?.dataset.status;

        if (initialBranch && initialStatus) {
            loadMembers(initialBranch, initialStatus);
            updateSortDropdown(initialStatus);
        }
    }

    // Delegate actions
    if (membersTableBody) {
        // View details
        delegate(membersTableBody, "click", ".view-details", async (_e, btn) => {
            const memberId = btn.dataset.id;
            const modal = qs("#detailsModal");
            const closeModal = qs("#closeModal");
            const personalDetails = qs("#personalDetails");
            const churchDetails = qs("#churchDetails");
            const editMemberBtn = qs("#editMemberBtn");

            let currentMember = null;
            let isEditing = false;

            const renderReadOnly = () => {
                if (!currentMember) return;
                renderDetailsView(personalDetails, personalFields, currentMember, false);
                renderDetailsView(churchDetails, churchFields, currentMember, false);
                isEditing = false;
                if (editMemberBtn) editMemberBtn.textContent = "EDIT";
            };

            const renderEditable = () => {
                if (!currentMember) return;
                renderDetailsView(personalDetails, personalFields, currentMember, true);
                renderDetailsView(churchDetails, churchFields, currentMember, true);
                wireAdminSpouseAutocomplete(personalDetails, memberId);
                isEditing = true;
                if (editMemberBtn) editMemberBtn.textContent = "SAVE";
            };

            try {
                const res = await safeFetch(`admin-functions/get-member-details.php?id=${encodeURIComponent(memberId)}`);
                const data = await jsonOrThrow(res);
                if (!data.success) return alert("Failed to fetch member details");

                currentMember = data;
                renderReadOnly();

                const approvedTabActive = currentStatus() === "approved";
                if (editMemberBtn) {
                    editMemberBtn.style.display = approvedTabActive ? "inline-block" : "none";
                    editMemberBtn.textContent = "EDIT";
                    editMemberBtn.onclick = null;

                    editMemberBtn.onclick = async () => {
                        if (!currentMember) return;

                        if (!isEditing) {
                            renderEditable();
                            return;
                        }

                        const payload = {
                            id: String(memberId),
                            ...collectModalData(personalDetails, personalFields),
                            ...collectModalData(churchDetails, churchFields),
                        };

                        if ((payload.marital_status || "") === "Married" && payload.spouse && !payload.spouse_id) {
                            alert("Please select a spouse from the dropdown list.");
                            return;
                        }

                        if ((payload.marital_status || "") !== "Married") {
                            payload.spouse = "";
                            payload.spouse_id = "";
                        }

                        try {
                            const res = await safeFetch("admin-functions/update-member-details.php", {
                                method: "POST",
                                body: addCSRF(new URLSearchParams(payload)),
                            });

                            const resp = await jsonOrThrow(res);
                            if (!resp.success || !resp.member) {
                                throw new Error(resp.message || "Failed to update member");
                            }

                            currentMember = resp.member;
                            renderReadOnly();
                            updateTableRowFromMember(memberId, currentMember);
                            alert("Member updated successfully.");
                        } catch (err) {
                            console.error("Update member failed:", err);
                            alert(err.message || "Failed to update member.");
                        }
                    };
                }

                if (modal) modal.style.display = "flex";

                on(closeModal, "click", () => (modal.style.display = "none"));
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
                console.error(err);
                alert("Failed to fetch member details");
            }
        });

        delegate(membersTableBody, "click", ".delete-row", async (_e, btn) => {
            const memberId = btn.dataset.id;
            if (!memberId) return;

            const row = btn.closest("tr");
            const username = row?.children?.[1]?.textContent?.trim() || "this member";
            const confirmed = window.confirm(`Are you sure you want to permanently remove ${username} from the list?`);
            if (!confirmed) return;

            btn.disabled = true;

            try {
                const body = addCSRF(new URLSearchParams({ id: memberId }));

                const res = await safeFetch("delete-member.php", {
                    method: "POST",
                    body
                });

                const data = await jsonOrThrow(res);

                if (!data || data.success !== true) {
                    throw new Error(data?.message || "Delete failed");
                }

                const row = btn.closest("tr");
                if (row) row.remove();

                const remainingRows = membersTableBody.querySelectorAll("tr").length;
                if (remainingRows === 0) {
                    membersTableBody.innerHTML = `<tr><td colspan="8">No members found.</td></tr>`;
                } else {
                    renumberVisibleRows();
                }

                alert("Member deleted successfully.");
            } catch (err) {
                console.error("Delete member failed:", err);
                alert(err.message || "Failed to delete member.");
                btn.disabled = false;
            }
        });

        // Approve / Reject
        delegate(membersTableBody, "click", ".btn-approve,.btn-reject", async (_e, btn) => {
            const memberId = btn.dataset.id;
            const isApprove = btn.classList.contains("btn-approve");
            const url = isApprove ? "admin-functions/approve-member.php" : "admin-functions/reject-member.php";

            const row = btn.closest("tr");
            const usernameCell = row ? row.cells[1] : null;
            const username = (usernameCell?.textContent || "").trim() || "this user";

            const actionText = isApprove ? "approve" : "reject";
            const confirmMsg = `Are you sure you want to ${actionText} ${username}?`;
            if (!window.confirm(confirmMsg)) return;

            try {
                const res = await safeFetch(url, {
                    method: "POST",
                    body: addCSRF(new URLSearchParams({ id: memberId })),
                });

                const resp = await jsonOrThrow(res);

                if (resp.success) {
                    alert(isApprove ? "Approved successfully!" : "Rejected successfully!");
                    row?.remove();

                    const targetStatus = isApprove ? "approved" : "rejected";
                    const targetTab = qs(`.status-tab[data-status="${targetStatus}"]`);
                    if (targetTab) targetTab.click();
                } else {
                    alert("Error: " + (resp.message || "Operation failed"));
                }
            } catch (err) {
                console.error("Error approving/rejecting:", err);
                alert("Network error.");
            }
        });
        // Role change
        (() => {
            const roleModal = qs("#roleModal");
            const closeRoleModal = qs("#closeRoleModal");
            const roleModalTitle = qs("#roleModalTitle");
            const roleModalText = qs("#roleModalText");
            const roleYesBtn = qs("#roleYesBtn");
            const roleNoBtn = qs("#roleNoBtn");

            let currentRoleMemberId = null;
            let currentRoleUsername = "";
            let currentRole = "";

            delegate(membersTableBody, "click", ".role-change", async (_e, btn) => {
                currentRoleMemberId = btn.dataset.id;
                try {
                    const res = await safeFetch(`admin-functions/get-member-details.php?id=${encodeURIComponent(currentRoleMemberId)}`);
                    const data = await jsonOrThrow(res);
                    if (!data.success) return alert("Failed to fetch member details");

                    currentRoleUsername = data.username;
                    currentRole = data.role
                        ? data.role.charAt(0).toUpperCase() + data.role.slice(1).toLowerCase()
                        : "Member";

                    if (currentRole === "Member") {
                        roleModalTitle.textContent = "Make Admin?";
                        roleModalText.innerHTML = `Role: Member<br>Do you want to make ${currentRoleUsername} an Admin?`;
                    } else {
                        roleModalTitle.textContent = "Make Member?";
                        roleModalText.innerHTML = `Role: Admin<br>Do you want to make ${currentRoleUsername} a Member?`;
                    }

                    if (roleModal) roleModal.style.display = "flex";
                } catch (err) {
                    console.error(err);
                    alert("Failed to fetch member details");
                }
            });
            on(closeRoleModal, "click", () => roleModal && (roleModal.style.display = "none"));
            on(roleModal, "click", (e) => {
                if (e.target === roleModal) roleModal.style.display = "none";
            });
            on(roleNoBtn, "click", () => roleModal && (roleModal.style.display = "none"));

            on(roleYesBtn, "click", async () => {
                if (!currentRoleMemberId) return;

                const action = currentRole === "Member" ? "admin" : "member";
                const label = action.charAt(0).toUpperCase() + action.slice(1);
                const confirmMsg = `Are you sure you want to make ${currentRoleUsername} ${label}?`;
                if (!window.confirm(confirmMsg)) return;

                try {
                    const body = addCSRF(
                        new URLSearchParams({
                            id: String(currentRoleMemberId),
                            role: action,
                        })
                    );

                    const res = await safeFetch("admin-functions/change-role.php", {
                        method: "POST",
                        body,
                    });
                    const resp = await jsonOrThrow(res);

                    if (resp.success) {
                        alert("Role changed successfully.");
                        if (roleModal) roleModal.style.display = "none";

                        const branch = currentBranch();
                        const status = currentStatus();
                        if (branch && status) loadMembers(branch, status);
                    } else {
                        alert("Error: " + (resp.message || "Failed to change role."));
                    }
                } catch (err) {
                    console.error("Error changing role:", err);
                    alert("Network error.");
                }
            });
        })();
    }
    // Branch buttons
    branchButtons.forEach((btn) => {
        on(btn, "click", () => {
            branchButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const branch = btn.dataset.branch || "";
            const status = qs(".status-tab.active")?.dataset.status || "approved";
            loadMembers(branch, status);
            updateSortDropdown(status);
        });
    });

    // Status tabs
    statusTabs.forEach((tab) => {
        on(tab, "click", () => {
            statusTabs.forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            const status = tab.dataset.status || "approved";
            const branch = qs(".bcc-branch-btn.active")?.dataset.branch || "";
            loadMembers(branch, status);
            updateSortDropdown(status);
        });
    });

    // Search
    on(searchNameInput, "input", (e) => {
        const needle = (e.target.value || "").toLowerCase();
        qsa("#membersTable tbody tr").forEach((row) => {
            const usernameCell = row.cells[1];
            const match = (usernameCell?.textContent || "").toLowerCase().includes(needle);
            row.style.display = match ? "" : "none";
        });
        renumberVisibleRows();
    });

    // Sorting
    let sortAsc = true;

    const sortTable = () => {
        if (!sortBySelectMembers || !membersTableBody) return;

        const sortBy = sortBySelectMembers.value;
        const rows = Array.from(membersTableBody.querySelectorAll("tr"));

        const colIndexMap = {
            username: 1,
            birthday: 2,
            group: 3,
            membership_date: 4,
            baptism_date: 5,
            date_approved: 6,
            date_created: 6,
            date_rejected: 6,
        };

        const index = colIndexMap[sortBy] ?? 0;

        rows.sort((a, b) => {
            const aCell = a.cells[index];
            const bCell = b.cells[index];

            const aVal = aCell?.dataset.sortValue || txt(aCell);
            const bVal = bCell?.dataset.sortValue || txt(bCell);

            if (
                ["birthday", "membership_date", "baptism_date", "date_approved", "date_created", "date_rejected"].includes(
                    sortBy
                )
            ) {
                const da = preferDate(aVal) || new Date(0);
                const db = preferDate(bVal) || new Date(0);
                return sortAsc ? da - db : db - da;
            }

            return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });

        membersTableBody.innerHTML = "";
        rows.forEach((r) => membersTableBody.appendChild(r));
        renumberVisibleRows();
    };
    on(sortBySelectMembers, "change", sortTable);
    on(toggleSortOrderBtn, "click", () => {
        sortAsc = !sortAsc;
        if (toggleSortOrderBtn) toggleSortOrderBtn.textContent = sortAsc ? "▲" : "▼";
        sortTable();
    });

    // Export CSV
    on(exportCSVBtn, "click", () => {
        const table = qs("#membersTable");
        if (!table) return;

        const rows = Array.from(table.querySelectorAll("tbody tr")).filter((r) => r.style.display !== "none");

        const csv = [];
        const headers = Array.from(table.querySelectorAll("thead th"));
        csv.push(headers.map((h) => `"${txt(h).replace(/"/g, '""')}"`).join(","));

        rows.forEach((row) => {
            const cols = Array.from(row.querySelectorAll("td"));
            const rowData = cols.map((col, idx) => {
                if (idx === cols.length - 1) {
                    const dateText = (col.childNodes[0] && txt(col.childNodes[0])) || "";
                    return `"${dateText.replace(/"/g, '""')}"`;
                }
                return `"${txt(col).replace(/"/g, '""')}"`;
            });
            csv.push(rowData.join(","));
        });

        const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "members.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    });
    // Export PDF
    on(exportPDFBtn, "click", () => {
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) return alert("jsPDF not loaded");

        const table = qs("#membersTable");
        if (!table) return;

        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        if (typeof doc.autoTable !== "function") return alert("jsPDF autoTable plugin not loaded");

        const margin = 32;
        let y = margin;

        doc.setFontSize(14);
        doc.text("Members", margin, y);
        y += 12;

        const head = ["Username", "Birthday", "Group", "Membership Date", "Water Baptism Date", "Date Approved"];

        const body = [];
        qsa("#membersTable tbody tr").forEach((row) => {
            if (row.style.display === "none") return;
            const cells = row.querySelectorAll("td");
            if (cells.length < 6) return;

            const username = (cells[0]?.textContent || "").trim();
            const birthday = (cells[1]?.textContent || "").trim();
            const group = (cells[2]?.textContent || "").trim();
            const membership = (cells[3]?.textContent || "").trim();
            const baptism = (cells[4]?.textContent || "").trim();

            let dateApproved = "";
            if (cells[5]) {
                const first = cells[5].childNodes[0];
                dateApproved = (first?.textContent ?? cells[5].textContent ?? "").trim();
            }

            body.push([username, birthday, group, membership, baptism, dateApproved]);
        });
        doc.autoTable({
            head: [head],
            body,
            startY: y,
            margin: { left: margin, right: margin },
            styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", textColor: [0, 0, 0] },
            headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
        });

        doc.save("members.pdf");
    });
});