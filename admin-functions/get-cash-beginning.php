<?php

declare(strict_types=1);

require_once __DIR__ . '/../admin-authorization.php';
require_once __DIR__ . '/../db/db.php';

header('Content-Type: application/json; charset=utf-8');

/** @var mysqli|null $conn */
$conn = $conn ?? null;

$year  = isset($_GET['year']) ? (int) $_GET['year'] : (int) date('Y');
$month = isset($_GET['month']) ? (int) $_GET['month'] : (int) date('n');

try {
    if (!$conn instanceof mysqli) {
        throw new Exception('Database connection not available.');
    }

    $sql = "SELECT amount, note, updated_at
            FROM cash_beginning_balances
            WHERE year = ? AND month = ?
            LIMIT 1";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB error (prepare)']);
        exit;
    }

    $stmt->bind_param('ii', $year, $month);
    $stmt->execute();

    $amount = null;
    $note = null;
    $updated_at = null;

    $stmt->bind_result($amount, $note, $updated_at);

    if ($stmt->fetch()) {
        echo json_encode([
            'success' => true,
            'amount' => (float) ($amount ?? 0),
            'note' => $note ?? '',
            'updated_at' => $updated_at ?? '',
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'amount' => 0.00,
            'note' => '',
            'updated_at' => '',
        ]);
    }

    $stmt->close();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB error']);
}
