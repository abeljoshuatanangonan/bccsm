<?php

declare(strict_types=1);

session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'Method Not Allowed',
    ]);
    exit;
}

require_once __DIR__ . '/../includes/csrf.php';
csrf_require_or_fail();

require_once __DIR__ . '/../db/db.php';

date_default_timezone_set('Asia/Manila');
header('Content-Type: application/json; charset=utf-8');

/** @var mysqli|null $conn */
$conn = $conn ?? null;

function money2($v): float
{
    $n = (float) $v;
    if (!is_finite($n) || $n < 0) {
        $n = 0;
    }
    return round($n, 2);
}

function buildCoupleDisplayName(array $primaryUser, array $spouseUser): string
{
    $first = $primaryUser;
    $second = $spouseUser;

    if (($primaryUser['gender'] ?? '') === 'Female' && ($spouseUser['gender'] ?? '') === 'Male') {
        $first = $spouseUser;
        $second = $primaryUser;
    }

    return trim((string) ($first['username'] ?? '')) . ' & ' . trim((string) ($second['username'] ?? ''));
}

try {
    if (!$conn instanceof mysqli) {
        throw new Exception('Database connection not available.');
    }

    $posted_user_id = isset($_POST['user_id']) ? (int) $_POST['user_id'] : 0;
    $visitor_name = isset($_POST['visitor_name']) ? trim((string) $_POST['visitor_name']) : null;
    $force_visitor = isset($_POST['force_visitor']) && $_POST['force_visitor'] === '1';

    $receiptType = strtolower(trim((string) ($_POST['receipt_type'] ?? 'single')));
    if (!in_array($receiptType, ['single', 'couple'], true)) {
        $receiptType = 'single';
    }

    $selectedSpouseId = isset($_POST['spouse_id']) ? (int) $_POST['spouse_id'] : 0;

    $user_id = null;
    $username = 'visitor';

    $isCoupleShared = 0;
    $couplePrimaryUserId = null;
    $coupleSecondaryUserId = null;
    $displayName = null;

    $currentUserRow = null;

    if ($force_visitor) {
        if ($visitor_name === '') {
            $visitor_name = null;
        }
    } elseif ($posted_user_id > 0) {
        $stmt_user = $conn->prepare("
            SELECT id, username, gender, spouse_id, role, status
            FROM registrations
            WHERE id = ? AND status = 'approved'
            LIMIT 1
        ");
        if (!$stmt_user) {
            throw new Exception('Prepare failed.');
        }

        $stmt_user->bind_param('i', $posted_user_id);
        $stmt_user->execute();
        $res = $stmt_user->get_result();

        $row = $res ? $res->fetch_assoc() : null;
        if ($row) {
            $currentUserRow = $row;
            $user_id = (int) ($row['id'] ?? 0);
            $username = (string) ($row['username'] ?? 'visitor');
        }

        $stmt_user->close();
    } elseif (isset($_SESSION['user_id'])) {
        $sid = (int) $_SESSION['user_id'];

        $stmt_user = $conn->prepare("
            SELECT id, username, gender, spouse_id, role, status
            FROM registrations
            WHERE id = ?
            LIMIT 1
        ");
        if (!$stmt_user) {
            throw new Exception('Prepare failed.');
        }

        $stmt_user->bind_param('i', $sid);
        $stmt_user->execute();
        $res = $stmt_user->get_result();

        $row = $res ? $res->fetch_assoc() : null;
        if ($row) {
            $currentUserRow = $row;
            $user_id = (int) ($row['id'] ?? 0);
            $username = (string) ($row['username'] ?? 'visitor');
        }

        $stmt_user->close();
    }

    $tithes = money2($_POST['tithes'] ?? 0);
    $offering = money2($_POST['offering'] ?? 0);
    $pledge = money2($_POST['pledge'] ?? 0);
    $eskwela_suporta = money2($_POST['eskwela_suporta'] ?? 0);
    $others = money2($_POST['others'] ?? 0);
    $construction = money2($_POST['construction'] ?? 0);
    $samarleyte_pledge = money2($_POST['samarleyte_pledge'] ?? 0);

    $total = round(
        $tithes + $offering + $pledge + $eskwela_suporta + $others + $construction + $samarleyte_pledge,
        2
    );

    $mode_of_offertory = trim((string) ($_POST['mode_of_offertory'] ?? 'Cash'));
    if (!in_array($mode_of_offertory, ['Cash', 'Bank'], true)) {
        $mode_of_offertory = 'Cash';
    }

    $other_use = isset($_POST['other_use']) ? trim((string) $_POST['other_use']) : '';

    if (mb_strlen($other_use) > 255) {
        $other_use = mb_substr($other_use, 0, 255);
    }

    if (($tithes + $offering + $pledge + $eskwela_suporta + $others + $construction + $samarleyte_pledge) <= 0) {
        throw new Exception('Please enter at least one amount greater than zero.');
    }

    $currentDate = isset($_POST['date']) ? (string) $_POST['date'] : date('Y-m-d');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $currentDate)) {
        throw new Exception('Invalid date.');
    }

    if ($receiptType === 'couple') {
        if ($force_visitor || !$currentUserRow || !$user_id) {
            throw new Exception('Couple receipt requires a valid registered account.');
        }

        $actualSpouseId = isset($currentUserRow['spouse_id']) ? (int) $currentUserRow['spouse_id'] : 0;

        if ($actualSpouseId <= 0 || $selectedSpouseId <= 0 || $actualSpouseId !== $selectedSpouseId) {
            throw new Exception('Invalid registered spouse for couple receipt.');
        }

        $stmt_spouse = $conn->prepare("
            SELECT id, username, gender, spouse_id, status
            FROM registrations
            WHERE id = ?
            LIMIT 1
        ");
        if (!$stmt_spouse) {
            throw new Exception('Prepare failed.');
        }

        $stmt_spouse->bind_param('i', $selectedSpouseId);
        $stmt_spouse->execute();
        $spouseRes = $stmt_spouse->get_result();
        $spouseRow = $spouseRes ? $spouseRes->fetch_assoc() : null;
        $stmt_spouse->close();

        if (!$spouseRow || ($spouseRow['status'] ?? '') !== 'approved') {
            throw new Exception('Registered spouse not found.');
        }

        if ((int) ($spouseRow['spouse_id'] ?? 0) !== $user_id) {
            throw new Exception('Spouse relationship is not properly paired in the database.');
        }

        $isCoupleShared = 1;
        $couplePrimaryUserId = $user_id;
        $coupleSecondaryUserId = (int) ($spouseRow['id'] ?? 0);
        $displayName = buildCoupleDisplayName($currentUserRow, $spouseRow);
    }

    $createdAt = $currentDate . ' ' . date('H:i:s');

    $stmt = $conn->prepare("
        INSERT INTO offertory
        (
            user_id,
            username,
            visitor_name,
            is_couple_shared,
            couple_primary_user_id,
            couple_secondary_user_id,
            display_name,
            mode_of_offertory,
            tithes,
            offering,
            pledge,
            eskwela_suporta,
            others,
            other_use,
            construction,
            samarleyte_pledge,
            total,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    if (!$stmt) {
        throw new Exception('Prepare failed.');
    }

    $stmt->bind_param(
        "issiiissdddddsddds",
        $user_id,
        $username,
        $visitor_name,
        $isCoupleShared,
        $couplePrimaryUserId,
        $coupleSecondaryUserId,
        $displayName,
        $mode_of_offertory,
        $tithes,
        $offering,
        $pledge,
        $eskwela_suporta,
        $others,
        $other_use,
        $construction,
        $samarleyte_pledge,
        $total,
        $createdAt
    );

    if (!$stmt->execute()) {
        throw new Exception('Failed to save offertory.');
    }

    $stmt->close();

    echo json_encode([
        'success' => true,
        'message' => 'Offertory saved successfully',
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
} finally {
    if ($conn instanceof mysqli) {
        $conn->close();
    }
}
