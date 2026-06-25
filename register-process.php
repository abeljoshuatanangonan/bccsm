<?php

declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo "Invalid request method.";
    exit;
}

require_once __DIR__ . '/db/db.php'; // provides $mysqli (and $conn alias)

/** @var mysqli $mysqli */
if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
    http_response_code(500);
    echo "Database not initialized.";
    exit;
}

function val(string $k): string
{
    return isset($_POST[$k]) ? trim((string)$_POST[$k]) : '';
}

$surname             = val('surname');
$first_name          = val('first_name');
$middle_name         = val('middle_name');
$suffix              = val('suffix');
$gender              = val('gender');
$contact             = val('contact');
$email               = val('email');
$birthday            = val('birthday');
$home_address        = val('home_address');
$residential_address = val('residential_address');
$marital_status      = val('marital_status');
$wedding_date        = val('wedding_date');
$children            = val('children');
$emergency_contact   = val('emergency_contact');
$emergency_mobile    = val('emergency_mobile');
$bcc_branch          = val('bcc_branch');
$group               = val('group');

/* Now optional */
$membership_date     = val('membership_date');
$baptism_date        = val('baptism_date');
$baptism_location    = val('baptism_location');

$username            = val('username');
$password            = val('password');

/* membership_date removed from required */
$required = [
    'surname',
    'first_name',
    'gender',
    'marital_status',
    'bcc_branch',
    'username',
    'password',
];

$map = [
    'surname' => $surname,
    'first_name' => $first_name,
    'middle_name' => $middle_name,
    'suffix' => $suffix,
    'gender' => $gender,
    'contact' => $contact,
    'email' => $email,
    'birthday' => $birthday,
    'home_address' => $home_address,
    'residential_address' => $residential_address,
    'marital_status' => $marital_status,
    'wedding_date' => $wedding_date,
    'children' => $children,
    'emergency_contact' => $emergency_contact,
    'emergency_mobile' => $emergency_mobile,
    'bcc_branch' => $bcc_branch,
    'group' => $group,
    'membership_date' => $membership_date,
    'baptism_date' => $baptism_date,
    'baptism_location' => $baptism_location,
    'username' => $username,
    'password' => $password,
];

$missing = [];
foreach ($required as $r) {
    if (!isset($map[$r]) || $map[$r] === '') {
        $missing[] = $r;
    }
}

/* Baptism is optional for ALL groups now (no conditional requirement). */

if (!empty($missing)) {
    http_response_code(400);
    echo "Missing required fields: " . implode(', ', $missing);
    exit;
}

$checkStmt = $mysqli->prepare("SELECT id FROM registrations WHERE username = ?");
if (!$checkStmt) {
    http_response_code(500);
    echo "DB prepare error (check username).";
    exit;
}

$checkStmt->bind_param("s", $username);
$checkStmt->execute();
$checkStmt->store_result();

if ($checkStmt->num_rows > 0) {
    http_response_code(409);
    echo "Username already taken.";
    $checkStmt->close();
    exit;
}
$checkStmt->close();

$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

/* membership_date now NULLIF too */
$sql = "
    INSERT INTO registrations (
        surname, first_name, middle_name, suffix, gender, contact, email, birthday,
        home_address, residential_address, marital_status, wedding_date, children,
        emergency_contact, emergency_mobile, bcc_branch, `group`,
        membership_date, baptism_date, baptism_location,
        username, password, role, status, created_at
    ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?, ?, ?, NULLIF(?, ''), ?, ?, ?, ?, ?,
    NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''),
    ?, ?, 'member', 'pending', NOW()
    )
";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    http_response_code(500);
    echo "DB prepare error (insert): " . $mysqli->error;
    exit;
}

$stmt->bind_param(
    "ssssssssssssssssssssss",
    $surname,
    $first_name,
    $middle_name,
    $suffix,
    $gender,
    $contact,
    $email,
    $birthday,
    $home_address,
    $residential_address,
    $marital_status,
    $wedding_date,
    $children,
    $emergency_contact,
    $emergency_mobile,
    $bcc_branch,
    $group,
    $membership_date,
    $baptism_date,
    $baptism_location,
    $username,
    $hashedPassword
);

if ($stmt->execute()) {
    echo "success";
} else {
    http_response_code(500);
    echo "Error saving data: " . $stmt->error;
}

$stmt->close();
exit;
