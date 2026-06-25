<header>
  <button id="hamburgerBtn"
    class="hamburger"
    aria-label="Open menu"
    aria-controls="sidebar"
    aria-expanded="false">
    ☰
  </button>

  <aside id="sidebar">
    <div class="logo">
      <img src="assets/images/bccsm logo.webp" alt="Bride of Christ Church Logo">
      <div class="logo-text">
        <h1>BRIDE OF CHRIST CHURCH</h1>
        <p>SAN MATEO</p>
      </div>
    </div>

    <nav>
      <ul>
        <li>
          <a href="admin-dashboard.php"
            class="<?= basename($_SERVER['PHP_SELF']) === 'admin-dashboard.php' ? 'active' : '' ?>">
            Dashboard
          </a>
        </li>

        <li class="has-submenu <?= basename($_SERVER['PHP_SELF']) === 'admin-members.php' ? 'open active' : '' ?>">
          <a href="#" class="menu-toggle">
            Members ▾
          </a>
          <ul class="submenu">
            <li>
              <a href="admin-members.php?filter=overall"
                class="<?= (basename($_SERVER['PHP_SELF']) === 'admin-members.php' && (($_GET['filter'] ?? 'overall') === 'overall')) ? 'active' : '' ?>">
                Overall List
              </a>
            </li>
            <li>
              <a href="admin-members.php?filter=birthdays"
                class="<?= (basename($_SERVER['PHP_SELF']) === 'admin-members.php' && (($_GET['filter'] ?? '') === 'birthdays')) ? 'active' : '' ?>">
                Birthdays
              </a>
            </li>
          </ul>
        </li>


        <li>
          <a href="admin-announcements.php"
            class="<?= basename($_SERVER['PHP_SELF']) === 'admin-announcements.php' ? 'active' : '' ?>">
            Announcements
          </a>
        </li>

        <li>
          <a href="admin-offertory.php"
            class="<?= basename($_SERVER['PHP_SELF']) === 'admin-offertory.php' ? 'active' : '' ?>">
            Offertory
          </a>
        </li>

        <li class="has-submenu <?= basename($_SERVER['PHP_SELF']) === 'admin-configuration.php' ? 'open active' : '' ?>">
          <a href="#" class="menu-toggle">
            Configuration ▾
          </a>
          <ul class="submenu">
            <li>
              <a href="admin-configuration.php?page=home"
                class="<?= (isset($_GET['page']) && $_GET['page'] === 'home') ? 'active' : '' ?>">
                Home Page
              </a>
            </li>
            <li>
              <a href="admin-configuration.php?page=events"
                class="<?= (isset($_GET['page']) && $_GET['page'] === 'events') ? 'active' : '' ?>">
                Events Page
              </a>
            </li>
            <li>
              <a href="admin-configuration.php?page=ministries"
                class="<?= (isset($_GET['page']) && $_GET['page'] === 'ministries') ? 'active' : '' ?>">
                Ministries Page
              </a>
            </li>
            <li>
              <a href="admin-configuration.php?page=about"
                class="<?= (isset($_GET['page']) && $_GET['page'] === 'about') ? 'active' : '' ?>">
                About Us Page
              </a>
            </li>
          </ul>
        </li>

        <li>
          <a href="index.php"
            class="<?= basename($_SERVER['PHP_SELF']) === 'index.php' ? 'active' : '' ?>">
            Switch View
          </a>
        </li>

        <li><a href="logout-process.php">Logout</a></li>
      </ul>
    </nav>
  </aside>

  <div class="topbar">
    <span><?= htmlspecialchars($_SESSION['username'] ?? 'ADMIN') ?></span>
  </div>

</header>

<!-- This is important: must always be outside <header> -->
<div id="sidebarOverlay" class="sidebar-overlay"></div>
<script src="assets/js/adminheader.js"></script>