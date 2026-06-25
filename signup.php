<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Register | Bride of Christ Church: San Mateo</title>
  <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="stylesheet" href="assets/css/sign-up.css">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
</head>

<body class="homepage">
  <!-- Header -->
  <?php include 'includes/header.php'; ?>

  <!-- Sidebar -->
  <?php include 'includes/sidebar.php'; ?>
  <main id="main">
    <section class="registration-section">
      <h2>Please complete the following information</h2>

      <form action="register-process.php" method="post" class="registration-form" autocomplete="off">
        <h3>I. Personal Section</h3>
        <div class="registration-grid">
          <div>
            <label>Surname<span class="required">*</span></label>
            <input type="text" name="surname" placeholder="Dela Cruz" required>
          </div>

          <div>
            <label>First Name<span class="required">*</span></label>
            <input type="text" name="first_name" placeholder="Juan" required>
          </div>

          <div>
            <label>Middle Name</label>
            <input type="text" name="middle_name" placeholder="Santos">
          </div>

          <div>
            <label>Suffix</label>
            <input type="text" name="suffix" placeholder="Jr">
          </div>

          <div>
            <label>Gender<span class="required">*</span></label>
            <select name="gender" required>
              <option value="" disabled selected hidden>Select</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>

          <div>
            <label>Contact Number</label>
            <input type="text" name="contact" placeholder="09xxxxxxxxx">
          </div>

          <div>
            <label>Email Address</label>
            <input type="email" name="email" placeholder="juandelacruz@gmail.com">
          </div>

          <div>
            <label>Birthday</label>
            <input type="text" id="birthday" name="birthday" placeholder="YYYY-MM-DD">
          </div>

          <div class="wide">
            <label>Home Address</label>
            <input type="text" name="home_address" placeholder="Full Address">
          </div>

          <div class="wide">
            <label>Residential Address</label>
            <input type="text" name="residential_address" placeholder="Full Address">
          </div>

          <div>
            <label>Marital Status<span class="required">*</span></label>
            <select name="marital_status" required>
              <option value="" disabled selected hidden>Select</option>
              <option>Single</option>
              <option>Married</option>
              <option>Widowed</option>
            </select>
          </div>

          <div>
            <label>Wedding Date</label>
            <input type="text" id="wedding_date" name="wedding_date" placeholder="YYYY-MM-DD">
          </div>
          <div class="wide">
            <label>Child/Children Name(s)</label>
            <input type="text" name="children" placeholder="Juan Dela Cruz, Maria Clara, Pedro Penduko">
          </div>

          <div>
            <label>Person to contact in case of emergency</label>
            <input type="text" name="emergency_contact" placeholder="Juan Dela Cruz">
          </div>

          <div>
            <label>Mobile Number</label>
            <input type="text" name="emergency_mobile" placeholder="09xxxxxxx">
          </div>
        </div> <!-- End of Personal Section grid -->

        <!-- II. Church Section -->
        <h3>II. Church Section</h3>
        <div class="registration-grid">
          <div>
            <label>BCC Branch<span class="required">*</span></label>
            <select name="bcc_branch" required>
              <option value="" disabled selected hidden>Select</option>
              <option>San Mateo</option>
              <option>Leyte</option>
            </select>
          </div>

          <div>
            <label>Group</label>
            <select name="group">
              <option value="" selected>Select</option>
              <option>Kids</option>
              <option>Youth</option>
              <option>Young Adult</option>
              <option>Mid Adult</option>
              <option>Late Adult</option>
              <option>Mothers</option>
              <option>Fathers</option>
            </select>
          </div>

          <div>
            <label>Membership Date</label>
            <input type="text" id="membership_date" name="membership_date" placeholder="YYYY-MM-DD">
          </div>

          <!-- IMPORTANT: make this full-width inside the grid -->
          <div id="baptism-fields" class="wide">
            <div class="registration-grid">
              <div>
                <label>Water Baptism Date</label>
                <input type="text" id="baptism_date" name="baptism_date" placeholder="YYYY-MM-DD">
              </div>

              <div>
                <label>Water Baptism Location</label>
                <input type="text" id="baptism_location" name="baptism_location"
                  placeholder="ex. Shunjis Resort, San Mateo, Rizal">
              </div>
            </div>
          </div>
        </div>

        <!-- III. Account Creation -->
        <h3>III. Account Creation</h3>
        <p>Password must have:<br><br>Minimum 8 characters.<br>At least one uppercase letter.<br>At least one number.</p>

        <div class="registration-grid">
          <div class="username-field">
            <label>Username<span class="required">*</span></label>
            <input type="text" name="username" placeholder="FullName ex.Dela Cruz, Juan Santos" autocomplete="off" required>
            <span id="username-error" class="input-error"></span>
          </div>

          <div class="password-field">
            <label>Password <span class="required">*</span></label>
            <div class="password-input-wrap">
              <input
                type="password"
                name="password"
                id="signupPassword"
                required>
              <button
                type="button"
                id="signupPasswordToggle"
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
          </div>

          <div class="password-field">
            <label>Confirm Password <span class="required">*</span></label>
            <div class="password-input-wrap">
              <input
                type="password"
                name="confirm_password"
                id="signupConfirmPassword"
                required>
              <button
                type="button"
                id="signupConfirmPasswordToggle"
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
            <span id="confirm-error" class="input-error"></span>
          </div>
        </div>

        <div class="registration-buttons">
          <button type="submit" class="registration-continue-btn">Continue</button>
          <button type="button" class="registration-back-btn" id="registrationBackBtn">Back to Log in</button>
        </div>
      </form>
    </section>

  </main>

  <div id="confirmation-overlay" class="confirmation-overlay">
    <div class="confirmation-box">
      <p>Are you sure all the information you entered is correct?</p>
      <div class="confirmation-buttons">
        <button id="confirmYes">YES</button>
        <button id="confirmNo">NO</button>
      </div>
    </div>
  </div>

  <div id="success-overlay" class="confirmation-overlay">
    <div class="confirmation-box">
      <p>Your registration request has been received.<br><br>
        Please allow 2–3 days for our admin to review your details.<br><br>
        We’ll get back to you once it’s approved. God bless!</p>
      <button id="backToHome">Back to Home</button>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js"></script>
  <script src="assets/js/script.js"></script>
</body>

</html>