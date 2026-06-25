<?php
require '../admin-authorization.php';
require_once __DIR__ . '/_guard.php';
require_admin_and_post();

include_once __DIR__ . '/../db/db.php';

if (!isset($mysqli)) {
    header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Database connection failed."));
    exit;
}

$imagePath = null;

try {
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $tmpName = $_FILES['image']['tmp_name'];
        $origName = $_FILES['image']['name'];

        $info = @getimagesize($tmpName);
        if ($info === false) {
            header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Uploaded file is not a valid image."));
            exit;
        }

        $mime = $info['mime'] ?? '';
        $width = (int) ($info[0] ?? 0);
        $height = (int) ($info[1] ?? 0);

        if ($mime !== 'image/webp') {
            header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Banner must be a WEBP image."));
            exit;
        }

        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        if ($ext !== 'webp') {
            header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("File extension must be .webp."));
            exit;
        }

        if ($width !== 1400 || $height !== 800) {
            header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Banner image must be exactly 1400x800 pixels."));
            exit;
        }

        $uploadDirFs = __DIR__ . '/../uploads/banner/';
        $uploadDirUrl = 'uploads/banner/';

        if (!is_dir($uploadDirFs) && !mkdir($uploadDirFs, 0777, true) && !is_dir($uploadDirFs)) {
            header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Failed to create upload directory."));
            exit;
        }

        $newFileName = 'banner_' . time() . '.webp';
        $destFs = $uploadDirFs . $newFileName;
        $destUrl = $uploadDirUrl . $newFileName;

        if (!move_uploaded_file($tmpName, $destFs)) {
            header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Failed to move uploaded file."));
            exit;
        }

        $imagePath = $destUrl;
    }

    $result = $mysqli->query("SELECT id FROM homepage_banner ORDER BY id DESC LIMIT 1");
    $hasRow = ($result && $result->num_rows > 0);

    if ($hasRow) {
        $row = $result->fetch_assoc();
        $id = (int) ($row['id'] ?? 0);

        if ($id <= 0) {
            header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Invalid banner record."));
            exit;
        }

        if ($imagePath !== null) {
            $stmt = $mysqli->prepare("UPDATE homepage_banner SET image_path = ? WHERE id = ?");
            if (!$stmt) {
                header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Prepare failed: " . $mysqli->error));
                exit;
            }
            $stmt->bind_param("si", $imagePath, $id);

            if (!$stmt->execute()) {
                header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Execute failed: " . $stmt->error));
                exit;
            }
            $stmt->close();
        }
    } else {
        if ($imagePath === null) {
            header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Please upload a banner image for first-time setup."));
            exit;
        }

        $stmt = $mysqli->prepare("INSERT INTO homepage_banner (image_path) VALUES (?)");
        if (!$stmt) {
            header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Prepare failed: " . $mysqli->error));
            exit;
        }
        $stmt->bind_param("s", $imagePath);

        if (!$stmt->execute()) {
            header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Execute failed: " . $stmt->error));
            exit;
        }
        $stmt->close();
    }

    header("Location: ../admin-configuration.php?tab=banner&success=1");
    exit;
} catch (mysqli_sql_exception $e) {
    header("Location: ../admin-configuration.php?tab=banner&error=" . urlencode("Database error: " . $e->getMessage()));
    exit;
}
