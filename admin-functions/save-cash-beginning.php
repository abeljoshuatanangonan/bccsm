<?php
require_once __DIR__ . '/../admin-authorization.php';
require_once __DIR__ . '/../db/db.php';
require_once __DIR__ . '/_guard.php';
require_admin_and_post();

header('Content-Type: application/json; charset=utf-8');

$input  = json_decode(file_get_contents('php://input'), true) ?? [];
$year   = isset($input['year'])   ? (int)$input['year']   : (int)date('Y');
$month  = isset($input['month'])  ? (int)$input['month']  : (int)date('n');
$amount = isset($input['amount']) ? (float)$input['amount'] : 0.00;
$note   = trim($input['note'] ?? '');

try {
  // Ensure a unique index exists on (year, month) so ON DUPLICATE KEY works
  // ALTER TABLE cash_beginning_balances ADD UNIQUE KEY uniq_year_month (year, month);

  $sql = "INSERT INTO cash_beginning_balances (year, month, amount, note)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            amount = VALUES(amount),
            note   = VALUES(note)";
  if (!$stmt = $conn->prepare($sql)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB error (prepare)']);
    exit;
  }
  // i = int, d = double, s = string
  $stmt->bind_param('iids', $year, $month, $amount, $note);
  $ok = $stmt->execute();
  $stmt->close();

  if ($ok) {
    echo json_encode(['success' => true]);
  } else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Save failed']);
  }
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Save failed']);
}
