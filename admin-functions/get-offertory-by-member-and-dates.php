<?php
header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../db/db.php';
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

    $date = null;
    if (isset($_GET['date'])) {
        $date = trim((string) $_GET['date']);
        if ($date === '') {
            echo json_encode(['success' => false, 'message' => 'Empty date']);
            exit;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            echo json_encode(['success' => false, 'message' => 'Invalid date format']);
            exit;
        }
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

    $extractTotals = function (array $row): array {
        $tithes       = (float) ($row['tithes'] ?? 0);
        $offering     = (float) ($row['offering'] ?? 0);
        $pledge       = (float) ($row['pledge'] ?? 0);
        $es           = (float) ($row['eskwela_suporta'] ?? 0);
        $others       = (float) ($row['others'] ?? 0);
        $construction = (float) ($row['construction'] ?? 0);
        $samar        = (float) ($row['samarleyte_pledge'] ?? 0);

        $total = $tithes + $offering + $pledge + $es + $others + $construction + $samar;

        return [
            'tithes'            => $tithes,
            'offering'          => $offering,
            'pledge'            => $pledge,
            'eskwela_suporta'   => $es,
            'others'            => $others,
            'construction'      => $construction,
            'samarleyte_pledge' => $samar,
            'overall_total'     => $total,
        ];
    };

    // DATE MODE: keep aggregated totals for the selected date
    if ($date !== null) {
        $sqlDaily = "
            SELECT
              COALESCE(SUM(o.tithes), 0)            AS tithes,
              COALESCE(SUM(o.offering), 0)          AS offering,
              COALESCE(SUM(o.pledge), 0)            AS pledge,
              COALESCE(SUM(o.eskwela_suporta), 0)   AS eskwela_suporta,
              COALESCE(SUM(o.others), 0)            AS others,
              COALESCE(SUM(o.construction), 0)      AS construction,
              COALESCE(SUM(o.samarleyte_pledge), 0) AS samarleyte_pledge
            FROM offertory o
            WHERE (
                (o.username = ? AND o.username IS NOT NULL AND o.username <> '')
                OR
                (o.is_couple_shared = 1 AND (o.couple_primary_user_id = ? OR o.couple_secondary_user_id = ?))
            )
            AND DATE(o.created_at) = ?
        ";

        $stmtDaily = $dbConn->prepare($sqlDaily);
        if (!$stmtDaily) {
            echo json_encode(['success' => false, 'message' => 'Prepare failed (daily): ' . $dbConn->error]);
            exit;
        }

        $stmtDaily->bind_param("siis", $username, $memberId, $memberId, $date);
        $stmtDaily->execute();
        $resDaily = $stmtDaily->get_result();
        $rowDaily = $resDaily->fetch_assoc() ?: [];
        $stmtDaily->close();

        $dailyTotals = $extractTotals($rowDaily);

        $sqlOverall = "
            SELECT
              COALESCE(SUM(o.tithes), 0)            AS tithes,
              COALESCE(SUM(o.offering), 0)          AS offering,
              COALESCE(SUM(o.pledge), 0)            AS pledge,
              COALESCE(SUM(o.eskwela_suporta), 0)   AS eskwela_suporta,
              COALESCE(SUM(o.others), 0)            AS others,
              COALESCE(SUM(o.construction), 0)      AS construction,
              COALESCE(SUM(o.samarleyte_pledge), 0) AS samarleyte_pledge
            FROM offertory o
            WHERE (
                (o.username = ? AND o.username IS NOT NULL AND o.username <> '')
                OR
                (o.is_couple_shared = 1 AND (o.couple_primary_user_id = ? OR o.couple_secondary_user_id = ?))
            )
            AND DATE(o.created_at) <= ?
        ";

        $stmtOverall = $dbConn->prepare($sqlOverall);
        if (!$stmtOverall) {
            echo json_encode(['success' => false, 'message' => 'Prepare failed (overall): ' . $dbConn->error]);
            exit;
        }

        $stmtOverall->bind_param("siis", $username, $memberId, $memberId, $date);
        $stmtOverall->execute();
        $resOverall = $stmtOverall->get_result();
        $rowOverall = $resOverall->fetch_assoc() ?: [];
        $stmtOverall->close();

        $overallTotals = $extractTotals($rowOverall);

        echo json_encode([
            'success'  => true,
            'username' => $username,
            'date'     => $date,
            'daily'    => $dailyTotals,
            'overall'  => $overallTotals,
        ]);
        exit;
    }

    // HISTORY MODE: return one row per actual receipt
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
        echo json_encode(['success' => false, 'message' => 'Prepare failed (history): ' . $dbConn->error]);
        exit;
    }

    $stmtHistory->bind_param("sii", $username, $memberId, $memberId);
    $stmtHistory->execute();
    $resHistory = $stmtHistory->get_result();

    $rows = [];
    while ($r = $resHistory->fetch_assoc()) {
        $rows[] = [
            'id'                 => (int) $r['id'],
            'date'               => $r['date'],
            'created_at'         => $r['created_at'],
            'entry_type'         => ((int) ($r['is_couple_shared'] ?? 0) === 1) ? 'Couple' : 'Single',
            'display_name'       => $r['display_name'] ?? '',
            'username'           => $r['username'] ?? '',
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
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
