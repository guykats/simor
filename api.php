<?php
// CORS — allow calls from GitHub Pages and any origin
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$db_host       = 'localhost';
$db_name       = 'u823311221_simor';
$db_user       = 'u823311221_simor';
$db_pass       = 'Simor1234';
$admin_password = '12321';

try {
    $pdo = new PDO(
        "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4",
        $db_user,
        $db_pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // Create table on first run
    $pdo->exec("CREATE TABLE IF NOT EXISTS leaderboard (
        id         INT          NOT NULL DEFAULT 1,
        data       LONGTEXT     NOT NULL,
        updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // ── GET: public read, no auth ────────────────────────────────────
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->query("SELECT data FROM leaderboard WHERE id = 1");
        $row  = $stmt->fetch(PDO::FETCH_ASSOC);
        echo $row
            ? $row['data']
            : json_encode(['players' => [], 'matches' => [], 'lastUpdated' => null]);

    // ── POST: admin write, password required ─────────────────────────
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON']);
            exit;
        }

        if (empty($input['password']) || $input['password'] !== $admin_password) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }

        if (!isset($input['data'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing data field']);
            exit;
        }

        $data                = $input['data'];
        $data['lastUpdated'] = date('c');
        $json                = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $stmt = $pdo->prepare(
            "INSERT INTO leaderboard (id, data) VALUES (1, ?)
             ON DUPLICATE KEY UPDATE data = ?, updated_at = NOW()"
        );
        $stmt->execute([$json, $json]);

        echo json_encode(['ok' => true, 'lastUpdated' => $data['lastUpdated']]);

    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
