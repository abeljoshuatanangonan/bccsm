<?php
require_once __DIR__ . '/_guard.php';
require_admin_and_post();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db/db.php';

$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid id']);
    exit;
}

$stmt = $conn->prepare("UPDATE registrations SET status='rejected', date_rejected=CURRENT_TIMESTAMP WHERE id=? LIMIT 1");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Prepare failed']);
    exit;
}
$stmt->bind_param('i', $id);
$ok = $stmt->execute();
$rows = $stmt->affected_rows;
$stmt->close();

if (!$ok) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Update failed']);
    exit;
}

echo json_encode(['success' => $rows > 0]);
