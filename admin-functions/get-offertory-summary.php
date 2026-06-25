<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function decode_json(string $s)
{
    $data = json_decode($s, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return ['success' => false, 'error' => 'Invalid JSON from included script', 'raw' => $s];
    }
    return $data;
}

function include_json(string $scriptBasename, array $params)
{
    $script = __DIR__ . '/' . ltrim($scriptBasename, '/');
    if (!is_file($script)) {
        return ['success' => false, 'error' => "Script not found: {$scriptBasename}"];
    }

    // Backup globals we touch
    $oldGet = $_GET;

    // Set params into $_GET for the included script
    $_GET = $params + $_GET;

    ob_start();
    try {
        include $script;
    } catch (Throwable $e) {
        // Restore $_GET before returning
        $_GET = $oldGet;
        ob_end_clean();
        return ['success' => false, 'error' => $e->getMessage()];
    }
    $out = ob_get_clean();

    // Restore
    $_GET = $oldGet;

    return decode_json((string)$out);
}

$date = isset($_GET['date']) ? trim((string)$_GET['date']) : date('Y-m-d');

// Basic sanity for date
$dt = DateTime::createFromFormat('Y-m-d', $date);
if (!$dt) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'Invalid date format. Use YYYY-MM-DD.'
    ]);
    exit;
}

$month = isset($_GET['month']) ? (int)$_GET['month'] : (int)$dt->format('n');
$year  = isset($_GET['year'])  ? (int)$_GET['year']  : (int)$dt->format('Y');

if ($month < 1 || $month > 12) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'Invalid month. Use 1–12.'
    ]);
    exit;
}
if ($year < 2000 || $year > 3000) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'Invalid year.'
    ]);
    exit;
}

$receipts = include_json('get-offertory-by-date.php', [
    'date' => $date
]);
$receiptsSuccess = is_array($receipts) && (empty($receipts['error']) || array_is_list($receipts));

$daily = include_json('get-offertory-daily-totals.php', [
    'date' => $date
]);
$dailySuccess = is_array($daily) && !empty($daily['success']);

$weekly = include_json('get-offertory-weekly-totals.php', [
    'month' => $month,
    'year'  => $year
]);
$weeklySuccess = is_array($weekly) && !empty($weekly['success']);

$monthly = include_json('get-offertory-monthly-totals.php', [
    'month' => $month,
    'year'  => $year
]);
$monthlySuccess = is_array($monthly) && !empty($monthly['success']);

// --- Build response ---
$monthLabel = DateTime::createFromFormat('!m', (string)$month)->format('F') . " " . $year;

$out = [
    'success' => ($receiptsSuccess && $dailySuccess && $weeklySuccess && $monthlySuccess),
    'context' => [
        'date'       => $date,
        'month'      => $month,
        'year'       => $year,
        'monthLabel' => $monthLabel
    ],
    'receipts' => array_is_list($receipts) ? $receipts : (isset($receipts['data']) ? $receipts['data'] : []),
    'daily'    => $dailySuccess   ? ($daily['total']   ?? null) : null,
    'weeks'    => $weeklySuccess  ? ($weekly['weeks']  ?? [])   : [],
    'monthly'  => $monthlySuccess ? ($monthly['totals'] ?? null) : null,
    'errors'   => []
];

if (!$receiptsSuccess) $out['errors']['receipts'] = $receipts['error'] ?? 'Failed / unexpected output';
if (!$dailySuccess)    $out['errors']['daily']    = $daily['error']    ?? 'Failed / unexpected output';
if (!$weeklySuccess)   $out['errors']['weekly']   = $weekly['error']   ?? 'Failed / unexpected output';
if (!$monthlySuccess)  $out['errors']['monthly']  = $monthly['error']  ?? 'Failed / unexpected output';

echo json_encode($out);
