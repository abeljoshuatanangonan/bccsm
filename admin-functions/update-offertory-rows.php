<?php
session_start();
require_once __DIR__ . '/_guard.php';
require_admin_and_post();

require_once __DIR__ . '/../includes/csrf.php';
csrf_require_or_fail();

require_once __DIR__ . '/../db/db.php';

date_default_timezone_set('Asia/Manila');
header('Content-Type: application/json; charset=utf-8');

function money2($v)
{
    $n = (float)$v;
    if (!is_finite($n)) {
        $n = 0;
    }
    return round($n, 2);
}

function money2_nonneg($v)
{
    $n = (float)$v;
    if (!is_finite($n) || $n < 0) $n = 0;
    return round($n, 2);
}

try {
    if (!isset($_POST['date'])) {
        throw new Exception('Missing date.');
    }

    $date = $_POST['date'];
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        throw new Exception('Invalid date format.');
    }

    $rowsJson = $_POST['rows_json'] ?? '[]';
    $rows = json_decode($rowsJson, true);
    if (!is_array($rows)) {
        throw new Exception('Invalid rows payload.');
    }

    // --- ADD: OFFERING save ---
    $aoJson = $_POST['add_offering_json'] ?? null;
    if ($aoJson !== null) {
        $ao = json_decode($aoJson, true);
        if (!is_array($ao)) throw new Exception('Invalid add_offering payload.');

        $aoVals = [
            'tithes' => money2_nonneg($ao['tithes'] ?? 0),
            'offering' => money2_nonneg($ao['offering'] ?? 0),
            'pledge' => money2_nonneg($ao['pledge'] ?? 0),
            'es' => money2_nonneg($ao['es'] ?? 0),
            'others' => money2_nonneg($ao['others'] ?? 0),
            'construction' => money2_nonneg($ao['construction'] ?? 0),
            'samar_leyte' => money2_nonneg($ao['samar_leyte'] ?? 0),
        ];

        $allZero = true;
        foreach ($aoVals as $v) {
            if (round($v, 2) != 0.00) {
                $allZero = false;
                break;
            }
        }

        if ($allZero) {
            $del = $conn->prepare("DELETE FROM offertory_add_offering WHERE date=?");
            if ($del) {
                $del->bind_param("s", $date);
                $del->execute();
                $del->close();
            }
        } else {
            $ins = $conn->prepare("
                INSERT INTO offertory_add_offering
                (date, tithes, offering, pledge, es, others, construction, samar_leyte)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                tithes=VALUES(tithes),
                offering=VALUES(offering),
                pledge=VALUES(pledge),
                es=VALUES(es),
                others=VALUES(others),
                construction=VALUES(construction),
                samar_leyte=VALUES(samar_leyte)
                ");
            if ($ins) {
                $ins->bind_param(
                    "sddddddd",
                    $date,
                    $aoVals['tithes'],
                    $aoVals['offering'],
                    $aoVals['pledge'],
                    $aoVals['es'],
                    $aoVals['others'],
                    $aoVals['construction'],
                    $aoVals['samar_leyte']
                );
                $ins->execute();
                $ins->close();
            }
        }
    }

    if (!($conn instanceof mysqli)) {
        throw new Exception('Database connection not available.');
    }

    // ---- Update each existing offertory row ----
    if (!empty($rows)) {
        $sql = "UPDATE offertory
        SET mode_of_offertory = ?, tithes = ?, offering = ?, pledge = ?, eskwela_suporta = ?,
            others = ?, construction = ?, samarleyte_pledge = ?, total = ?
        WHERE id = ?";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception('Prepare failed: ' . $conn->error);
        }

        foreach ($rows as $r) {
            $id = isset($r['id']) ? (int)$r['id'] : 0;
            if ($id <= 0) {
                continue;
            }

            $mode_of_offertory = trim((string)($r['mode_of_offertory'] ?? 'Cash'));
            if (!in_array($mode_of_offertory, ['Cash', 'Bank'], true)) {
                $mode_of_offertory = 'Cash';
            }

            $tithes       = money2($r['tithes']       ?? 0);
            $offering     = money2($r['offering']     ?? 0);
            $pledge       = money2($r['pledge']       ?? 0);
            $es           = money2($r['es']           ?? 0);
            $others       = money2($r['others']       ?? 0);
            $construction = money2($r['construction'] ?? 0);
            $samar        = money2($r['samar_leyte']  ?? 0);

            $total = $tithes + $offering + $pledge + $es + $others + $construction + $samar;

            $stmt->bind_param(
                "sddddddddi",
                $mode_of_offertory,
                $tithes,
                $offering,
                $pledge,
                $es,
                $others,
                $construction,
                $samar,
                $total,
                $id
            );
            $stmt->execute();
        }

        $stmt->close();
    }

    // ---- Recalculate daily totals for this date from OFFERTORY ----
    $sumSql = "SELECT
                 COALESCE(SUM(tithes), 0)            AS tithes,
                 COALESCE(SUM(offering), 0)          AS offering,
                 COALESCE(SUM(pledge), 0)            AS pledge,
                 COALESCE(SUM(eskwela_suporta), 0)   AS eskwela_suporta,
                 COALESCE(SUM(others), 0)            AS others,
                 COALESCE(SUM(construction), 0)      AS construction,
                 COALESCE(SUM(samarleyte_pledge), 0) AS samarleyte_pledge
               FROM offertory
               WHERE DATE(created_at) = ?";

    $sumStmt = $conn->prepare($sumSql);
    if ($sumStmt) {
        $sumStmt->bind_param("s", $date);
        $sumStmt->execute();
        $res  = $sumStmt->get_result();
        $sums = $res->fetch_assoc() ?: [
            'tithes'            => 0,
            'offering'          => 0,
            'pledge'            => 0,
            'eskwela_suporta'   => 0,
            'others'            => 0,
            'construction'      => 0,
            'samarleyte_pledge' => 0,
        ];
        $sumStmt->close();

        $tithes       = (float)$sums['tithes'];
        $offering     = (float)$sums['offering'];
        $pledge       = (float)$sums['pledge'];
        $es           = (float)$sums['eskwela_suporta'];
        $others       = (float)$sums['others'];
        $construction = (float)$sums['construction'];
        $samar        = (float)$sums['samarleyte_pledge'];
        $overall      = $tithes + $offering + $pledge + $es + $others + $construction + $samar;

        // Absolute upsert into daily totals (no += here)
        $upsert = "INSERT INTO offertory_daily_totals
                     (date, dailyTithes_total, dailyOffering_total, dailyPledge_total,
                      dailyEskwelaSuporta_total, dailyOthers_total, dailyConstruction_total,
                      dailySamarLeyte_total, dailyOverall_total)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE
                     dailyTithes_total         = VALUES(dailyTithes_total),
                     dailyOffering_total       = VALUES(dailyOffering_total),
                     dailyPledge_total         = VALUES(dailyPledge_total),
                     dailyEskwelaSuporta_total = VALUES(dailyEskwelaSuporta_total),
                     dailyOthers_total         = VALUES(dailyOthers_total),
                     dailyConstruction_total   = VALUES(dailyConstruction_total),
                     dailySamarLeyte_total     = VALUES(dailySamarLeyte_total),
                     dailyOverall_total        = VALUES(dailyOverall_total),
                     last_updated              = CURRENT_TIMESTAMP";

        $up = $conn->prepare($upsert);
        if ($up) {
            $up->bind_param(
                "sdddddddd",
                $date,
                $tithes,
                $offering,
                $pledge,
                $es,
                $others,
                $construction,
                $samar,
                $overall
            );
            $up->execute();
            $up->close();
        }
    }

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
