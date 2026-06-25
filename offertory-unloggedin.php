<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offertory | Choose Option</title>
    <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">

    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="stylesheet" href="assets/css/offertory-unloggedin.css">

    <!-- Header fonts (match index.php) -->
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
</head>

<body class="homepage">
    <?php include 'includes/header.php'; ?>
    <?php include 'includes/sidebar.php'; ?>

    <main id="main">
        <div class="offertory-choice">
            <h2>Offertory Giving</h2>
            <p>Please select your role to continue</p>

            <button class="choice-btn member" onclick="window.location.href='login.php?redirect=offertory.php'">MEMBER</button>
            <button class="choice-btn visitor" onclick="window.location.href='offertory.php?visitor=1'">VISITOR</button>

            <a href="index.php" class="back-link">Back to Home</a>
        </div>
    </main>
</body>
<script src="assets/js/script.js"></script>

</html>