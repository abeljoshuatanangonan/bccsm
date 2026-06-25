<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('Asia/Manila');

if (!isset($_SESSION['user_id'], $_SESSION['username'])) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
    exit;
}

require __DIR__ . '/db/db.php';

try {
    $memberId = (int) $_SESSION['user_id'];
    $username = trim((string) $_SESSION['username']);

    if ($memberId <= 0 || $username === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid session user'
        ]);
        exit;
    }

    $dbConn = null;
    if (isset($mysqli) && $mysqli instanceof mysqli) {
        $dbConn = $mysqli;
    } elseif (isset($conn) && $conn instanceof mysqli) {
        $dbConn = $conn;
    }

    if (!$dbConn) {
        throw new RuntimeException('Database connection not available');
    }

    $sqlHistory = "
        SELECT
            o.id,
            DATE(o.created_at) AS date,
            o.created_at,
            o.display_name,
            o.username,
            o.tithes,
            o.offering,
            o.pledge,
            o.eskwela_suporta,
            o.others,
            o.construction,
            o.samarleyte_pledge,
            o.total,
            o.is_couple_shared
        FROM offertory o
        WHERE
            (
                (o.username = ? AND o.username IS NOT NULL AND o.username <> '')
                OR
                (o.is_couple_shared = 1 AND (o.couple_primary_user_id = ? OR o.couple_secondary_user_id = ?))
            )
        ORDER BY o.created_at ASC, o.id ASC
    ";

    $stmtHistory = $dbConn->prepare($sqlHistory);
    if (!$stmtHistory) {
        throw new RuntimeException('Prepare failed (history): ' . $dbConn->error);
    }

    $stmtHistory->bind_param("sii", $username, $memberId, $memberId);
    $stmtHistory->execute();
    $resHistory = $stmtHistory->get_result();

    $rows = [];
    while ($r = $resHistory->fetch_assoc()) {
        $rows[] = [
            'id'                 => (int) $r['id'],
            'date'               => (string) $r['date'],
            'created_at'         => (string) $r['created_at'],
            'entry_type'         => ((int) ($r['is_couple_shared'] ?? 0) === 1) ? 'Couple' : 'Single',
            'display_name'       => (string) ($r['display_name'] ?? ''),
            'username'           => (string) ($r['username'] ?? ''),
            'tithes'             => (float) ($r['tithes'] ?? 0),
            'offering'           => (float) ($r['offering'] ?? 0),
            'pledge'             => (float) ($r['pledge'] ?? 0),
            'eskwela_suporta'    => (float) ($r['eskwela_suporta'] ?? 0),
            'others'             => (float) ($r['others'] ?? 0),
            'construction'       => (float) ($r['construction'] ?? 0),
            'samarleyte_pledge'  => (float) ($r['samarleyte_pledge'] ?? 0),
            'overall_total'      => (float) ($r['total'] ?? 0),
        ];
    }
    $stmtHistory->close();

    echo json_encode([
        'success'  => true,
        'username' => $username,
        'rows'     => $rows,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}
