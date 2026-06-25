<?php
require 'admin-authorization.php';
require_once __DIR__ . '/db/db.php';
require_once __DIR__ . '/includes/csrf.php';   // 🔐 add this

// generate a CSRF token for this page
$__csrf_token = csrf_token();
$tab = $_GET['tab'] ?? 'receipts';
?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= htmlspecialchars($__csrf_token, ENT_QUOTES, 'UTF-8') ?>">
    <title>Admin | Offertory</title>
    <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">
    <link rel="stylesheet" href="admin-style.css">
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css" rel="stylesheet">
</head>

<body class="homepage">

    <?php include 'admin-header.php'; ?>

    <main>
        <h1>Offertory Management</h1>

        <!-- Tabs -->
        <div class="status-tabs">
            <button class="status-tab <?= $tab === 'receipts' ? 'active' : '' ?>" onclick="location.href='admin-offertory.php?tab=receipts'">Receipts</button>
            <button class="status-tab <?= $tab === 'summary' ? 'active' : '' ?>" onclick="location.href='admin-offertory.php?tab=summary'">Summary</button>
            <button class="status-tab <?= $tab === 'records' ? 'active' : '' ?>" onclick="location.href='admin-offertory.php?tab=records'">Member Records</button>
        </div>

        <?php if ($tab === 'receipts'): ?>
            <div id="calendar"></div>

            <!-- Export and Controls -->
            <div class="controls" style="margin-top: 20px; margin-bottom: -20px;">
                <div class="OP-export-buttons">
                    <div class="OP-export-dropdown" id="xlsxDropdown">
                        <button id="offertoryExportXLSX">XLSX ▼</button>
                        <div class="OP-dropdown-menu">
                            <button data-type="today">Receipts</button>
                            <button data-type="computed">Computed</button>
                            <button data-type="week_overall">Week Overall</button>
                        </div>
                    </div>

                    <div class="OP-export-dropdown" id="pdfDropdown">
                        <button id="offertoryExportPDF">PDF ▼</button>
                        <div class="OP-dropdown-menu">
                            <button data-type="today">Receipts</button>
                            <button data-type="computed">Computed</button>
                            <button data-type="week_overall">Week Overall</button>
                        </div>
                    </div>
                </div>

                <div class="search-sort">
                    <div class="search-box">
                        <input type="text" id="offertorySearchName" placeholder="Search Name:">
                    </div>
                    <select id="offertorySortBy">
                        <option value="date_received">Date Received</option>
                        <option value="username">Name</option>
                        <option value="role">Role</option>
                    </select>

                    <select id="offertoryRoleSort">
                        <option value="all">All</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="visitor">Visitor</option>
                    </select>

                    <button id="offertoryToggleSortOrder" class="sort-btn">▲</button>
                </div>
            </div>

            <div id="receiptsContainer" style="margin-top: 40px; display:none;">
                <h3 class="OP-flex">
                    <span id="selectedDate"></span>
                    <span id="receiptsActions" class="export-buttons">
                        <button id="rcEditBtn">EDIT</button>
                        <button id="rcSaveBtn" class="OP-hidden" disabled>SAVE</button>
                    </span>
                </h3>

                <div class="table-container">
                    <table id="receiptsTable">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Type</th>
                                <th>Mode</th>
                                <th>Tithes</th>
                                <th>Offering</th>
                                <th>Pledge</th>
                                <th>ES</th>
                                <th>Others</th>
                                <th>Construction</th>
                                <th>Samar Leyte</th>
                                <th>Total</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <div id="receiptsComputedContainer" class="table-container" style="margin-top:16px;"></div>

            <!-- FullCalendar JS -->
            <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>

        <?php elseif ($tab === 'summary'): ?>

            <!-- Month selector -->
            <div class="controls" style="margin-top: 10px;">
                <div class="summary-monthpicker" id="summaryMonthPicker">
                    <label class="summary-monthpicker-label">Summary Months</label>

                    <input type="month" id="sumMonth" hidden>

                    <div class="summary-monthpicker-bar">
                        <button type="button" id="sumMonthPickerToggle" class="summary-monthpicker-toggle">
                            Select month(s)
                        </button>
                        <div id="summaryMonthChips" class="summary-month-chips"></div>
                    </div>

                    <div id="summaryMonthPickerPanel" class="summary-monthpicker-panel" hidden>
                        <div class="summary-monthpicker-row">
                            <label for="summaryMonthPickerYear">Year</label>
                            <select id="summaryMonthPickerYear"></select>
                        </div>

                        <div id="summaryMonthPickerMonths" class="summary-monthpicker-months"></div>

                        <div class="summary-monthpicker-actions">
                            <span id="summaryMonthApplySpinner" class="summary-month-apply-spinner" aria-hidden="true" hidden></span>
                            <button type="button" id="summaryMonthApplyBtn">Apply</button>
                        </div>
                    </div>
                </div>

                <div class="OP-export-buttons" style="margin-left:auto;">
                    <div class="OP-export-dropdown" id="summaryCsvDropdown">
                        <button id="summaryExportCSV">CSV ▼</button>
                        <div class="OP-dropdown-menu">
                            <button data-type="week">Week</button>
                            <button data-type="month">Month</button>
                            <button data-type="month_overall">Overall Receipt of Month</button>
                        </div>
                    </div>

                    <div class="OP-export-dropdown" id="summaryPdfDropdown">
                        <button id="summaryExportPDF">PDF ▼</button>
                        <div class="OP-dropdown-menu">
                            <button data-type="week">Week</button>
                            <button data-type="month">Month</button>
                            <button data-type="month_overall">Overall Receipt of Month</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Weekly Totals Table -->
            <div id="summaryWeeklyTotalsContainer" style="margin-top: 20px;">
                <h3>Weekly Totals for <span id="summaryWeeklyRange"></span></h3>
                <div class="table-container">
                    <table id="summaryWeeklyTotalsTable">
                        <thead>
                            <tr>
                                <th>Week</th>
                                <th>Tithes</th>
                                <th>Offering</th>
                                <th>Pledge</th>
                                <th>Eskwela Suporta</th>
                                <th>Others</th>
                                <th>Construction</th>
                                <th>Samar Leyte</th>
                                <th>Overall Total</th>
                                <th>Last Updated</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <div id="summaryMultiMonthsViewport" class="summary-multi-months-viewport" hidden>
                <div id="summaryMultiMonthsTrack" class="summary-multi-months-track"></div>
            </div>

            <div id="summaryMultiMonthsScrollbar" class="summary-multi-months-scrollbar" hidden>
                <div id="summaryMultiMonthsScrollbarInner" class="summary-multi-months-scrollbar-inner"></div>
            </div>

            <div id="summaryComputedTotals" class="table-container" style="margin-top:16px;"></div>

        <?php elseif ($tab === 'records'): ?>
            <!-- Search + Sort controls (same design as Receipts, no role filter) -->
            <div class="search-sort" style="margin-top: 20px; margin-bottom: 10px;">
                <div class="search-box">
                    <input type="text" id="memberSearchName" placeholder="Search Name:">
                </div>
                <button id="memberToggleSortOrder" class="sort-btn">▲</button>
            </div>

            <!-- Member records: left NAME list + right calendar -->
            <div class="member-records-layout">
                <div class="member-records-list">
                    <div class="table-container">
                        <table id="memberRecordsTable">
                            <thead>
                                <tr>
                                    <th>NAME</th>
                                    <th class="member-view-all-col"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php
                                // Load all approved admin/member usernames (exclude visitor), sorted A–Z
                                $dbConn = null;
                                if (isset($mysqli) && $mysqli instanceof mysqli) {
                                    $dbConn = $mysqli;
                                } elseif (isset($conn) && $conn instanceof mysqli) {
                                    $dbConn = $conn;
                                }

                                if ($dbConn) {
                                    $stmtMembers = $dbConn->prepare("
                                        SELECT username
                                        FROM registrations
                                        WHERE status = 'approved'
                                          AND role IN ('admin', 'member')
                                          AND username IS NOT NULL
                                          AND username <> ''
                                        ORDER BY username ASC
                                    ");

                                    if ($stmtMembers) {
                                        $stmtMembers->execute();
                                        $resMembers = $stmtMembers->get_result();
                                        while ($m = $resMembers->fetch_assoc()) {
                                            $username = htmlspecialchars($m['username'] ?? '', ENT_QUOTES, 'UTF-8');
                                            if ($username === '') {
                                                continue;
                                            }
                                            // Single NAME column only
                                            echo "<tr><td>{$username}</td><td class=\"member-view-all-cell\"></td></tr>";
                                        }
                                        $stmtMembers->close();
                                    }
                                }
                                ?>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="member-records-calendar">
                    <div id="memberRecordsCalendar"></div>
                </div>
            </div>

            <!-- Member Receipts Modal (Member Records tab) -->
            <div id="memberReceiptsModal" class="modal-overlay">
                <div class="modal-content">
                    <button type="button" id="closeMemberReceiptsModal" class="close-btn">&times;</button>
                    <h3 id="memberReceiptsTitle" class="modal-title"></h3>

                    <div class="details-section">
                        <div class="table-container">
                            <table id="memberReceiptsTable">
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Tithes</th>
                                        <th>Offering</th>
                                        <th>Pledge</th>
                                        <th>ES</th>
                                        <th>Others</th>
                                        <th>Construction</th>
                                        <th>Samar Leyte</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- row is filled dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Member Records: Full receipt history modal -->
            <div id="memberHistoryModal" class="modal-overlay">
                <div class="modal-content">
                    <button type="button" id="closeMemberHistoryModal" class="close-btn">&times;</button>
                    <div class="member-history-header">
                        <h3 id="memberHistoryTitle" class="modal-title"></h3>
                        <div class="OP-export-buttons member-history-export">
                            <div class="OP-export-dropdown" id="memberHistoryCsvDropdown">
                                <button id="memberHistoryExportCSV">CSV</button>
                            </div>
                            <div class="OP-export-dropdown" id="memberHistoryPdfDropdown">
                                <button id="memberHistoryExportPDF">PDF</button>
                            </div>
                        </div>
                    </div>

                    <div class="details-section">
                        <div class="table-container">
                            <table id="memberHistoryTable">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Tithes</th>
                                        <th>Offering</th>
                                        <th>Pledge</th>
                                        <th>ES</th>
                                        <th>Others</th>
                                        <th>Construction</th>
                                        <th>Samar Leyte</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- Filled dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- FullCalendar for Member Records tab -->
            <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>

        <?php endif; ?>
    </main>

    <div id="bankProofModal" class="modal-overlay" style="display:none;">
        <div class="modal-content bank-proof-modal-content">
            <div class="bank-proof-modal-header">
                <h3 id="bankProofModalTitle">Proof of Receipt</h3>
                <div class="bank-proof-modal-actions">
                    <a id="bankProofDownloadBtn" href="#" download class="btn-export-like">Download</a>
                    <button type="button" id="closeBankProofModal" class="btn-reject" aria-label="Close">✕</button>
                </div>
            </div>

            <div class="bank-proof-modal-body">
                <img id="bankProofModalImage" src="" alt="Bank Proof Image">
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/exceljs/dist/exceljs.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>
    <script src="assets/js/ReceiptsTab_xlsxExports.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
    <script src="assets/js/ReceiptsTab_pdfExports.js"></script>
    <script>
        window.CSRF_TOKEN = '<?= htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') ?>';
    </script>
    <script src="assets/js/admin-script.js?v=20260422-1"></script>
    <script src="assets/js/adminoffertory_memberrecords.js?v=20260508-2"></script>

    <?php if ($tab === 'summary'): ?>
        <script src="assets/js/adminoffertory_summary.js?v=20260201"></script>
    <?php endif; ?>

</body>

</html>