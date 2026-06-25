<?php
session_start();

function sanitize_redirect(?string $redirect): string
{
    $redirect = trim((string)($redirect ?? ''));
    if ($redirect === '') {
        return '';
    }

    $path = parse_url($redirect, PHP_URL_PATH);
    if (!is_string($path) || $path === '') {
        return '';
    }

    return basename($path);
}

function redirect_to_login_error(string $error, string $redirect = ''): void
{
    $params = ['error' => $error];

    if ($redirect !== '') {
        $params['redirect'] = $redirect;
    }

    header('Location: login.php?' . http_build_query($params));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("Location: login.php");
    exit;
}

$username = trim((string)($_POST['username'] ?? ''));
$password = (string)($_POST['password'] ?? '');
$redirect = sanitize_redirect($_POST['redirect'] ?? $_GET['redirect'] ?? '');

if ($username === '' || $password === '') {
    redirect_to_login_error('1', $redirect);
}

$mysqli = new mysqli("localhost", "root", "", "BCC_RegistrationForm");
if ($mysqli->connect_errno) {
    redirect_to_login_error('1', $redirect);
}

$stmt = $mysqli->prepare("SELECT id, username, password, role, status FROM registrations WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows === 1) {
    $stmt->bind_result($id, $dbUsername, $hashedPassword, $role, $status);
    $stmt->fetch();

    if (is_string($hashedPassword) && password_verify($password, $hashedPassword)) {
        if ($status === 'pending') {
            $stmt->close();
            $mysqli->close();
            redirect_to_login_error('pending', $redirect);
        }

        if ($status === 'rejected') {
            $stmt->close();
            $mysqli->close();
            redirect_to_login_error('rejected', $redirect);
        }

        $_SESSION['user_id'] = $id;
        $_SESSION['username'] = $dbUsername;
        $_SESSION['role'] = $role;

        $stmt->close();
        $mysqli->close();

        if ($redirect !== '') {
            header("Location: $redirect");
            exit;
        }

        if ($role === 'admin') {
            header("Location: admin-dashboard.php");
        } else {
            header("Location: index.php");
        }
        exit;
    }

    $stmt->close();
    $mysqli->close();
    redirect_to_login_error('1', $redirect);
}

$stmt->close();
$mysqli->close();
redirect_to_login_error('1', $redirect);
