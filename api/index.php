<?php
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'register':
        handleRegister($pdo);
        break;
    case 'login':
        handleLogin($pdo);
        break;
    case 'getProfile':
        handleGetProfile($pdo);
        break;
    case 'getBehaviors':
        handleGetBehaviors($pdo);
        break;
    case 'addBehavior':
        handleAddBehavior($pdo);
        break;
    case 'getGifts':
        handleGetGifts($pdo);
        break;
    case 'addGift':
        handleAddGift($pdo);
        break;
    case 'redeemGift':
        handleRedeemGift($pdo);
        break;
    case 'getRedeemedGifts':
        handleGetRedeemedGifts($pdo);
        break;
    case 'updateTheme':
        handleUpdateTheme($pdo);
        break;
    case 'getUserConfig':
        handleGetUserConfig($pdo);
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
}

function getUserId() {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (empty($auth)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    $token = str_replace('Bearer ', '', $auth);
    $payload = json_decode(base64_decode($token), true);
    return $payload['user_id'] ?? null;
}

function handleRegister($pdo) {
    $data = json_decode(file_get_contents('php://input'), true);
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email and password required']);
        return;
    }
    
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(400);
        echo json_encode(['error' => 'Email already exists']);
        return;
    }
    
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
    $stmt->execute([$email, $passwordHash]);
    $userId = $pdo->lastInsertId();
    
    $stmt = $pdo->prepare('INSERT INTO profiles (user_id, total_points) VALUES (?, 0)');
    $stmt->execute([$userId]);
    
    $stmt = $pdo->prepare('INSERT INTO user_configs (user_id, selected_theme) VALUES (?, "classic")');
    $stmt->execute([$userId]);
    
    $token = base64_encode(json_encode(['user_id' => $userId, 'email' => $email]));
    echo json_encode(['token' => $token, 'user_id' => $userId]);
}

function handleLogin($pdo) {
    $data = json_decode(file_get_contents('php://input'), true);
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? '';
    
    $stmt = $pdo->prepare('SELECT id, email, password_hash FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        return;
    }
    
    $token = base64_encode(json_encode(['user_id' => $user['id'], 'email' => $user['email']]));
    echo json_encode(['token' => $token, 'user_id' => $user['id'], 'email' => $user['email']]);
}

function handleGetProfile($pdo) {
    $userId = getUserId();
    if (!$userId) return;
    
    $stmt = $pdo->prepare('SELECT * FROM profiles WHERE user_id = ?');
    $stmt->execute([$userId]);
    echo json_encode($stmt->fetch());
}

function handleGetBehaviors($pdo) {
    $userId = getUserId();
    if (!$userId) return;
    
    $stmt = $pdo->prepare('SELECT * FROM behaviors WHERE user_id = ? ORDER BY timestamp DESC');
    $stmt->execute([$userId]);
    echo json_encode($stmt->fetchAll());
}

function handleAddBehavior($pdo) {
    $userId = getUserId();
    if (!$userId) return;
    
    $data = json_decode(file_get_contents('php://input'), true);
    $description = $data['description'] ?? '';
    $points = $data['points'] ?? 0;
    
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO behaviors (user_id, description, points) VALUES (?, ?, ?)');
        $stmt->execute([$userId, $description, $points]);
        
        $stmt = $pdo->prepare('UPDATE profiles SET current_points = current_points + ?, total_points = total_points + ? WHERE user_id = ?');
        $stmt->execute([$points, $points, $userId]);
        
        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function handleGetGifts($pdo) {
    $userId = getUserId();
    if (!$userId) return;
    
    $stmt = $pdo->prepare('SELECT * FROM gifts WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$userId]);
    echo json_encode($stmt->fetchAll());
}

function handleAddGift($pdo) {
    $userId = getUserId();
    if (!$userId) return;
    
    $data = json_decode(file_get_contents('php://input'), true);
    $name = $data['name'] ?? '';
    $points = $data['points'] ?? 0;
    $description = $data['description'] ?? '';
    
    $stmt = $pdo->prepare('INSERT INTO gifts (user_id, name, points, description) VALUES (?, ?, ?, ?)');
    $stmt->execute([$userId, $name, $points, $description]);
    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
}

function handleRedeemGift($pdo) {
    $userId = getUserId();
    if (!$userId) return;
    
    $data = json_decode(file_get_contents('php://input'), true);
    $giftId = $data['gift_id'] ?? 0;
    
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM gifts WHERE id = ? AND user_id = ? FOR UPDATE');
        $stmt->execute([$giftId, $userId]);
        $gift = $stmt->fetch();
        
        if (!$gift) {
            throw new Exception('Gift not found');
        }
        
        $stmt = $pdo->prepare('SELECT current_points FROM profiles WHERE user_id = ?');
        $stmt->execute([$userId]);
        $profile = $stmt->fetch();
        
        if ($profile['current_points'] < $gift['points']) {
            throw new Exception('Insufficient points');
        }
        
        $stmt = $pdo->prepare('DELETE FROM gifts WHERE id = ?');
        $stmt->execute([$giftId]);
        
        $stmt = $pdo->prepare('INSERT INTO redeemed_gifts (user_id, gift_id, name, points, description, redeem_date) VALUES (?, ?, ?, ?, ?, NOW())');
        $stmt->execute([$userId, $giftId, $gift['name'], $gift['points'], $gift['description']]);
        
        $stmt = $pdo->prepare('UPDATE profiles SET current_points = current_points - ? WHERE user_id = ?');
        $stmt->execute([$gift['points'], $userId]);
        
        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function handleGetRedeemedGifts($pdo) {
    $userId = getUserId();
    if (!$userId) return;
    
    $stmt = $pdo->prepare('SELECT * FROM redeemed_gifts WHERE user_id = ? ORDER BY redeem_date DESC');
    $stmt->execute([$userId]);
    echo json_encode($stmt->fetchAll());
}

function handleUpdateTheme($pdo) {
    $userId = getUserId();
    if (!$userId) return;
    
    $data = json_decode(file_get_contents('php://input'), true);
    $theme = $data['theme'] ?? 'classic';
    
    $stmt = $pdo->prepare('UPDATE user_configs SET selected_theme = ?, updated_at = NOW() WHERE user_id = ?');
    $stmt->execute([$theme, $userId]);
    echo json_encode(['success' => true]);
}

function handleGetUserConfig($pdo) {
    $userId = getUserId();
    if (!$userId) return;
    
    $stmt = $pdo->prepare('SELECT * FROM user_configs WHERE user_id = ?');
    $stmt->execute([$userId]);
    echo json_encode($stmt->fetch());
}
