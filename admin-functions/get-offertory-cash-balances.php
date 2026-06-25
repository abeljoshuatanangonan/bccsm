<?php

declare(strict_types=1);

require_once __DIR__ . '/../admin-authorization.php';
require_once __DIR__ . '/../db/db.php';

header('Content-Type: application/json; charset=utf-8');

/** @var mysqli|null $conn */
$conn = $conn ?? null;

$date = isset($_GET['date']) ? trim((string) $_GET['date']) : '';
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid or missing date (YYYY-MM-DD).',
    ]);
    exit;
}

try {
    if (!$conn instanceof mysqli) {
        throw new Exception('Database connection not available.');
    }

    $sql = "
        SELECT
          a.id,
          a.code,
          a.name,
          a.parent_id,
          a.is_input,
          a.sort_order,
          b.amount AS amount
        FROM offertory_cb_accounts a
        LEFT JOIN offertory_cb_balances b
          ON b.account_id = a.id
         AND b.sunday_date = ?
        WHERE a.is_active = 1
        ORDER BY a.sort_order ASC, a.id ASC
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'DB error (prepare).',
        ]);
        exit;
    }

    $stmt->bind_param('s', $date);
    $stmt->execute();

    $items = [];

    if (method_exists($stmt, 'get_result')) {
        $res = $stmt->get_result();

        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $row['id'] = (int) ($row['id'] ?? 0);
                $row['code'] = (string) ($row['code'] ?? '');
                $row['name'] = (string) ($row['name'] ?? '');
                $row['parent_id'] = $row['parent_id'] === null ? null : (int) $row['parent_id'];
                $row['is_input'] = (int) ($row['is_input'] ?? 0);
                $row['sort_order'] = (int) ($row['sort_order'] ?? 0);
                $row['amount'] = $row['amount'] === null ? null : (float) $row['amount'];
                $items[] = $row;
            }
        }
    } else {
        $id = null;
        $code = null;
        $name = null;
        $parent_id = null;
        $is_input = null;
        $sort_order = null;
        $amount = null;

        $stmt->bind_result($id, $code, $name, $parent_id, $is_input, $sort_order, $amount);

        while ($stmt->fetch()) {
            $items[] = [
                'id' => (int) ($id ?? 0),
                'code' => (string) ($code ?? ''),
                'name' => (string) ($name ?? ''),
                'parent_id' => $parent_id === null ? null : (int) $parent_id,
                'is_input' => (int) ($is_input ?? 0),
                'sort_order' => (int) ($sort_order ?? 0),
                'amount' => $amount === null ? null : (float) $amount,
            ];
        }
    }

    $stmt->close();

    echo json_encode([
        'success' => true,
        'date' => $date,
        'items' => $items,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'DB error.',
    ]);
}
