<?php
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    ['value' => 'admin',   'label' => 'Admin'],
    ['value' => 'member',  'label' => 'Member'],
    ['value' => 'visitor', 'label' => 'Visitor'],
]);
