<?php require 'admin-authorization.php';
require_once __DIR__ . '/includes/csrf.php';
$__token = csrf_token();
?>

<?php
$memberFilter = strtolower(trim($_GET['filter'] ?? 'overall'));
$isBirthdaysPage = ($memberFilter === 'birthdays');
?>

<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= htmlspecialchars($__token, ENT_QUOTES, 'UTF-8') ?>">
  <title>Admin | Members</title>
  <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">
  <link rel="stylesheet" href="admin-style.css">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
</head>

<body class="homepage">

  <?php include 'admin-header.php'; ?>

  <main>
    <?php if (!$isBirthdaysPage): ?>
      <div class="members-page">

        <!-- Branch Selector -->
        <div class="bcc-branch-selection">
          <span class="bcc-branch-label">BCC Branch</span>
          <div class="bcc-branch-buttons">
            <button class="bcc-branch-btn active" data-branch="San Mateo">San Mateo</button>
            <button class="bcc-branch-btn" data-branch="Leyte">Leyte</button>
          </div>
        </div>

        <!-- Status Tabs -->
        <div class="status-tabs">
          <button class="status-tab active" data-status="approved">Approved</button>
          <button class="status-tab" data-status="pending">Pending</button>
          <button class="status-tab" data-status="rejected">Rejected</button>
        </div>

        <!-- Export and Controls -->
        <div class="controls">
          <div class="export-buttons">
            <button id="exportCSV">CSV</button>
            <button id="exportPDF">PDF</button>
          </div>
          <div class="search-sort">
            <div class="search-box">
              <input type="text" id="searchName" placeholder="Search Name:">
            </div>
            <select id="sortBy">
              <option value="date_approved">Date Approved</option>
              <option value="username">Username</option>
              <option value="birthday">Birthday</option>
              <option value="baptism_date">Water Baptism Date</option>
              <option value="membership_date">Membership Date</option>
            </select>
            <button id="toggleSortOrder" class="sort-btn">▲</button>
          </div>
        </div>

        <!-- Members Table -->
        <div class="table-container">
          <table id="membersTable">
            <thead>
              <tr>
                <th>#</th>
                <th>Username</th>
                <th>Birthday</th>
                <th>Group</th>
                <th>Membership Date</th>
                <th>Water Baptism Date</th>
                <th id="dateHeader">Date</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td colspan="8">Loading members...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    <?php else: ?>
      <section class="members-page"></section>
    <?php endif; ?>

    <!-- View Details Modal -->
    <div id="detailsModal" class="modal-overlay">
      <div class="modal-content details-modal">
        <button id="closeModal" class="close-btn">✕</button>

        <div class="details-modal-header">
          <h3>Member Details</h3>
          <button id="editMemberBtn" type="button" style="display:none;">EDIT</button>
        </div>

        <div class="details-layout">
          <div class="details-section">
            <h4>Personal Section</h4>
            <div class="details-grid" id="personalDetails"></div>
          </div>

          <div class="details-section">
            <h4>Church Section</h4>
            <div class="details-grid" id="churchDetails"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Role Change Modal -->
    <div id="roleModal" class="modal-overlay">
      <div class="modal-content">
        <button id="closeRoleModal" class="close-btn">✕</button>
        <h3 id="roleModalTitle">Change Role</h3>
        <p id="roleModalText"></p>
        <div style="margin-top:15px; display:flex; gap:10px; justify-content:flex-end;">
          <button id="roleYesBtn" style="background:#28a745; color:#fff; padding:6px 12px; border:none; border-radius:4px; cursor:pointer;">Yes</button>
          <button id="roleNoBtn" style="background:#dc3545; color:#fff; padding:6px 12px; border:none; border-radius:4px; cursor:pointer;">No</button>
        </div>
      </div>
    </div>


  </main>
  <script>
    window.CSRF_TOKEN = <?= json_encode($__token) ?>;
  </script>
  <script src="assets/js/vendor/jspdf.umd.min.js"></script>
  <script src="assets/js/vendor/jspdf.plugin.autotable.min.js"></script>
  <script src="assets/js/adminmembers.js"></script>
  <script src="assets/js/admin-script.js"></script>
</body>

</html>