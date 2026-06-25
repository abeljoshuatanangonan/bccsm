<?php
require_once __DIR__ . '/../admin-authorization.php';
require_once __DIR__ . '/../db/db.php';
require_once __DIR__ . '/_guard.php';

require_admin_and_post();
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) {
    $input = $_POST ?? [];
}

$date = trim((string)($input['sunday_date'] ?? $input['date'] ?? ''));

$items = $input['items'] ?? null;

// NEW: support items_json for form posts (so CSRF in $_POST works)
if (!is_array($items) && isset($input['items_json'])) {
    $decoded = json_decode((string)$input['items_json'], true);
    if (is_array($decoded)) $items = $decoded;
}

// Support single-row posts too
if (!is_array($items) && isset($input['account_id'])) {
    $items = [[
        'account_id' => $input['account_id'],
        'amount' => $input['amount'] ?? null,
    ]];
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid or missing sunday_date/date (YYYY-MM-DD).']);
    exit;
}
if (!is_array($items)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing items/items_json.']);
    exit;
}

try {
    $sqlUpsert = "
        INSERT INTO offertory_cb_balances (sunday_date, account_id, amount)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE amount = VALUES(amount)
    ";
    $sqlDelete = "
        DELETE FROM offertory_cb_balances
        WHERE sunday_date = ? AND account_id = ?
    ";

    $stmtUpsert = $conn->prepare($sqlUpsert);
    $stmtDelete = $conn->prepare($sqlDelete);

    if (!$stmtUpsert || !$stmtDelete) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB error (prepare).']);
        exit;
    }

    $conn->begin_transaction();

    $saved = 0;
    $deleted = 0;

    foreach ($items as $it) {
        $accountId = (int)($it['account_id'] ?? 0);
        $rawAmount = $it['amount'] ?? null;
        $preserveBlank = !empty($it['preserve_blank']);

        if ($accountId <= 0) continue;

        // For split cash-balance rows, an intentional blank should be saved as 0,
        // not deleted, so the UI will not carry forward the previous Sunday again.
        if ($rawAmount === null || $rawAmount === '') {
            if ($preserveBlank) {
                $rawAmount = 0;
            } else {
                $stmtDelete->bind_param('si', $date, $accountId);
                if (!$stmtDelete->execute()) {
                    throw new RuntimeException('Delete failed.');
                }
                $deleted++;
                continue;
            }
        }

        $amount = (float)$rawAmount;
        if (!is_finite($amount) || $amount < 0) $amount = 0.0;

        if ($amount <= 0 && !$preserveBlank) {
            $stmtDelete->bind_param('si', $date, $accountId);
            if (!$stmtDelete->execute()) {
                throw new RuntimeException('Delete failed.');
            }
            $deleted++;
            continue;
        }

        $stmtUpsert->bind_param('sid', $date, $accountId, $amount);
        if (!$stmtUpsert->execute()) {
            throw new RuntimeException('Upsert failed.');
        }
        $saved++;
    }

    $conn->commit();
    $stmtUpsert->close();
    $stmtDelete->close();

    echo json_encode(['success' => true, 'saved' => $saved, 'deleted' => $deleted]);
} catch (Throwable $e) {
    if ($conn && method_exists($conn, 'rollback')) $conn->rollback();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Save failed.']);
}
