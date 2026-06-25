<?php

declare(strict_types=1);

require_once __DIR__ . '/../admin-authorization.php';
require_once __DIR__ . '/../db/db.php';

header('Content-Type: application/json; charset=utf-8');

function bcc_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function bcc_round2($n): float
{
    return round((float)$n, 2);
}

function bcc_iso_date(string $raw): ?string
{
    $raw = trim($raw);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) return null;
    [$y, $m, $d] = array_map('intval', explode('-', $raw));
    if (!checkdate($m, $d, $y)) return null;
    return sprintf('%04d-%02d-%02d', $y, $m, $d);
}

function bcc_add_days(string $iso, int $days): string
{
    $dt = new DateTimeImmutable($iso . ' 00:00:00');
    return $dt->modify(($days >= 0 ? '+' : '') . $days . ' days')->format('Y-m-d');
}

function bcc_prev_sunday(string $iso): string
{
    return bcc_add_days($iso, -7);
}

function bcc_week_range_from_sunday(string $sundayIso): array
{
    $sun = new DateTimeImmutable($sundayIso . ' 00:00:00');
    $mon = $sun->modify('-6 days');
    return [$mon->format('Y-m-d'), $sun->format('Y-m-d')];
}

function bcc_next_day(string $iso): string
{
    return bcc_add_days($iso, 1);
}

function bcc_get_cb_account_id(mysqli $conn): int
{
    static $cached = null;
    if ($cached !== null) return $cached;

    $sql = "SELECT id FROM offertory_cb_accounts WHERE UPPER(code) = 'CB_ENDING' LIMIT 1";
    $res = $conn->query($sql);
    if (!$res) {
        throw new RuntimeException('Failed to load CB_ENDING account.');
    }
    $row = $res->fetch_assoc();
    $cached = $row ? (int)$row['id'] : 0;
    return $cached;
}

function bcc_get_saved_cb_ending(mysqli $conn, string $sundayIso): ?float
{
    $accountId = bcc_get_cb_account_id($conn);
    if ($accountId <= 0) return null;

    $sql = "
        SELECT amount
        FROM offertory_cb_balances
        WHERE sunday_date = ?
          AND account_id = ?
        LIMIT 1
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare CB_ENDING lookup.');
    }
    $stmt->bind_param('si', $sundayIso, $accountId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$row) return null;

    $amount = isset($row['amount']) ? (float)$row['amount'] : 0.0;
    return bcc_round2($amount);
}

function bcc_get_month_cash_beginning(mysqli $conn, string $sundayIso): ?float
{
    $dt = new DateTimeImmutable($sundayIso . ' 00:00:00');
    $year = (int)$dt->format('Y');
    $month = (int)$dt->format('m');

    $sql = "
        SELECT amount
        FROM cash_beginning_balances
        WHERE year = ?
          AND month = ?
        LIMIT 1
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare cash beginning lookup.');
    }
    $stmt->bind_param('ii', $year, $month);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$row) return null;

    $amount = isset($row['amount']) ? (float)$row['amount'] : 0.0;
    return bcc_round2($amount);
}

function bcc_has_any_activity(mysqli $conn, string $sundayIso): bool
{
    [$start, $end] = bcc_week_range_from_sunday($sundayIso);
    $next = bcc_next_day($end);

    $sql1 = "
        SELECT 1
        FROM offertory
        WHERE created_at >= ?
          AND created_at < ?
        LIMIT 1
    ";
    $stmt1 = $conn->prepare($sql1);
    $stmt1->bind_param('ss', $start, $next);
    $stmt1->execute();
    $res1 = $stmt1->get_result();
    $has1 = (bool)($res1 && $res1->fetch_row());
    $stmt1->close();
    if ($has1) return true;

    $sql2 = "
        SELECT 1
        FROM offertory_add_offering
        WHERE date >= ?
          AND date <= ?
        LIMIT 1
    ";
    $stmt2 = $conn->prepare($sql2);
    $stmt2->bind_param('ss', $start, $end);
    $stmt2->execute();
    $res2 = $stmt2->get_result();
    $has2 = (bool)($res2 && $res2->fetch_row());
    $stmt2->close();
    if ($has2) return true;

    $sql3 = "
    SELECT 1
    FROM offertory_disbursements
    WHERE txn_date >= ?
      AND txn_date <= ?
    LIMIT 1
    ";
    $stmt3 = $conn->prepare($sql3);
    $stmt3->bind_param('ss', $start, $end);
    $stmt3->execute();
    $res3 = $stmt3->get_result();
    $has3 = (bool)($res3 && $res3->fetch_row());
    $stmt3->close();
    if ($has3) return true;

    $sql4 = "
        SELECT 1
        FROM offertory_cb_balances
        WHERE sunday_date = ?
        LIMIT 1
    ";
    $stmt4 = $conn->prepare($sql4);
    $stmt4->bind_param('s', $sundayIso);
    $stmt4->execute();
    $res4 = $stmt4->get_result();
    $has4 = (bool)($res4 && $res4->fetch_row());
    $stmt4->close();

    return $has4;
}

function bcc_get_weekly_receipts_total(mysqli $conn, string $sundayIso): float
{
    [$start, $end] = bcc_week_range_from_sunday($sundayIso);
    $next = bcc_next_day($end);

    $offertorySql = "
        SELECT
            COALESCE(SUM(COALESCE(tithes,0)),0) +
            COALESCE(SUM(COALESCE(offering,0)),0) +
            COALESCE(SUM(COALESCE(pledge,0)),0) +
            COALESCE(SUM(COALESCE(eskwela_suporta,0)),0) +
            COALESCE(SUM(COALESCE(others,0)),0) +
            COALESCE(SUM(COALESCE(construction,0)),0) +
            COALESCE(SUM(COALESCE(samarleyte_pledge,0)),0) AS total_receipts
        FROM offertory
        WHERE created_at >= ?
          AND created_at < ?
    ";
    $stmt1 = $conn->prepare($offertorySql);
    $stmt1->bind_param('ss', $start, $next);
    $stmt1->execute();
    $res1 = $stmt1->get_result();
    $row1 = $res1 ? $res1->fetch_assoc() : null;
    $stmt1->close();

    $receipts = $row1 ? (float)$row1['total_receipts'] : 0.0;

    $addSql = "
        SELECT
            COALESCE(SUM(COALESCE(tithes,0)),0) +
            COALESCE(SUM(COALESCE(offering,0)),0) +
            COALESCE(SUM(COALESCE(pledge,0)),0) +
            COALESCE(SUM(COALESCE(es,0)),0) +
            COALESCE(SUM(COALESCE(others,0)),0) +
            COALESCE(SUM(COALESCE(construction,0)),0) +
            COALESCE(SUM(COALESCE(samar_leyte,0)),0) AS total_add
        FROM offertory_add_offering
        WHERE date >= ?
        AND date <= ?
    ";
    $stmt2 = $conn->prepare($addSql);
    $stmt2->bind_param('ss', $start, $end);
    $stmt2->execute();
    $res2 = $stmt2->get_result();
    $row2 = $res2 ? $res2->fetch_assoc() : null;
    $stmt2->close();

    $add = $row2 ? (float)$row2['total_add'] : 0.0;

    return bcc_round2($receipts + $add);
}

function bcc_get_weekly_disbursement_total(mysqli $conn, string $sundayIso): float
{
    [$start, $end] = bcc_week_range_from_sunday($sundayIso);

    $sql = "
    SELECT COALESCE(SUM(COALESCE(amount,0)),0) AS total_disb
    FROM offertory_disbursements
    WHERE txn_date >= ?
      AND txn_date <= ?
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('ss', $start, $end);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    return bcc_round2($row ? (float)$row['total_disb'] : 0.0);
}

function bcc_find_seed_sunday(mysqli $conn, string $targetSundayIso): string
{
    $cursor = $targetSundayIso;
    $found = null;

    for ($i = 0; $i < 156; $i++) {
        $savedEnding = bcc_get_saved_cb_ending($conn, $cursor);
        $cashBeginning = bcc_get_month_cash_beginning($conn, $cursor);
        $hasActivity = bcc_has_any_activity($conn, $cursor);

        $isRelevant =
            ($savedEnding !== null && abs($savedEnding) > 0.00001) ||
            ($cashBeginning !== null && abs($cashBeginning) > 0.00001) ||
            $hasActivity;

        if ($isRelevant) {
            $found = $cursor;
        }

        $cursor = bcc_prev_sunday($cursor);
    }

    return $found ?: $targetSundayIso;
}

function bcc_collect_sundays(string $seedSundayIso, string $targetSundayIso): array
{
    $out = [];
    $cur = $seedSundayIso;

    for ($i = 0; $i < 156; $i++) {
        $out[] = $cur;
        if ($cur === $targetSundayIso) break;
        $cur = bcc_add_days($cur, 7);
    }

    return $out;
}

function bcc_compute_chain(mysqli $conn, string $targetSundayIso): array
{
    $seedSunday = bcc_find_seed_sunday($conn, $targetSundayIso);
    $sundays = bcc_collect_sundays($seedSunday, $targetSundayIso);

    $carry = 0.0;
    $chain = [];

    foreach ($sundays as $idx => $sundayIso) {
        $savedEnding = bcc_get_saved_cb_ending($conn, $sundayIso);
        $monthBeginning = bcc_get_month_cash_beginning($conn, $sundayIso);

        if ($idx === 0) {
            if ($savedEnding !== null && abs($savedEnding) > 0.00001) {
                $prevBeginning = bcc_round2($savedEnding);
            } elseif ($monthBeginning !== null) {
                $prevBeginning = bcc_round2($monthBeginning);
            } else {
                $prevBeginning = 0.0;
            }
        } else {
            $prevBeginning = $carry;
        }

        $receipts = bcc_get_weekly_receipts_total($conn, $sundayIso);
        $disb = bcc_get_weekly_disbursement_total($conn, $sundayIso);
        $ending = bcc_round2($prevBeginning + $receipts - $disb);

        $chain[] = [
            'sunday' => $sundayIso,
            'beginning' => bcc_round2($prevBeginning),
            'receipts' => bcc_round2($receipts),
            'disbursements' => bcc_round2($disb),
            'ending' => bcc_round2($ending),
            'saved_cb_ending' => $savedEnding,
            'month_cash_beginning' => $monthBeginning,
        ];

        $carry = $ending;
    }

    $target = end($chain);
    if (!$target) {
        $target = [
            'sunday' => $targetSundayIso,
            'beginning' => 0.0,
            'receipts' => 0.0,
            'disbursements' => 0.0,
            'ending' => 0.0,
            'saved_cb_ending' => null,
            'month_cash_beginning' => null,
        ];
    }

    return [
        'seed_sunday' => $seedSunday,
        'target' => $target,
        'chain' => $chain,
    ];
}

try {
    if (!isset($conn) || !($conn instanceof mysqli)) {
        throw new RuntimeException('Database connection is not available.');
    }

    $sunday = bcc_iso_date((string)($_GET['sunday'] ?? ''));
    if (!$sunday) {
        bcc_json([
            'success' => false,
            'message' => 'Invalid or missing sunday parameter.'
        ], 422);
    }

    $computed = bcc_compute_chain($conn, $sunday);

    bcc_json([
        'success' => true,
        'sunday' => $sunday,
        'seed_sunday' => $computed['seed_sunday'],
        'target' => $computed['target'],
        'chain' => $computed['chain'],
    ]);
} catch (Throwable $e) {
    bcc_json([
        'success' => false,
        'message' => $e->getMessage(),
    ], 500);
}
