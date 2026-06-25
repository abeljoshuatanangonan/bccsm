<?php
// File: C:\xampp\htdocs\BCCSMOfficial\admin-functions\save-event.php

require '../admin-authorization.php';
include_once __DIR__ . '/../db/db.php';
require_once __DIR__ . '/_guard.php';

require_admin_and_post();

if (!isset($mysqli)) {
    header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Database connection failed"));
    exit;
}

$mode = strtolower((string)($_GET['mode'] ?? $_POST['mode'] ?? ''));

/**
 * Legacy endpoint: update only the full details (homepage_events.details).
 * Kept for backward compatibility if old forms still post with mode=details.
 */
if ($mode === 'details') {
    $eventIdRaw = $_POST['event_id'] ?? '';
    $eventId = ($eventIdRaw !== '' && ctype_digit((string)$eventIdRaw)) ? (int)$eventIdRaw : 0;
    $details = trim((string)($_POST['details'] ?? ''));

    if ($eventId <= 0) {
        header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Missing event id"));
        exit;
    }

    $stmt = $mysqli->prepare("UPDATE homepage_events SET details = ? WHERE id = ?");
    if (!$stmt) {
        header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Prepare failed: " . $mysqli->error));
        exit;
    }

    $stmt->bind_param("si", $details, $eventId);
    if (!$stmt->execute()) {
        $stmt->close();
        header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Execute failed: " . $stmt->error));
        exit;
    }

    $stmt->close();
    header("Location: ../admin-configuration.php?page=home&tab=events&success=2");
    exit;
}

// ----------------------------------------------------
// Normal create/update (Homepage config tab: page=home&tab=events)
// ----------------------------------------------------
$title = trim((string)($_POST['title'] ?? ''));
$date = trim((string)($_POST['date'] ?? ''));
$homeDetails = trim((string)($_POST['home_details'] ?? '')); // index.php card text
$details = trim((string)($_POST['details'] ?? ''));          // events.php full text

$eventIdRaw = $_POST['event_id'] ?? '';
$eventId = ($eventIdRaw !== '' && ctype_digit((string)$eventIdRaw)) ? (int)$eventIdRaw : null;

if ($title === '' || $date === '' || $homeDetails === '' || $details === '') {
    header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Missing required fields"));
    exit;
}

// Upload (optional for edit; required for insert)
$uploadDirFs = __DIR__ . '/../uploads/';
$uploadDirUrl = 'uploads/';

if (!is_dir($uploadDirFs)) {
    mkdir($uploadDirFs, 0777, true);
}

$imagePath = null;
if (!empty($_FILES['image']['name']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
    $fileName = time() . '_' . preg_replace('/[^A-Za-z0-9_\.-]/', '_', basename((string)$_FILES['image']['name']));
    $targetFs = $uploadDirFs . $fileName;
    $targetUrl = $uploadDirUrl . $fileName;

    if (!move_uploaded_file($_FILES['image']['tmp_name'], $targetFs)) {
        header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Image upload failed"));
        exit;
    }

    $imagePath = $targetUrl;
}

// UPDATE
if ($eventId !== null) {
    $stmt = $mysqli->prepare("SELECT image_path FROM homepage_events WHERE id = ? LIMIT 1");
    if (!$stmt) {
        header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Prepare failed: " . $mysqli->error));
        exit;
    }

    $stmt->bind_param("i", $eventId);
    $stmt->execute();
    $res = $stmt->get_result();
    $existing = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$existing) {
        header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Event not found"));
        exit;
    }

    $finalImagePath = $imagePath ?? (string)($existing['image_path'] ?? '');

    $stmt = $mysqli->prepare(
        "UPDATE homepage_events
            SET image_path = ?, title = ?, event_date = ?, home_details = ?, details = ?
        WHERE id = ?"
    );

    if (!$stmt) {
        header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Prepare failed: " . $mysqli->error));
        exit;
    }

    $stmt->bind_param("sssssi", $finalImagePath, $title, $date, $homeDetails, $details, $eventId);

    if (!$stmt->execute()) {
        $stmt->close();
        header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Execute failed: " . $stmt->error));
        exit;
    }

    $stmt->close();
    header("Location: ../admin-configuration.php?page=home&tab=events&success=2");
    exit;
}

// INSERT (image required)
if ($imagePath === null) {
    header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Event image is required"));
    exit;
}

$stmt = $mysqli->prepare(
    "INSERT INTO homepage_events (image_path, title, event_date, home_details, details, readmore_link)
     VALUES (?, ?, ?, ?, ?, '')"
);

if (!$stmt) {
    header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Prepare failed: " . $mysqli->error));
    exit;
}

$stmt->bind_param("sssss", $imagePath, $title, $date, $homeDetails, $details);

if (!$stmt->execute()) {
    $stmt->close();
    header("Location: ../admin-configuration.php?page=home&tab=events&error=" . urlencode("Execute failed: " . $stmt->error));
    exit;
}

$stmt->close();
header("Location: ../admin-configuration.php?page=home&tab=events&success=1");
exit;
