<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/admin-authorization.php';
require_once __DIR__ . '/includes/csrf.php';

csrf_require_or_fail();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit;
}

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid member ID'
    ]);
    exit;
}

$checkStmt = $mysqli->prepare("SELECT id FROM registrations WHERE id = ? LIMIT 1");
if (!$checkStmt) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to prepare member lookup'
    ]);
    exit;
}

$checkStmt->bind_param("i", $id);
$checkStmt->execute();
$checkResult = $checkStmt->get_result();
$member = $checkResult->fetch_assoc();
$checkStmt->close();

if (!$member) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'Member not found'
    ]);
    exit;
}

$deleteStmt = $mysqli->prepare("DELETE FROM registrations WHERE id = ?");
if (!$deleteStmt) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to prepare delete query'
    ]);
    exit;
}

$deleteStmt->bind_param("i", $id);

if (!$deleteStmt->execute()) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to delete member'
    ]);
    $deleteStmt->close();
    exit;
}

$deleteStmt->close();

echo json_encode([
    'success' => true,
    'message' => 'Member deleted successfully'
]);
exit;
