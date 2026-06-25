<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function csrf_from_request(): ?string
{
    if (!empty($_SERVER['HTTP_X_CSRF_TOKEN'])) {
        return $_SERVER['HTTP_X_CSRF_TOKEN'];
    }
    if (isset($_POST['csrf_token'])) {
        return (string)$_POST['csrf_token'];
    }
    if (isset($_GET['csrf_token'])) {
        return (string)$_GET['csrf_token'];
    }
    return null;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_field(): string
{
    $t = htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8');
    return '<input type="hidden" name="csrf_token" value="' . $t . '">';
}

function csrf_check(?string $token): bool
{
    if (empty($_SESSION['csrf_token'])) return false;
    return is_string($token) && hash_equals($_SESSION['csrf_token'], $token);
}

if (!function_exists('csrf_verify')) {
    function csrf_verify(?string $token): bool
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        $sessionToken = $_SESSION['csrf_token'] ?? '';
        return is_string($token) && is_string($sessionToken) && hash_equals($sessionToken, $token);
    }
}

function csrf_verify_or_400(): void
{
    if (!csrf_verify(csrf_from_request())) {
        http_response_code(419);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'Invalid or missing CSRF token']);
        exit;
    }
}

function csrf_require_or_fail(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    $token  = csrf_from_request();

    $ok = ($method === 'POST') && csrf_check($token);

    if (!$ok) {
        http_response_code(419);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'Invalid or missing CSRF token. Please refresh.'
        ]);
        exit;
    }
}
