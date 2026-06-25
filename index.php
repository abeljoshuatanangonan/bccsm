<?php
session_start();
?>

<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bride of Christ Church: San Mateo</title>
  <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="stylesheet" href="assets/css/footer.css">
  <link rel="stylesheet" href="assets/css/footer.css">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">

  <script>
    window.isLoggedIn = <?= json_encode(isset($_SESSION['user_id'])) ?>;
  </script>

</head>

<body class="homepage">

  <!-- Header -->
  <?php include 'includes/header.php'; ?>

  <!-- Sidebar -->
  <?php include 'includes/sidebar.php'; ?>

  <main id="main">

    <!-- Homepage Banner -->
    <?php
    include 'db/db.php';
    $banner = $mysqli->query("SELECT * FROM homepage_banner ORDER BY id DESC LIMIT 1")->fetch_assoc();
    ?>

    <section id="home" class="home-section">
      <div class="container">
        <div class="home-inner">
          <div class="home-content">
            <?php
            $bannerSrc = $banner['image_path'] ?? '';
            $bannerSrcWithV = $bannerSrc !== '' ? ($bannerSrc . (str_contains($bannerSrc, '?') ? '&' : '?') . 'v=' . time()) : '';
            ?>
            <img src="<?= htmlspecialchars($bannerSrcWithV) ?>" alt="home pic" class="home-image">

          </div>
        </div>
      </div>
    </section>


    <!-- Announcements Section -->
    <section id="announcements" class="announcements">
      <div class="announcements-inner">
        <h2 class="announcements-title">Announcements</h2>

        <div class="table-container">
          <?php
          // include DB connection (this file creates $mysqli)
          include 'db/db.php';

          $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

          // get counts per day (using $mysqli, not $conn)
          $counts = [];
          foreach ($days as $day) {
            $dayEsc = $mysqli->real_escape_string($day);
            $res = $mysqli->query("SELECT COUNT(*) AS c FROM announcements WHERE day='$dayEsc'");
            $counts[$day] = $res ? intval($res->fetch_assoc()['c']) : 0;
          }

          $maxRows = $counts ? max($counts) : 0;
          ?>

          <table id="announcementsTable">
            <thead>
              <tr>
                <?php foreach ($days as $day): ?>
                  <th><?= htmlspecialchars(strtoupper($day)) ?></th>
                <?php endforeach; ?>
              </tr>
            </thead>

            <tbody>
              <?php if ($maxRows === 0): ?>
                <tr>
                  <td colspan="7" style="text-align:center;">No announcements yet.</td>
                </tr>
              <?php else: ?>
                <?php
                // build rows so each column aligns
                for ($i = 0; $i < $maxRows; $i++):
                  echo "<tr>";
                  foreach ($days as $day) {
                    $dayEsc = $mysqli->real_escape_string($day);
                    // fetch the i-th activity for this day
                    $res = $mysqli->query("SELECT activity FROM announcements WHERE day='$dayEsc' ORDER BY sort_order ASC LIMIT $i,1");
                    $row = $res ? $res->fetch_assoc() : null;
                    $cell = $row ? nl2br(htmlspecialchars($row['activity'])) : '';
                    echo "<td data-label=\"" . htmlspecialchars(strtoupper($day)) . "\">{$cell}</td>";
                  }
                  echo "</tr>";
                endfor;
                ?>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Recent Events Section -->
    <section id="recent-events" class="recentevents">
      <div class="recentevents-inner">
        <h2 class="recentevents-title">Recent Church Events</h2>
      </div>

      <div class="event-slider">
        <?php
        include 'db/db.php';

        $query = "SELECT * FROM homepage_events ORDER BY id DESC";
        $result = $mysqli->query($query);

        if ($result && $result->num_rows > 0) {
          $activeClass = 'active';
          while ($row = $result->fetch_assoc()) {
            echo '
          <div class="event-mover ' . $activeClass . '">
            <img src="' . htmlspecialchars($row['image_path']) . '" alt="' . htmlspecialchars($row['title']) . '" class="event-image" loading="lazy">
            <div class="event-content">
              <div class="event-header">
                <h3 class="event-title">' . htmlspecialchars($row['title']) . '</h3>
                <p class="event-date">' . htmlspecialchars($row['event_date']) . '</p>
              </div>
              <p class="event-details">' . htmlspecialchars($row['home_details'] ?? '') . '</p>
              <a href="events.php#event-' . (int)$row['id'] . '" class="event-readmore-button">Read More</a>
            </div>
          </div>';
            $activeClass = '';
          }
        } else {
          echo '<p style="text-align:center;">No events available yet.</p>';
        }
        ?>

        <!-- Slider Arrows -->
        <button class="event-arrow left">&#10094;</button>
        <button class="event-arrow right">&#10095;</button>
      </div>
    </section>


    <!-- Groups Section -->
    <section id="groups" class="groups-section">
      <div class="groups-inner">
        <h2 class="groups-title">Groups</h2>
      </div>
      <div class="groups-grid">
        <a href="#" class="group-card kids"><img src="assets/images/kids.webp" alt="Kids Group"></a>
        <a href="#" class="group-card youth"><img src="assets/images/youth.webp" alt="Youth Group"></a>
        <a href="#" class="group-card youngadult"><img src="assets/images/youngadult.webp" alt="Young Adult Group"></a>
        <a href="#" class="group-card mothers"><img src="assets/images/mothers.webp" alt="Mothers Group"></a>
        <a href="#" class="group-card fathers"><img src="assets/images/fathers.webp" alt="Fathers Group"></a>
      </div>
    </section>

    <!-- Short Motto -->
    <section id="shortmotto" class="shortmotto-section">
      <div class="shortmotto-inner">
        <h2 class="shortmotto-title">Bride of Christ Church San Mateo</h2>
        <p class="shortmotto-details">
          is a child church of the Bride of Christ Churches Inc.,<br>
          and at BCC, we are called to preach the Gospel and make disciples.
        </p>
      </div>
    </section>

    <!-- Accreditations -->
    <section id="accreditations" class="accreditations-section">
      <div class="accreditations-inner">
        <h2 class="accreditations-title">Accreditations</h2>

        <div class="accreditations-grid">
          <?php
          include 'db/db.php';
          $result = $mysqli->query("SELECT * FROM accreditations ORDER BY sort_order ASC");

          if ($result && $result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
              echo '
            <div class="accreditation-card">
              <img src="' . htmlspecialchars($row['image_path']) . '" alt="' . strip_tags($row['name']) . '">
              <p class="accreditation-name">' . $row['name'] . '</p>
            </div>';
            }
          } else {
            echo '<p style="text-align:center;">No accreditations yet.</p>';
          }
          ?>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <?php include 'includes/footer.php'; ?>

  <script src="assets/js/script.js"></script>
</body>

</html>