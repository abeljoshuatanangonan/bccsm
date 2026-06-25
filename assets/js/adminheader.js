/*!
 * Admin Header script (admin-header.php)
 * Sidebar + hamburger + submenu toggle.
 */
document.addEventListener("DOMContentLoaded", () => {
    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

    const hamburger = qs("#hamburgerBtn");
    const sidebar = qs("#sidebar");
    const overlay = qs("#sidebarOverlay");

    if (!hamburger || !sidebar || !overlay) return;

    const navLinks = sidebar.querySelectorAll("nav a");

    const closeSidebar = () => {
        sidebar.classList.remove("show");
        overlay.classList.remove("active");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.style.display = "block";
    };

    on(hamburger, "click", () => {
        const isOpen = sidebar.classList.toggle("show");
        overlay.classList.toggle("active", isOpen);
        hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
        hamburger.style.display = isOpen ? "none" : "block";
    });

    on(overlay, "click", closeSidebar);

    navLinks.forEach((link) => {
        on(link, "click", () => {
            if (link.closest(".submenu")) return; // why: submenu navigation shouldn't collapse the whole sidebar
            closeSidebar();
        });
    });

    qsa("#sidebar .has-submenu > a").forEach((link) => {
        on(link, "click", (e) => {
            e.preventDefault();
            link.parentElement.classList.toggle("open");
        });
    });
});
