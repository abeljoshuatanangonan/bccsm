<?php
require 'admin-authorization.php';
require_once __DIR__ . '/includes/csrf.php';

$db = null;
if (isset($mysqli) && $mysqli) {
  $db = $mysqli;
} elseif (isset($conn) && $conn) {
  $db = $conn;
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin | Announcements</title>
  <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">
  <link rel="stylesheet" href="admin-style.css">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
</head>

<body class="homepage">

  <?php include 'admin-header.php'; ?>

  <main class="admin-content">
    <h1>Manage Announcements</h1>

    <?php if (isset($_GET['deleted'])): ?>
      <p style="color: green;">✅ Announcement deleted successfully.</p>
    <?php elseif (isset($_GET['error'])): ?>
      <p style="color: red;">❌ Error: <?= htmlspecialchars($_GET['error']) ?></p>
    <?php elseif (isset($_GET['success'])): ?>
      <p style="color: green;">✅ Announcement added successfully.</p>
    <?php endif; ?>

    <!-- Add Announcement Form -->
    <form method="POST" action="admin-functions/save-announcement.php" class="announcement-form">
      <label>Day(s):</label>
      <div class="day-options">
        <label><input type="checkbox" name="days[]" value="Sunday"> Sunday</label>
        <label><input type="checkbox" name="days[]" value="Monday"> Monday</label>
        <label><input type="checkbox" name="days[]" value="Tuesday"> Tuesday</label>
        <label><input type="checkbox" name="days[]" value="Wednesday"> Wednesday</label>
        <label><input type="checkbox" name="days[]" value="Thursday"> Thursday</label>
        <label><input type="checkbox" name="days[]" value="Friday"> Friday</label>
        <label><input type="checkbox" name="days[]" value="Saturday"> Saturday</label>
      </div>

      <label for="activity">Activity:</label>
      <input type="text"
        name="activity"
        id="activity"
        value=""
        required>

      <?= csrf_field() ?>

      <button type="submit" class="btn-export-like">ADD ANNOUNCEMENT</button>
    </form>

    <hr>

    <!-- Existing Announcements -->
    <!-- Current Announcements -->
    <h2>Current Announcements</h2>

    <table class="announcements-table">
      <thead>
        <tr>
          <th>Day</th>
          <th>Activity</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <?php
        if (!$db) {
          echo "<tr><td colspan='3'>Database connection not available.</td></tr>";
        } else {
          $sql = "SELECT * FROM announcements
                  ORDER BY FIELD(day, 'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'),
                           sort_order ASC, id ASC";
          $result = $db->query($sql);
          $editId = isset($_GET['edit']) ? (int) $_GET['edit'] : 0;

          if ($result && $result->num_rows > 0) {
            $daysList = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            while ($row = $result->fetch_assoc()):
              $id       = (int) $row['id'];
              $dayValue = $row['day'];
              $day      = htmlspecialchars($dayValue);
              $activity = htmlspecialchars($row['activity']);
        ?>
              <?php if ($editId === $id): ?>
                <tr>
                  <form method="POST" action="admin-functions/update-announcement.php">
                    <td>
                      <input type="hidden" name="id" value="<?= $id ?>">
                      <select name="day" required>
                        <?php foreach ($daysList as $d): ?>
                          <option value="<?= $d ?>" <?= $d === $dayValue ? 'selected' : '' ?>>
                            <?= $d ?>
                          </option>
                        <?php endforeach; ?>
                      </select>
                    </td>
                    <td>
                      <input type="text"
                        name="activity"
                        value="<?= htmlspecialchars($row['activity'], ENT_QUOTES, 'UTF-8') ?>"
                        required>
                    </td>
                    <td class="announcement-actions">
                      <!-- CSRF for save -->
                      <?= csrf_field() ?>
                      <button type="submit" class="btn-export-like">SAVE</button>
                      <a href="admin-announcements.php" class="btn-export-like">CANCEL</a>
                    </td>
                  </form>
                </tr>
              <?php else: ?>
                <tr>
                  <td><?= $day ?></td>
                  <td><?= nl2br($activity) ?></td>
                  <td class="announcement-actions">
                    <a href="admin-announcements.php?edit=<?= $id ?>" class="btn-export-like">EDIT</a>

                    <form method="POST"
                      action="admin-functions/delete-announcement.php"
                      style="display:inline;"
                      onsubmit="return confirm('Are you sure you want to delete this announcement?');">
                      <input type="hidden" name="id" value="<?= $id ?>">
                      <!-- CSRF for delete -->
                      <?= csrf_field() ?>
                      <button type="submit" class="btn-export-like">DELETE</button>
                    </form>
                  </td>
                </tr>
              <?php endif; ?>
        <?php
            endwhile;
          } else {
            echo "<tr><td colspan='3' style='text-align:center;'>No announcements found.</td></tr>";
          }
        }
        ?>
      </tbody>
    </table>

  </main>

  <script src="assets/js/adminannouncement.js"></script>
  <script src="assets/js/admin-script.js"></script>
</body>

</html>