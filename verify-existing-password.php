<?php
session_start();

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['username'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'valid' => false,
        'message' => 'Unauthorized'
    ]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'valid' => false,
        'message' => 'Method not allowed'
    ]);
    exit;
}

$existingPassword = isset($_POST['existing_password']) ? trim((string) $_POST['existing_password']) : '';

if ($existingPassword === '') {
    echo json_encode([
        'success' => true,
        'valid' => false
    ]);
    exit;
}

$mysqli = new mysqli("localhost", "root", "", "BCC_RegistrationForm");

if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'valid' => false,
        'message' => 'Database connection failed'
    ]);
    exit;
}

$currentSessionUsername = $_SESSION['username'];

$stmt = $mysqli->prepare("SELECT password FROM registrations WHERE username = ? LIMIT 1");
if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'valid' => false,
        'message' => 'Failed to prepare lookup'
    ]);
    exit;
}

$stmt->bind_param("s", $currentSessionUsername);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
$stmt->close();
$mysqli->close();

if (!$user) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'valid' => false,
        'message' => 'Account not found'
    ]);
    exit;
}

$storedPassword = (string) $user['password'];
$passwordOk = password_verify($existingPassword, $storedPassword) || hash_equals($storedPassword, $existingPassword);

echo json_encode([
    'success' => true,
    'valid' => $passwordOk
]);
exit;
