<?php
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

require_once __DIR__ . '/includes/csrf.php';
csrf_require_or_fail();

require 'db/db.php';

date_default_timezone_set('Asia/Manila');
header('Content-Type: application/json; charset=utf-8');

function money2($v)
{
    $n = (float) $v;
    if (!is_finite($n) || $n < 0) $n = 0;
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

    return trim((string) $first['username']) . ' & ' . trim((string) $second['username']);
}

function normalizeOffertoryMode(?string $value): string
{
    $mode = trim((string) $value);
    return in_array($mode, ['Cash', 'Bank'], true) ? $mode : '';
}

function saveBankProofImage(array $file): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new Exception("Failed to upload bank proof image.");
    }

    $originalName = (string) ($file['name'] ?? '');
    $tmpPath = (string) ($file['tmp_name'] ?? '');

    if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
        throw new Exception("Invalid uploaded bank proof image.");
    }

    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'heif', 'heic', 'webp', 'tif', 'tiff'];

    if (!in_array($extension, $allowedExtensions, true)) {
        throw new Exception("Invalid bank proof image format.");
    }

    $uploadDir = __DIR__ . '/uploads/offertory-bank-proofs';
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true)) {
        throw new Exception("Failed to prepare bank proof upload directory.");
    }

    $safeName = uniqid('bank_proof_', true) . '.' . $extension;
    $destination = $uploadDir . '/' . $safeName;

    if (!move_uploaded_file($tmpPath, $destination)) {
        throw new Exception("Failed to save bank proof image.");
    }

    return 'uploads/offertory-bank-proofs/' . $safeName;
}

try {
    $force_visitor = isset($_POST['force_visitor']) && $_POST['force_visitor'] === '1';
    $posted_user_id = isset($_POST['user_id']) ? (int) $_POST['user_id'] : 0;

    $user_id = null;
    $username = 'visitor';
    $visitor_name = null;

    $isCoupleShared = 0;
    $couplePrimaryUserId = null;
    $coupleSecondaryUserId = null;
    $displayName = null;

    $shareAsCouple = isset($_POST['share_as_couple']) && $_POST['share_as_couple'] === '1';
    $postedSpouseId = isset($_POST['spouse_id']) ? (int) $_POST['spouse_id'] : 0;

    $currentUserRow = null;

    if ($force_visitor) {
        $visitor_name = isset($_POST['visitor_name']) ? trim($_POST['visitor_name']) : null;
        if ($visitor_name === '') $visitor_name = null;
    } elseif ($posted_user_id > 0) {
        $stmt_user = $conn->prepare("
            SELECT id, username, gender, spouse_id
            FROM registrations
            WHERE id = ? AND status = 'approved'
            LIMIT 1
        ");
        $stmt_user->bind_param("i", $posted_user_id);
        $stmt_user->execute();
        $res = $stmt_user->get_result();
        if ($row = $res->fetch_assoc()) {
            $currentUserRow = $row;
            $user_id = (int) $row['id'];
            $username = $row['username'];
        }
        $stmt_user->close();
    } elseif (isset($_SESSION['user_id'])) {
        $sid = (int) $_SESSION['user_id'];
        $stmt_user = $conn->prepare("
            SELECT id, username, gender, spouse_id
            FROM registrations
            WHERE id = ?
            LIMIT 1
        ");
        $stmt_user->bind_param("i", $sid);
        $stmt_user->execute();
        $res = $stmt_user->get_result();
        if ($row = $res->fetch_assoc()) {
            $currentUserRow = $row;
            $user_id = (int) $row['id'];
            $username = $row['username'];
        }
        $stmt_user->close();
    }

    $tithes            = money2($_POST['tithes'] ?? 0);
    $offering          = money2($_POST['offering'] ?? 0);
    $pledge            = money2($_POST['pledge'] ?? 0);
    $eskwela_suporta   = money2($_POST['eskwela_suporta'] ?? 0);
    $others            = money2($_POST['others'] ?? 0);
    $other_use         = isset($_POST['other_use']) ? trim($_POST['other_use']) : '';
    $construction      = money2($_POST['construction'] ?? 0);
    $samarleyte_pledge = money2($_POST['samarleyte_pledge'] ?? 0);
    $mode_of_offertory = normalizeOffertoryMode($_POST['mode_of_offertory'] ?? '');
    $bank_proof_image  = null;

    $total = round(
        $tithes + $offering + $pledge + $eskwela_suporta + $others + $construction + $samarleyte_pledge,
        2
    );

    if (mb_strlen($other_use) > 255) {
        $other_use = mb_substr($other_use, 0, 255);
    }

    if ($mode_of_offertory === '') {
        throw new Exception("Please select a valid mode of offertory.");
    }

    if ($mode_of_offertory === 'Bank') {
        if (!isset($_FILES['bank_proof_image']) || ($_FILES['bank_proof_image']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            throw new Exception("Bank proof image is required when mode of offertory is Bank.");
        }

        $bank_proof_image = saveBankProofImage($_FILES['bank_proof_image']);
    }

    if (($tithes + $offering + $pledge + $eskwela_suporta + $others + $construction + $samarleyte_pledge) <= 0) {
        throw new Exception("Please enter at least one amount greater than zero.");
    }

    if ($shareAsCouple) {
        if ($force_visitor || !$currentUserRow || !$user_id) {
            throw new Exception("Only logged-in members with a registered spouse can share offertory as a couple.");
        }

        $actualSpouseId = isset($currentUserRow['spouse_id']) ? (int) $currentUserRow['spouse_id'] : 0;

        if ($actualSpouseId <= 0 || $postedSpouseId <= 0 || $actualSpouseId !== $postedSpouseId) {
            throw new Exception("Invalid spouse selection for couple offertory.");
        }

        $stmt_spouse = $conn->prepare("
            SELECT id, username, gender, spouse_id
            FROM registrations
            WHERE id = ?
            LIMIT 1
        ");
        $stmt_spouse->bind_param("i", $postedSpouseId);
        $stmt_spouse->execute();
        $spouseRes = $stmt_spouse->get_result();
        $spouseRow = $spouseRes->fetch_assoc();
        $stmt_spouse->close();

        if (!$spouseRow) {
            throw new Exception("Registered spouse not found.");
        }

        if ((int) ($spouseRow['spouse_id'] ?? 0) !== $user_id) {
            throw new Exception("Spouse relationship is not properly paired in the database.");
        }

        $isCoupleShared = 1;
        $couplePrimaryUserId = $user_id;
        $coupleSecondaryUserId = (int) $spouseRow['id'];
        $displayName = buildCoupleDisplayName($currentUserRow, $spouseRow);
    }

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
        tithes,
        offering,
        pledge,
        eskwela_suporta,
        others,
        other_use,
        construction,
        samarleyte_pledge,
        mode_of_offertory,
        bank_proof_image,
        total
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->bind_param(
        "issiiisdddddsddssd",
        $user_id,
        $username,
        $visitor_name,
        $isCoupleShared,
        $couplePrimaryUserId,
        $coupleSecondaryUserId,
        $displayName,
        $tithes,
        $offering,
        $pledge,
        $eskwela_suporta,
        $others,
        $other_use,
        $construction,
        $samarleyte_pledge,
        $mode_of_offertory,
        $bank_proof_image,
        $total
    );

    if (!$stmt->execute()) {
        throw new Exception("Failed to save offertory.");
    }
    $stmt->close();

    $currentDate = isset($_POST['date']) ? $_POST['date'] : date('Y-m-d');
    $sql_daily = "
        INSERT INTO offertory_daily_totals
          (date, dailyTithes_total, dailyOffering_total, dailyPledge_total, dailyEskwelaSuporta_total,
           dailyOthers_total, dailyConstruction_total, dailySamarLeyte_total, dailyOverall_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          dailyTithes_total = dailyTithes_total + VALUES(dailyTithes_total),
          dailyOffering_total = dailyOffering_total + VALUES(dailyOffering_total),
          dailyPledge_total = dailyPledge_total + VALUES(dailyPledge_total),
          dailyEskwelaSuporta_total = dailyEskwelaSuporta_total + VALUES(dailyEskwelaSuporta_total),
          dailyOthers_total = dailyOthers_total + VALUES(dailyOthers_total),
          dailyConstruction_total = dailyConstruction_total + VALUES(dailyConstruction_total),
          dailySamarLeyte_total = dailySamarLeyte_total + VALUES(dailySamarLeyte_total),
          dailyOverall_total = dailyOverall_total + VALUES(dailyOverall_total),
          last_updated = CURRENT_TIMESTAMP
    ";

    $stmt_daily = $conn->prepare($sql_daily);
    $stmt_daily->bind_param(
        "sdddddddd",
        $currentDate,
        $tithes,
        $offering,
        $pledge,
        $eskwela_suporta,
        $others,
        $construction,
        $samarleyte_pledge,
        $total
    );
    $stmt_daily->execute();
    $stmt_daily->close();

    echo json_encode([
        "success" => true,
        "message" => "Offertory saved successfully"
    ]);
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
