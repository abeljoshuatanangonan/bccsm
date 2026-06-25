<?php

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
    if (ob_get_length()) {
        ob_end_clean();
    }
    echo json_encode(['success' => $ok, 'message' => $msg] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    if (!isset($conn) || !($conn instanceof mysqli)) {
        throw new RuntimeException('DB connection not initialized ($conn).');
    }
    $conn->set_charset('utf8mb4');

    // --- Inputs ---
    $txn_date = trim((string)($_POST['txn_date'] ?? ''));
    $category = trim((string)($_POST['category'] ?? ''));
    $group    = trim((string)($_POST['catalog_subcategory'] ?? ''));
    $leaf     = trim((string)($_POST['subcategory'] ?? ''));
    $amount_s = trim((string)($_POST['amount'] ?? ''));

    if ($txn_date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $txn_date)) {
        throw new InvalidArgumentException('txn_date must be YYYY-MM-DD');
    }
    if ($category === '') {
        throw new InvalidArgumentException('category is required');
    }

    $isNumericCat = preg_match('/^\d+(?:\.\d+)?$/', $category) === 1;
    if ($isNumericCat && $leaf !== '') {
        $st = $conn->prepare("SELECT 1 FROM offertory_disb_catalog WHERE category=? LIMIT 1");
        if ($st) {
            $st->bind_param('s', $leaf);
            if ($st->execute()) {
                $st->store_result();
                if ($st->num_rows > 0) {
                    $category = $leaf;
                    $leaf = $category;
                    $group = '';
                }
            }
            $st->close();
        }
    }

    // Final guard: category must exist in catalog
    $stCat = $conn->prepare("SELECT 1 FROM offertory_disb_catalog WHERE category=? LIMIT 1");
    if (!$stCat) throw new RuntimeException('Prepare category check: ' . $conn->error);
    $stCat->bind_param('s', $category);
    if (!$stCat->execute()) throw new RuntimeException('Exec category check: ' . $stCat->error);
    $stCat->store_result();
    if ($stCat->num_rows === 0) {
        $stCat->close();
        jexit(false, 'Invalid category');
    }
    $stCat->close();


    // Guard: Supplies Expenses must only use these subcategories (stored in $leaf / POST[subcategory])
    if ($category === 'Supplies Expenses') {
        $allowed = ['Office Supplies Expense', 'Cleaning Materials'];

        if ($leaf === '' && in_array($group, $allowed, true)) {
            $leaf = $group;
            $group = '';
        }

        if (!in_array($leaf, $allowed, true)) {
            jexit(false, 'Invalid Supplies Expenses subcategory.');
        }

        $group = '';
    }

    $amount = (float)$amount_s;
    if (!is_finite($amount)) {
        $amount = 0.0;
    }

    $isStandalone = ($group === '' && ($leaf === '' || strcasecmp($leaf, $category) === 0));

    if ($leaf === '') {
        $leaf = $category;
    }

    $textSubcat = $isStandalone ? '' : (($group !== '') ? ($group . ' - ' . $leaf) : $leaf);

    // --- Resolve catalog_id ---
    $catalogId = null;

    if ($group !== '') {
        $sql = "SELECT id FROM offertory_disb_catalog WHERE category=? AND subcategory=? LIMIT 1";
        $st = $conn->prepare($sql);
        if (!$st) throw new RuntimeException('Prepare catalog: ' . $conn->error);
        $st->bind_param('ss', $category, $group);
        if (!$st->execute()) throw new RuntimeException('Exec catalog: ' . $st->error);
        $st->bind_result($cid);
        if ($st->fetch()) $catalogId = (int)$cid;
        $st->close();
    } else {
        $sql = "SELECT id FROM offertory_disb_catalog WHERE category=? AND (subcategory IS NULL OR subcategory='') LIMIT 1";
        $st = $conn->prepare($sql);
        if (!$st) throw new RuntimeException('Prepare catalog-standalone: ' . $conn->error);
        $st->bind_param('s', $category);
        if (!$st->execute()) throw new RuntimeException('Exec catalog-standalone: ' . $st->error);
        $st->bind_result($cid2);
        if ($st->fetch()) $catalogId = (int)$cid2;
        $st->close();
    }

    // --- Resolve subcategory_id (leaf) ---
    $subcatId = null;
    if ($catalogId !== null && !$isStandalone) {
        $sql = "SELECT id FROM offertory_disb_subcategories WHERE catalog_id=? AND name=? LIMIT 1";
        $st = $conn->prepare($sql);
        if (!$st) throw new RuntimeException('Prepare subcat: ' . $conn->error);
        $st->bind_param('is', $catalogId, $leaf);
        if (!$st->execute()) throw new RuntimeException('Exec subcat: ' . $st->error);
        $st->bind_result($sid);
        if ($st->fetch()) $subcatId = (int)$sid;
        $st->close();
    }

    // --- Locate existing row (strict → broad fallbacks) ---
    $existingId = null;

    if ($catalogId !== null && $subcatId !== null) {
        $sql = "SELECT id FROM offertory_disbursements
                WHERE txn_date=? AND category=? AND catalog_id=? AND subcategory_id=?
                LIMIT 1";
        $st = $conn->prepare($sql);
        if (!$st) throw new RuntimeException('Prepare find ids: ' . $conn->error);
        $st->bind_param('ssii', $txn_date, $category, $catalogId, $subcatId);
        if (!$st->execute()) throw new RuntimeException('Exec find ids: ' . $st->error);
        $st->bind_result($eid);
        if ($st->fetch()) $existingId = (int)$eid;
        $st->close();
    }

    
    // 1b) Standalone categories: match by catalog_id regardless of legacy subcategory text.
    // Some legacy rows incorrectly stored unrelated text in `subcategory` even for standalone categories.
    if ($existingId === null && $isStandalone && $catalogId !== null) {
        $sql = "SELECT id FROM offertory_disbursements
                WHERE txn_date=? AND category=? AND catalog_id=?
                ORDER BY id DESC LIMIT 1";
        $st = $conn->prepare($sql);
        if (!$st) throw new RuntimeException('Prepare find standalone by catalog_id: ' . $conn->error);
        $st->bind_param('ssi', $txn_date, $category, $catalogId);
        if (!$st->execute()) throw new RuntimeException('Exec find standalone by catalog_id: ' . $st->error);
        $st->bind_result($eid1b);
        if ($st->fetch()) $existingId = (int)$eid1b;
        $st->close();
    }

// 2) catalog_id + subcategory text (non-standalone)
    if ($existingId === null && $catalogId !== null && $textSubcat !== '') {
        $sql = "SELECT id FROM offertory_disbursements
                WHERE txn_date=? AND category=? AND catalog_id=? AND subcategory=?
                LIMIT 1";
        $st = $conn->prepare($sql);
        if (!$st) throw new RuntimeException('Prepare find cat+text: ' . $conn->error);
        $st->bind_param('ssis', $txn_date, $category, $catalogId, $textSubcat);
        if (!$st->execute()) throw new RuntimeException('Exec find cat+text: ' . $st->error);
        $st->bind_result($eid2);
        if ($st->fetch()) $existingId = (int)$eid2;
        $st->close();
    }

    // 3) date + category + (subcategory match | NULL | '')
    if ($existingId === null) {
        $matchSub = $isStandalone ? $category : $textSubcat;
        $sql = "SELECT id FROM offertory_disbursements
                WHERE txn_date=? AND category=? AND (subcategory=? OR subcategory IS NULL OR subcategory='')
                ORDER BY id DESC LIMIT 1";
        $st = $conn->prepare($sql);
        if (!$st) throw new RuntimeException('Prepare find cat+leaf: ' . $conn->error);
        $st->bind_param('sss', $txn_date, $category, $matchSub);
        if (!$st->execute()) throw new RuntimeException('Exec find cat+leaf: ' . $st->error);
        $st->bind_result($eid3);
        if ($st->fetch()) $existingId = (int)$eid3;
        $st->close();
    }

    // 4) Legacy fallback: date + category + subcategory text (NO cross-category collisions)
    if ($existingId === null && !$isStandalone && $textSubcat !== '') {
        $sql = "SELECT id FROM offertory_disbursements
            WHERE txn_date=? AND category=? AND (subcategory=? OR subcategory=?)
            ORDER BY id DESC LIMIT 1";
        $st = $conn->prepare($sql);
        if (!$st) throw new RuntimeException('Prepare find text-only: ' . $conn->error);

        $leafOnly = $leaf;
        $st->bind_param('ssss', $txn_date, $category, $textSubcat, $leafOnly);

        if (!$st->execute()) throw new RuntimeException('Exec find text-only: ' . $st->error);
        $st->bind_result($eid4);
        if ($st->fetch()) $existingId = (int)$eid4;
        $st->close();
    }

    if (!$conn->begin_transaction()) {
        throw new RuntimeException('Begin transaction failed: ' . $conn->error);
    }

    // --- Delete on zero/blank (allow negatives; delete only when amount is 0.00) ---
    $amount = round($amount, 2);
    if (abs($amount) < 0.005) {
        if ($existingId !== null) {
            $st = $conn->prepare("DELETE FROM offertory_disbursements WHERE id=?");
            if (!$st) throw new RuntimeException('Prepare delete: ' . $conn->error);
            $st->bind_param('i', $existingId);
            if (!$st->execute()) throw new RuntimeException('Exec delete: ' . $st->error);
            $st->close();
        } else {
            if ($isStandalone && $catalogId !== null) {
                // Standalone rows should not be keyed by legacy `subcategory` text.
                $st = $conn->prepare("DELETE FROM offertory_disbursements
                                      WHERE txn_date=? AND category=? AND catalog_id=?");
                if (!$st) throw new RuntimeException('Prepare delete standalone by catalog_id: ' . $conn->error);
                $st->bind_param('ssi', $txn_date, $category, $catalogId);
                if (!$st->execute()) throw new RuntimeException('Exec delete standalone by catalog_id: ' . $st->error);
                $st->close();
            } else {
                $matchSub = $isStandalone ? $category : $textSubcat;
                $st = $conn->prepare("DELETE FROM offertory_disbursements
                                      WHERE txn_date=? AND category=? AND (subcategory=? OR subcategory IS NULL OR subcategory='')");
                if ($st) {
                    $st->bind_param('sss', $txn_date, $category, $matchSub);
                    $st->execute();
                    $st->close();
                }
            }
        }

        if (!$conn->commit()) throw new RuntimeException('Commit failed: ' . $conn->error);
        jexit(true, '', ['deleted' => true]);
    }

    // --- Upsert ---
    if ($existingId !== null) {
        if ($isStandalone) {
            if ($catalogId !== null) {
                $sql = "UPDATE offertory_disbursements
                        SET amount=?, category=?, catalog_id=?, subcategory_id=NULL, subcategory=NULL, note=NULL
                        WHERE id=?";
                $st = $conn->prepare($sql);
                if (!$st) throw new RuntimeException('Prepare upd standalone+cat: ' . $conn->error);
                $st->bind_param('dsii', $amount, $category, $catalogId, $existingId);
            } else {
                $sql = "UPDATE offertory_disbursements
                        SET amount=?, category=?, catalog_id=NULL, subcategory_id=NULL, subcategory=NULL, note=NULL
                        WHERE id=?";
                $st = $conn->prepare($sql);
                if (!$st) throw new RuntimeException('Prepare upd standalone: ' . $conn->error);
                $st->bind_param('dsi', $amount, $category, $existingId);
            }
        } elseif ($catalogId !== null && $subcatId !== null) {
            $sql = "UPDATE offertory_disbursements
                    SET amount=?, category=?, catalog_id=?, subcategory_id=?, subcategory=?, note=NULL
                    WHERE id=?";
            $st = $conn->prepare($sql);
            if (!$st) throw new RuntimeException('Prepare upd ids: ' . $conn->error);
            $st->bind_param('dsiisi', $amount, $category, $catalogId, $subcatId, $textSubcat, $existingId);
        } elseif ($catalogId !== null) {
            $sql = "UPDATE offertory_disbursements
                    SET amount=?, category=?, catalog_id=?, subcategory_id=NULL, subcategory=?, note=NULL
                    WHERE id=?";
            $st = $conn->prepare($sql);
            if (!$st) throw new RuntimeException('Prepare upd cat: ' . $conn->error);
            $st->bind_param('dsisi', $amount, $category, $catalogId, $textSubcat, $existingId);
        } else {
            $sql = "UPDATE offertory_disbursements
                    SET amount=?, category=?, catalog_id=NULL, subcategory_id=NULL, subcategory=?, note=NULL
                    WHERE id=?";
            $st = $conn->prepare($sql);
            if (!$st) throw new RuntimeException('Prepare upd text: ' . $conn->error);
            $st->bind_param('dssi', $amount, $category, $textSubcat, $existingId);
        }

        if (!$st->execute()) throw new RuntimeException('Exec update: ' . $st->error);
        $st->close();
    } else {
        // INSERT
        if ($isStandalone) {
            if ($catalogId !== null) {
                $sql = "INSERT INTO offertory_disbursements
                        (txn_date, category, amount, catalog_id, subcategory_id, subcategory, note)
                        VALUES (?, ?, ?, ?, NULL, NULL, NULL)";
                $st = $conn->prepare($sql);
                if (!$st) throw new RuntimeException('Prepare ins standalone+cat: ' . $conn->error);
                $st->bind_param('ssdi', $txn_date, $category, $amount, $catalogId);
            } else {
                $sql = "INSERT INTO offertory_disbursements
                        (txn_date, category, amount, catalog_id, subcategory_id, subcategory, note)
                        VALUES (?, ?, ?, NULL, NULL, NULL, NULL)";
                $st = $conn->prepare($sql);
                if (!$st) throw new RuntimeException('Prepare ins standalone: ' . $conn->error);
                $st->bind_param('ssd', $txn_date, $category, $amount);
            }
        } elseif ($catalogId !== null && $subcatId !== null) {
            $sql = "INSERT INTO offertory_disbursements
                    (txn_date, category, amount, catalog_id, subcategory_id, subcategory, note)
                    VALUES (?, ?, ?, ?, ?, ?, NULL)";
            $st = $conn->prepare($sql);
            if (!$st) throw new RuntimeException('Prepare ins ids: ' . $conn->error);
            $st->bind_param('ssdiis', $txn_date, $category, $amount, $catalogId, $subcatId, $textSubcat);
        } elseif ($catalogId !== null) {
            $sql = "INSERT INTO offertory_disbursements
                    (txn_date, category, amount, catalog_id, subcategory_id, subcategory, note)
                    VALUES (?, ?, ?, ?, NULL, ?, NULL)";
            $st = $conn->prepare($sql);
            if (!$st) throw new RuntimeException('Prepare ins cat: ' . $conn->error);
            $st->bind_param('ssdis', $txn_date, $category, $amount, $catalogId, $textSubcat);
        } else {
            $sql = "INSERT INTO offertory_disbursements
                    (txn_date, category, amount, catalog_id, subcategory_id, subcategory, note)
                    VALUES (?, ?, ?, NULL, NULL, ?, NULL)";
            $st = $conn->prepare($sql);
            if (!$st) throw new RuntimeException('Prepare ins text: ' . $conn->error);
            $st->bind_param('ssds', $txn_date, $category, $amount, $textSubcat);
        }

        if (!$st->execute()) throw new RuntimeException('Exec insert: ' . $st->error);
        $st->close();
    }

    if (!$conn->commit()) throw new RuntimeException('Commit failed: ' . $conn->error);
    jexit(true);
} catch (Throwable $e) {
    @$conn->rollback();
    $stray = '';
    if (ob_get_length()) {
        $stray = ob_get_contents();
    }
    @ob_end_clean();
    error_log('[save-disbursement.php] ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'stray'   => $stray ? substr($stray, 0, 4000) : null
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
