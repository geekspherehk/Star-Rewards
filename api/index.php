<?php
require_once 'config.php';

header('Content-Type: application/json; charset=utf-8');

$allowedOrigin = getenv('ALLOWED_ORIGIN') ?: '';
if ($allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
} else {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $requestScheme = $_SERVER['REQUEST_SCHEME'] ?? 'http';
    $requestHost = $_SERVER['HTTP_HOST'] ?? '';
    $sameOrigin = $requestScheme . '://' . $requestHost;
    if ($origin && $origin === $sameOrigin) {
        header('Access-Control-Allow-Origin: ' . $origin);
    }
    // No wildcard fallback — strict origin policy
}
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function sendJson($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function sendError($message, $code = 400, $logDetail = null) {
    if ($logDetail !== null) {
        error_log('[StarRewards API Error] ' . $message . ' | Detail: ' . $logDetail);
    }
    sendJson(['error' => $message], $code);
}

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function generateToken($userId, $email) {
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $payload = [
        'user_id' => (int)$userId,
        'email' => $email,
        'iat' => time(),
        'exp' => time() + TOKEN_TTL
    ];
    $headerEncoded = base64url_encode(json_encode($header));
    $payloadEncoded = base64url_encode(json_encode($payload));
    $signature = base64url_encode(hash_hmac('sha256', "$headerEncoded.$payloadEncoded", TOKEN_SECRET, true));
    return "$headerEncoded.$payloadEncoded.$signature";
}

function verifyToken($token) {
    if (empty($token)) return null;
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    list($headerEncoded, $payloadEncoded, $signatureProvided) = $parts;

    $expectedSignature = base64url_encode(hash_hmac('sha256', "$headerEncoded.$payloadEncoded", TOKEN_SECRET, true));
    if (!hash_equals($expectedSignature, $signatureProvided)) {
        return null;
    }

    $payload = json_decode(base64url_decode($payloadEncoded), true);
    if (!is_array($payload)) return null;

    if (isset($payload['exp']) && $payload['exp'] < time()) {
        return null;
    }
    if (!isset($payload['user_id']) || !isset($payload['email'])) {
        return null;
    }
    return $payload;
}

function getRequestData() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// Simple file-based rate limiter
function rateLimit($action, $maxAttempts, $windowSeconds) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = $action . '_' . $ip;
    $dir = sys_get_temp_dir() . '/star_ratelimit';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    $file = $dir . '/' . md5($key) . '.json';

    $now = time();
    $data = ['attempts' => [], 'blocked_until' => 0];

    if (file_exists($file)) {
        $content = @file_get_contents($file);
        if ($content) {
            $data = json_decode($content, true) ?: $data;
        }
    }

    // Clean old attempts
    $data['attempts'] = array_filter($data['attempts'], function($ts) use ($now, $windowSeconds) {
        return $ts > ($now - $windowSeconds);
    });

    // Check if blocked
    if ($data['blocked_until'] > $now) {
        sendError('Too many requests. Please try again later.', 429);
    }

    if (count($data['attempts']) >= $maxAttempts) {
        $data['blocked_until'] = $now + $windowSeconds;
        @file_put_contents($file, json_encode($data), LOCK_EX);
        sendError('Too many requests. Please try again in ' . $windowSeconds . ' seconds.', 429);
    }

    $data['attempts'][] = $now;
    @file_put_contents($file, json_encode($data), LOCK_EX);
}

function getUserId() {
    $headers = getallheaders();
    if (!$headers) $headers = [];
    $authHeader = '';
    foreach ($headers as $key => $value) {
        if (strcasecmp($key, 'Authorization') === 0) {
            $authHeader = $value;
            break;
        }
    }
    if (empty($authHeader)) {
        sendError('Unauthorized', 401);
    }
    if (strpos($authHeader, 'Bearer ') !== 0) {
        sendError('Invalid authorization format', 401);
    }
    $token = substr($authHeader, 7);
    $payload = verifyToken($token);
    if (!$payload) {
        sendError('Invalid or expired token', 401);
    }
    return (int)$payload['user_id'];
}

// ── Multi-child profile helpers ──
function getSelectedProfileId($pdo, $userId) {
    $stmt = $pdo->prepare('SELECT selected_profile_id FROM user_configs WHERE user_id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return ($row && $row['selected_profile_id']) ? (int)$row['selected_profile_id'] : null;
}

function firstProfileId($pdo, $userId) {
    $stmt = $pdo->prepare('SELECT id FROM profiles WHERE user_id = ? ORDER BY id ASC LIMIT 1');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row ? (int)$row['id'] : null;
}

function profileBelongsToUser($pdo, $userId, $profileId) {
    $stmt = $pdo->prepare('SELECT id FROM profiles WHERE id = ? AND user_id = ?');
    $stmt->execute([$profileId, $userId]);
    return (bool)$stmt->fetch();
}

// Resolve which child profile a request targets: explicit profile_id (if owned) → selected → first
function resolveProfileId($pdo, $userId, $data) {
    $pid = isset($data['profile_id']) ? (int)$data['profile_id'] : 0;
    if ($pid > 0 && profileBelongsToUser($pdo, $userId, $pid)) {
        return $pid;
    }
    $sel = getSelectedProfileId($pdo, $userId);
    if ($sel) return $sel;
    return firstProfileId($pdo, $userId);
}

function validateEmail($email) {
    $email = trim($email);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
    if (strlen($email) > 255) return false;
    return $email;
}

function validatePassword($password) {
    $len = strlen($password);
    return $len >= 6 && $len <= 255;
}

try {
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
} catch (PDOException $e) {
    sendError('Service unavailable', 500, 'DB connection failed: ' . $e->getMessage());
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$data = getRequestData();

switch ($action) {
    case 'register':
        handleRegister($pdo, $data);
        break;
    case 'login':
        handleLogin($pdo, $data);
        break;
    case 'logout':
        handleLogout();
        break;
    case 'refreshToken':
        handleRefreshToken();
        break;
    case 'getProfile':
        handleGetProfile($pdo);
        break;
    case 'getProfiles':
        handleGetProfiles($pdo);
        break;
    case 'addProfile':
        handleAddProfile($pdo, $data);
        break;
    case 'updateProfile':
        handleUpdateProfile($pdo, $data);
        break;
    case 'deleteProfile':
        handleDeleteProfile($pdo, $data);
        break;
    case 'setSelectedProfile':
        handleSetSelectedProfile($pdo, $data);
        break;
    case 'getBehaviors':
        handleGetBehaviors($pdo, $data);
        break;
    case 'addBehavior':
        handleAddBehavior($pdo, $data);
        break;
    case 'getGifts':
        handleGetGifts($pdo, $data);
        break;
    case 'addGift':
        handleAddGift($pdo, $data);
        break;
    case 'redeemGift':
        handleRedeemGift($pdo, $data);
        break;
    case 'getRedeemedGifts':
        handleGetRedeemedGifts($pdo, $data);
        break;
    case 'updateTheme':
        handleUpdateTheme($pdo, $data);
        break;
    case 'getUserConfig':
        handleGetUserConfig($pdo);
        break;
    case 'deleteBehavior':
        handleDeleteBehavior($pdo, $data);
        break;
    case 'deleteGift':
        handleDeleteGift($pdo, $data);
        break;
    case 'fetchProductInfo':
        handleFetchProductInfo($pdo, $data);
        break;
    default:
        sendError('Invalid action', 400);
}

function handleRegister($pdo, $data) {
    rateLimit('register', 5, 60); // 5 attempts per 60 seconds
    $email = validateEmail($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (!$email) sendError('Invalid email format', 400);
    if (!validatePassword($password)) sendError('Password must be 6-255 characters', 400);

    try {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            sendError('Email already registered', 409);
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
        $stmt->execute([$email, $passwordHash]);
        $userId = (int)$pdo->lastInsertId();

        $pdo->beginTransaction();
        $stmt = $pdo->prepare('INSERT INTO profiles (user_id, name, avatar, color, current_points, total_points) VALUES (?, ?, ?, ?, 0, 0)');
        $stmt->execute([$userId, '孩子', '⭐', '#FFB300']);
        $profileId = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare('INSERT INTO user_configs (user_id, selected_theme, selected_profile_id) VALUES (?, "classic", ?)');
        $stmt->execute([$userId, $profileId]);
        $pdo->commit();

        $token = generateToken($userId, $email);
        sendJson([
            'token' => $token,
            'user_id' => $userId,
            'email' => $email,
            'expires_in' => TOKEN_TTL,
            'profiles' => [
                ['id' => $profileId, 'name' => '孩子', 'avatar' => '⭐', 'color' => '#FFB300', 'current_points' => 0, 'total_points' => 0]
            ],
            'selected_profile_id' => $profileId
        ], 201);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendError('Registration failed', 500, $e->getMessage());
    }
}

function handleLogin($pdo, $data) {
    rateLimit('login', 10, 60); // 10 attempts per 60 seconds
    $email = validateEmail($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (!$email || empty($password)) {
        sendError('Email and password required', 400);
    }

    try {
        $stmt = $pdo->prepare('SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            sendError('Invalid email or password', 401);
        }

        $token = generateToken((int)$user['id'], $user['email']);
        $stmt = $pdo->prepare('SELECT id, name, avatar, color, current_points, total_points FROM profiles WHERE user_id = ? ORDER BY id ASC');
        $stmt->execute([(int)$user['id']]);
        $profiles = $stmt->fetchAll();
        $selected = getSelectedProfileId($pdo, (int)$user['id']);
        if (!$selected && $profiles) {
            $selected = (int)$profiles[0]['id'];
        }
        sendJson([
            'token' => $token,
            'user_id' => (int)$user['id'],
            'email' => $user['email'],
            'expires_in' => TOKEN_TTL,
            'profiles' => $profiles,
            'selected_profile_id' => $selected
        ]);
    } catch (Exception $e) {
        sendError('Login failed', 500, $e->getMessage());
    }
}

function handleLogout() {
    getUserId();
    sendJson(['success' => true, 'message' => 'Logged out']);
}

function handleRefreshToken() {
    $headers = getallheaders();
    if (!$headers) $headers = [];
    $authHeader = '';
    foreach ($headers as $key => $value) {
        if (strcasecmp($key, 'Authorization') === 0) {
            $authHeader = $value;
            break;
        }
    }
    if (empty($authHeader) || strpos($authHeader, 'Bearer ') !== 0) {
        sendError('Unauthorized', 401);
    }
    $token = substr($authHeader, 7);
    $payload = verifyToken($token);
    if (!$payload) {
        sendError('Invalid or expired token', 401);
    }
    $newToken = generateToken((int)$payload['user_id'], $payload['email']);
    sendJson([
        'token' => $newToken,
        'expires_in' => TOKEN_TTL
    ]);
}

function handleGetProfile($pdo) {
    $userId = getUserId();
    $profileId = getSelectedProfileId($pdo, $userId);
    if (!$profileId) $profileId = firstProfileId($pdo, $userId);
    try {
        $stmt = $pdo->prepare('SELECT id, name, avatar, color, current_points, total_points FROM profiles WHERE id = ? AND user_id = ?');
        $stmt->execute([$profileId, $userId]);
        $profile = $stmt->fetch();
        if (!$profile) {
            $profile = ['id' => $profileId, 'name' => '孩子', 'avatar' => '⭐', 'color' => '#FFB300', 'current_points' => 0, 'total_points' => 0, 'user_id' => $userId];
        }
        $profile['user_id'] = $userId;
        sendJson($profile);
    } catch (Exception $e) {
        sendError('Failed to get profile', 500, $e->getMessage());
    }
}

function handleGetProfiles($pdo) {
    $userId = getUserId();
    try {
        $stmt = $pdo->prepare('SELECT id, name, avatar, color, current_points, total_points FROM profiles WHERE user_id = ? ORDER BY id ASC');
        $stmt->execute([$userId]);
        sendJson($stmt->fetchAll());
    } catch (Exception $e) {
        sendError('Failed to get profiles', 500, $e->getMessage());
    }
}

function handleAddProfile($pdo, $data) {
    $userId = getUserId();
    $name = trim($data['name'] ?? '');
    if ($name === '') sendError('Child name required', 400);
    if (strlen($name) > 50) sendError('Name too long (max 50)', 400);
    $avatar = isset($data['avatar']) ? trim($data['avatar']) : '⭐';
    if ($avatar === '' || strlen($avatar) > 20) $avatar = '⭐';
    $color = isset($data['color']) ? trim($data['color']) : '#FFB300';
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = '#FFB300';
    try {
        $stmt = $pdo->prepare('INSERT INTO profiles (user_id, name, avatar, color, current_points, total_points) VALUES (?, ?, ?, ?, 0, 0)');
        $stmt->execute([$userId, $name, $avatar, $color]);
        $id = (int)$pdo->lastInsertId();
        sendJson(['success' => true, 'id' => $id, 'name' => $name, 'avatar' => $avatar, 'color' => $color, 'current_points' => 0, 'total_points' => 0], 201);
    } catch (Exception $e) {
        sendError('Failed to add child', 500, $e->getMessage());
    }
}

function handleUpdateProfile($pdo, $data) {
    $userId = getUserId();
    $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : 0;
    if ($profileId <= 0) sendError('Invalid profile id', 400);
    if (!profileBelongsToUser($pdo, $userId, $profileId)) sendError('Profile not found', 404);

    $fields = [];
    $params = [];
    if (isset($data['name'])) {
        $n = trim($data['name']);
        if ($n === '' || strlen($n) > 50) sendError('Invalid name', 400);
        $fields[] = 'name = ?';
        $params[] = $n;
    }
    if (isset($data['avatar'])) {
        $a = trim($data['avatar']);
        if ($a === '' || strlen($a) > 20) $a = '⭐';
        $fields[] = 'avatar = ?';
        $params[] = $a;
    }
    if (isset($data['color'])) {
        $c = trim($data['color']);
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $c)) $c = '#FFB300';
        $fields[] = 'color = ?';
        $params[] = $c;
    }
    if (empty($fields)) sendError('Nothing to update', 400);
    $fields[] = 'updated_at = NOW()';
    $params[] = $profileId;
    $params[] = $userId;

    try {
        $stmt = $pdo->prepare('UPDATE profiles SET ' . implode(', ', $fields) . ' WHERE id = ? AND user_id = ?');
        $stmt->execute($params);
        sendJson(['success' => true]);
    } catch (Exception $e) {
        sendError('Failed to update child', 500, $e->getMessage());
    }
}

function handleDeleteProfile($pdo, $data) {
    $userId = getUserId();
    $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : 0;
    if ($profileId <= 0) sendError('Invalid profile id', 400);
    if (!profileBelongsToUser($pdo, $userId, $profileId)) sendError('Profile not found', 404);

    $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM profiles WHERE user_id = ?');
    $stmt->execute([$userId]);
    if ((int)$stmt->fetch()['cnt'] <= 1) {
        sendError('Cannot delete the only child profile', 400);
    }

    try {
        $pdo->beginTransaction();
        $sel = getSelectedProfileId($pdo, $userId);
        if ($sel == $profileId) {
            $stmt = $pdo->prepare('SELECT id FROM profiles WHERE user_id = ? AND id != ? ORDER BY id ASC LIMIT 1');
            $stmt->execute([$userId, $profileId]);
            $next = $stmt->fetch();
            $nextId = $next ? (int)$next['id'] : null;
            $stmt = $pdo->prepare('UPDATE user_configs SET selected_profile_id = ? WHERE user_id = ?');
            $stmt->execute([$nextId, $userId]);
        }
        $stmt = $pdo->prepare('DELETE FROM profiles WHERE id = ? AND user_id = ?');
        $stmt->execute([$profileId, $userId]);
        $pdo->commit();
        sendJson(['success' => true]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendError('Failed to delete child', 500, $e->getMessage());
    }
}

function handleSetSelectedProfile($pdo, $data) {
    $userId = getUserId();
    $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : 0;
    if ($profileId <= 0) sendError('Invalid profile id', 400);
    if (!profileBelongsToUser($pdo, $userId, $profileId)) sendError('Profile not found', 404);
    try {
        $stmt = $pdo->prepare('INSERT INTO user_configs (user_id, selected_profile_id, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE selected_profile_id = VALUES(selected_profile_id), updated_at = VALUES(updated_at)');
        $stmt->execute([$userId, $profileId]);
        sendJson(['success' => true, 'selected_profile_id' => $profileId]);
    } catch (Exception $e) {
        sendError('Failed to set profile', 500, $e->getMessage());
    }
}

function handleGetBehaviors($pdo, $data) {
    $userId = getUserId();
    $profileId = resolveProfileId($pdo, $userId, $data);
    try {
        $stmt = $pdo->prepare('SELECT id, profile_id, description, points, timestamp FROM behaviors WHERE user_id = ? AND profile_id = ? ORDER BY timestamp DESC LIMIT 500');
        $stmt->execute([$userId, $profileId]);
        sendJson($stmt->fetchAll());
    } catch (Exception $e) {
        sendError('Failed to get behaviors', 500, $e->getMessage());
    }
}

function handleAddBehavior($pdo, $data) {
    $userId = getUserId();
    $profileId = resolveProfileId($pdo, $userId, $data);
    $description = trim($data['description'] ?? '');
    $points = isset($data['points']) ? (int)$data['points'] : 0;

    if ($description === '') sendError('Description required', 400);
    if (strlen($description) > 1000) sendError('Description too long (max 1000 chars)', 400);
    if ($points === 0) sendError('Points cannot be zero', 400);
    if ($points < -10000 || $points > 10000) sendError('Points out of range (-10000 to 10000)', 400);

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('INSERT INTO behaviors (user_id, profile_id, description, points) VALUES (?, ?, ?, ?)');
        $stmt->execute([$userId, $profileId, $description, $points]);

        $currentDelta = $points;
        $totalDelta = max($points, 0);

        $stmt = $pdo->prepare('UPDATE profiles 
            SET current_points = current_points + ?, 
                total_points = total_points + ?,
                updated_at = NOW() 
            WHERE id = ? AND user_id = ?');
        $stmt->execute([$currentDelta, $totalDelta, $profileId, $userId]);

        $behaviorId = (int)$pdo->lastInsertId();

        // Fetch updated points
        $stmt = $pdo->prepare('SELECT current_points, total_points FROM profiles WHERE id = ? AND user_id = ?');
        $stmt->execute([$profileId, $userId]);
        $profile = $stmt->fetch();

        $pdo->commit();
        sendJson([
            'success' => true,
            'id' => $behaviorId,
            'current_points' => (int)$profile['current_points'],
            'total_points' => (int)$profile['total_points']
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendError('Failed to add behavior', 500, $e->getMessage());
    }
}

function handleGetGifts($pdo, $data) {
    $userId = getUserId();
    $profileId = resolveProfileId($pdo, $userId, $data);
    try {
        $stmt = $pdo->prepare('SELECT id, profile_id, name, points, description, image_url, original_url, created_at FROM gifts WHERE user_id = ? AND profile_id = ? ORDER BY created_at DESC');
        $stmt->execute([$userId, $profileId]);
        sendJson($stmt->fetchAll());
    } catch (Exception $e) {
        sendError('Failed to get gifts', 500, $e->getMessage());
    }
}

function handleAddGift($pdo, $data) {
    $userId = getUserId();
    $profileId = resolveProfileId($pdo, $userId, $data);
    $name = trim($data['name'] ?? '');
    $points = isset($data['points']) ? (int)$data['points'] : 0;
    $description = trim($data['description'] ?? '');
    $imageUrl = isset($data['image_url']) ? trim($data['image_url']) : '';
    $originalUrl = isset($data['original_url']) ? trim($data['original_url']) : '';

    if ($name === '') sendError('Gift name required', 400);
    if (strlen($name) > 255) sendError('Gift name too long (max 255 chars)', 400);
    if ($points <= 0) sendError('Points must be positive', 400);
    if ($points > 100000) sendError('Points too large (max 100000)', 400);
    if (strlen($description) > 2000) sendError('Description too long (max 2000 chars)', 400);
    if (strlen($imageUrl) > 2048) sendError('Image URL too long', 400);
    if (strlen($originalUrl) > 2048) sendError('Original URL too long', 400);

    try {
        $stmt = $pdo->prepare('INSERT INTO gifts (user_id, profile_id, name, points, description, image_url, original_url) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $profileId, $name, $points, $description, $imageUrl, $originalUrl]);
        sendJson(['success' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    } catch (Exception $e) {
        sendError('Failed to add gift', 500, $e->getMessage());
    }
}

function handleRedeemGift($pdo, $data) {
    $userId = getUserId();
    $profileId = resolveProfileId($pdo, $userId, $data);
    $giftId = isset($data['gift_id']) ? (int)$data['gift_id'] : 0;

    if ($giftId <= 0) sendError('Invalid gift id', 400);

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('SELECT id, name, points, description, image_url, original_url FROM gifts WHERE id = ? AND user_id = ? AND profile_id = ? LIMIT 1 FOR UPDATE');
        $stmt->execute([$giftId, $userId, $profileId]);
        $gift = $stmt->fetch();
        if (!$gift) sendError('Gift not found', 404);

        $stmt = $pdo->prepare('SELECT current_points FROM profiles WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE');
        $stmt->execute([$profileId, $userId]);
        $profile = $stmt->fetch();
        if (!$profile || (int)$profile['current_points'] < (int)$gift['points']) {
            sendError('Insufficient points', 400);
        }

        $stmt = $pdo->prepare('DELETE FROM gifts WHERE id = ?');
        $stmt->execute([$giftId]);

        $stmt = $pdo->prepare('INSERT INTO redeemed_gifts 
            (user_id, profile_id, gift_id, name, points, description, image_url, original_url, redeem_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())');
        $stmt->execute([
            $userId,
            $profileId,
            $giftId,
            $gift['name'],
            $gift['points'],
            $gift['description'],
            $gift['image_url'] ?? '',
            $gift['original_url'] ?? ''
        ]);

        $stmt = $pdo->prepare('UPDATE profiles SET current_points = current_points - ?, updated_at = NOW() WHERE id = ? AND user_id = ?');
        $stmt->execute([(int)$gift['points'], $profileId, $userId]);

        $stmt = $pdo->prepare('SELECT id, current_points FROM profiles WHERE id = ? AND user_id = ?');
        $stmt->execute([$profileId, $userId]);
        $profile = $stmt->fetch();
        $stmt = $pdo->prepare('SELECT id FROM redeemed_gifts WHERE user_id = ? AND profile_id = ? AND gift_id = ? ORDER BY id DESC LIMIT 1');
        $stmt->execute([$userId, $profileId, $giftId]);
        $redeemedRow = $stmt->fetch();

        $pdo->commit();
        sendJson([
            'success' => true,
            'current_points' => (int)$profile['current_points'],
            'redeemed_id' => $redeemedRow ? (int)$redeemedRow['id'] : null,
            'redeemed_gift' => [
                'name' => $gift['name'],
                'points' => (int)$gift['points'],
                'image_url' => $gift['image_url'] ?? '',
                'original_url' => $gift['original_url'] ?? ''
            ]
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e->getCode() === 400 || $e->getCode() === 404) {
            sendError($e->getMessage(), $e->getCode());
        }
        sendError('Failed to redeem gift', 500, $e->getMessage());
    }
}

function handleGetRedeemedGifts($pdo, $data) {
    $userId = getUserId();
    $profileId = resolveProfileId($pdo, $userId, $data);
    try {
        $stmt = $pdo->prepare('SELECT id, profile_id, name, points, description, image_url, original_url, redeem_date FROM redeemed_gifts WHERE user_id = ? AND profile_id = ? ORDER BY redeem_date DESC LIMIT 500');
        $stmt->execute([$userId, $profileId]);
        sendJson($stmt->fetchAll());
    } catch (Exception $e) {
        sendError('Failed to get redeemed gifts', 500, $e->getMessage());
    }
}

function handleUpdateTheme($pdo, $data) {
    $userId = getUserId();
    $theme = isset($data['theme']) ? trim($data['theme']) : 'classic';
    $allowedThemes = ['classic', 'juanwa', 'juanziji'];
    if (!in_array($theme, $allowedThemes, true)) {
        sendError('Invalid theme', 400);
    }
    try {
        $stmt = $pdo->prepare('INSERT INTO user_configs (user_id, selected_theme, updated_at) VALUES (?, ?, NOW()) 
            ON DUPLICATE KEY UPDATE selected_theme = VALUES(selected_theme), updated_at = VALUES(updated_at)');
        $stmt->execute([$userId, $theme]);
        sendJson(['success' => true]);
    } catch (Exception $e) {
        sendError('Failed to update theme', 500, $e->getMessage());
    }
}

function handleGetUserConfig($pdo) {
    $userId = getUserId();
    try {
        $stmt = $pdo->prepare('SELECT selected_theme FROM user_configs WHERE user_id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $config = $stmt->fetch();
        if (!$config) $config = ['selected_theme' => 'classic'];
        $config['user_id'] = $userId;
        sendJson($config);
    } catch (Exception $e) {
        sendError('Failed to get user config', 500, $e->getMessage());
    }
}

function handleDeleteBehavior($pdo, $data) {
    $userId = getUserId();
    $behaviorId = isset($data['id']) ? (int)$data['id'] : 0;
    if ($behaviorId <= 0) sendError('Invalid behavior ID', 400);

    try {
        $stmt = $pdo->prepare('DELETE FROM behaviors WHERE id = ? AND user_id = ?');
        $stmt->execute([$behaviorId, $userId]);
        if ($stmt->rowCount() === 0) {
            sendError('Behavior not found or not owned by you', 404);
        }
        sendJson(['success' => true]);
    } catch (Exception $e) {
        sendError('Failed to delete behavior', 500, $e->getMessage());
    }
}

function handleDeleteGift($pdo, $data) {
    $userId = getUserId();
    $giftId = isset($data['id']) ? (int)$data['id'] : 0;
    if ($giftId <= 0) sendError('Invalid gift ID', 400);

    try {
        $stmt = $pdo->prepare('DELETE FROM gifts WHERE id = ? AND user_id = ?');
        $stmt->execute([$giftId, $userId]);
        if ($stmt->rowCount() === 0) {
            sendError('Gift not found or not owned by you', 404);
        }
        sendJson(['success' => true]);
    } catch (Exception $e) {
        sendError('Failed to delete gift', 500, $e->getMessage());
    }
}

// 从电商/商品链接提取商品信息（标题/主图/价格），供愿望清单「从链接导入」
function handleFetchProductInfo($pdo, $data) {
    getUserId(); // 需要登录
    rateLimit('fetchProductInfo', 20, 60); // 防滥用：每 IP 每分钟 20 次

    $url = trim($data['url'] ?? '');
    if ($url === '') sendError('URL is required', 400);
    if (strlen($url) > 2048) sendError('URL too long', 400);
    if (!preg_match('#^https?://#i', $url)) {
        $url = 'https://' . $url;
    }

    // SSRF 防护
    $parts = parse_url($url);
    if (!$parts || empty($parts['host'])) sendError('Invalid URL', 400);
    $scheme = strtolower($parts['scheme'] ?? '');
    if (!in_array($scheme, ['http', 'https'], true)) sendError('Only http/https URLs are allowed', 400);

    $host = strtolower($parts['host']);
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        sendError('IP addresses are not allowed', 400);
    }
    if (preg_match('#^(localhost|0\.0\.0\.0)$#i', $host)
        || substr($host, -6) === '.local'
        || substr($host, -9) === '.internal') {
        sendError('This host is not allowed', 400);
    }
    $port = $parts['port'] ?? null;
    if ($port !== null && !in_array((int)$port, [80, 443], true)) {
        sendError('Only default ports are allowed', 400);
    }

    $html = fetchUrlContent($url);
    if ($html === null || $html === '') {
        sendError('Failed to fetch the page', 502);
    }

    $title = extractMetaTag($html, 'og:title')
        ?: extractMetaTag($html, 'twitter:title')
        ?: extractHtmlTitle($html);
    $image = extractMetaTag($html, 'og:image')
        ?: extractMetaTag($html, 'twitter:image')
        ?: extractFirstImageSrc($html);
    $price = extractMetaTag($html, 'product:price:amount')
        ?: extractMetaTag($html, 'og:price:amount');

    if ($image !== '') {
        $image = resolveRelativeUrl($image, $url);
    }

    if ($title === '' && $image === '' && $price === '') {
        sendError('Could not extract product info from this page', 422);
    }

    sendJson([
        'title' => mb_substr($title, 0, 255),
        'image_url' => mb_substr($image, 0, 2048),
        'price' => $price !== '' ? (string)$price : null
    ]);
}

// 抓取页面内容（带超时/大小上限）
function fetchUrlContent($url) {
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 8,
            'follow_location' => 1,
            'max_redirects' => 5,
            'ignore_errors' => true,
            'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n"
                . "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n"
                . "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8\r\n"
        ],
        // 部分共享主机 CA 证书路径异常，放宽校验以提升可用性（仅抓取公开商品页）
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false]
    ]);
    $body = @file_get_contents($url, false, $ctx);
    if ($body === false) return null;
    if (strlen($body) > 2000000) {
        $body = substr($body, 0, 2000000); // 2MB 上限
    }
    return $body;
}

// 提取 <meta property|name="X" content="...">（属性顺序两种都支持）
function extractMetaTag($html, $key) {
    $escaped = preg_quote($key, '#');
    if (preg_match('#<meta[^>]+(?:property|name)=["\']' . $escaped . '["\'][^>]*content=["\']([^"\']*)["\']#i', $html, $m)
        || preg_match('#<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' . $escaped . '["\']#i', $html, $m)) {
        return html_entity_decode(trim($m[1]), ENT_QUOTES, 'UTF-8');
    }
    return '';
}

function extractHtmlTitle($html) {
    if (preg_match('#<title[^>]*>(.*?)</title>#is', $html, $m)) {
        return html_entity_decode(trim(preg_replace('/\s+/', ' ', $m[1])), ENT_QUOTES, 'UTF-8');
    }
    return '';
}

function extractFirstImageSrc($html) {
    if (preg_match('#<img[^>]+src=["\']([^"\']+)["\']#i', $html, $m)) {
        return html_entity_decode(trim($m[1]), ENT_QUOTES, 'UTF-8');
    }
    return '';
}

// 把相对图片路径补全为绝对 URL
function resolveRelativeUrl($path, $baseUrl) {
    if (preg_match('#^https?://#i', $path)) return $path;
    if (strpos($path, '//') === 0) return 'https:' . $path;
    if ($path === '') return '';
    $parts = parse_url($baseUrl);
    $origin = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '');
    if (strpos($path, '/') === 0) return $origin . $path;
    $dir = isset($parts['path']) ? substr($parts['path'], 0, strrpos($parts['path'], '/') + 1) : '/';
    return $origin . $dir . $path;
}
