<?php
require '../admin-authorization.php';
require '../db/db.php';
require_once __DIR__ . '/_guard.php';
require_admin_and_post();

// Resolve DB connection
$db = null;
if (isset($mysqli) && $mysqli instanceof mysqli) {
    $db = $mysqli;
} elseif (isset($conn) && $conn instanceof mysqli) {
    $db = $conn;
}

if (!$db) {
    // Fallback: hard fail if DB not available
    die("Database connection not available.");
}

$id       = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$day      = isset($_POST['day']) ? trim($_POST['day']) : '';
$activity = isset($_POST['activity']) ? trim($_POST['activity']) : '';

if ($id <= 0 || $day === '' || $activity === '') {
    header("Location: ../admin-announcements.php?error=" . urlencode("Invalid announcement data."));
    exit;
}

$stmt = $db->prepare("UPDATE announcements SET day = ?, activity = ? WHERE id = ?");
if (!$stmt) {
    header("Location: ../admin-announcements.php?error=" . urlencode("Prepare failed: " . $db->error));
    exit;
}

$stmt->bind_param("ssi", $day, $activity, $id);
$stmt->execute();
$stmt->close();

// Redirect back with success flag
header("Location: ../admin-announcements.php?success=1");
exit;
