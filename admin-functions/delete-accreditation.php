<?php
require '../admin-authorization.php';
include_once __DIR__ . '/../db/db.php';

if (!isset($mysqli)) {
    header("Location: ../admin-configuration.php?tab=accreditations&error=" . urlencode("Database connection failed"));
    exit;
}

if (isset($_GET['id'])) {
    $id = intval($_GET['id']);

    // ✅ Fetch image path to delete the file later
    $stmt = $mysqli->prepare("SELECT image_path FROM accreditations WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $image = $result->fetch_assoc();
    $stmt->close();

    // ✅ Delete the accreditation record
    $stmt = $mysqli->prepare("DELETE FROM accreditations WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();

    // ✅ Remove image file (if it exists)
    if (!empty($image['image_path'])) {
        $file_path = __DIR__ . '/../' . $image['image_path'];
        if (file_exists($file_path)) {
            unlink($file_path);
        }
    }

    header("Location: ../admin-configuration.php?tab=accreditations&deleted=1");
    exit;
} else {
    header("Location: ../admin-configuration.php?tab=accreditations&error=" . urlencode("Invalid ID"));
    exit;
}
?>
