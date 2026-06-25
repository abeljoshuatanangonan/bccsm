<?php

declare(strict_types=1);

require_once __DIR__ . '/../db/db.php';
require_once __DIR__ . '/_guard.php';
require_admin_and_post();

header('Content-Type: application/json; charset=utf-8');

/** @var mysqli|null $conn */
$conn = $conn ?? null;

try {
    if (!$conn instanceof mysqli) {
        throw new Exception('Database connection not available.');
    }

    $month = isset($_POST['month'])
        ? (int) $_POST['month']
        : (isset($_GET['month']) ? (int) $_GET['month'] : (int) date('n'));

    $year = isset($_POST['year'])
        ? (int) $_POST['year']
        : (isset($_GET['year']) ? (int) $_GET['year'] : (int) date('Y'));

    if ($month < 1 || $month > 12) {
        throw new Exception('Invalid month.');
    }

    if ($year < 2000 || $year > 2100) {
        throw new Exception('Invalid year.');
    }

    $monthStart = sprintf('%04d-%02d-01', $year, $month);
    $monthEnd = date('Y-m-t', strtotime($monthStart));

    $sql = "
    SELECT
        SUM(tithes)            AS tithes,
        SUM(offering)          AS offering,
        SUM(pledge)            AS pledge,
        SUM(eskwela_suporta)   AS eskwela_suporta,
        SUM(others)            AS others,
        SUM(construction)      AS construction,
        SUM(samarleyte_pledge) AS samarleyte_pledge
    FROM offertory
    WHERE DATE(created_at) BETWEEN ? AND ?
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Prepare failed.');
    }

    $stmt->bind_param('ss', $monthStart, $monthEnd);
    $stmt->execute();

    $result = $stmt->get_result();
    $row = $result ? ($result->fetch_assoc() ?: [
        'tithes' => 0,
        'offering' => 0,
        'pledge' => 0,
        'eskwela_suporta' => 0,
        'others' => 0,
        'construction' => 0,
        'samarleyte_pledge' => 0,
    ]) : [
        'tithes' => 0,
        'offering' => 0,
        'pledge' => 0,
        'eskwela_suporta' => 0,
        'others' => 0,
        'construction' => 0,
        'samarleyte_pledge' => 0,
    ];
    $stmt->close();

    $tithes = (float) ($row['tithes'] ?? 0);
    $offering = (float) ($row['offering'] ?? 0);
    $pledge = (float) ($row['pledge'] ?? 0);
    $eskwela = (float) ($row['eskwela_suporta'] ?? 0);
    $others = (float) ($row['others'] ?? 0);
    $construction = (float) ($row['construction'] ?? 0);
    $samarleyte = (float) ($row['samarleyte_pledge'] ?? 0);

    $total = $tithes + $offering + $pledge + $eskwela + $others + $construction + $samarleyte;

    $monthName = date('F', strtotime($monthStart));
    $username = 'system';

    $check = $conn->prepare("
        SELECT id
        FROM offertory_monthly_totals
        WHERE month_name = ? AND year = ?
    ");
    if (!$check) {
        throw new Exception('Prepare failed.');
    }

    $check->bind_param('si', $monthName, $year);
    $check->execute();
    $checkResult = $check->get_result();

    if ($checkResult && $checkResult->num_rows > 0) {
        $update = $conn->prepare("
            UPDATE offertory_monthly_totals
            SET tithes = ?, offering = ?, pledge = ?, eskwela_suporta = ?, others = ?,
                construction = ?, samarleyte_pledge = ?, total = ?, username = ?
            WHERE month_name = ? AND year = ?
        ");
        if (!$update) {
            throw new Exception('Prepare failed.');
        }

        $update->bind_param(
            'ddddddddssi',
            $tithes,
            $offering,
            $pledge,
            $eskwela,
            $others,
            $construction,
            $samarleyte,
            $total,
            $username,
            $monthName,
            $year
        );
        $update->execute();
        $update->close();
    } else {
        $insert = $conn->prepare("
            INSERT INTO offertory_monthly_totals
            (tithes, offering, pledge, eskwela_suporta, others, construction, samarleyte_pledge, total, username, month_name, year)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        if (!$insert) {
            throw new Exception('Prepare failed.');
        }

        $insert->bind_param(
            'ddddddddssi',
            $tithes,
            $offering,
            $pledge,
            $eskwela,
            $others,
            $construction,
            $samarleyte,
            $total,
            $username,
            $monthName,
            $year
        );
        $insert->execute();
        $insert->close();
    }

    $check->close();

    echo json_encode([
        'success' => true,
        'message' => "Monthly totals updated for {$monthName} {$year}",
        'totals' => [
            'tithes' => $tithes,
            'offering' => $offering,
            'pledge' => $pledge,
            'eskwela_suporta' => $eskwela,
            'others' => $others,
            'construction' => $construction,
            'samarleyte_pledge' => $samarleyte,
            'total' => $total,
        ],
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}
