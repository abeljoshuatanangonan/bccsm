<?php
session_start();

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['username'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
    exit;
}

$mysqli = new mysqli("localhost", "root", "", "BCC_RegistrationForm");

if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed'
    ]);
    exit;
}

$currentUsername = $_SESSION['username'];
$query = isset($_GET['q']) ? trim((string) $_GET['q']) : '';

if ($query === '') {
    echo json_encode([
        'success' => true,
        'items' => []
    ]);
    exit;
}

$currentUserStmt = $mysqli->prepare("
    SELECT id, spouse_id
    FROM registrations
    WHERE username = ?
    LIMIT 1
");

if (!$currentUserStmt) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to prepare current user lookup'
    ]);
    exit;
}

$currentUserStmt->bind_param("s", $currentUsername);
$currentUserStmt->execute();
$currentUserResult = $currentUserStmt->get_result();
$currentUser = $currentUserResult->fetch_assoc();
$currentUserStmt->close();

if (!$currentUser) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'Current user not found'
    ]);
    exit;
}

$currentUserId = (int) $currentUser['id'];
$currentSpouseId = isset($currentUser['spouse_id']) ? (int) $currentUser['spouse_id'] : 0;

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
    echo json_encode([
        'success' => false,
        'message' => 'Failed to prepare search'
    ]);
    exit;
}

$stmt->bind_param("sii", $query, $currentUserId, $currentSpouseId);
$stmt->execute();
$result = $stmt->get_result();

$items = [];
while ($row = $result->fetch_assoc()) {
    $items[] = [
        'id' => (int) $row['id'],
        'username' => $row['username']
    ];
}

$stmt->close();
$mysqli->close();

echo json_encode([
    'success' => true,
    'items' => $items
]);
exit;
