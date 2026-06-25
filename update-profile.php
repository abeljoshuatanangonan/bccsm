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

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $mysqli = new mysqli("localhost", "root", "", "BCC_RegistrationForm");
    $mysqli->set_charset("utf8mb4");

    function val(string $key): string
    {
        return isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    }

    $currentUsername     = $_SESSION['username'];
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

    $required = [
        'surname' => $surname,
        'first_name' => $first_name,
        'gender' => $gender,
        'marital_status' => $marital_status,
        'bcc_branch' => $bcc_branch,
        'group' => $group,
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
            'message' => 'Missing required fields: ' . implode(', ', $missing)
        ]);
        exit;
    }

    $mysqli->begin_transaction();

    $currentUserStmt = $mysqli->prepare("
        SELECT id, spouse_id
        FROM registrations
        WHERE username = ?
        LIMIT 1
    ");
    $currentUserStmt->bind_param("s", $currentUsername);
    $currentUserStmt->execute();
    $currentUserResult = $currentUserStmt->get_result();
    $currentUser = $currentUserResult->fetch_assoc();
    $currentUserStmt->close();

    if (!$currentUser) {
        throw new RuntimeException('Current user not found');
    }

    $currentUserId = (int) $currentUser['id'];
    $oldSpouseId = isset($currentUser['spouse_id']) ? (int) $currentUser['spouse_id'] : 0;
    $newSpouseId = null;

    if ($marital_status === 'Married' && $spouseIdRaw !== '') {
        if (!ctype_digit($spouseIdRaw)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid spouse selection'
            ]);
            exit;
        }

        $newSpouseId = (int) $spouseIdRaw;

        if ($newSpouseId === $currentUserId) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'You cannot select your own account as spouse'
            ]);
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
                'message' => 'Please select a valid married username from the dropdown'
            ]);
            exit;
        }

        $selectedSpouseCurrentSpouseId = isset($selectedSpouse['spouse_id']) ? (int) $selectedSpouse['spouse_id'] : 0;

        if ($selectedSpouseCurrentSpouseId !== 0 && $selectedSpouseCurrentSpouseId !== $currentUserId) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Selected spouse is already paired with another account'
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
        $clearOldSpouseStmt->bind_param("ii", $oldSpouseId, $currentUserId);
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
        $clearSelectedSpouseOldPairStmt->bind_param("ii", $newSpouseId, $currentUserId);
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
            baptism_location = ?
        WHERE username = ?
    ";

    $stmt = $mysqli->prepare($sql);
    $stmt->bind_param(
        "ssssssssssssisssssssss",
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
        $currentUsername
    );
    $stmt->execute();
    $stmt->close();

    if ($newSpouseId !== null) {
        $setReciprocalStmt = $mysqli->prepare("
            UPDATE registrations
            SET spouse_id = ?
            WHERE id = ?
        ");
        $setReciprocalStmt->bind_param("ii", $currentUserId, $newSpouseId);
        $setReciprocalStmt->execute();
        $setReciprocalStmt->close();
    }

    if ($newSpouseId === null) {
        $clearReciprocalStmt = $mysqli->prepare("
            UPDATE registrations
            SET spouse_id = NULL
            WHERE spouse_id = ?
        ");
        $clearReciprocalStmt->bind_param("i", $currentUserId);
        $clearReciprocalStmt->execute();
        $clearReciprocalStmt->close();
    }

    $mysqli->commit();

    $fetchStmt = $mysqli->prepare("
        SELECT r.*, s.username AS spouse_username
        FROM registrations r
        LEFT JOIN registrations s ON s.id = r.spouse_id
        WHERE r.username = ?
        LIMIT 1
    ");
    $fetchStmt->bind_param("s", $currentUsername);
    $fetchStmt->execute();
    $result = $fetchStmt->get_result();
    $user = $result->fetch_assoc();
    $fetchStmt->close();

    $mysqli->close();

    echo json_encode([
        'success' => true,
        'message' => 'Profile updated successfully',
        'user' => $user
    ]);
    exit;
} catch (Throwable $e) {
    if (isset($mysqli) && $mysqli instanceof mysqli && $mysqli->ping()) {
        try {
            $mysqli->rollback();
        } catch (Throwable $rollbackError) {
        }
        $mysqli->close();
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update profile',
        'error' => $e->getMessage()
    ]);
    exit;
}
