<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db/db.php';

ini_set('display_errors', '1');
error_reporting(E_ALL);

/** @var mysqli|null $conn */
$conn = $conn ?? null;

if (!isset($_GET['date'])) {
  echo json_encode([]);
  exit;
}

$date = trim((string) $_GET['date']);
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
  echo json_encode([
    'success' => false,
    'message' => 'Invalid date.',
  ]);
  exit;
}

try {
  if (!$conn instanceof mysqli) {
    throw new Exception('Database connection not available.');
  }

  $stmt = $conn->prepare("
        SELECT
            o.id AS id,
            CASE
                WHEN o.display_name IS NOT NULL AND o.display_name <> '' THEN o.display_name
                WHEN o.username IS NOT NULL AND o.username <> '' AND LOWER(o.username) <> 'visitor' THEN o.username
                WHEN o.visitor_name IS NOT NULL AND o.visitor_name <> '' THEN o.visitor_name
                ELSE ''
            END AS name,
            CASE
                WHEN r.role IS NOT NULL AND r.role <> '' THEN r.role
                WHEN o.username IS NULL OR o.username = '' OR LOWER(o.username) = 'visitor' THEN 'visitor'
                ELSE r.role
            END AS role,
            CASE
                WHEN o.is_couple_shared = 1 THEN 'Couple'
                ELSE 'Single'
            END AS type,
            o.mode_of_offertory,
            o.bank_proof_image,
            o.tithes,
            o.offering,
            o.pledge,
            o.eskwela_suporta AS es,
            o.others,
            o.construction,
            o.samarleyte_pledge AS samar_leyte,
            o.total,
            o.created_at AS date
        FROM offertory o
        LEFT JOIN registrations r ON r.id = o.user_id
        WHERE DATE(o.created_at) = ?
    ");

  if (!$stmt) {
    throw new Exception('Prepare failed.');
  }

  $stmt->bind_param('s', $date);

  if (!$stmt->execute()) {
    echo json_encode(['error' => $stmt->error]);
    exit;
  }

  $result = $stmt->get_result();
  $receipts = [];

  while ($row = $result->fetch_assoc()) {
    $receipts[] = $row;
  }
  $stmt->close();

  $ao = [
    'tithes' => 0.0,
    'offering' => 0.0,
    'pledge' => 0.0,
    'es' => 0.0,
    'others' => 0.0,
    'construction' => 0.0,
    'samar_leyte' => 0.0,
  ];

  $aoStmt = $conn->prepare("
        SELECT tithes, offering, pledge, es, others, construction, samar_leyte
        FROM offertory_add_offering
        WHERE date = ?
        LIMIT 1
    ");

  if ($aoStmt) {
    $aoStmt->bind_param('s', $date);

    if ($aoStmt->execute()) {
      $aoRes = $aoStmt->get_result();
      $aoRow = $aoRes ? $aoRes->fetch_assoc() : null;

      if ($aoRow) {
        foreach ($ao as $k => $_) {
          $ao[$k] = (float) ($aoRow[$k] ?? 0);
        }
      }
    }

    $aoStmt->close();
  }

  $overrides = [];

  $ovStmt = $conn->prepare("
        SELECT label, amount
        FROM offertory_receipts_computed_overrides
        WHERE date = ?
    ");

  if ($ovStmt) {
    $ovStmt->bind_param('s', $date);

    if ($ovStmt->execute()) {
      $ovRes = $ovStmt->get_result();

      while ($ovRow = $ovRes ? $ovRes->fetch_assoc() : null) {
        $lbl = (string) ($ovRow['label'] ?? '');
        if ($lbl !== '') {
          $overrides[$lbl] = (float) ($ovRow['amount'] ?? 0);
        }
      }
    }

    $ovStmt->close();
  }

  echo json_encode([
    'success' => true,
    'receipts' => $receipts,
    'add_offering' => $ao,
    'receipts_computed_overrides' => $overrides,
  ]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode([
    'success' => false,
    'message' => $e->getMessage(),
  ]);
}
