<?php
require_once __DIR__ . '/includes/csrf.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}
if (!isset($_SESSION['user_id']) && !isset($_GET['visitor'])) {
  header("Location: offertory-unloggedin.php");
  exit;
}

$coupleShareAvailable = false;
$spouseId = null;
$spouseUsername = '';
$loggedInUsername = isset($_SESSION['username']) ? (string) $_SESSION['username'] : '';

if (isset($_SESSION['user_id'])) {
  require __DIR__ . '/db/db.php';

  $currentUserId = (int) $_SESSION['user_id'];

  $stmt = $conn->prepare("
    SELECT
      r.id,
      r.gender,
      r.spouse_id,
      s.username AS spouse_username
    FROM registrations r
    LEFT JOIN registrations s ON s.id = r.spouse_id
    WHERE r.id = ?
    LIMIT 1
  ");

  if ($stmt) {
    $stmt->bind_param("i", $currentUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    $userRow = $result->fetch_assoc();
    $stmt->close();

    if ($userRow && !empty($userRow['spouse_id']) && !empty($userRow['spouse_username'])) {
      $coupleShareAvailable = true;
      $spouseId = (int) $userRow['spouse_id'];
      $spouseUsername = (string) $userRow['spouse_username'];
    }
  }

  if (isset($conn) && $conn instanceof mysqli) {
    $conn->close();
  }
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= htmlspecialchars(csrf_token(), ENT_QUOTES) ?>">
  <title>Offertory | Bride of Christ Church: San Mateo</title>
  <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="stylesheet" href="assets/css/offertory.css">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
</head>

<body class="homepage">

  <?php include 'includes/header.php'; ?>
  <?php include 'includes/sidebar.php'; ?>

  <main id="main">
    <?php if (isset($_SESSION['user_id'])): ?>
      <div class="offertory-history-trigger-wrap">
        <button
          type="button"
          id="offertoryHistoryBtn"
          class="offertory-history-btn"
          data-username="<?= htmlspecialchars($loggedInUsername, ENT_QUOTES, 'UTF-8') ?>">
          Offertory History
        </button>
      </div>
    <?php endif; ?>

    <section class="offertory-section">
      <div class="offertory-container">
        <p class="offertory-note">Please enter exact amounts. Numbers only. No spaces.</p>

        <form id="offertoryForm" class="offertory-form" method="post" enctype="multipart/form-data" autocomplete="off">
          <?= csrf_field() ?>

          <?php if (!isset($_SESSION['user_id']) && isset($_GET['visitor'])): ?>
            <div class="form-group">
              <label for="visitor_name">Name (optional)</label>
              <input type="text" name="visitor_name" id="visitor_name" placeholder="Enter your name">
            </div>
            <input type="hidden" name="force_visitor" value="1">
          <?php endif; ?>

          <?php if ($coupleShareAvailable): ?>
            <div class="couple-share-box">
              <label class="couple-share-label">
                <input type="checkbox" id="share_as_couple" name="share_as_couple" value="1">
                <span>Share offertory as couples with <?= htmlspecialchars($spouseUsername, ENT_QUOTES, 'UTF-8') ?>?</span>
              </label>
              <input type="hidden" name="spouse_id" value="<?= (int) $spouseId ?>">
            </div>
          <?php endif; ?>

          <div class="form-row">
            <div class="form-group">
              <label for="tithes">Tithes</label>
              <input type="text" id="tithes" name="tithes" placeholder="ex. 500" inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
            </div>
            <div class="form-group">
              <label for="offering">Offering</label>
              <input type="text" id="offering" name="offering" placeholder="ex. 500" inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
            </div>
            <div class="form-group">
              <label for="pledge">Pledge</label>
              <input type="text" id="pledge" name="pledge" placeholder="ex. 500" inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="eskwela_suporta">Eskwela Suporta</label>
              <input type="text" id="eskwela_suporta" name="eskwela_suporta" placeholder="ex. 500" inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
            </div>
            <div class="form-group">
              <label for="others">Others</label>
              <input type="text" id="others" name="others" placeholder="ex. 500" inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
            </div>
            <div class="form-group" id="otherUseGroup" style="display: none;">
              <label for="other_use">Please specify for what use</label>
              <input type="text" id="other_use" name="other_use" placeholder="ex. new church chairs">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="construction">Construction (Pledge)</label>
              <input type="text" id="construction" name="construction" placeholder="ex. 500" inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
            </div>
            <div class="form-group">
              <label for="samarleyte_pledge">Samar - Leyte (Pledge)</label>
              <input type="text" id="samarleyte_pledge" name="samarleyte_pledge" placeholder="ex. 500" inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
            </div>
            <div class="form-group">
              <label for="mode_of_offertory">Mode of Offertory</label>
              <select id="mode_of_offertory" name="mode_of_offertory" required>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group bank-proof-group" id="bankProofGroup" hidden>
              <label for="bank_proof_image">Bank Proof Image</label>
              <div class="bank-proof-input-wrap">
                <input
                  type="file"
                  id="bank_proof_image"
                  name="bank_proof_image"
                  accept=".jpg,.jpeg,.png,.heif,.heic,.webp,.tif,.tiff,image/jpeg,image/png,image/heif,image/heic,image/webp,image/tiff">
                <button
                  type="button"
                  id="clearBankProofBtn"
                  class="clear-bank-proof-btn"
                  aria-label="Remove selected bank proof image"
                  hidden>×</button>
              </div>
              <small class="offertory-file-note">Accepted: JPG, JPEG, PNG, HEIF, HEIC, WEBP, TIFF</small>
            </div>

            <div class="form-group form-total">
              <label for="total">Total:</label>
              <input type="text" id="total" readonly>
            </div>
          </div>

          <button type="submit" class="submit-btn">Submit</button>
        </form>
      </div>
    </section>
  </main>

  <?php if (isset($_SESSION['user_id'])): ?>
    <div id="userMemberHistoryModal" class="offertory-history-modal-overlay" aria-hidden="true">
      <div class="offertory-history-modal-content">
        <button type="button" id="closeUserMemberHistoryModal" class="offertory-history-close-btn">&times;</button>

        <div class="offertory-history-header">
          <h3 id="userMemberHistoryTitle" class="offertory-history-modal-title"></h3>
          <div class="offertory-history-export">
            <button type="button" id="userMemberHistoryExportCSV" class="offertory-history-export-btn">CSV</button>
            <button type="button" id="userMemberHistoryExportPDF" class="offertory-history-export-btn">PDF</button>
          </div>
        </div>

        <div class="offertory-history-details-section">
          <div class="offertory-history-table-container">
            <table id="userMemberHistoryTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Tithes</th>
                  <th>Offering</th>
                  <th>Pledge</th>
                  <th>ES</th>
                  <th>Others</th>
                  <th>Construction</th>
                  <th>Samar Leyte</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="10">Loading...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  <?php endif; ?>

  <div class="offertory-overlay" id="offertorySuccessOverlay">
    <div class="overlay-box">
      <h2>Thank you!</h2>
      <p>Your offertory has been successfully recorded.</p>
      <div class="overlay-buttons">
        <button type="button" id="offertoryOverlayOk">OK</button>
      </div>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
  <script src="assets/js/script.js"></script>
  <?php if (isset($_SESSION['user_id'])): ?>
    <script src="assets/js/offertoryhistory_user.js"></script>
  <?php endif; ?>
</body>

</html>