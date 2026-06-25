<?php

declare(strict_types=1);

require_once __DIR__ . '/_guard.php';
require_admin_and_post();

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../admin-authorization.php';

    /** @var PDO|null $pdo */
    $pdo = $pdo ?? null;

    /** @var mysqli|null $conn */
    $conn = $conn ?? null;

    $hasPDO = $pdo instanceof PDO;
    $hasMySQL = $conn instanceof mysqli;

    if (!$hasPDO && !$hasMySQL) {
        throw new Exception('Database connection not available.');
    }

    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    if ($id <= 0) {
        throw new Exception('Invalid id');
    }

    if ($hasPDO) {
        $st = $pdo->prepare("DELETE FROM offertory_disbursements WHERE id = :id");
        $st->execute([':id' => $id]);
        $affected = $st->rowCount();
    } else {
        $st = $conn->prepare("DELETE FROM offertory_disbursements WHERE id = ?");
        if (!$st) {
            throw new Exception('Prepare failed: ' . $conn->error);
        }

        $st->bind_param('i', $id);

        if (!$st->execute()) {
            throw new Exception('Execute failed: ' . $st->error);
        }

        $affected = $st->affected_rows;
        $st->close();
    }

    echo json_encode(['success' => $affected > 0]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}
