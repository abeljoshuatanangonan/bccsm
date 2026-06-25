<?php
require 'admin-authorization.php';
require_once __DIR__ . '/includes/csrf.php';   // 🔐 add this

if (!isset($mysqli) && file_exists(__DIR__ . '/db/db.php')) {
  include_once __DIR__ . '/db/db.php';
}
if (isset($mysqli) && !isset($conn)) {
  $conn = $mysqli;
}
$db = $mysqli ?? ($conn ?? null);
$__csrf_token = csrf_token();

$page = $_GET['page'] ?? 'home';
$tab  = $_GET['tab'] ?? 'banner';

$banner = null;
if ($db && $tab === 'banner') {
  $result = $db->query("SELECT * FROM homepage_banner ORDER BY id DESC LIMIT 1");
  $banner = $result && $result->num_rows > 0 ? $result->fetch_assoc() : null;
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= htmlspecialchars($__csrf_token, ENT_QUOTES, 'UTF-8') ?>">
  <title>Admin | Configuration</title>
  <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">
  <link rel="stylesheet" href="admin-style.css">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
</head>

<body class="homepage">

  <?php include 'admin-header.php'; ?>

  <main class="admin-content">

    <?php if (in_array($page, ['events', 'ministries', 'about'], true)): ?>
      <!-- Intentionally blank: these submenus are handled elsewhere -->
    <?php else: ?>

      <h1>Homepage Configuration</h1>

      <!-- Status Tabs -->
      <div class="status-tabs">
        <button class="status-tab <?= $tab === 'banner' ? 'active' : '' ?>" onclick="location.href='admin-configuration.php?page=home&tab=banner'">Banner</button>
        <button class="status-tab <?= $tab === 'events' ? 'active' : '' ?>" onclick="location.href='admin-configuration.php?page=home&tab=events'">Recent Church Events</button>
        <button class="status-tab <?= $tab === 'groups' ? 'active' : '' ?>" onclick="location.href='admin-configuration.php?page=home&tab=groups'">Groups</button>
        <button class="status-tab <?= $tab === 'accreditations' ? 'active' : '' ?>" onclick="location.href='admin-configuration.php?page=home&tab=accreditations'">Accreditations</button>
      </div>

      <?php if ($tab === 'banner'): ?>

        <!-- Banner edit form -->
        <form method="POST"
          action="admin-functions/save-configuration.php"
          enctype="multipart/form-data"
          class="configuration-form">
          <label>Current Banner:</label>
          <?php if (!empty($banner['image_path'])): ?>
            <img src="<?= htmlspecialchars($banner['image_path']) ?>"
              alt="Current Banner"
              style="max-width: 40%; border-radius: 8px; margin-bottom: 10px; display:block;">
            <!--          ^^^^^^^  50% smaller preview -->
          <?php else: ?>
            <p>No banner uploaded yet.</p>
          <?php endif; ?>

          <label for="image">Change Banner Image:</label>
          <input type="file"
            name="image"
            id="image"
            accept="image/webp">
          <!--           ^^^^^^^^^^^ only WEBP in the chooser -->

          <p style="font-size: 12px; color:#666; margin-top:4px;">
            Allowed format: WEBP, size: 1400×800 pixels
          </p>

          <?= csrf_field() ?>

          <button type="submit" class="btn-export-like">SAVE</button>
        </form>

      <?php elseif ($tab === 'events'): ?>

        <?php
        $events = [];
        $editingEvent = null;

        if ($db) {
          $result = $db->query("SELECT * FROM homepage_events ORDER BY id DESC");
          if ($result) {
            $events = $result->fetch_all(MYSQLI_ASSOC);
          }

          $editIdRaw = $_GET['edit_id'] ?? '';
          $editId = ($editIdRaw !== '' && ctype_digit((string)$editIdRaw)) ? (int)$editIdRaw : null;

          if ($editId !== null) {
            $stmt = $db->prepare("SELECT * FROM homepage_events WHERE id = ? LIMIT 1");
            if ($stmt) {
              $stmt->bind_param("i", $editId);
              $stmt->execute();
              $res = $stmt->get_result();
              $editingEvent = $res ? $res->fetch_assoc() : null;
              $stmt->close();
            }
          }
        }

        $isEditing = is_array($editingEvent);
        ?>

        <!-- Add / Edit Event Form -->
        <form method="POST"
          action="admin-functions/save-event.php"
          enctype="multipart/form-data"
          class="event-form">
          <h3><?= $isEditing ? 'Edit Event' : 'Add New Event' ?></h3>

          <?php if ($isEditing): ?>
            <input type="hidden" name="event_id" value="<?= (int)$editingEvent['id'] ?>">
            <label>Current Image:</label>
            <?php if (!empty($editingEvent['image_path'])): ?>
              <img src="<?= htmlspecialchars($editingEvent['image_path']) ?>"
                alt="Current Event Image"
                style="max-width: 40%; border-radius: 8px; margin-bottom: 10px; display:block;">
            <?php else: ?>
              <p>No image set.</p>
            <?php endif; ?>
          <?php endif; ?>

          <label for="image">Event Image (1400px x 800px) .WEBP:</label>
          <input type="file" name="image" id="image" accept="image/*" <?= $isEditing ? '' : 'required' ?>>

          <label for="title">Event Title:</label>
          <input type="text" name="title" id="title" required value="<?= htmlspecialchars($editingEvent['title'] ?? '') ?>">

          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">

          <label for="event_date">Event Date:</label>
          <input
            type="text"
            name="date"
            id="event_date"
            placeholder="Select a date"
            required
            value="<?= htmlspecialchars($editingEvent['event_date'] ?? '') ?>">

          <label for="home_details">Event Details:</label>
          <input
            type="text"
            name="home_details"
            id="home_details"
            required
            value="<?= htmlspecialchars($editingEvent['home_details'] ?? '') ?>"
            style="width: 100%; height: 52px; padding: 12px 10px;">

          <label for="details">Full Event Details:</label>
          <textarea
            name="details"
            id="details"
            required
            style="width: 100%; min-height: 160px; padding: 12px 10px; resize: vertical; line-height: 1.5;"><?= htmlspecialchars($editingEvent['details'] ?? '') ?></textarea>

          <?= csrf_field() ?>

          <button type="submit"><?= $isEditing ? 'Save Changes' : 'Add Event' ?></button>

          <?php if ($isEditing): ?>
            <a href="admin-configuration.php?page=home&tab=events" style="margin-left:10px;">Cancel Edit</a>
          <?php endif; ?>
        </form>

        <hr>

        <!-- Existing Events List -->
        <h3>Existing Events</h3>
        <table class="table-display" style="width:100%; border-collapse:collapse; margin-top:10px;">
          <thead>
            <tr style="background:#f2f2f2;">
              <th style="padding:8px;">Image</th>
              <th>Title</th>
              <th>Date</th>
              <th>Full Event Details</th>
              <th>Event Details</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <?php if (empty($events)): ?>
              <tr>
                <td colspan="6" style="text-align:center;">No events added yet.</td>
              </tr>
            <?php else: ?>
              <?php foreach ($events as $event): ?>
                <tr>
                  <td><img src="<?= htmlspecialchars($event['image_path']) ?>" alt="" style="width:80px; height:auto; border-radius:6px;"></td>
                  <td><?= htmlspecialchars($event['title']) ?></td>
                  <td><?= htmlspecialchars($event['event_date']) ?></td>
                  <td><?= htmlspecialchars($event['details']) ?></td>
                  <td><?= htmlspecialchars($event['home_details']) ?></td>
                  <td>
                    <a href="admin-configuration.php?page=home&tab=events&edit_id=<?= (int)$event['id'] ?>">Edit</a> |
                    <a href="admin-functions/delete-event.php?id=<?= (int)$event['id'] ?>" onclick="return confirm('Delete this event?')">Delete</a>
                  </td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>

      <?php elseif ($tab === 'groups'): ?>
        <p class="config-placeholder">Feature coming soon: Manage church groups.</p>

      <?php elseif ($tab === 'accreditations'): ?>
        <h2>Manage Accreditations</h2>

        <!-- Add New Accreditation -->
        <form action="admin-functions/save-accreditation.php" method="POST" enctype="multipart/form-data" class="admin-form">
          <label>Accreditation Name:</label>
          <textarea name="name" required></textarea>

          <label>Image (500px x 500px) .WEBP:</label>
          <input type="file" name="image" accept="image/*" required>

          <label>Sort Order:</label>
          <input type="number" name="sort_order" min="0" value="0">

          <button type="submit">Add Accreditation</button>
        </form>

        <hr>

        <!-- Existing Accreditations -->
        <table class="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php
            include 'db/db.php';
            $accreditations = $mysqli->query("SELECT * FROM accreditations ORDER BY sort_order ASC");

            if ($accreditations && $accreditations->num_rows > 0):
              while ($acc = $accreditations->fetch_assoc()):
            ?>
                <tr>
                  <td><img src="<?= htmlspecialchars($acc['image_path']) ?>" width="60"></td>
                  <td><?= $acc['name'] ?></td>
                  <td><?= $acc['sort_order'] ?></td>
                  <td>
                    <a href="admin-functions/delete-accreditation.php?id=<?= $acc['id'] ?>" onclick="return confirm('Delete this accreditation?')">Delete</a>
                  </td>
                </tr>
            <?php
              endwhile;
            else:
              echo "<tr><td colspan='4' style='text-align:center;'>No accreditations found.</td></tr>";
            endif;
            ?>
          </tbody>
        </table>
      <?php endif; ?>
    <?php endif; ?>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
  <script src="assets/js/admin-script.js"></script>
  <script src="assets/js/adminconfig.js" defer></script>

</body>

</html>