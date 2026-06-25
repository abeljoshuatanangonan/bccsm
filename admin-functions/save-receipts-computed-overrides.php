<?php
// FILE: admin-functions/save-receipts-computed-overrides.php

declare(strict_types=1);

ob_start();
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/_php_error.log');

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/_guard.php';
require_admin_and_post();
require_once __DIR__ . '/../db/db.php';

date_default_timezone_set('Asia/Manila');

function jexit(bool $ok, string $msg = '', array $extra = []): never
{
    if (ob_get_length()) ob_end_clean();
    echo json_encode(['success' => $ok, 'message' => $msg] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
}

function is_zero_cents(float $n): bool
{
    return (int)round($n * 100) === 0;
}

try {
    if (!isset($conn) || !($conn instanceof mysqli)) {
        throw new RuntimeException('DB connection not initialized ($conn).');
    }
    $conn->set_charset('utf8mb4');

    $date = trim((string)($_POST['date'] ?? ''));
    if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        throw new InvalidArgumentException('Invalid date.');
    }

    $items_json = (string)($_POST['items_json'] ?? '[]');
    $items = json_decode($items_json, true);
    if (!is_array($items)) {
        throw new InvalidArgumentException('Invalid items_json.');
    }

    $allowed = array_flip([
        "ADD RECEIPTS",
        "TITHES",
        "TITHES (90%)",
        "MISSIONARY RESERVED FUND (10%)",
        "OFFERING",
        "SHORT TERM PLEDGES",
        "LONG TERM PLEDGES",
        "RESTRICTED PLEDGES",
        "OTHER RECEIPTS",
        "One Time Pledge/Offering",
        "Bank Interest/Other Income",
        "Pledge Outreach",
        "Kids Church",
        "Samar Leyte beg 5700",
        "Pledge -Worship Team",
        "Eskwela Suporta",
        "Donation fr Sis Criselda",
        "BCC CENTER",
        "Donation for Wellness Program",
        "Anniversary Pledge/Contibution",
    ]);

    $stmt_upsert = $conn->prepare("
        INSERT INTO offertory_receipts_computed_overrides (date, label, amount)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE amount = VALUES(amount), updated_at = CURRENT_TIMESTAMP
    ");
    if (!$stmt_upsert) throw new RuntimeException('Failed to prepare upsert statement.');

    $stmt_delete = $conn->prepare("
        DELETE FROM offertory_receipts_computed_overrides
        WHERE date = ? AND label = ?
    ");
    if (!$stmt_delete) throw new RuntimeException('Failed to prepare delete statement.');

    $saved = 0;
    $deleted = 0;

    foreach ($items as $it) {
        if (!is_array($it)) continue;

        $label = trim((string)($it['label'] ?? ''));
        if ($label === '' || !isset($allowed[$label])) continue;

        $amount_raw = $it['amount'] ?? null;

        if ($amount_raw === null || $amount_raw === '') {
            $stmt_delete->bind_param('ss', $date, $label);
            $stmt_delete->execute();
            $deleted++;
            continue;
        }

        $amount = round((float)$amount_raw, 2);

        // Treat 0.00 as "clear"
        if (!is_finite($amount) || is_zero_cents($amount)) {
            $stmt_delete->bind_param('ss', $date, $label);
            $stmt_delete->execute();
            $deleted++;
            continue;
        }

        $stmt_upsert->bind_param('ssd', $date, $label, $amount);
        if (!$stmt_upsert->execute()) {
            throw new RuntimeException('Failed to save override for: ' . $label);
        }
        $saved++;
    }

    $stmt_upsert->close();
    $stmt_delete->close();

    jexit(true, 'Overrides saved.', ['saved' => $saved, 'deleted' => $deleted]);
} catch (Throwable $e) {
    http_response_code(400);
    jexit(false, $e->getMessage());
} finally {
    if (isset($conn) && $conn instanceof mysqli) $conn->close();
}
