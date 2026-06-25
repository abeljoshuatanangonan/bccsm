<?php

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

require_once __DIR__ . '/_guard.php';
require_admin();

require_once __DIR__ . '/../db/db.php';

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('Asia/Manila');

function jexit(bool $ok, string $msg = '', array $extra = []): never
{
    $out = ['success' => $ok];
    if (!$ok && $msg !== '') $out['message'] = $msg;
    if ($extra) $out += $extra;
    echo json_encode($out);
    exit;
}

// Inputs: month & year (UI calls ...?month=12&year=2025)
$month = isset($_GET['month']) ? (int)$_GET['month'] : (isset($_POST['month']) ? (int)$_POST['month'] : 0);
$year  = isset($_GET['year'])  ? (int)$_GET['year']  : (isset($_POST['year'])  ? (int)$_POST['year']  : 0);

if ($month < 1 || $month > 12 || $year < 1900 || $year > 2100) {
    jexit(false, 'Invalid or missing month/year');
}

// Compute first/last day for the month
$start = sprintf('%04d-%02d-01', $year, $month);
$end   = date('Y-m-t', strtotime($start));

// Known leaf names under grouped categories (to suppress legacy, group-less duplicates)
$GROUPED_CATEGORIES = ['Ministry Expenses', 'Outreach Support'];
$GROUP_LEAFS = [
    // Ministry Expenses
    'Transportation',
    'Food',
    'Transportation/others',
    'Materials',
    'Food Expenses',
    'Misc',
    // Outreach Support
    'Rental',
    'Love Gift',
    'Food Expenses & others',
    'Samar-Leyte printing',
    'Samar-Leyte Internet',
    'Checked Baggage',
];

// --- Valid categories (for repairing legacy swapped rows) ---
$validCats = [];
$resCats = $conn->query("SELECT DISTINCT category FROM offertory_disb_catalog");
if ($resCats) {
    while ($r = $resCats->fetch_assoc()) {
        $c = trim((string)($r['category'] ?? ''));
        if ($c !== '') $validCats[$c] = true;
    }
    $resCats->free();
}

function is_numericish(string $s): bool
{
    $s = trim($s);
    return $s !== '' && preg_match('/^\d+(?:\.\d+)?$/', $s) === 1;
}

function find_catalog_id(mysqli $conn, string $category): ?int
{
    $sql = "SELECT id FROM offertory_disb_catalog WHERE category=? AND (subcategory IS NULL OR subcategory='') LIMIT 1";
    $st = $conn->prepare($sql);
    if (!$st) return null;
    $st->bind_param('s', $category);
    if (!$st->execute()) {
        $st->close();
        return null;
    }
    $st->bind_result($id);
    $out = null;
    if ($st->fetch()) $out = (int)$id;
    $st->close();
    return $out;
}


// Fetch; we’ll compose the final text in PHP
$sql = "
SELECT
    d.id,
    d.txn_date,
    COALESCE(c.category, d.category)             AS category,
    COALESCE(c.subcategory, '')                  AS catalog_subcategory,  -- group
    s.name                                       AS subcategory_name,     -- leaf
    d.subcategory                                AS subcategory_legacy,   -- legacy text
    d.catalog_id,
    d.subcategory_id,
    d.amount,
    d.note
FROM offertory_disbursements d
LEFT JOIN offertory_disb_catalog c
       ON c.id = d.catalog_id
LEFT JOIN offertory_disb_subcategories s
       ON s.id = d.subcategory_id
WHERE d.txn_date BETWEEN ? AND ?
ORDER BY d.txn_date, d.id
";

try {
    if (!$st = $conn->prepare($sql)) {
        throw new Exception('Prepare failed: ' . $conn->error);
    }
    if (!$st->bind_param('ss', $start, $end)) {
        throw new Exception('Bind failed: ' . $st->error);
    }
    if (!$st->execute()) {
        throw new Exception('Execute failed: ' . $st->error);
    }
    $res = $st->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $cat    = trim((string)($row['category'] ?? ''));
        $group  = trim((string)($row['catalog_subcategory'] ?? ''));
        $leaf   = trim((string)($row['subcategory_name'] ?? ''));
        $legacy = trim((string)($row['subcategory_legacy'] ?? ''));

        // Repair legacy swapped rows: category stored as a number, real category stored in legacy subcategory.
        if (is_numericish($cat) && $legacy !== '' && isset($validCats[$legacy]) && $group === '' && $leaf === '') {
            $fixedCat = $legacy;
            $fixedCatalogId = find_catalog_id($conn, $fixedCat);

            // Update DB row so future edits/deletes work correctly.
            $upd = $conn->prepare("UPDATE offertory_disbursements
                SET category=?, subcategory=NULL, catalog_id=?, subcategory_id=NULL
                WHERE id=?");
            if ($upd) {
                $cid = $fixedCatalogId;
                if ($cid === null) {
                    $upd->close();
                    $upd = $conn->prepare("UPDATE offertory_disbursements
                        SET category=?, subcategory=NULL, catalog_id=NULL, subcategory_id=NULL
                        WHERE id=?");
                    if ($upd) {
                        $id = (int)$row['id'];
                        $upd->bind_param('si', $fixedCat, $id);
                        $upd->execute();
                        $upd->close();
                    }
                } else {
                    $id = (int)$row['id'];
                    $upd->bind_param('sii', $fixedCat, $cid, $id);
                    $upd->execute();
                    $upd->close();
                }
            }

            $cat = $fixedCat;
            $row['catalog_id'] = $fixedCatalogId;
            $row['subcategory_id'] = null;
            $row['subcategory_legacy'] = null;
            $legacy = '';
        }

        if ($group !== '' && $leaf !== '') {
            $subText = $group . ' - ' . $leaf;
        } elseif ($leaf !== '') {
            $subText = $leaf;
        } else {
            $subText = $legacy;
        }

        if (
            in_array($cat, $GROUPED_CATEGORIES, true)
            && (empty($row['catalog_id']) || $row['catalog_id'] === null)
            && in_array($subText, $GROUP_LEAFS, true)
        ) {
            continue;
        }

        $rows[] = [
            'id'               => (int)$row['id'],
            'txn_date'         => $row['txn_date'],
            'category'         => $cat,
            'catalog_subcategory' => $group,
            'subcategory_name' => $leaf,
            'subcategory'      => $subText,
            'catalog_id'       => $row['catalog_id'] !== null ? (int)$row['catalog_id'] : null,
            'subcategory_id'   => $row['subcategory_id'] !== null ? (int)$row['subcategory_id'] : null,
            'amount'           => (float)$row['amount'],
            'note'             => $row['note'],
        ];
    }
    $st->close();

    jexit(true, '', ['items' => $rows]);
} catch (Throwable $e) {
    jexit(false, $e->getMessage());
}
