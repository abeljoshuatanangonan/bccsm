<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db/db.php';

ini_set('display_errors', '1');
error_reporting(E_ALL);

/** @var mysqli|null $conn */
$conn = $conn ?? null;

try {
    if (!$conn instanceof mysqli) {
        throw new Exception('Database connection not available.');
    }

    if (isset($_GET['date'])) {
        $date = trim((string) $_GET['date']);

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            echo json_encode([
                'success' => false,
                'message' => 'Invalid date.',
            ]);
            exit;
        }

        $stmt = $conn->prepare("
            SELECT 
                dailyTithes_total AS tithes,
                dailyOffering_total AS offering,
                dailyPledge_total AS pledge,
                dailyEskwelaSuporta_total AS eskwela_suporta,
                dailyOthers_total AS others,
                dailyConstruction_total AS construction,
                dailySamarLeyte_total AS samarleyte_pledge,
                dailyOverall_total AS total,
                last_updated
            FROM offertory_daily_totals
            WHERE date = ?
            LIMIT 1
        ");

        if (!$stmt) {
            throw new Exception('Prepare failed.');
        }

        $stmt->bind_param('s', $date);
        $stmt->execute();

        $result = $stmt->get_result();
        $row = $result ? $result->fetch_assoc() : null;

        $stmt->close();

        if ($row) {
            echo json_encode([
                'success' => true,
                'total' => $row,
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'No totals found for this date',
            ]);
        }
        exit;
    }

    $query = "
        SELECT 
            date,
            dailyTithes_total AS tithes,
            dailyOffering_total AS offering,
            dailyPledge_total AS pledge,
            dailyEskwelaSuporta_total AS eskwela_suporta,
            dailyOthers_total AS others,
            dailyConstruction_total AS construction,
            dailySamarLeyte_total AS samarleyte_pledge,
            dailyOverall_total AS total,
            last_updated
        FROM offertory_daily_totals
        ORDER BY date DESC
    ";

    $result = $conn->query($query);
    $data = [];

    if ($result) {
        while ($r = $result->fetch_assoc()) {
            $data[] = $r;
        }
    }

    echo json_encode([
        'success' => true,
        'totals' => $data,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}
