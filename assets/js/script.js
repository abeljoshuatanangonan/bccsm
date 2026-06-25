document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.isLoggedIn === "undefined") {
    window.isLoggedIn = false;
  }
  console.log("✅ Script started properly");

  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const closeSidebar = document.getElementById('closeSidebar');
  const userBtn = document.getElementById('userBtn');
  const userPanel = document.getElementById('userPanel');

  // === CSRF helpers ===
  function getCSRF() {
    const m = document.querySelector('meta[name="csrf-token"]');
    if (m && m.content) return m.content;
    const h = document.querySelector('input[name="csrf_token"]');
    return h ? h.value : '';
  }

  async function safeFetch(url, opts = {}) {
    const headers = new Headers(opts.headers || {});
    headers.set('X-CSRF-Token', getCSRF());
    headers.set('X-Requested-With', 'XMLHttpRequest');
    return fetch(url, { ...opts, headers });
  }

  // Dropdown toggle
  document.querySelectorAll('.dropdown > a').forEach(drop => {
    drop.addEventListener('click', e => {
      e.preventDefault();
      const content = drop.nextElementSibling;
      content.style.display = (content.style.display === 'block') ? 'none' : 'block';
    });
  });

  // User panel toggle (desktop only)
  if (userBtn && userPanel) {
    userBtn.addEventListener('click', e => {
      e.preventDefault();
      if (window.innerWidth > 768) {
        userPanel.style.display = (userPanel.style.display === 'block') ? 'none' : 'block';
      }
    });
    document.addEventListener('click', e => {
      if (!userBtn.contains(e.target) && !userPanel.contains(e.target)) {
        userPanel.style.display = 'none';
      }
    });
  }

  // Sidebar toggle (patched with accessibility)
  if (hamburgerBtn && sidebar && overlay && closeSidebar) {
    hamburgerBtn.addEventListener('click', e => {
      e.preventDefault();
      sidebar.classList.add('active');
      overlay.classList.add('active');
      sidebar.setAttribute('aria-hidden', 'false');
      hamburgerBtn.setAttribute('aria-expanded', 'true');

      const firstLink = sidebar.querySelector('a, button');
      if (firstLink) firstLink.focus();
    });

    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      sidebar.setAttribute('aria-hidden', 'true');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
    });

    closeSidebar.addEventListener('click', () => {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      sidebar.setAttribute('aria-hidden', 'true');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
    });
  }


  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('active')) {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      sidebar.setAttribute('aria-hidden', 'true');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
      hamburgerBtn.focus();
    }
  });

  // Event slider
  let currentEvent = 0;
  const events = document.querySelectorAll('.event-mover');
  const totalEvents = events.length;

  function showEvent(index) {
    events.forEach(e => e.classList.remove('active'));
    events[index].classList.add('active');
  }
  document.querySelector('.event-arrow.left')?.addEventListener('click', () => {
    currentEvent = (currentEvent - 1 + totalEvents) % totalEvents;
    showEvent(currentEvent);
  });
  document.querySelector('.event-arrow.right')?.addEventListener('click', () => {
    currentEvent = (currentEvent + 1) % totalEvents;
    showEvent(currentEvent);
  });
  if (totalEvents > 0) showEvent(currentEvent);

  const datePickerConfigs = {
    birthday: { selector: "#birthday", options: { maxDate: "today" } },
    wedding_date: { selector: "#wedding_date", options: {} },
    membership_date: { selector: "#membership_date", options: {} },
    baptism_date: { selector: "#baptism_date", options: { maxDate: "today" } }
  };

  const datePickers = {};

  const initDatePicker = (selector, options = {}, forceInteractive = null) => {
    if (typeof flatpickr === "undefined") return null;

    const input = document.querySelector(selector);
    if (!input) return null;

    if (input._flatpickr) {
      input._flatpickr.destroy();
    }

    const shouldOpen = forceInteractive !== null ? forceInteractive : !input.disabled;

    input.disabled = !shouldOpen;
    input.readOnly = !shouldOpen;

    const picker = flatpickr(input, {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "F j, Y",
      allowInput: false,
      clickOpens: shouldOpen,
      disableMobile: true,
      defaultDate: input.value || null,
      monthSelectorType: "dropdown",
      ...options
    });

    if (picker.altInput) {
      picker.altInput.disabled = !shouldOpen;
      picker.altInput.readOnly = !shouldOpen;
      picker.altInput.setAttribute("aria-disabled", shouldOpen ? "false" : "true");
    }

    return picker;
  };

  const rebuildDatePicker = (key, interactive) => {
    const config = datePickerConfigs[key];
    if (!config) return null;

    datePickers[key] = initDatePicker(config.selector, config.options, interactive);
    return datePickers[key];
  };

  const rebuildAllDefaultDatePickers = () => {
    Object.keys(datePickerConfigs).forEach((key) => {
      const input = document.querySelector(datePickerConfigs[key].selector);
      rebuildDatePicker(key, input ? !input.disabled : false);
    });
  };

  rebuildAllDefaultDatePickers();

  const registrationForm = document.querySelector(".registration-form");
  const confirmationOverlay = document.getElementById("confirmation-overlay");
  const confirmYes = document.getElementById("confirmYes");
  const confirmNo = document.getElementById("confirmNo");

  if (registrationForm) {
    const showConfirmation = () => confirmationOverlay.style.display = "flex";
    const hideConfirmation = () => confirmationOverlay.style.display = "none";

    const backBtn = document.getElementById("registrationBackBtn");

    let formDirty = false;
    let allowNavigation = false;

    const markDirty = () => {
      formDirty = true;
    };

    const clearDirty = () => {
      formDirty = false;
    };

    registrationForm.querySelectorAll("input, select, textarea").forEach((field) => {
      field.addEventListener("input", markDirty);
      field.addEventListener("change", markDirty);
    });

    window.addEventListener("beforeunload", (e) => {
      if (!formDirty || allowNavigation) return;
      e.preventDefault();
      e.returnValue = "";
    });

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (!formDirty) {
          allowNavigation = true;
          window.location.href = "login.php";
          return;
        }

        const confirmed = window.confirm("You have unsaved changes. Do you want to leave this page?");
        if (confirmed) {
          allowNavigation = true;
          registrationForm.reset();
          window.location.href = "login.php";
        }
      });
    }

    const confirmError = document.getElementById("confirm-error");
    const usernameError = document.getElementById("username-error");

    // Intercept form submission
    registrationForm.addEventListener("submit", async e => {
      e.preventDefault();

      const pwd = registrationForm.password?.value;
      const confirmPwd = registrationForm.confirm_password?.value;
      const username = registrationForm.username?.value;

      // Reset previous errors
      confirmError.textContent = "";
      confirmError.style.display = "none";
      usernameError.textContent = "";
      usernameError.style.display = "none";

      // ✅ Password constraints
      const pwdRules = [
        { regex: /.{8,}/, message: "At least 8 characters" },
        { regex: /[A-Z]/, message: "At least one uppercase letter" },
        { regex: /[a-z]/, message: "At least one lowercase letter" },
        { regex: /[0-9]/, message: "At least one number" }
      ];
      for (let rule of pwdRules) {
        if (!rule.regex.test(pwd)) {
          confirmError.textContent = `Password invalid: ${rule.message}`;
          confirmError.style.display = "block";
          return; // stop submission
        }
      }

      // ✅ Password match check
      if (pwd && confirmPwd && pwd !== confirmPwd) {
        confirmError.textContent = "Passwords do not match!";
        confirmError.style.display = "block";
        return; // stop submission
      }

      // ✅ Username availability check
      try {
        const resp = await fetch("check-username.php", {
          method: "POST",
          body: new URLSearchParams({ username })
        });
        const text = await resp.text();
        if (text.trim() === "taken") {
          usernameError.textContent = "Username already taken.";
          usernameError.style.display = "block";
          return; // stop submission
        }
      } catch (err) {
        alert("Error checking username availability.");
        return;
      }

      // ✅ All validations passed → show confirmation overlay
      if (registrationForm.checkValidity()) {
        showConfirmation();
      } else {
        registrationForm.reportValidity();
      }
    });

    // YES button: submit via AJAX
    confirmYes.addEventListener("click", () => {
      hideConfirmation();
      fetch(registrationForm.action, {
        method: registrationForm.method,
        body: new FormData(registrationForm)
      })
        .then(r => r.text())
        .then(data => {
          if (data.trim() === "success") {
            allowNavigation = true;
            clearDirty();
            document.getElementById("success-overlay").style.display = "flex";
            registrationForm.reset();
          } else {
            alert(data || "Error submitting form");
          }
        })
        .catch(err => alert("Error submitting form."));
    });

    // NO button: hide overlay
    confirmNo.addEventListener("click", hideConfirmation);
  }

  document.getElementById("backToHome")?.addEventListener("click", function () {
    document.getElementById("success-overlay").style.display = "none";
    window.location.href = "index.php";
  });

  // Hide login error when user types
  const usernameInput = document.querySelector("input[name='username']");
  const passwordInput = document.getElementById("loginPassword");
  const loginError = document.getElementById("login-error");
  const loginPasswordToggle = document.getElementById("loginPasswordToggle");

  const updateLoginPasswordToggle = () => {
    if (!passwordInput || !loginPasswordToggle) return;

    const hasValue = passwordInput.value.trim() !== "";
    const isVisible = passwordInput.type === "text";

    loginPasswordToggle.hidden = !hasValue;
    loginPasswordToggle.dataset.visible = String(isVisible);
    loginPasswordToggle.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
    loginPasswordToggle.setAttribute("aria-pressed", isVisible ? "true" : "false");

    if (!hasValue && isVisible) {
      passwordInput.type = "password";
      loginPasswordToggle.dataset.visible = "false";
      loginPasswordToggle.setAttribute("aria-label", "Show password");
      loginPasswordToggle.setAttribute("aria-pressed", "false");
    }
  };

  if (usernameInput && loginError) {
    usernameInput.addEventListener("input", () => {
      loginError.style.display = "none";
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener("input", () => {
      if (loginError) {
        loginError.style.display = "none";
      }
      updateLoginPasswordToggle();
    });

    passwordInput.addEventListener("change", updateLoginPasswordToggle);
    passwordInput.addEventListener("focus", updateLoginPasswordToggle);
    passwordInput.addEventListener("blur", updateLoginPasswordToggle);
  }

  if (passwordInput && loginPasswordToggle) {
    updateLoginPasswordToggle();

    loginPasswordToggle.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });

    loginPasswordToggle.addEventListener("click", () => {
      const shouldShow = passwordInput.type === "password";
      passwordInput.type = shouldShow ? "text" : "password";

      updateLoginPasswordToggle();

      passwordInput.focus({ preventScroll: true });

      const valueLength = passwordInput.value.length;
      try {
        passwordInput.setSelectionRange(valueLength, valueLength);
      } catch (_) { }
    });
  }

  const bindPasswordToggle = (inputId, toggleId) => {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);

    if (!input || !toggle) return;

    const updateToggle = () => {
      const hasValue = input.value.trim() !== "";
      const isVisible = input.type === "text";

      toggle.hidden = !hasValue;
      toggle.dataset.visible = String(isVisible);
      toggle.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
      toggle.setAttribute("aria-pressed", isVisible ? "true" : "false");

      if (!hasValue && isVisible) {
        input.type = "password";
        toggle.dataset.visible = "false";
        toggle.setAttribute("aria-label", "Show password");
        toggle.setAttribute("aria-pressed", "false");
      }
    };

    input.addEventListener("input", updateToggle);
    input.addEventListener("change", updateToggle);
    input.addEventListener("focus", updateToggle);
    input.addEventListener("blur", updateToggle);

    toggle.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });

    toggle.addEventListener("click", () => {
      const shouldShow = input.type === "password";
      input.type = shouldShow ? "text" : "password";

      updateToggle();

      input.focus({ preventScroll: true });

      const valueLength = input.value.length;
      try {
        input.setSelectionRange(valueLength, valueLength);
      } catch (_) { }
    });

    updateToggle();
  };

  bindPasswordToggle("signupPassword", "signupPasswordToggle");
  bindPasswordToggle("signupConfirmPassword", "signupConfirmPasswordToggle");
  bindPasswordToggle("existingPassword", "existingPasswordToggle");
  bindPasswordToggle("newPassword", "newPasswordToggle");
  bindPasswordToggle("confirmNewPassword", "confirmNewPasswordToggle");

  // Show login error if URL has ?error=1
  if (window.location.search.includes("error=1")) {
    if (loginError) loginError.style.display = 'block';
  }


  // === Offertory Link Logic (Simplified) ===
  document.addEventListener("click", function (e) {
    const link = e.target.closest(".offertory-link");
    if (!link) return;

    e.preventDefault();
    const isLoggedIn = window.isLoggedIn === true || window.isLoggedIn === 'true';

    if (isLoggedIn) {
      // Logged-in users go straight to offertory.php
      window.location.href = "offertory.php";
    } else {
      // Not logged in → redirect to new unlogged-in page
      window.location.href = "offertory-unloggedin.php";
    }
  });

  // === Offertory Page Script ===
  const offertoryForm = document.getElementById("offertoryForm");

  if (offertoryForm) {
    const numberFields = [
      "tithes",
      "offering",
      "pledge",
      "eskwela_suporta",
      "others",
      "construction",
      "samarleyte_pledge"
    ];

    const totalField = document.getElementById("total");
    const otherUseGroup = document.getElementById("otherUseGroup");
    const otherUseInput = document.getElementById("other_use");
    const visitorNameInput = document.getElementById("visitor_name");
    const modeOfOffertoryInput = document.getElementById("mode_of_offertory");
    const bankProofGroup = document.getElementById("bankProofGroup");
    const bankProofInput = document.getElementById("bank_proof_image");
    const clearBankProofBtn = document.getElementById("clearBankProofBtn");

    // === Numeric input restriction & live total calculation ===
    numberFields.forEach(id => {
      const field = document.getElementById(id);
      if (field) {
        field.addEventListener("input", () => {
          const cursorPos = field.selectionStart;
          const cleaned = field.value.replace(/[^\d.]/g, "");
          if (cleaned !== field.value) {
            field.value = cleaned;
            // Restore cursor position safely
            const newPos = Math.min(cursorPos, cleaned.length);
            field.setSelectionRange(newPos, newPos);
          }
          calculateTotal();
          if (id === "others") handleOthersInput();
        });
      }
    });

    function calculateTotal() {
      let total = 0;
      numberFields.forEach(id => {
        const val = parseFloat(document.getElementById(id)?.value || 0);
        total += isNaN(val) ? 0 : val;
      });
      totalField.value = total.toLocaleString();
    }

    function handleOthersInput() {
      const othersValue = parseFloat(document.getElementById("others").value);
      if (othersValue > 0) {
        otherUseGroup.style.display = "block";
      } else {
        otherUseGroup.style.display = "none";
        otherUseInput.value = "";
      }
    }

    function handleModeOfOffertory() {
      const mode = modeOfOffertoryInput?.value || "";
      const isBank = mode === "Bank";

      if (bankProofGroup) {
        bankProofGroup.hidden = !isBank;
      }

      if (bankProofInput) {
        bankProofInput.required = isBank;

        if (!isBank) {
          bankProofInput.value = "";
          bankProofInput.setCustomValidity("");
        } else {
          bankProofInput.setCustomValidity("");
        }
      }

      updateBankProofClearButton();
    }

    function isAllowedBankProofFile(file) {
      if (!file) return false;

      const allowedExtensions = ["jpg", "jpeg", "png", "heif", "heic", "webp", "tif", "tiff"];
      const filename = String(file.name || "").toLowerCase();
      const extension = filename.includes(".") ? filename.split(".").pop() : "";

      return allowedExtensions.includes(extension);
    }

    function updateBankProofClearButton() {
      if (!clearBankProofBtn || !bankProofInput) return;
      clearBankProofBtn.hidden = !(bankProofInput.files && bankProofInput.files.length > 0);
    }

    if (modeOfOffertoryInput) {
      modeOfOffertoryInput.addEventListener("change", handleModeOfOffertory);
      handleModeOfOffertory();
    }

    if (bankProofInput) {
      bankProofInput.addEventListener("change", () => {
        bankProofInput.setCustomValidity("");
        updateBankProofClearButton();
      });
    }

    if (clearBankProofBtn && bankProofInput) {
      clearBankProofBtn.addEventListener("click", () => {
        bankProofInput.value = "";
        bankProofInput.setCustomValidity("");
        updateBankProofClearButton();
        bankProofInput.focus();
      });
    }

    // === Form submission via Fetch API ===
    offertoryForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const formData = new FormData(offertoryForm);

      const isVisitor = !!offertoryForm.querySelector('input[name="visitor"]');
      if (isVisitor) {
        formData.set('force_visitor', '1');
        formData.set('visitor_name', (visitorNameInput?.value || '').trim());
      } else if (visitorNameInput) {
        formData.set('visitor_name', visitorNameInput.value.trim());
      }

      let hasValue = false;
      numberFields.forEach(id => {
        const val = parseFloat(document.getElementById(id)?.value || 0);
        if (val > 0) hasValue = true;
      });

      if (!hasValue) {
        alert('Please fill out at least one field before submitting.');
        return;
      }

      const mode = modeOfOffertoryInput?.value || "";
      if (!mode) {
        alert('Please select a mode of offertory.');
        return;
      }

      if (mode === "Bank") {
        const file = bankProofInput?.files?.[0];

        if (bankProofInput && !file) {
          bankProofInput.setCustomValidity("Please upload the bank proof image.");
          bankProofInput.reportValidity();
          return;
        }

        if (bankProofInput) {
          bankProofInput.setCustomValidity("");
        }

        if (file && !isAllowedBankProofFile(file)) {
          if (bankProofInput) {
            bankProofInput.setCustomValidity("Invalid bank proof image format. Allowed: JPG, JPEG, PNG, HEIF, HEIC, WEBP, TIFF.");
            bankProofInput.reportValidity();
          }
          return;
        }

        if (bankProofInput) {
          bankProofInput.setCustomValidity("");
        }
      }

      const confirmed = confirm("Are you sure all entered amounts are correct?");
      if (!confirmed) return;
      try {
        const response = await safeFetch('save-offertory.php', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.success) {
          alert('Offertory successfully recorded!');
          offertoryForm.reset();
          totalField.value = '';
          otherUseGroup.style.display = 'none';

          const coupleShareCheckbox = document.getElementById('share_as_couple');
          if (coupleShareCheckbox) {
            coupleShareCheckbox.checked = false;
          }

          handleModeOfOffertory();
          updateBankProofClearButton();
        } else {
          alert('Error: ' + (result.message || 'Something went wrong.'));
        }
      } catch (error) {
        console.error('Error submitting offertory:', error);
        alert('An unexpected error occurred. Please try again.');
      }
    });

  }

  const profileForm = document.getElementById("profileForm");
  const profileEditBtn = document.getElementById("profileEditBtn");
  const changeCredentialsBtn = document.getElementById("changeCredentialsBtn");
  const profileCancelBtn = document.getElementById("profileCancelBtn");
  const profileStatusMsg = document.getElementById("profileStatusMsg");

  const maritalStatusField = document.querySelector('#profileForm select[name="marital_status"]');
  const spouseNameInput = document.getElementById("spouse_name");
  const spouseIdInput = document.getElementById("spouse_id");
  const spouseSuggestions = document.getElementById("spouseSuggestions");

  if (profileForm && profileEditBtn && profileCancelBtn && changeCredentialsBtn) {
    const editableFields = Array.from(
      profileForm.querySelectorAll("input[name], select[name], textarea[name]")
    ).filter((field) => field.type !== "hidden");

    let spouseOriginalId = spouseIdInput ? spouseIdInput.value : "";
    let spouseSearchRequestId = 0;

    let profileEditing = false;
    let profileDirty = false;
    let allowProfileLeave = false;

    const originalValues = {};
    editableFields.forEach((field) => {
      originalValues[field.name] = field.value;
    });

    const setProfileStatus = (message, type = "") => {
      if (!profileStatusMsg) return;
      profileStatusMsg.textContent = message;
      profileStatusMsg.className = `profile-status-msg ${type}`.trim();
      profileStatusMsg.style.display = message ? "block" : "none";
    };

    const canEditWeddingDate = () => {
      const status = maritalStatusField?.value || "";
      return profileEditing && (status === "Married" || status === "Widowed");
    };

    const syncProfileDatePickerState = () => {
      rebuildDatePicker("birthday", profileEditing);
      rebuildDatePicker("membership_date", profileEditing);
      rebuildDatePicker("baptism_date", profileEditing);
      rebuildDatePicker("wedding_date", canEditWeddingDate());
    };

    const setEditableState = (editable) => {
      profileEditing = editable;

      editableFields.forEach((field) => {
        field.disabled = !editable;
      });

      setSpouseFieldState();
      syncProfileDatePickerState();

      profileEditBtn.textContent = editable ? "SAVE" : "Edit Profile";
      changeCredentialsBtn.style.display = "inline-block";
      profileCancelBtn.style.display = editable ? "inline-block" : "none";
    };

    const restoreOriginalValues = () => {
      editableFields.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(originalValues, field.name)) return;

        const originalValue = originalValues[field.name];
        field.value = originalValue;

        if (field._flatpickr) {
          field._flatpickr.setDate(originalValue || null, false);
        }

        field.dispatchEvent(new Event("change", { bubbles: true }));
      });

      if (spouseIdInput) spouseIdInput.value = spouseOriginalId;
      if (spouseNameInput) spouseNameInput.dataset.selectedId = spouseOriginalId;

      hideSpouseSuggestions();
      setSpouseFieldState();
    };

    const snapshotCurrentValues = () => {
      editableFields.forEach((field) => {
        originalValues[field.name] = field.value;
      });

      spouseOriginalId = spouseIdInput ? spouseIdInput.value : "";
      if (spouseNameInput) {
        spouseNameInput.dataset.selectedId = spouseOriginalId;
      }
    };

    const hideSpouseSuggestions = () => {
      if (!spouseSuggestions) return;
      spouseSuggestions.innerHTML = "";
      spouseSuggestions.style.display = "none";
    };

    const clearSpouseSelection = (keepTypedValue = false) => {
      if (spouseIdInput) spouseIdInput.value = "";
      if (spouseNameInput) spouseNameInput.dataset.selectedId = "";
      if (spouseNameInput && !keepTypedValue) spouseNameInput.value = "";
      hideSpouseSuggestions();
    };

    const setSpouseFieldState = () => {
      if (!spouseNameInput || !maritalStatusField) return;

      const isMarried = maritalStatusField.value === "Married";
      const canEditSpouse = profileEditing && isMarried;

      spouseNameInput.disabled = !canEditSpouse;
      spouseNameInput.readOnly = !canEditSpouse;

      if (!isMarried) {
        clearSpouseSelection(false);
        spouseNameInput.placeholder = "Available only for Married status";
      } else if (profileEditing) {
        spouseNameInput.placeholder = "Type and select married username";
      } else {
        spouseNameInput.placeholder = "";
        hideSpouseSuggestions();
      }
    };

    const renderSpouseSuggestions = (items) => {
      if (!spouseSuggestions || !spouseNameInput || !spouseIdInput) return;

      if (!Array.isArray(items) || items.length === 0) {
        spouseSuggestions.innerHTML = '<div class="spouse-suggestion-empty">No matching married usernames found.</div>';
        spouseSuggestions.style.display = "block";
        return;
      }

      spouseSuggestions.innerHTML = items
        .map(
          (item) => `
            <button
              type="button"
              class="spouse-suggestion-item"
              data-id="${item.id}"
              data-username="${item.username.replace(/"/g, '&quot;')}"
            >
              ${item.username}
            </button>
          `
        )
        .join("");

      spouseSuggestions.style.display = "block";

      spouseSuggestions.querySelectorAll(".spouse-suggestion-item").forEach((button) => {
        button.addEventListener("click", () => {
          spouseNameInput.value = button.dataset.username || "";
          spouseIdInput.value = button.dataset.id || "";
          spouseNameInput.dataset.selectedId = button.dataset.id || "";
          hideSpouseSuggestions();
          profileDirty = hasProfileChanges();
        });
      });
    };

    const searchSpouses = async (keyword) => {
      if (!spouseNameInput || !spouseSuggestions) return;
      if (!profileEditing || maritalStatusField?.value !== "Married") {
        hideSpouseSuggestions();
        return;
      }

      const trimmed = keyword.trim();

      if (!trimmed) {
        hideSpouseSuggestions();
        return;
      }

      const requestId = ++spouseSearchRequestId;

      try {
        const response = await fetch(`search-spouses.php?q=${encodeURIComponent(trimmed)}`);
        const data = await response.json();

        if (requestId !== spouseSearchRequestId) return;

        if (!response.ok || !data.success) {
          throw new Error(data?.message || "Failed to search spouses");
        }

        renderSpouseSuggestions(data.items || []);
      } catch (error) {
        console.error("Spouse search failed:", error);
        hideSpouseSuggestions();
      }
    };

    const hasProfileChanges = () => {
      const visibleFieldChanged = editableFields.some((field) => field.value !== originalValues[field.name]);
      const spouseChanged = spouseIdInput ? spouseIdInput.value !== spouseOriginalId : false;
      return visibleFieldChanged || spouseChanged;
    };

    editableFields.forEach((field) => {
      field.addEventListener("input", () => {
        if (!profileEditing) return;
        profileDirty = hasProfileChanges();
      });
      field.addEventListener("change", () => {
        if (!profileEditing) return;
        profileDirty = hasProfileChanges();
      });
    });

    if (maritalStatusField) {
      maritalStatusField.addEventListener("change", () => {
        if (maritalStatusField.value !== "Married") {
          clearSpouseSelection(false);
        }

        setSpouseFieldState();
        syncProfileDatePickerState();
        profileDirty = hasProfileChanges();
      });
    }

    if (spouseNameInput) {
      spouseNameInput.addEventListener("input", () => {
        if (!profileEditing || maritalStatusField?.value !== "Married") return;

        if (spouseIdInput) spouseIdInput.value = "";
        spouseNameInput.dataset.selectedId = "";
        profileDirty = hasProfileChanges();
        searchSpouses(spouseNameInput.value);
      });

      spouseNameInput.addEventListener("focus", () => {
        if (!profileEditing || maritalStatusField?.value !== "Married") return;
        if (spouseNameInput.value.trim() !== "") {
          searchSpouses(spouseNameInput.value);
        }
      });
    }

    document.addEventListener("click", (event) => {
      if (!spouseSuggestions || !spouseNameInput) return;
      if (
        spouseSuggestions.contains(event.target) ||
        spouseNameInput.contains(event.target)
      ) {
        return;
      }
      hideSpouseSuggestions();
    });

    window.addEventListener("beforeunload", (e) => {
      if (!profileEditing || !profileDirty || allowProfileLeave) return;
      e.preventDefault();
      e.returnValue = "";
    });

    setEditableState(false);

    profileEditBtn.addEventListener("click", async () => {
      setProfileStatus("");

      if (!profileEditing) {
        allowProfileLeave = false;
        profileDirty = false;
        setEditableState(true);
        return;
      }

      if (maritalStatusField?.value === "Married") {
        const spouseText = spouseNameInput?.value.trim() || "";
        const spouseId = spouseIdInput?.value.trim() || "";

        if (spouseText !== "" && spouseId === "") {
          setProfileStatus("Please select a spouse from the dropdown list.", "error");
          return;
        }
      }

      if (maritalStatusField?.value !== "Married" && spouseIdInput) {
        spouseIdInput.value = "";
      }

      const formData = new FormData(profileForm);

      try {
        const response = await fetch("update-profile.php", {
          method: "POST",
          body: formData
        });

        const text = await response.text();
        let data;

        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Invalid JSON response");
        }

        if (!response.ok || !data.success) {
          throw new Error(data?.message || "Failed to update profile");
        }

        editableFields.forEach((field) => {
          if (data.user && Object.prototype.hasOwnProperty.call(data.user, field.name)) {
            field.value = data.user[field.name] ?? "";
            if (field._flatpickr) {
              field._flatpickr.setDate(field.value || null, false);
            }
          }
        });

        if (spouseNameInput) {
          spouseNameInput.value = data.user?.spouse_username ?? "";
        }

        if (spouseIdInput) {
          spouseIdInput.value = data.user?.spouse_id ?? "";
        }

        hideSpouseSuggestions();
        snapshotCurrentValues();

        profileDirty = false;
        allowProfileLeave = true;
        setEditableState(false);
        setProfileStatus("Profile updated successfully.", "success");

      } catch (error) {
        console.error("Profile update failed:", error);
        setProfileStatus(error.message || "Failed to update profile.", "error");
      }
    });

    profileCancelBtn.addEventListener("click", () => {
      if (!profileDirty) {
        restoreOriginalValues();
        setEditableState(false);
        setProfileStatus("");
        return;
      }

      const confirmed = window.confirm("You have unsaved changes. Do you want to cancel editing?");
      if (!confirmed) return;

      restoreOriginalValues();
      profileDirty = false;
      allowProfileLeave = true;
      setEditableState(false);
      setProfileStatus("");
    });

    const changeCredentialsOverlay = document.getElementById("changeCredentialsOverlay");
    const credentialsUsername = document.getElementById("credentialsUsername");
    const existingPassword = document.getElementById("existingPassword");
    const newPassword = document.getElementById("newPassword");
    const confirmNewPassword = document.getElementById("confirmNewPassword");
    const existingPasswordError = document.getElementById("existingPasswordError");
    const newPasswordError = document.getElementById("newPasswordError");
    const confirmNewPasswordError = document.getElementById("confirmNewPasswordError");

    let existingPasswordValid = false;
    let verifyPasswordRequestId = 0;

    const setNewPasswordFieldsEnabled = (enabled) => {
      if (newPassword) {
        newPassword.disabled = !enabled;
        if (!enabled) newPassword.value = "";
      }
      if (confirmNewPassword) {
        confirmNewPassword.disabled = !enabled;
        if (!enabled) confirmNewPassword.value = "";
      }

      updateSaveCredentialsButtonState();
    };

    const isNewPasswordValid = () => {
      const value = newPassword?.value || "";
      if (!value.trim()) return true;

      const rules = [
        /.{8,}/,
        /[A-Z]/,
        /[0-9]/
      ];

      return rules.every((regex) => regex.test(value));
    };

    const isConfirmPasswordValid = () => {
      const newValue = newPassword?.value || "";
      const confirmValue = confirmNewPassword?.value || "";

      if (!newValue.trim() && !confirmValue.trim()) return true;
      if (!newValue.trim() || !confirmValue.trim()) return false;

      return newValue === confirmValue;
    };

    const updateSaveCredentialsButtonState = () => {
      if (!saveCredentialsBtn) return;

      const usernameValue = credentialsUsername?.value.trim() || "";
      const existingPasswordValue = existingPassword?.value || "";
      const newPasswordValue = newPassword?.value || "";
      const confirmNewPasswordValue = confirmNewPassword?.value || "";

      const usernameValid = usernameValue !== "";
      const existingPasswordFilled = existingPasswordValue.trim() !== "";
      const existingPasswordReady = existingPasswordFilled && existingPasswordValid;

      const newPasswordReady = isNewPasswordValid();
      const confirmPasswordReady = isConfirmPasswordValid();

      const changingPassword = newPasswordValue.trim() !== "" || confirmNewPasswordValue.trim() !== "";

      const canSave = usernameValid &&
        existingPasswordReady &&
        newPasswordReady &&
        confirmPasswordReady &&
        (
          !changingPassword ||
          (newPasswordValue.trim() !== "" && confirmNewPasswordValue.trim() !== "")
        );

      saveCredentialsBtn.disabled = !canSave;
    };

    const updateConfirmPasswordError = () => {
      if (!confirmNewPassword || !confirmNewPasswordError) {
        updateSaveCredentialsButtonState();
        return;
      }

      const confirmValue = confirmNewPassword.value || "";
      const newValue = newPassword?.value || "";

      if (!confirmValue.trim()) {
        confirmNewPasswordError.textContent = "Password do not match";
        confirmNewPasswordError.style.display = "none";
        updateSaveCredentialsButtonState();
        return;
      }

      const matches = confirmValue === newValue;
      confirmNewPasswordError.textContent = "Password do not match";
      confirmNewPasswordError.style.display = matches ? "none" : "block";

      updateSaveCredentialsButtonState();
    };

    const saveCredentialsBtn = document.getElementById("saveCredentialsBtn");
    const cancelCredentialsBtn = document.getElementById("cancelCredentialsBtn");

    const getDisplayedUsername = () => {
      const usernameBox = document.querySelector(".profile-readonly");
      return usernameBox ? usernameBox.textContent.trim() : "";
    };

    const clearCredentialErrors = () => {
      if (existingPasswordError) {
        existingPasswordError.textContent = "Incorrect Password.";
        existingPasswordError.style.display = "none";
      }
      if (newPasswordError) {
        newPasswordError.textContent = "Invalid Password";
        newPasswordError.style.display = "none";
      }
      if (confirmNewPasswordError) {
        confirmNewPasswordError.textContent = "Password do not match";
        confirmNewPasswordError.style.display = "none";
      }

      updateSaveCredentialsButtonState();
    };

    const closeCredentialsOverlay = () => {
      if (!changeCredentialsOverlay) return;
      changeCredentialsOverlay.style.display = "none";
      document.body.classList.remove("profile-overlay-open");
      clearCredentialErrors();
      existingPasswordValid = false;
      setNewPasswordFieldsEnabled(false);

      if (existingPassword) existingPassword.value = "";
      if (newPassword) newPassword.value = "";
      if (confirmNewPassword) confirmNewPassword.value = "";
    };

    updateSaveCredentialsButtonState();

    changeCredentialsBtn.addEventListener("click", () => {
      if (!changeCredentialsOverlay) return;

      clearCredentialErrors();
      existingPasswordValid = false;
      setNewPasswordFieldsEnabled(false);

      if (credentialsUsername) {
        credentialsUsername.value = getDisplayedUsername();
      }
      if (existingPassword) existingPassword.value = "";
      if (newPassword) newPassword.value = "";
      if (confirmNewPassword) confirmNewPassword.value = "";

      updateSaveCredentialsButtonState();

      changeCredentialsOverlay.style.display = "flex";
      document.body.classList.add("profile-overlay-open");
    });

    cancelCredentialsBtn?.addEventListener("click", closeCredentialsOverlay);

    changeCredentialsOverlay?.addEventListener("click", (e) => {
      if (e.target === changeCredentialsOverlay) {
        closeCredentialsOverlay();
      }
    });

    existingPassword?.addEventListener("input", async () => {
      const value = existingPassword.value || "";
      verifyPasswordRequestId += 1;
      const requestId = verifyPasswordRequestId;

      existingPasswordValid = false;
      setNewPasswordFieldsEnabled(false);

      if (!value.trim()) {
        if (existingPasswordError) {
          existingPasswordError.textContent = "Incorrect Password.";
          existingPasswordError.style.display = "none";
        }
        updateSaveCredentialsButtonState();
        return;
      }

      if (existingPasswordError) {
        existingPasswordError.textContent = "Incorrect Password.";
        existingPasswordError.style.display = "block";
      }

      try {
        const body = new URLSearchParams({
          existing_password: value
        });

        const response = await fetch("verify-existing-password.php", {
          method: "POST",
          body
        });

        const text = await response.text();
        let data;

        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Invalid JSON response");
        }

        if (requestId !== verifyPasswordRequestId) return;

        if (response.ok && data.success && data.valid) {
          existingPasswordValid = true;
          setNewPasswordFieldsEnabled(true);
          if (existingPasswordError) {
            existingPasswordError.style.display = "none";
          }
          updateSaveCredentialsButtonState();
          return;
        }

        existingPasswordValid = false;
        setNewPasswordFieldsEnabled(false);
        if (existingPasswordError) {
          existingPasswordError.textContent = "Incorrect Password.";
          existingPasswordError.style.display = "block";
        }
        updateSaveCredentialsButtonState();
      } catch (error) {
        if (requestId !== verifyPasswordRequestId) return;
        existingPasswordValid = false;
        setNewPasswordFieldsEnabled(false);
        if (existingPasswordError) {
          existingPasswordError.textContent = "Incorrect Password.";
          existingPasswordError.style.display = "block";
        }
        updateSaveCredentialsButtonState();
      }
    });

    credentialsUsername?.addEventListener("input", () => {
      updateSaveCredentialsButtonState();
    });

    newPassword?.addEventListener("input", () => {
      const value = newPassword.value || "";

      if (!value.trim()) {
        if (newPasswordError) {
          newPasswordError.textContent = "Invalid Password";
          newPasswordError.style.display = "none";
        }
        updateConfirmPasswordError();
        return;
      }

      const rules = [
        /.{8,}/,
        /[A-Z]/,
        /[0-9]/
      ];

      const isValid = rules.every((regex) => regex.test(value));

      if (newPasswordError) {
        newPasswordError.textContent = "Invalid Password";
        newPasswordError.style.display = isValid ? "none" : "block";
      }

      updateConfirmPasswordError();
    });

    confirmNewPassword?.addEventListener("input", () => {
      updateConfirmPasswordError();
    });

    saveCredentialsBtn?.addEventListener("click", async () => {
      if (saveCredentialsBtn.disabled) return;
      const confirmed = window.confirm("Are you sure you want to save these changes?");
      if (!confirmed) return;
      clearCredentialErrors();

      const usernameValue = credentialsUsername?.value.trim() || "";
      const existingPasswordValue = existingPassword?.value || "";
      const newPasswordValue = newPassword?.value || "";
      const confirmNewPasswordValue = confirmNewPassword?.value || "";

      if (!usernameValue) {
        if (newPasswordError) {
          newPasswordError.textContent = "Username is required.";
          newPasswordError.style.display = "block";
        }
        return;
      }

      if (!existingPasswordValue) {
        if (existingPasswordError) {
          existingPasswordError.textContent = "Incorrect Password.";
          existingPasswordError.style.display = "block";
        }
        return;
      }

      if (!existingPasswordValid) {
        if (existingPasswordError) {
          existingPasswordError.textContent = "Incorrect Password.";
          existingPasswordError.style.display = "block";
        }
        setNewPasswordFieldsEnabled(false);
        return;
      }

      if (newPasswordValue || confirmNewPasswordValue) {
        const rules = [
          { regex: /.{8,}/, message: "Password must be at least 8 characters." },
          { regex: /[A-Z]/, message: "Password must contain at least one uppercase letter." },
          { regex: /[0-9]/, message: "Password must contain at least one number." }
        ];

        for (const rule of rules) {
          if (!rule.regex.test(newPasswordValue)) {
            if (newPasswordError) {
              newPasswordError.textContent = rule.message;
              newPasswordError.style.display = "block";
            }
            return;
          }
        }

        if (newPasswordValue !== confirmNewPasswordValue) {
          if (confirmNewPasswordError) {
            confirmNewPasswordError.textContent = "Password do not match";
            confirmNewPasswordError.style.display = "block";
          }
          return;
        }
      }

      try {
        const body = new URLSearchParams({
          username: usernameValue,
          existing_password: existingPasswordValue,
          new_password: newPasswordValue,
          confirm_new_password: confirmNewPasswordValue
        });

        const response = await fetch("change-credentials.php", {
          method: "POST",
          body
        });

        const text = await response.text();
        let data;

        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Invalid JSON response");
        }

        if (!response.ok || !data.success) {
          if (data?.field === "existing_password" && existingPasswordError) {
            existingPasswordError.textContent = data.message || "Incorrect Password.";
            existingPasswordError.style.display = "block";
            return;
          }

          if ((data?.field === "new_password" || data?.field === "username") && newPasswordError) {
            newPasswordError.textContent = data.message || "Failed to update credentials.";
            newPasswordError.style.display = "block";
            return;
          }

          throw new Error(data?.message || "Failed to update credentials.");
        }

        const usernameDisplay = document.querySelector(".profile-readonly");
        if (usernameDisplay && data.username) {
          usernameDisplay.textContent = data.username;
        }

        closeCredentialsOverlay();
        setProfileStatus("Username or password updated successfully.", "success");
      } catch (error) {
        console.error("Change credentials failed:", error);
        if (newPasswordError) {
          newPasswordError.textContent = error.message || "Failed to update credentials.";
          newPasswordError.style.display = "block";
        }
      }
    });
  }

});


// Forgot Password Overlay (kept outside DOMContentLoaded in case login.php needs it before)
document.querySelector(".forgot")?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("forgot-overlay").style.display = "flex";
});

document.getElementById("forgotOkBtn")?.addEventListener("click", () => {
  document.getElementById("forgot-overlay").style.display = "none";
});

