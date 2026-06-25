<?php
require_once __DIR__ . '/_guard.php';
require_admin_and_post();

// ---------- Basic headers ----------
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$tableName   = 'offertory';
$primaryKey  = 'id';

$DEBUG = false;

$includeTried = [];
$loadedDb = false;
$pathsDb = [
    __DIR__ . '/../db/db.php',
    __DIR__ . '/../db.php',
    __DIR__ . '/../../db.php',
    __DIR__ . '/../../BCCSMOfficial/db.php',
];
foreach ($pathsDb as $p) {
    if (is_file($p)) {
        require_once $p;
        $loadedDb = true;
        break;
    }
    $includeTried[] = $p;
}
if (!$loadedDb || !isset($conn) || !($conn instanceof mysqli)) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection not available (db.php not found or $conn missing).',
        'tried'   => $DEBUG ? $includeTried : [],
    ]);
    exit;
}

// ---------- Read & validate input ----------
$id = $_GET['id'] ?? $_POST['id'] ?? null;
if ($id === null || $id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing id']);
    exit;
}
if (!ctype_digit((string)$id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid id']);
    exit;
}
$id = (int)$id;

// ---------- Look up row first (for daily totals & date) ----------
$sqlFind = "
    SELECT
        id,
        DATE(created_at) AS d,
        tithes, offering, pledge, eskwela_suporta,
        others, construction, samarleyte_pledge,
        total
    FROM `$tableName`
    WHERE `$primaryKey` = ?
    LIMIT 1
";
$stmt = $conn->prepare($sqlFind);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => ($DEBUG ? 'Prepare find failed: ' . $conn->error : 'Server error')]);
    exit;
}
$stmt->bind_param('i', $id);
$stmt->execute();
$old = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$old) {
    echo json_encode(['success' => false, 'message' => 'Row not found or already deleted.']);
    exit;
}

// ---------- Delete ----------
$sqlDel = "DELETE FROM `$tableName` WHERE `$primaryKey` = ? LIMIT 1";
$stmt = $conn->prepare($sqlDel);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => ($DEBUG ? 'Prepare delete failed: ' . $conn->error : 'Server error')]);
    exit;
}
$stmt->bind_param('i', $id);
$ok = $stmt->execute();
$rows = $stmt->affected_rows;
$stmt->close();

if (!$ok || $rows <= 0) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => ($DEBUG ? 'Execute failed or no rows deleted' : 'Server error')]);
    exit;
}

// ---------- Subtract from daily totals for that created_at date ----------
$dateISO      = $old['d'];
$negTithes    = -(float)$old['tithes'];
$negOffering  = -(float)$old['offering'];
$negPledge    = -(float)$old['pledge'];
$negES        = -(float)$old['eskwela_suporta'];
$negOthers    = -(float)$old['others'];
$negConstr    = -(float)$old['construction'];
$negSamar     = -(float)$old['samarleyte_pledge'];
$negOverall   = -(float)$old['total'];

$sqlDaily = "
    INSERT INTO offertory_daily_totals
      (date, dailyTithes_total, dailyOffering_total, dailyPledge_total, dailyEskwelaSuporta_total,
       dailyOthers_total, dailyConstruction_total, dailySamarLeyte_total, dailyOverall_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      dailyTithes_total         = dailyTithes_total         + VALUES(dailyTithes_total),
      dailyOffering_total       = dailyOffering_total       + VALUES(dailyOffering_total),
      dailyPledge_total         = dailyPledge_total         + VALUES(dailyPledge_total),
      dailyEskwelaSuporta_total = dailyEskwelaSuporta_total + VALUES(dailyEskwelaSuporta_total),
      dailyOthers_total         = dailyOthers_total         + VALUES(dailyOthers_total),
      dailyConstruction_total   = dailyConstruction_total   + VALUES(dailyConstruction_total),
      dailySamarLeyte_total     = dailySamarLeyte_total     + VALUES(dailySamarLeyte_total),
      dailyOverall_total        = dailyOverall_total        + VALUES(dailyOverall_total),
      last_updated              = CURRENT_TIMESTAMP
";
$stmt = $conn->prepare($sqlDaily);
if ($stmt) {
    $stmt->bind_param(
        "sdddddddd",
        $dateISO,
        $negTithes,
        $negOffering,
        $negPledge,
        $negES,
        $negOthers,
        $negConstr,
        $negSamar,
        $negOverall
    );
    $stmt->execute(); // if this fails we still keep the deletion; UI will re-sync on next save
    $stmt->close();
}

echo json_encode(['success' => true]);
