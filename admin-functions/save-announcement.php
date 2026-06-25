<?php
require '../admin-authorization.php';
require '../db/db.php';
require_once __DIR__ . '/_guard.php';
require_admin_and_post();

$db = null;
if (isset($mysqli) && $mysqli instanceof mysqli) {
    $db = $mysqli;
} elseif (isset($conn) && $conn instanceof mysqli) {
    $db = $conn;
}

if (!$db) {
    die("Database connection not available.");
}

// ✅ Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../admin-announcements.php');
    exit;
}

// ✅ Collect days: support either a single "day" or "weekdays"
$days = [];
if (!empty($_POST['days'])) {
    $days = is_array($_POST['days']) ? $_POST['days'] : [$_POST['days']];
} elseif (!empty($_POST['day'])) {
    $raw = trim($_POST['day']);
    $lower = strtolower($raw);
    if (in_array($lower, ['weekdays', 'mon-fri', 'monday-friday'])) {
        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    } else {
        $days = [$raw];
    }
} else {
    header('Location: ../admin-announcements.php?error=no_day');
    exit;
}

// ✅ Get activity
$activity = trim($_POST['activity'] ?? '');
if ($activity === '') {
    header('Location: ../admin-announcements.php?error=empty_activity');
    exit;
}

// ✅ Your table includes sort_order — keep it true
$hasSortOrder = true;

if ($hasSortOrder) {
    $stmt = $db->prepare("INSERT INTO announcements (`day`, `activity`, `sort_order`) VALUES (?, ?, ?)");
    if (!$stmt) {
        header("Location: ../admin-announcements.php?error=" . urlencode("Prepare failed: " . $db->error));
        exit;
    }

    foreach ($days as $day) {
        // Get next sort_order for this day
        $safeDay = $db->real_escape_string($day);
        $res = $db->query("SELECT COALESCE(MAX(sort_order),0) AS m FROM announcements WHERE `day` = '$safeDay'");
        $row = $res ? $res->fetch_assoc() : null;
        $next = ($row ? intval($row['m']) : 0) + 1;

        $stmt->bind_param("ssi", $day, $activity, $next);
        $stmt->execute();
    }

    $stmt->close();
} else {
    $stmt = $db->prepare("INSERT INTO announcements (`day`, `activity`) VALUES (?, ?)");
    if (!$stmt) {
        header("Location: ../admin-announcements.php?error=" . urlencode("Prepare failed: " . $db->error));
        exit;
    }

    foreach ($days as $day) {
        $stmt->bind_param("ss", $day, $activity);
        $stmt->execute();
    }

    $stmt->close();
}

// ✅ Redirect back to admin-announcements page
header("Location: ../admin-announcements.php?success=1");
exit;
?>
