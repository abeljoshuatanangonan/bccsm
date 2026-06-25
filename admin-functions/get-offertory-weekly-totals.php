<?php

declare(strict_types=1);

require_once __DIR__ . '/../db/db.php';

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('Asia/Manila');

/** @var mysqli|null $conn */
$conn = $conn ?? null;

$month = isset($_GET['month']) ? (string) $_GET['month'] : date('m');
$year  = isset($_GET['year']) ? (string) $_GET['year'] : date('Y');

try {
    if (!$conn instanceof mysqli) {
        throw new Exception('Database connection not available.');
    }

    $monthNum = (int) $month;
    $yearNum = (int) $year;

    if ($monthNum < 1 || $monthNum > 12) {
        throw new Exception('Invalid month.');
    }

    if ($yearNum < 2000 || $yearNum > 2100) {
        throw new Exception('Invalid year.');
    }

    $first_day = date('Y-m-01', strtotime(sprintf('%04d-%02d-01', $yearNum, $monthNum)));
    $last_day  = date('Y-m-t', strtotime($first_day));

    $first_sunday_in_month = date('Y-m-d', strtotime('next sunday', strtotime($first_day)));
    if ((int) date('w', strtotime($first_day)) === 0) {
        $first_sunday_in_month = $first_day;
    }

    $last_sunday_in_month = date('Y-m-d', strtotime('last sunday', strtotime($last_day)));
    if ((int) date('w', strtotime($last_day)) === 0) {
        $last_sunday_in_month = $last_day;
    }

    $current_sunday = strtotime($first_sunday_in_month);

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

    $weeks = [];
    $row_count = 1;

    while ($current_sunday !== false && $current_sunday <= strtotime($last_sunday_in_month)) {
        $week_end = date('Y-m-d', $current_sunday);
        $week_start = date('Y-m-d', strtotime($week_end . ' -6 days'));

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
            $offStmt->bind_param('ss', $week_start, $week_end);
            if ($offStmt->execute()) {
                $res = $offStmt->get_result();
                $r = $res ? $res->fetch_assoc() : null;
                if ($r) {
                    foreach ($off as $k => $_) {
                        $off[$k] = (float) ($r[$k] ?? 0);
                    }
                }
            }
        }

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
            $aoStmt->bind_param('ss', $week_start, $week_end);
            if ($aoStmt->execute()) {
                $res = $aoStmt->get_result();
                $r = $res ? $res->fetch_assoc() : null;
                if ($r) {
                    foreach ($ao as $k => $_) {
                        $ao[$k] = (float) ($r[$k] ?? 0);
                    }
                }
            }
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

        $label_sunday = date('M j', strtotime($week_end));
        $week_label = "Week {$row_count} ({$label_sunday})";

        $weeks[] = [
            'row_label' => $week_label,
            'week_start' => $week_start,
            'week_end' => $week_end,
            'totals' => $totals,
        ];

        $row_count++;
        $current_sunday = strtotime('+7 days', $current_sunday);
    }

    if ($offStmt) {
        $offStmt->close();
    }

    if ($aoStmt) {
        $aoStmt->close();
    }

    echo json_encode([
        'success' => true,
        'weeks' => $weeks,
    ]);

    $conn->close();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}
