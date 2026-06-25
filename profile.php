<?php
session_start();

if (!isset($_SESSION['username'])) {
  header("Location: login.php");
  exit;
}

$username = $_SESSION['username'];

$mysqli = new mysqli("localhost", "root", "", "BCC_RegistrationForm");

if ($mysqli->connect_errno) {
  die("Database connection failed: " . $mysqli->connect_error);
}

$stmt = $mysqli->prepare("
  SELECT r.*, s.username AS spouse_username
  FROM registrations r
  LEFT JOIN registrations s ON s.id = r.spouse_id
  WHERE r.username = ?
");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

$stmt->close();
$mysqli->close();

if (!$user) {
  die("Profile not found.");
}

function h(?string $value): string
{
  return htmlspecialchars((string)($value ?? ''), ENT_QUOTES, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Profile | Bride of Christ Church: San Mateo</title>
  <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="stylesheet" href="assets/css/sign-up.css">
  <link rel="stylesheet" href="assets/css/profile.css">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
</head>

<body class="homepage">

  <?php include 'includes/header.php'; ?>
  <?php include 'includes/sidebar.php'; ?>

  <main id="main">
    <section class="registration-section">
      <h2>Profile</h2>

      <form id="profileForm" class="profile-form" autocomplete="off">
        <input type="hidden" name="id" value="<?= (int)$user['id'] ?>">

        <h3>I. Personal Section</h3>
        <div class="registration-grid">
          <div>
            <label>Surname</label>
            <input type="text" name="surname" value="<?= h($user['surname']) ?>" disabled>
          </div>

          <div>
            <label>First Name</label>
            <input type="text" name="first_name" value="<?= h($user['first_name']) ?>" disabled>
          </div>

          <div>
            <label>Middle Name</label>
            <input type="text" name="middle_name" value="<?= h($user['middle_name']) ?>" disabled>
          </div>

          <div>
            <label>Suffix</label>
            <input type="text" name="suffix" value="<?= h($user['suffix']) ?>" disabled>
          </div>

          <div>
            <label>Gender</label>
            <select name="gender" disabled>
              <option value="Male" <?= ($user['gender'] === 'Male') ? 'selected' : '' ?>>Male</option>
              <option value="Female" <?= ($user['gender'] === 'Female') ? 'selected' : '' ?>>Female</option>
            </select>
          </div>

          <div>
            <label>Contact Number</label>
            <input type="text" name="contact" value="<?= h($user['contact']) ?>" disabled>
          </div>

          <div>
            <label>Email Address</label>
            <input type="email" name="email" value="<?= h($user['email']) ?>" disabled>
          </div>

          <div>
            <label>Birthday</label>
            <input type="text" id="birthday" name="birthday" value="<?= h($user['birthday']) ?>" disabled>
          </div>

          <div class="wide">
            <label>Home Address</label>
            <input type="text" name="home_address" value="<?= h($user['home_address']) ?>" disabled>
          </div>

          <div class="wide">
            <label>Residential Address</label>
            <input type="text" name="residential_address" value="<?= h($user['residential_address']) ?>" disabled>
          </div>

          <div>
            <label>Marital Status</label>
            <select name="marital_status" disabled>
              <option value="Single" <?= ($user['marital_status'] === 'Single') ? 'selected' : '' ?>>Single</option>
              <option value="Married" <?= ($user['marital_status'] === 'Married') ? 'selected' : '' ?>>Married</option>
              <option value="Widowed" <?= ($user['marital_status'] === 'Widowed') ? 'selected' : '' ?>>Widowed</option>
            </select>
          </div>

          <div>
            <label>Wedding Date</label>
            <input type="text" id="wedding_date" name="wedding_date" value="<?= h($user['wedding_date']) ?>" disabled>
          </div>

          <div class="spouse-field-wrap">
            <label>Spouse</label>
            <input type="hidden" id="spouse_id" name="spouse_id" value="<?= h($user['spouse_id'] ?? '') ?>">
            <input
              type="text"
              id="spouse_name"
              name="spouse_name"
              value="<?= h($user['spouse_username'] ?? '') ?>"
              data-selected-id="<?= h($user['spouse_id'] ?? '') ?>"
              autocomplete="off"
              disabled>
            <div id="spouseSuggestions" class="spouse-suggestions" style="display:none;"></div>
          </div>

          <div class="wide">
            <label>Child/Children Name(s)</label>
            <input type="text" name="children" value="<?= h($user['children']) ?>" disabled>
          </div>

          <div>
            <label>Emergency Contact</label>
            <input type="text" name="emergency_contact" value="<?= h($user['emergency_contact']) ?>" disabled>
          </div>

          <div>
            <label>Emergency Mobile</label>
            <input type="text" name="emergency_mobile" value="<?= h($user['emergency_mobile']) ?>" disabled>
          </div>
        </div>

        <h3>II. Church Section</h3>
        <div class="registration-grid">
          <div>
            <label>BCC Branch</label>
            <select name="bcc_branch" disabled>
              <option value="San Mateo" <?= ($user['bcc_branch'] === 'San Mateo') ? 'selected' : '' ?>>San Mateo</option>
              <option value="Leyte" <?= ($user['bcc_branch'] === 'Leyte') ? 'selected' : '' ?>>Leyte</option>
            </select>
          </div>

          <div>
            <label>Group</label>
            <select name="group" disabled>
              <option value="Kids" <?= ($user['group'] === 'Kids') ? 'selected' : '' ?>>Kids</option>
              <option value="Youth" <?= ($user['group'] === 'Youth') ? 'selected' : '' ?>>Youth</option>
              <option value="Young Adult" <?= ($user['group'] === 'Young Adult') ? 'selected' : '' ?>>Young Adult</option>
              <option value="Mid Adult" <?= ($user['group'] === 'Mid Adult') ? 'selected' : '' ?>>Mid Adult</option>
              <option value="Late Adult" <?= ($user['group'] === 'Late Adult') ? 'selected' : '' ?>>Late Adult</option>
              <option value="Mothers" <?= ($user['group'] === 'Mothers') ? 'selected' : '' ?>>Mothers</option>
              <option value="Fathers" <?= ($user['group'] === 'Fathers') ? 'selected' : '' ?>>Fathers</option>
            </select>
          </div>

          <div>
            <label>Membership Date</label>
            <input type="text" id="membership_date" name="membership_date" value="<?= h($user['membership_date']) ?>" disabled>
          </div>

          <div>
            <label>Water Baptism Date</label>
            <input type="text" id="baptism_date" name="baptism_date" value="<?= h($user['baptism_date']) ?>" disabled>
          </div>

          <div class="wide">
            <label>Water Baptism Location</label>
            <input type="text" name="baptism_location" value="<?= h($user['baptism_location']) ?>" disabled>
          </div>
        </div>

        <h3>III. Account</h3>
        <div class="registration-grid">
          <div>
            <label>Username</label>
            <div class="profile-readonly"><?= h($user['username']) ?></div>
          </div>

          <div>
            <label>Password</label>
            <div class="profile-readonly">********</div>
          </div>
        </div>

        <div class="registration-buttons profile-actions">
          <div class="profile-action-row">
            <button type="button" class="registration-back-btn" id="profileEditBtn">Edit Profile</button>
            <button type="button" class="registration-back-btn" id="changeCredentialsBtn">Change Username or Password</button>
          </div>
          <button type="button" class="registration-back-btn" id="profileCancelBtn" style="display:none;">Cancel</button>
          <div id="profileStatusMsg" class="profile-status-msg"></div>
        </div>
      </form>
    </section>

    <div id="changeCredentialsOverlay" class="profile-credentials-overlay" style="display:none;">
      <div class="profile-credentials-box">
        <h3>Change Username or Password</h3>

        <p class="profile-credentials-note">
          Password must have:<br><br>
          Minimum 8 characters.<br>
          At least one uppercase letter.<br>
          At least one number.
        </p>

        <div class="registration-grid profile-credentials-grid">
          <div class="wide">
            <label>Username</label>
            <input type="text" id="credentialsUsername" name="credentials_username" autocomplete="off">
          </div>

          <div class="wide">
            <label>Existing Password</label>
            <div class="password-input-wrap">
              <input type="password" id="existingPassword" name="existing_password">
              <button
                type="button"
                id="existingPasswordToggle"
                class="password-toggle-btn"
                aria-label="Show password"
                aria-pressed="false"
                hidden
                data-visible="false">
                <span class="password-toggle-icon password-toggle-show" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12s-3.8 6.5-10.5 6.5S1.5 12 1.5 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"></circle>
                  </svg>
                </span>
                <span class="password-toggle-icon password-toggle-hide" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                    <path d="M10.6 5.7A11.5 11.5 0 0 1 12 5.5c6.7 0 10.5 6.5 10.5 6.5a18.6 18.6 0 0 1-4.2 4.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M6.3 6.3A18.2 18.2 0 0 0 1.5 12S5.3 18.5 12 18.5c1.7 0 3.2-.4 4.5-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M9.9 9.9A3 3 0 0 0 9 12a3 3 0 0 0 4.6 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                  </svg>
                </span>
              </button>
            </div>
            <span id="existingPasswordError" class="input-error">Incorrect Password.</span>
          </div>

          <div class="wide">
            <label>New Password</label>
            <div class="password-input-wrap">
              <input type="password" id="newPassword" name="new_password" disabled>
              <button
                type="button"
                id="newPasswordToggle"
                class="password-toggle-btn"
                aria-label="Show password"
                aria-pressed="false"
                hidden
                data-visible="false">
                <span class="password-toggle-icon password-toggle-show" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12s-3.8 6.5-10.5 6.5S1.5 12 1.5 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"></circle>
                  </svg>
                </span>
                <span class="password-toggle-icon password-toggle-hide" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                    <path d="M10.6 5.7A11.5 11.5 0 0 1 12 5.5c6.7 0 10.5 6.5 10.5 6.5a18.6 18.6 0 0 1-4.2 4.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M6.3 6.3A18.2 18.2 0 0 0 1.5 12S5.3 18.5 12 18.5c1.7 0 3.2-.4 4.5-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M9.9 9.9A3 3 0 0 0 9 12a3 3 0 0 0 4.6 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                  </svg>
                </span>
              </button>
            </div>
            <span id="newPasswordError" class="input-error">Invalid Password</span>
          </div>

          <div class="wide">
            <label>Re-Enter New Password</label>
            <div class="password-input-wrap">
              <input type="password" id="confirmNewPassword" name="confirm_new_password" disabled>
              <button
                type="button"
                id="confirmNewPasswordToggle"
                class="password-toggle-btn"
                aria-label="Show password"
                aria-pressed="false"
                hidden
                data-visible="false">
                <span class="password-toggle-icon password-toggle-show" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12s-3.8 6.5-10.5 6.5S1.5 12 1.5 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"></circle>
                  </svg>
                </span>
                <span class="password-toggle-icon password-toggle-hide" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                    <path d="M10.6 5.7A11.5 11.5 0 0 1 12 5.5c6.7 0 10.5 6.5 10.5 6.5a18.6 18.6 0 0 1-4.2 4.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M6.3 6.3A18.2 18.2 0 0 0 1.5 12S5.3 18.5 12 18.5c1.7 0 3.2-.4 4.5-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M9.9 9.9A3 3 0 0 0 9 12a3 3 0 0 0 4.6 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                  </svg>
                </span>
              </button>
            </div>
            <span id="confirmNewPasswordError" class="input-error">Password do not match</span>
          </div>
        </div>

        <div class="profile-credentials-actions">
          <button type="button" class="registration-back-btn" id="saveCredentialsBtn">SAVE</button>
          <button type="button" class="registration-continue-btn" id="cancelCredentialsBtn">CANCEL</button>
        </div>
      </div>
    </div>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js"></script>
  <script src="assets/js/script.js"></script>
</body>

</html>