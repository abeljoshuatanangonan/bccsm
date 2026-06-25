<?php
require_once __DIR__ . '/../db/db.php';
header('Content-Type: application/json; charset=utf-8');

$role = isset($_GET['role']) ? strtolower(trim((string) $_GET['role'])) : '';
$type = isset($_GET['type']) ? strtolower(trim((string) $_GET['type'])) : 'single';

if (!in_array($role, ['admin', 'member'], true)) {
    echo json_encode([]);
    exit;
}

if (!in_array($type, ['single', 'couple'], true)) {
    $type = 'single';
}

function buildCoupleDisplayName(array $primaryUser, array $spouseUser): string
{
    $first = $primaryUser;
    $second = $spouseUser;

    if (($primaryUser['gender'] ?? '') === 'Female' && ($spouseUser['gender'] ?? '') === 'Male') {
        $first = $spouseUser;
        $second = $primaryUser;
    }

    return trim((string) $first['username']) . ' & ' . trim((string) $second['username']);
}

if ($type === 'single') {
    $stmt = $conn->prepare("
      SELECT id,
             CONCAT(surname, ', ', first_name, IFNULL(CONCAT(' ', middle_name), '')) AS full_name,
             username
      FROM registrations
      WHERE role = ? AND status = 'approved'
      ORDER BY surname, first_name
    ");
    $stmt->bind_param('s', $role);
    $stmt->execute();
    $res = $stmt->get_result();

    $out = [];
    while ($r = $res->fetch_assoc()) {
        $username = trim((string)($r['username'] ?? ''));

        $out[] = [
            'id' => (int)$r['id'],
            'label' => $username,
            'username' => $username,
            'type' => 'single',
        ];
    }
    $stmt->close();

    echo json_encode($out);
    exit;
}

$stmt = $conn->prepare("
    SELECT
        r.id,
        r.username,
        r.gender,
        r.role,
        r.spouse_id,
        s.id AS spouse_user_id,
        s.username AS spouse_username,
        s.gender AS spouse_gender,
        s.role AS spouse_role,
        s.spouse_id AS spouse_spouse_id
    FROM registrations r
    INNER JOIN registrations s ON s.id = r.spouse_id
    WHERE r.role = ?
      AND r.status = 'approved'
      AND r.spouse_id IS NOT NULL
      AND s.status = 'approved'
      AND s.spouse_id = r.id
    ORDER BY r.username ASC
");
$stmt->bind_param('s', $role);
$stmt->execute();
$res = $stmt->get_result();

$out = [];
$seen = [];

while ($r = $res->fetch_assoc()) {
    $primaryId = (int)($r['id'] ?? 0);
    $spouseId = (int)($r['spouse_user_id'] ?? 0);

    if ($primaryId <= 0 || $spouseId <= 0) {
        continue;
    }

    $pairKey = min($primaryId, $spouseId) . ':' . max($primaryId, $spouseId);
    if (isset($seen[$pairKey])) {
        continue;
    }
    $seen[$pairKey] = true;

    $primary = [
        'id' => $primaryId,
        'username' => (string)($r['username'] ?? ''),
        'gender' => (string)($r['gender'] ?? ''),
    ];

    $spouse = [
        'id' => $spouseId,
        'username' => (string)($r['spouse_username'] ?? ''),
        'gender' => (string)($r['spouse_gender'] ?? ''),
    ];

    $label = buildCoupleDisplayName($primary, $spouse);

    $out[] = [
        'id' => $primaryId,
        'label' => $label,
        'username' => (string)($r['username'] ?? ''),
        'spouse_id' => $spouseId,
        'spouse_username' => (string)($r['spouse_username'] ?? ''),
        'type' => 'couple',
    ];
}
$stmt->close();

echo json_encode($out);
