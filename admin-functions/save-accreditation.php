<?php
require '../admin-authorization.php';
include_once __DIR__ . '/../db/db.php';

if (!isset($mysqli)) {
    header("Location: ../admin-configuration.php?tab=accreditations&error=" . urlencode("Database connection failed"));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['name'] ?? '');
    $sort_order = intval($_POST['sort_order'] ?? 0);

    if (empty($name)) {
        header("Location: ../admin-configuration.php?tab=accreditations&error=" . urlencode("Name is required"));
        exit;
    }

    $image_path = null;
    $upload_dir = __DIR__ . '/../assets/images/'; // absolute safe path

    // ✅ Make sure upload folder exists
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }

    // ✅ Handle image upload
    if (!empty($_FILES['image']['name']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        // Sanitize filename to avoid issues
        $file_name = time() . '_' . preg_replace('/[^A-Za-z0-9_\.-]/', '_', basename($_FILES['image']['name']));
        $target_file = $upload_dir . $file_name;

        if (move_uploaded_file($_FILES['image']['tmp_name'], $target_file)) {
            $image_path = 'assets/images/' . $file_name; // relative path for database
        } else {
            header("Location: ../admin-configuration.php?tab=accreditations&error=" . urlencode("Image upload failed"));
            exit;
        }
    } else {
        header("Location: ../admin-configuration.php?tab=accreditations&error=" . urlencode("No image uploaded"));
        exit;
    }

    // ✅ Insert record securely
    $stmt = $mysqli->prepare("INSERT INTO accreditations (image_path, name, sort_order) VALUES (?, ?, ?)");
    if ($stmt) {
        $stmt->bind_param('ssi', $image_path, $name, $sort_order);
        $stmt->execute();
        $stmt->close();
    } else {
        header("Location: ../admin-configuration.php?tab=accreditations&error=" . urlencode("Database error"));
        exit;
    }

    header("Location: ../admin-configuration.php?tab=accreditations&success=1");
    exit;
}
?>
