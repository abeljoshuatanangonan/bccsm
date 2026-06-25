<?php
$mysqli = new mysqli("localhost", "root", "", "BCC_RegistrationForm");
if ($mysqli->connect_errno) {
    echo "error";
    exit;
}

$username = $_POST['username'] ?? '';
$stmt = $mysqli->prepare("SELECT id FROM registrations WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$stmt->store_result();
echo ($stmt->num_rows > 0) ? "taken" : "available";
$stmt->close();
$mysqli->close();
