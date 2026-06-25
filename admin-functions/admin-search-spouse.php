<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../admin-authorization.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$memberId = isset($_GET['member_id']) ? (int) $_GET['member_id'] : 0;
$query = isset($_GET['q']) ? trim((string) $_GET['q']) : '';

if ($memberId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid member ID']);
    exit;
}

if ($query === '') {
    echo json_encode(['success' => true, 'items' => []]);
    exit;
}

$currentStmt = $mysqli->prepare("
    SELECT id, spouse_id
    FROM registrations
    WHERE id = ?
    LIMIT 1
");

if (!$currentStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to prepare member lookup']);
    exit;
}

$currentStmt->bind_param("i", $memberId);
$currentStmt->execute();
$currentResult = $currentStmt->get_result();
$currentMember = $currentResult->fetch_assoc();
$currentStmt->close();

if (!$currentMember) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Member not found']);
    exit;
}

$currentSpouseId = isset($currentMember['spouse_id']) ? (int) $currentMember['spouse_id'] : 0;

$sql = "
    SELECT r.id, r.username
    FROM registrations r
    WHERE r.marital_status = 'Married'
      AND r.username LIKE CONCAT('%', ?, '%')
      AND r.id <> ?
      AND (
            r.spouse_id IS NULL
            OR r.spouse_id = ?
          )
    ORDER BY r.username ASC
    LIMIT 10
";

$stmt = $mysqli->prepare($sql);

if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to prepare spouse search']);
    exit;
}

$stmt->bind_param("sii", $query, $memberId, $currentSpouseId);
$stmt->execute();
$result = $stmt->get_result();

$items = [];
while ($row = $result->fetch_assoc()) {
    $items[] = [
        'id' => (int) $row['id'],
        'username' => $row['username'],
    ];
}

$stmt->close();

echo json_encode([
    'success' => true,
    'items' => $items,
]);
exit;
