<?php
require_once __DIR__ . '/_guard.php';
require_admin_and_post();

header('Content-Type: application/json');

try {
    $pdo = new PDO(
        'mysql:host=localhost;dbname=YOUR_DB;charset=utf8mb4',
        'YOUR_USER',
        'YOUR_PASS',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) throw new Exception("Invalid JSON.");

    $dateISO = isset($input['date']) ? trim($input['date']) : '';
    if (!$dateISO || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateISO)) {
        throw new Exception("Invalid date.");
    }

    $name  = trim($input['name'] ?? '');
    $role  = trim($input['role'] ?? 'Visitor');
    if ($name === '') throw new Exception("Name is required.");

    $mode_of_offertory = trim((string)($input['mode_of_offertory'] ?? 'Cash'));
    if (!in_array($mode_of_offertory, ['Cash', 'Bank'], true)) {
        $mode_of_offertory = 'Cash';
    }

    $tithes      = (float)($input['tithes'] ?? 0);
    $offering    = (float)($input['offering'] ?? 0);
    $pledge      = (float)($input['pledge'] ?? 0);
    $es          = (float)($input['eskwela_suporta'] ?? 0);
    $others      = (float)($input['others'] ?? 0);
    $construction = (float)($input['construction'] ?? 0);
    $samar       = (float)($input['samarleyte_pledge'] ?? 0);

    $total = $tithes + $offering + $pledge + $es + $others + $construction + $samar;

    $createdAt = $dateISO . " 00:00:00";

    $pdo->beginTransaction();

    $username = ($role === 'Visitor') ? 'visitor' : $name;
    $visitorName = ($role === 'Visitor') ? $name : null;

    $stmt = $pdo->prepare("
        INSERT INTO offertory
        (user_id, mode_of_offertory, tithes, offering, pledge, eskwela_suporta, others, other_use,
        construction, samarleyte_pledge, total, created_at, username, visitor_name)
        VALUES
        (NULL, :mode_of_offertory, :tithes, :offering, :pledge, :es, :others, NULL,
        :construction, :samar, :total, :created_at, :username, :visitor_name)
    ");
    $stmt->execute([
        ':mode_of_offertory' => $mode_of_offertory,
        ':tithes'            => $tithes,
        ':offering'          => $offering,
        ':pledge'            => $pledge,
        ':es'                => $es,
        ':others'            => $others,
        ':construction'      => $construction,
        ':samar'             => $samar,
        ':total'             => $total,
        ':created_at'        => $createdAt,
        ':username'          => $username,
        ':visitor_name'      => $visitorName
    ]); 

    $newId = (int)$pdo->lastInsertId();

    $stmt2 = $pdo->prepare("
    INSERT INTO offertory_daily_totals
      (`date`, dailyTithes_total, dailyOffering_total, dailyPledge_total,
       dailyEskwelaSuporta_total, dailyOthers_total, dailyConstruction_total,
       dailySamarLeyte_total, dailyOverall_total)
    VALUES
      (:date, :tithes, :offering, :pledge, :es, :others, :construction, :samar, :overall)
    ON DUPLICATE KEY UPDATE
      dailyTithes_total           = dailyTithes_total           + VALUES(dailyTithes_total),
      dailyOffering_total         = dailyOffering_total         + VALUES(dailyOffering_total),
      dailyPledge_total           = dailyPledge_total           + VALUES(dailyPledge_total),
      dailyEskwelaSuporta_total   = dailyEskwelaSuporta_total   + VALUES(dailyEskwelaSuporta_total),
      dailyOthers_total           = dailyOthers_total           + VALUES(dailyOthers_total),
      dailyConstruction_total     = dailyConstruction_total     + VALUES(dailyConstruction_total),
      dailySamarLeyte_total       = dailySamarLeyte_total       + VALUES(dailySamarLeyte_total),
      dailyOverall_total          = dailyOverall_total          + VALUES(dailyOverall_total)
  ");
    $stmt2->execute([
        ':date'        => $dateISO,
        ':tithes'      => $tithes,
        ':offering'    => $offering,
        ':pledge'      => $pledge,
        ':es'          => $es,
        ':others'      => $others,
        ':construction' => $construction,
        ':samar'       => $samar,
        ':overall'     => $total
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'id'      => $newId,
        'total'   => number_format($total, 2, '.', '')
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
