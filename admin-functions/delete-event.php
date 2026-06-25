<?php
// File: C:\xampp\htdocs\BCCSMOfficial\admin-functions\delete-event.php

require '../admin-authorization.php';
include_once __DIR__ . '/../db/db.php';

if (!isset($mysqli)) {
    header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Database connection failed"));
    exit;
}

$idRaw = $_GET['id'] ?? '';
$id = (ctype_digit((string)$idRaw)) ? (int)$idRaw : 0;

if ($id <= 0) {
    header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Invalid event id"));
    exit;
}

$stmt = $mysqli->prepare("DELETE FROM homepage_events WHERE id = ?");
if (!$stmt) {
    header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Prepare failed: " . $mysqli->error));
    exit;
}

$stmt->bind_param("i", $id);

if (!$stmt->execute()) {
    $stmt->close();
    header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Execute failed: " . $stmt->error));
    exit;
}

$stmt->close();

header("Location: ../admin-configuration.php?page=home&tab=events&deleted=1");
exit;
