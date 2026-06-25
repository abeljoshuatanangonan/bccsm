<?php
// admin-functions/_guard.php

// Correct path: admin-functions/../includes/csrf.php
require_once __DIR__ . '/../includes/csrf.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

/**
 * Small helper so all exits are consistent JSON.
 */
function guard_json_exit(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

/**
 * Must be:
 *   - POST request
 *   - Valid CSRF token
 *   - Logged-in admin user
 */
function require_admin_and_post(): void
{
    // 1) Enforce method
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($method !== 'POST') {
        guard_json_exit(405, [
            'success' => false,
            'message' => 'Method Not Allowed',
        ]);
    }

    // 2) CSRF check (uses csrf.php helper)
    csrf_require_or_fail();

    // 3) Admin session
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $userId = $_SESSION['user_id'] ?? null;
    $role   = $_SESSION['role'] ?? null;

    if (!$userId || $role !== 'admin') {
        guard_json_exit(403, [
            'success' => false,
            'message' => 'Forbidden',
        ]);
    }
}

/**
 * For endpoints that only need admin authentication (GET or POST).
 */
function require_admin(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $userId = $_SESSION['user_id'] ?? null;
    $role   = $_SESSION['role'] ?? null;

    if (!$userId || $role !== 'admin') {
        guard_json_exit(403, [
            'success' => false,
            'message' => 'Forbidden',
        ]);
    }
}
