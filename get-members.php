<?php
header("Content-Type: application/json");
require 'admin-authorization.php';

$branch = $_GET['branch'] ?? 'San Mateo';
$status = $_GET['status'] ?? 'pending'; // default to pending just in case

$data = [];

if (isset($mysqli)) {
    $stmt = $mysqli->prepare("
        SELECT id, username, contact, birthday, `group`, membership_date, baptism_date,
               created_at, date_approved, date_rejected, status
        FROM registrations
        WHERE bcc_branch=? AND status=?
        ORDER BY id DESC
    ");
    $stmt->bind_param("ss", $branch, $status);
    $stmt->execute();
    $result = $stmt->get_result();

    while ($row = $result->fetch_assoc()) {
        // Decide which date to show
        switch ($row['status']) {
            case 'pending':
                $row['date_display'] = $row['created_at'];
                break;

            case 'approved':
                $row['date_display'] = $row['date_approved'] ?? $row['created_at'];
                break;

            case 'rejected':
                $row['date_display'] = $row['date_rejected'] ?? $row['created_at'];
                break;

            default:
                $row['date_display'] = $row['created_at'];
                break;
        }

        $data[] = $row;
    }

    $stmt->close();
}

echo json_encode($data);
