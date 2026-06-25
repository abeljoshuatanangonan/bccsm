<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../admin-authorization.php';
require_once __DIR__ . '/../includes/csrf.php';

csrf_require_or_fail();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

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

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid member ID']);
    exit;
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
$spouseIdRaw         = val('spouse_id');
$children            = val('children');
$emergency_contact   = val('emergency_contact');
$emergency_mobile    = val('emergency_mobile');
$bcc_branch          = val('bcc_branch');
$group               = val('group');
$membership_date     = val('membership_date');
$baptism_date        = val('baptism_date');
$baptism_location    = val('baptism_location');
$username            = val('username');
$role                = val('role');
$status              = val('status');

$required = [
    'surname' => $surname,
    'first_name' => $first_name,
    'gender' => $gender,
    'marital_status' => $marital_status,
    'bcc_branch' => $bcc_branch,
    'username' => $username,
    'role' => $role,
    'status' => $status,
];

$missing = [];
foreach ($required as $field => $value) {
    if ($value === '') {
        $missing[] = $field;
    }
}

if ($missing) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Missing required fields: ' . implode(', ', $missing),
    ]);
    exit;
}

try {
    $mysqli->begin_transaction();

    $currentStmt = $mysqli->prepare("
        SELECT id, spouse_id
        FROM registrations
        WHERE id = ?
        LIMIT 1
    ");
    $currentStmt->bind_param("i", $id);
    $currentStmt->execute();
    $currentResult = $currentStmt->get_result();
    $currentMember = $currentResult->fetch_assoc();
    $currentStmt->close();

    if (!$currentMember) {
        throw new RuntimeException('Member not found');
    }

    $checkStmt = $mysqli->prepare("SELECT id FROM registrations WHERE username = ? AND id <> ?");
    $checkStmt->bind_param("si", $username, $id);
    $checkStmt->execute();
    $checkStmt->store_result();

    if ($checkStmt->num_rows > 0) {
        $checkStmt->close();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Username already taken']);
        exit;
    }
    $checkStmt->close();

    $oldSpouseId = isset($currentMember['spouse_id']) ? (int) $currentMember['spouse_id'] : 0;
    $newSpouseId = null;

    if ($marital_status === 'Married' && $spouseIdRaw !== '') {
        if (!ctype_digit($spouseIdRaw)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid spouse selection']);
            exit;
        }

        $newSpouseId = (int) $spouseIdRaw;

        if ($newSpouseId === $id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'A member cannot be their own spouse']);
            exit;
        }

        $spouseStmt = $mysqli->prepare("
            SELECT id, spouse_id, marital_status
            FROM registrations
            WHERE id = ?
            LIMIT 1
        ");
        $spouseStmt->bind_param("i", $newSpouseId);
        $spouseStmt->execute();
        $spouseResult = $spouseStmt->get_result();
        $selectedSpouse = $spouseResult->fetch_assoc();
        $spouseStmt->close();

        if (!$selectedSpouse || $selectedSpouse['marital_status'] !== 'Married') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Please select a valid married username from the dropdown',
            ]);
            exit;
        }

        $selectedSpouseCurrentSpouseId = isset($selectedSpouse['spouse_id']) ? (int) $selectedSpouse['spouse_id'] : 0;

        if ($selectedSpouseCurrentSpouseId !== 0 && $selectedSpouseCurrentSpouseId !== $id) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Selected spouse is already paired with another account',
            ]);
            exit;
        }
    }

    if ($marital_status !== 'Married') {
        $newSpouseId = null;
    }

    if ($oldSpouseId > 0 && $oldSpouseId !== (int) $newSpouseId) {
        $clearOldSpouseStmt = $mysqli->prepare("
            UPDATE registrations
            SET spouse_id = NULL
            WHERE id = ?
              AND spouse_id = ?
        ");
        $clearOldSpouseStmt->bind_param("ii", $oldSpouseId, $id);
        $clearOldSpouseStmt->execute();
        $clearOldSpouseStmt->close();
    }

    if ($newSpouseId !== null) {
        $clearSelectedSpouseOldPairStmt = $mysqli->prepare("
            UPDATE registrations
            SET spouse_id = NULL
            WHERE spouse_id = ?
              AND id <> ?
        ");
        $clearSelectedSpouseOldPairStmt->bind_param("ii", $newSpouseId, $id);
        $clearSelectedSpouseOldPairStmt->execute();
        $clearSelectedSpouseOldPairStmt->close();
    }

    $sql = "
        UPDATE registrations
        SET
            surname = ?,
            first_name = ?,
            middle_name = ?,
            suffix = ?,
            gender = ?,
            contact = ?,
            email = ?,
            birthday = NULLIF(?, ''),
            home_address = ?,
            residential_address = ?,
            marital_status = ?,
            wedding_date = NULLIF(?, ''),
            spouse_id = ?,
            children = ?,
            emergency_contact = ?,
            emergency_mobile = ?,
            bcc_branch = ?,
            `group` = ?,
            membership_date = NULLIF(?, ''),
            baptism_date = NULLIF(?, ''),
            baptism_location = ?,
            username = ?,
            role = ?,
            status = ?
        WHERE id = ?
    ";

    $stmt = $mysqli->prepare($sql);
    $stmt->bind_param(
        "ssssssssssssisssssssssssi",
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
        $newSpouseId,
        $children,
        $emergency_contact,
        $emergency_mobile,
        $bcc_branch,
        $group,
        $membership_date,
        $baptism_date,
        $baptism_location,
        $username,
        $role,
        $status,
        $id
    );
    $stmt->execute();
    $stmt->close();

    syncOffertoryNames($mysqli, $id, $username);

    if ($newSpouseId !== null) {
        $setReciprocalStmt = $mysqli->prepare("
            UPDATE registrations
            SET spouse_id = ?
            WHERE id = ?
        ");
        $setReciprocalStmt->bind_param("ii", $id, $newSpouseId);
        $setReciprocalStmt->execute();
        $setReciprocalStmt->close();
    }

    if ($newSpouseId === null) {
        $clearReciprocalStmt = $mysqli->prepare("
            UPDATE registrations
            SET spouse_id = NULL
            WHERE spouse_id = ?
        ");
        $clearReciprocalStmt->bind_param("i", $id);
        $clearReciprocalStmt->execute();
        $clearReciprocalStmt->close();
    }

    $mysqli->commit();

    $fetchStmt = $mysqli->prepare("
        SELECT r.*, s.username AS spouse_username
        FROM registrations r
        LEFT JOIN registrations s ON s.id = r.spouse_id
        WHERE r.id = ?
        LIMIT 1
    ");
    $fetchStmt->bind_param("i", $id);
    $fetchStmt->execute();
    $result = $fetchStmt->get_result();
    $member = $result->fetch_assoc();
    $fetchStmt->close();

    echo json_encode([
        'success' => true,
        'message' => 'Member updated successfully',
        'member' => $member,
    ]);
    exit;
} catch (Throwable $e) {
    try {
        $mysqli->rollback();
    } catch (Throwable $rollbackError) {
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update member',
        'error' => $e->getMessage(),
    ]);
    exit;
}
