<?php
header('Content-Type: application/json; charset=utf-8');

require '../db/db.php';

date_default_timezone_set('Asia/Manila');

try {
    if (!isset($_GET['username'])) {
        echo json_encode(['success' => false, 'message' => 'Missing username']);
        exit;
    }

    $username = trim((string) $_GET['username']);
    if ($username === '') {
        echo json_encode(['success' => false, 'message' => 'Empty username']);
        exit;
    }

    $dbConn = null;
    if (isset($mysqli) && $mysqli instanceof mysqli) {
        $dbConn = $mysqli;
    } elseif (isset($conn) && $conn instanceof mysqli) {
        $dbConn = $conn;
    }

    if (!$dbConn) {
        echo json_encode(['success' => false, 'message' => 'Database connection not available']);
        exit;
    }

    $memberStmt = $dbConn->prepare("
        SELECT id, username
        FROM registrations
        WHERE username = ?
        LIMIT 1
    ");
    if (!$memberStmt) {
        echo json_encode(['success' => false, 'message' => 'Prepare failed (member lookup): ' . $dbConn->error]);
        exit;
    }

    $memberStmt->bind_param("s", $username);
    $memberStmt->execute();
    $memberRes = $memberStmt->get_result();
    $member = $memberRes->fetch_assoc();
    $memberStmt->close();

    if (!$member) {
        echo json_encode(['success' => false, 'message' => 'Member not found']);
        exit;
    }

    $memberId = (int) $member['id'];

    $sql = "
        SELECT DATE(o.created_at) AS date
        FROM offertory o
        WHERE
            (
                (o.username = ? AND o.username IS NOT NULL AND o.username <> '')
                OR
                (o.is_couple_shared = 1 AND (o.couple_primary_user_id = ? OR o.couple_secondary_user_id = ?))
            )
        GROUP BY DATE(o.created_at)
        ORDER BY DATE(o.created_at) ASC
    ";

    $stmt = $dbConn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $dbConn->error]);
        exit;
    }

    $stmt->bind_param("sii", $username, $memberId, $memberId);
    $stmt->execute();
    $res = $stmt->get_result();

    $dates = [];
    while ($row = $res->fetch_assoc()) {
        if (!empty($row['date'])) {
            $dates[] = $row['date'];
        }
    }
    $stmt->close();

    echo json_encode([
        'success' => true,
        'dates' => $dates
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
