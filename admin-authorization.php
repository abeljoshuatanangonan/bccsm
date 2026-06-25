<?php
// /admin-authorization.php  (drop-in)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$authorized = isset($_SESSION['user_id']) && ($_SESSION['role'] ?? '') === 'admin';

// Decide if this request is for an API (JSON) vs. a page
$uri         = $_SERVER['REQUEST_URI'] ?? '';
$accept      = $_SERVER['HTTP_ACCEPT'] ?? '';
$isApiRoute  = strpos($uri, 'admin-functions/') !== false;             // our API folder
$wantsJson   = $isApiRoute || stripos($accept, 'application/json') !== false;

if (!$authorized) {
    if ($wantsJson) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }
    header("Location: ../login.php");
    exit;
}

// Resolve DB bootstrap after auth
require __DIR__ . '/db/db.php';
