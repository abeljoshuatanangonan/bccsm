<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login | Bride of Christ Church: San Mateo</title>
  <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="stylesheet" href="assets/css/login.css">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
</head>

<body class="homepage">

  <!-- Header -->
  <?php include 'includes/header.php'; ?>

  <!-- Sidebar -->
  <?php include 'includes/sidebar.php'; ?>

  <main id="main">

    <section class="login-container">
      <!-- Left side images -->
      <div id="login-images" class="login-images">
        <img src="assets/images/loginimg1.webp" alt="login image1">
        <img src="assets/images/loginimg2.webp" alt="login image2">
        <img src="assets/images/loginimg3.webp" alt="login image3">
        <img src="assets/images/loginimg4.webp" alt="login image4">
      </div>

      <!-- Right side login form -->
      <div id="login-form" class="login-form">
        <p class="signup-text">Don’t have an account? <a href="signup.php">Sign up</a></p>

        <?php $redirect = isset($_GET['redirect']) ? trim((string)$_GET['redirect']) : ''; ?>
        <form action="login-process.php" method="POST">
          <?php if ($redirect !== ''): ?>
            <input type="hidden" name="redirect" value="<?= htmlspecialchars($redirect, ENT_QUOTES, 'UTF-8') ?>">
          <?php endif; ?>
          <input type="text" name="username" placeholder="Username" required>

          <div class="password-wrapper" style="position: relative;">
            <div class="password-input-wrap">
              <input
                type="password"
                name="password"
                id="loginPassword"
                placeholder="Password"
                required>
              <button
                type="button"
                id="loginPasswordToggle"
                class="password-toggle-btn"
                aria-label="Show password"
                aria-pressed="false"
                hidden>
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

            <?php if (isset($_GET['error'])): ?>
              <?php if ($_GET['error'] === '1'): ?>
                <span id="login-error" class="input-error" style="display:block; color:red;">
                  Incorrect username or password.
                </span>

              <?php elseif ($_GET['error'] === 'pending'): ?>
                <span id="login-error" class="input-error" style="display:block; color:red;">
                  Your account is still pending approval.
                </span>
              <?php elseif ($_GET['error'] === 'rejected'): ?>
                <span id="login-error" class="input-error" style="display:block; color:red;">
                  Your registration was declined. Please register in Sign Up above again.
                </span>
              <?php endif; ?>
            <?php endif; ?>

            <a href="#" class="forgot">Forgot your password?</a>
            <button type="submit">Log in</button>
        </form>



        <!-- Forgot Password Overlay -->
        <div id="forgot-overlay" class="forgot-overlay">
          <div class="forgot-box">
            <h2>Password Assistance</h2>
            <p>Please contact a church administrator to reset your password.</p>
            <button id="forgotOkBtn">Okay</button>
          </div>
        </div>

        <div class="socials">
          <p>Find us on</p>
          <a href="https://www.facebook.com/bccsanmateo" target="_blank" rel="noopener noreferrer"><img src="assets/images/fblogo.webp" alt="Facebook"></a>
          <a href="https://www.instagram.com/bccsanmateo" target="_blank" rel="noopener noreferrer"><img src="assets/images/iglogo.webp" alt="Instagram"></a>
        </div>

      </div>
    </section>
  </main>
  <script>
    window.addEventListener("load", () => {
      document.querySelector("input[name='username']").value = "";
      document.querySelector("input[name='password']").value = "";
    });
  </script>
  <script src="assets/js/script.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", () => {
      const passwordInput = document.querySelector("input[name='password']");
      const errorMsg = document.getElementById("login-error");

      if (passwordInput && errorMsg) {
        passwordInput.addEventListener("focus", () => {
          errorMsg.style.display = "none";
        });
        passwordInput.addEventListener("input", () => {
          errorMsg.style.display = "none";
        });
      }
    });
  </script>

</body>

</html>