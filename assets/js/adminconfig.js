document.addEventListener("DOMContentLoaded", () => {
    const qs = (sel, root = document) => root.querySelector(sel);
    const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

    const params = new URLSearchParams(window.location.search);
    const tab = (params.get("tab") || "").toLowerCase();
    const success = params.get("success");

    const cleanSuccessParam = () => {
        if (!params.has("success")) return;
        params.delete("success");
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
        window.history.replaceState({}, "", newUrl);
    };

    // ---------- Banner tab (save-configuration.php) ----------
    (() => {
        const bannerForm =
            qs('form.configuration-form[action*="save-configuration.php"]') ||
            qs(".configuration-form");

        if (!bannerForm) return;

        on(bannerForm, "submit", (e) => {
            if (!window.confirm("Are you sure the Banner details are correct?")) {
                e.preventDefault();
            }
        });

        if (success === "1" && tab === "banner") {
            alert("Banner Updated");
            cleanSuccessParam();
        }
    })();

    // ---------- Recent Church Events tab (save-event.php) ----------
    (() => {
        const eventForm = qs("form.event-form") || qs('form[action*="save-event.php"]');
        if (!eventForm) return;

        on(eventForm, "submit", (e) => {
            const isEdit = !!eventForm.querySelector('input[name="event_id"]');
            const msg = isEdit
                ? "Save changes to this event?"
                : "Are you sure the event details are correct?";
            if (!window.confirm(msg)) e.preventDefault();
        });

        if (tab === "events") {
            if (success === "1") {
                alert("Event Added");
                cleanSuccessParam();
            } else if (success === "2") {
                alert("Event Updated");
                cleanSuccessParam();
            }
        }
    })();

    // Events: date picker
    (() => {
        const dateInput = document.querySelector("#event_date");
        if (!dateInput || typeof flatpickr === "undefined") return;

        flatpickr(dateInput, {
            dateFormat: "Y-m-d",   // stored value
            allowInput: true,
        });
    })();


    // ---------- Accreditations tab (save-accreditation.php) ----------
    (() => {
        const accreditationForm = qs('form[action*="save-accreditation.php"]');
        if (!accreditationForm) return;

        on(accreditationForm, "submit", (e) => {
            if (!window.confirm("Are you sure the accreditation details are correct?")) {
                e.preventDefault();
            }
        });

        if (success === "1" && tab === "accreditations") {
            alert("Accreditation Added");
            cleanSuccessParam();
        }
    })();
});