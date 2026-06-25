<?php

declare(strict_types=1);

require_once __DIR__ . '/../db/db.php';

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('Asia/Manila');

/** @var mysqli|null $conn */
$conn = $conn ?? null;

try {
    if (!$conn instanceof mysqli) {
        throw new Exception('Database connection not available.');
    }

    $month = isset($_GET['month']) ? (string) $_GET['month'] : date('m');
    $year  = isset($_GET['year']) ? (string) $_GET['year'] : date('Y');

    $monthNum = (int) $month;
    $yearNum = (int) $year;

    if ($monthNum < 1 || $monthNum > 12) {
        throw new Exception('Invalid month.');
    }

    if ($yearNum < 2000 || $yearNum > 2100) {
        throw new Exception('Invalid year.');
    }

    $start_date = date('Y-m-01', strtotime(sprintf('%04d-%02d-01', $yearNum, $monthNum)));
    $end_date = date('Y-m-t', strtotime($start_date));

    $offSql = "
        SELECT 
            COALESCE(SUM(o.tithes), 0) AS tithes,
            COALESCE(SUM(o.offering), 0) AS offering,
            COALESCE(SUM(o.pledge), 0) AS pledge,
            COALESCE(SUM(o.eskwela_suporta), 0) AS eskwela_suporta,
            COALESCE(SUM(o.others), 0) AS others,
            COALESCE(SUM(o.construction), 0) AS construction,
            COALESCE(SUM(o.samarleyte_pledge), 0) AS samarleyte_pledge,
            COALESCE(SUM(o.total), 0) AS total
        FROM offertory o
        WHERE DATE(o.created_at) BETWEEN ? AND ?
    ";

    $offStmt = $conn->prepare($offSql);

    $off = [
        'tithes' => 0.0,
        'offering' => 0.0,
        'pledge' => 0.0,
        'eskwela_suporta' => 0.0,
        'others' => 0.0,
        'construction' => 0.0,
        'samarleyte_pledge' => 0.0,
        'total' => 0.0,
    ];

    if ($offStmt) {
        $offStmt->bind_param('ss', $start_date, $end_date);

        if ($offStmt->execute()) {
            $res = $offStmt->get_result();
            $r = $res ? $res->fetch_assoc() : null;

            if ($r) {
                foreach ($off as $k => $_) {
                    $off[$k] = (float) ($r[$k] ?? 0);
                }
            }
        }

        $offStmt->close();
    }

    $aoSql = "
        SELECT
            COALESCE(SUM(a.tithes), 0) AS tithes,
            COALESCE(SUM(a.offering), 0) AS offering,
            COALESCE(SUM(a.pledge), 0) AS pledge,
            COALESCE(SUM(a.es), 0) AS eskwela_suporta,
            COALESCE(SUM(a.others), 0) AS others,
            COALESCE(SUM(a.construction), 0) AS construction,
            COALESCE(SUM(a.samar_leyte), 0) AS samarleyte_pledge
        FROM offertory_add_offering a
        WHERE a.date BETWEEN ? AND ?
    ";

    $aoStmt = $conn->prepare($aoSql);

    $ao = [
        'tithes' => 0.0,
        'offering' => 0.0,
        'pledge' => 0.0,
        'eskwela_suporta' => 0.0,
        'others' => 0.0,
        'construction' => 0.0,
        'samarleyte_pledge' => 0.0,
    ];

    if ($aoStmt) {
        $aoStmt->bind_param('ss', $start_date, $end_date);

        if ($aoStmt->execute()) {
            $res = $aoStmt->get_result();
            $r = $res ? $res->fetch_assoc() : null;

            if ($r) {
                foreach ($ao as $k => $_) {
                    $ao[$k] = (float) ($r[$k] ?? 0);
                }
            }
        }

        $aoStmt->close();
    }

    $totals = [
        'tithes' => $off['tithes'] + $ao['tithes'],
        'offering' => $off['offering'] + $ao['offering'],
        'pledge' => $off['pledge'] + $ao['pledge'],
        'eskwela_suporta' => $off['eskwela_suporta'] + $ao['eskwela_suporta'],
        'others' => $off['others'] + $ao['others'],
        'construction' => $off['construction'] + $ao['construction'],
        'samarleyte_pledge' => $off['samarleyte_pledge'] + $ao['samarleyte_pledge'],
    ];

    $totals['total'] =
        $totals['tithes'] +
        $totals['offering'] +
        $totals['pledge'] +
        $totals['eskwela_suporta'] +
        $totals['others'] +
        $totals['construction'] +
        $totals['samarleyte_pledge'];

    $totals['last_updated'] = date('Y-m-d H:i:s');
    $month_label = date('F Y', strtotime($start_date));

    echo json_encode([
        'success' => true,
        'month_label' => $month_label,
        'totals' => $totals,
    ]);

    $conn->close();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}
