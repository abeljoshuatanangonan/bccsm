document.addEventListener("DOMContentLoaded", () => {
    const qs = (sel, root = document) => root.querySelector(sel);
    const on = (el, evt, handler, options) => el?.addEventListener(evt, handler, options);

    const onAnnouncementsPage = /admin-announcements\.php$/i.test(window.location.pathname);
    const addAnnouncementForm = qs(".announcement-form");
    if (!onAnnouncementsPage || !addAnnouncementForm) return;

    on(addAnnouncementForm, "submit", (e) => {
        const ok = window.confirm("Are you sure the announcement details are correct?");
        if (!ok) e.preventDefault();
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
        alert("Announcement Added");

        params.delete("success");
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
        window.history.replaceState({}, "", newUrl);
    }
});