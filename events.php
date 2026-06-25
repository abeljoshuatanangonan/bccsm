<?php
session_start();
include __DIR__ . '/db/db.php';

$events = [];
if (isset($mysqli)) {
    $res = $mysqli->query("SELECT * FROM homepage_events ORDER BY event_date DESC, id DESC");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $events[] = $row;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Events | Bride of Christ Church: San Mateo</title>
    <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="stylesheet" href="assets/css/events.css">
</head>

<body>

    <?php include 'includes/header.php'; ?>
    <?php include 'includes/sidebar.php'; ?>

    <main id="main">
        <section class="featuredevent">
            <div class="eventspage-inner">
                <h2 class="eventspage-title">Recent Church Events</h2>
            </div>
        </section>

        <?php if (count($events) === 0): ?>
            <section class="featuredevent">
                <div class="eventspage-inner">
                    <p style="margin: 10px 0 30px;">No events posted yet.</p>
                </div>
            </section>
        <?php else: ?>
            <?php foreach ($events as $ev): ?>
                <?php
                $id = (int)($ev['id'] ?? 0);
                $title = (string)($ev['title'] ?? '');
                $img = (string)($ev['image_path'] ?? '');
                $detailsRaw = (string)($ev['details'] ?? '');

                $dateRaw = $ev['event_date'] ?? null;
                $dateText = '';
                if ($dateRaw) {
                    $ts = strtotime((string)$dateRaw);
                    $dateText = $ts ? date('F j, Y', $ts) : (string)$dateRaw;
                }
                ?>
                <section class="featuredevent" id="event-<?= $id ?>">
                    <div class="featuredevent-card">
                        <div class="featuredevent-media">
                            <?php if ($img !== ''): ?>
                                <img src="<?= htmlspecialchars($img) ?>" alt="<?= htmlspecialchars($title) ?>" class="featuredevent-image">
                            <?php endif; ?>

                            <div class="featuredevent-overlay">
                                <h3 class="featuredevent-name"><?= htmlspecialchars($title) ?></h3>

                                <?php if ($dateText !== ''): ?>
                                    <p class="featuredevent-date"><?= htmlspecialchars($dateText) ?></p>
                                <?php endif; ?>
                            </div>
                        </div>

                        <?php if (trim($detailsRaw) !== ''): ?>
                            <p class="featuredevent-caption"><?= nl2br(htmlspecialchars($detailsRaw)) ?></p>
                        <?php endif; ?>
                    </div>
                </section>
            <?php endforeach; ?>
        <?php endif; ?>
    </main>

    <script src="assets/js/script.js"></script>
</body>

</html>