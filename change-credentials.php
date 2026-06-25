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

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
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

function val(string $key): string
{
    return isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
}
function syncOffertoryNames(mysqli $mysqli, int $userId, string $newUsername): void
{
    $singleStmt = $mysqli->prepare("
        UPDATE offertory
        SET username = ?
        WHERE user_id = ?
          AND (is_couple_shared = 0 OR is_couple_shared IS NULL)
          AND username IS NOT NULL
          AND LOWER(username) <> 'visitor'
    ");
    $singleStmt->bind_param("si", $newUsername, $userId);
    $singleStmt->execute();
    $singleStmt->close();

    $coupleStmt = $mysqli->prepare("
        UPDATE offertory o
        LEFT JOIN registrations p ON p.id = o.couple_primary_user_id
        LEFT JOIN registrations s ON s.id = o.couple_secondary_user_id
        SET
            o.username = CASE
                WHEN o.user_id = ? AND o.username IS NOT NULL AND LOWER(o.username) <> 'visitor'
                    THEN ?
                ELSE o.username
            END,
            o.display_name = CASE
                WHEN o.is_couple_shared = 1
                     AND p.id IS NOT NULL
                     AND s.id IS NOT NULL
                THEN CASE
                    WHEN p.gender = 'Female' AND s.gender = 'Male'
                        THEN CONCAT(s.username, ' & ', p.username)
                    ELSE CONCAT(p.username, ' & ', s.username)
                END
                ELSE o.display_name
            END
        WHERE o.is_couple_shared = 1
          AND (o.couple_primary_user_id = ? OR o.couple_secondary_user_id = ?)
    ");
    $coupleStmt->bind_param("isii", $userId, $newUsername, $userId, $userId);
    $coupleStmt->execute();
    $coupleStmt->close();
}

$currentSessionUsername = $_SESSION['username'];
$newUsername = val('username');
$existingPassword = val('existing_password');
$newPassword = val('new_password');
$confirmNewPassword = val('confirm_new_password');

if ($newUsername === '' || $existingPassword === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Username and existing password are required.'
    ]);
    exit;
}

$stmt = $mysqli->prepare("SELECT id, username, password FROM registrations WHERE username = ? LIMIT 1");
if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to prepare account lookup.'
    ]);
    exit;
}

$stmt->bind_param("s", $currentSessionUsername);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
$stmt->close();

if (!$user) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'Account not found.'
    ]);
    exit;
}

$storedPassword = (string) $user['password'];
$passwordOk = password_verify($existingPassword, $storedPassword) || hash_equals($storedPassword, $existingPassword);

if (!$passwordOk) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'field' => 'existing_password',
        'message' => 'Incorrect Password.'
    ]);
    exit;
}

if ($newPassword !== '' || $confirmNewPassword !== '') {
    if ($newPassword !== $confirmNewPassword) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'field' => 'new_password',
            'message' => 'New passwords do not match.'
        ]);
        exit;
    }

    $rules = [
        ['regex' => '/.{8,}/', 'message' => 'Password must be at least 8 characters.'],
        ['regex' => '/[A-Z]/', 'message' => 'Password must contain at least one uppercase letter.'],
        ['regex' => '/[0-9]/', 'message' => 'Password must contain at least one number.'],
    ];

    foreach ($rules as $rule) {
        if (!preg_match($rule['regex'], $newPassword)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'field' => 'new_password',
                'message' => $rule['message']
            ]);
            exit;
        }
    }
}

if ($newUsername !== $currentSessionUsername) {
    $check = $mysqli->prepare("SELECT id FROM registrations WHERE username = ? AND username <> ? LIMIT 1");
    if (!$check) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to prepare username check.'
        ]);
        exit;
    }

    $check->bind_param("ss", $newUsername, $currentSessionUsername);
    $check->execute();
    $checkResult = $check->get_result();
    $existingUser = $checkResult->fetch_assoc();
    $check->close();

    if ($existingUser) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'field' => 'username',
            'message' => 'Username already taken.'
        ]);
        exit;
    }
}

$finalPassword = $storedPassword;
if ($newPassword !== '') {
    $needsHashUpdate = !password_verify($existingPassword, $storedPassword);
    $finalPassword = $needsHashUpdate ? password_hash($newPassword, PASSWORD_DEFAULT) : password_hash($newPassword, PASSWORD_DEFAULT);
}

$update = $mysqli->prepare("UPDATE registrations SET username = ?, password = ? WHERE username = ?");
if (!$update) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to prepare account update.'
    ]);
    exit;
}

$mysqli->begin_transaction();

$update->bind_param("sss", $newUsername, $finalPassword, $currentSessionUsername);

if (!$update->execute()) {
    $update->close();
    $mysqli->rollback();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update account.'
    ]);
    exit;
}

$update->close();

syncOffertoryNames($mysqli, (int) $user['id'], $newUsername);

$mysqli->commit();
$mysqli->close();

$_SESSION['username'] = $newUsername;

echo json_encode([
    'success' => true,
    'message' => 'Username or password updated successfully.',
    'username' => $newUsername
]);
exit;
