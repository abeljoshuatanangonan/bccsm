<header>
  <div class="container">
    <div class="logo">
      <img src="assets/images/bccsm logo.webp" alt="Bride of Christ Church Logo">
      <div>
        <h1>BRIDE OF CHRIST CHURCH</h1>
        <p>SAN MATEO</p>
      </div>
    </div>

    <!-- Hamburger button (only visible on mobile) -->
    <button id="hamburgerBtn" class="hamburger" aria-label="Open menu" aria-expanded="false" type="button">
      <span class="hamburger-bar"></span>
      <span class="hamburger-bar"></span>
      <span class="hamburger-bar"></span>
    </button>

    <!-- Desktop nav -->
    <nav class="nav-links" aria-label="Primary">
      <a href="index.php" class="condensed">HOME</a>
      <a href="events.php" class="condensed">EVENTS</a>

      <div class="dropdown">
        <a href="#" class="condensed"
          aria-haspopup="true"
          aria-expanded="false"
          aria-controls="ministry-menu">
          MINISTRIES
        </a>
        <div id="ministry-menu" class="dropdown-content" role="menu">
          <a role="menuitem" href="ministries.php">>> See All >></a>
          <a role="menuitem" href="ministries.php#Administration">Administration</a>
          <a role="menuitem" href="ministries.php#Children's-Ministry">Children's Ministry</a>
          <a role="menuitem" href="ministries.php#Church-Planting">Church Planting</a>
          <a role="menuitem" href="ministries.php#Community-Works">Community Works</a>
          <a role="menuitem" href="ministries.php#Creative-Arts">Creative Arts</a>
          <a role="menuitem" href="ministries.php#D-Team">D Team</a>
          <a role="menuitem" href="ministries.php#Iskwela-Suporta">Iskwela Suporta</a>
          <a role="menuitem" href="ministries.php#Kids'-Care">Kids’ Care</a>
          <a role="menuitem" href="ministries.php#Membership">Membership</a>
          <a role="menuitem" href="ministries.php#Prayer">Prayer</a>
          <a role="menuitem" href="ministries.php#Social-Media-Communications">Social Media Communications</a>
          <a role="menuitem" href="ministries.php#Social-Media-Evangelism">Social Media Evangelism & Discipleship</a>
          <a role="menuitem" href="ministries.php#Sports">Sports</a>
          <a role="menuitem" href="ministries.php#Sunday-Service">Sunday Service</a>
          <a role="menuitem" href="ministries.php#Support">Support</a>
          <a role="menuitem" href="ministries.php#Technical-Operation">Technical Operation</a>
          <a role="menuitem" href="ministries.php#Timothites'">Timothites’</a>
          <a role="menuitem" href="ministries.php#Ushering">Ushering</a>
          <a role="menuitem" href="ministries.php#Worship">Worship</a>
        </div>
      </div>

      <a href="about-us.php" class="condensed">ABOUT US</a>
      <a href="#" id="userBtn"
        aria-label="Open profile menu"
        aria-haspopup="true"
        aria-expanded="false"
        aria-controls="userPanel">
        <img src="assets/images/account_icon.webp" alt="" class="user-icon">
        <span class="visually-hidden">Profile</span>
      </a>
    </nav>

    <!-- Desktop profile panel -->
    <div id="userPanel" class="user-panel"
      role="dialog"
      aria-label="Profile"
      style="display: none;">
      <?php if (isset($_SESSION['user_id'])): ?>
        <p>Welcome, <?= htmlspecialchars($_SESSION['username']); ?></p>
        <a href="profile.php">Profile</a>
        <?php if (($_SESSION['role'] ?? '') === 'admin'): ?>
          <a href="admin-dashboard.php">Admin Dashboard</a>
        <?php endif; ?>
        <a href="offertory.php" class="offertory-link">Offertory</a>
        <a href="logout-process.php">Logout</a>
      <?php else: ?>
        <a href="login.php">Login / Register</a>
        <a href="#" class="offertory-link">Offertory</a>
      <?php endif; ?>
    </div>

  </div>
  <script>
    // Ensure global flag for JS
    window.isLoggedIn = <?= isset($_SESSION['user_id']) ? 'true' : 'false' ?>;
  </script>
</header>