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
    header("Location: ../admin-announcements.php?error=" . urlencode("Database connection not available."));
    exit;
}

// ID must come from POST now (NOT GET)
$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) {
    header("Location: ../admin-announcements.php?error=" . urlencode("Invalid announcement ID."));
    exit;
}

$stmt = $db->prepare("DELETE FROM announcements WHERE id = ?");
if (!$stmt) {
    header("Location: ../admin-announcements.php?error=" . urlencode("Prepare failed: " . $db->error));
    exit;
}

$stmt->bind_param("i", $id);
$stmt->execute();
$stmt->close();

// Redirect back after successful deletion
header("Location: ../admin-announcements.php?deleted=1");
exit;
