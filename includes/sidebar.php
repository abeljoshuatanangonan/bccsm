<!-- Sidebar -->
<div id="sidebar" class="sidebar" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Mobile menu">
  <button id="closeSidebar" class="close-btn" aria-label="Close menu">&times;</button>

  <?php if (isset($_SESSION['user_id'])): ?>
    <p class="welcome">Welcome, <?= htmlspecialchars($_SESSION['username']); ?></p>
  <?php endif; ?>

  <a href="index.php">HOME</a>
  <a href="events.php">EVENTS</a>

  <!-- Ministry dropdown -->
  <div class="dropdown">
    <a href="#" aria-haspopup="true" aria-expanded="false" aria-controls="ministry-menu-mobile">MINISTRIES</a>
    <div id="ministry-menu-mobile" class="dropdown-content" role="menu">
      <a href="ministries.php">>> See All >></a>
      <a href="ministries.php#Administration">Administration</a>
      <a href="ministries.php#Children's-Ministry">Children's Ministry</a>
      <a href="ministries.php#Church-Planting">Church Planting</a>
      <a href="ministries.php#Community-Works">Community Works</a>
      <a href="ministries.php#Creative-Arts">Creative Arts</a>
      <a href="ministries.php#D-Team">D Team</a>
      <a href="ministries.php#Iskwela-Suporta">Iskwela Suporta</a>
      <a href="ministries.php#Kids'-Care">Kids’ Care</a>
      <a href="ministries.php#Membership">Membership</a>
      <a href="ministries.php#Prayer">Prayer</a>
      <a href="ministries.php#Social-Media-Communications">Social Media Communications</a>
      <a href="ministries.php#Social-Media-Evangelism">Social Media Evangelism & Discipleship</a>
      <a href="ministries.php#Sports">Sports</a>
      <a href="ministries.php#Sunday-Service">Sunday Service</a>
      <a href="ministries.php#Support">Support</a>
      <a href="ministries.php#Technical-Operation">Technical Operation</a>
      <a href="ministries.php#Timothites'">Timothites’</a>
      <a href="ministries.php#Ushering">Ushering</a>
      <a href="ministries.php#Worship">Worship</a>
    </div>
  </div>

  <a href="about-us.php">ABOUT US</a>

  <br><br><br><br><br><br>

  <?php if (isset($_SESSION['user_id'])): ?>
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

  <script>
    window.isLoggedIn = <?= isset($_SESSION['user_id']) ? 'true' : 'false' ?>;
  </script>
</div>
<div id="overlay" class="overlay-bg" aria-hidden="true"></div>