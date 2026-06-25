<?php
header("Content-Type: application/json; charset=utf-8");
require __DIR__ . '/../admin-authorization.php';

if (!isset($_GET['id'])) {
    echo json_encode(["success" => false, "message" => "Missing ID"]);
    exit;
}

$id = (int) $_GET['id'];

$stmt = $mysqli->prepare("
    SELECT r.*, s.username AS spouse_username
    FROM registrations r
    LEFT JOIN registrations s ON s.id = r.spouse_id
    WHERE r.id = ?
    LIMIT 1
");

if (!$stmt) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Failed to prepare member lookup"]);
    exit;
}

$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();
$member = $result->fetch_assoc();

if ($member) {
    echo json_encode(array_merge(["success" => true], $member));
} else {
    echo json_encode(["success" => false, "message" => "Member not found"]);
}

$stmt->close();
$mysqli->close();
exit;
