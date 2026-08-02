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
    case 'getBehaviors':
        handleGetBehaviors($pdo);
        break;
    case 'addBehavior':
        handleAddBehavior($pdo, $data);
        break;
    case 'getGifts':
        handleGetGifts($pdo);
        break;
    case 'addGift':
        handleAddGift($pdo, $data);
        break;
    case 'redeemGift':
        handleRedeemGift($pdo, $data);
        break;
    case 'getRedeemedGifts':
        handleGetRedeemedGifts($pdo);
        break;
    case 'updateTheme':
        handleUpdateTheme($pdo, $data);
        break;
    case 'getUserConfig':
        handleGetUserConfig($pdo);
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
        $stmt = $pdo->prepare('INSERT INTO profiles (user_id, current_points, total_points) VALUES (?, 0, 0)');
        $stmt->execute([$userId]);
        $stmt = $pdo->prepare('INSERT INTO user_configs (user_id, selected_theme) VALUES (?, "classic")');
        $stmt->execute([$userId]);
        $pdo->commit();

        $token = generateToken($userId, $email);
        sendJson([
            'token' => $token,
            'user_id' => $userId,
            'email' => $email,
            'expires_in' => TOKEN_TTL
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
        sendJson([
            'token' => $token,
            'user_id' => (int)$user['id'],
            'email' => $user['email'],
            'expires_in' => TOKEN_TTL
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
    try {
        $stmt = $pdo->prepare('SELECT current_points, total_points FROM profiles WHERE user_id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $profile = $stmt->fetch();
        if (!$profile) {
            $profile = ['current_points' => 0, 'total_points' => 0, 'user_id' => $userId];
        }
        $profile['user_id'] = $userId;
        sendJson($profile);
    } catch (Exception $e) {
        sendError('Failed to get profile', 500, $e->getMessage());
    }
}

function handleGetBehaviors($pdo) {
    $userId = getUserId();
    try {
        $stmt = $pdo->prepare('SELECT id, description, points, timestamp FROM behaviors WHERE user_id = ? ORDER BY timestamp DESC LIMIT 500');
        $stmt->execute([$userId]);
        sendJson($stmt->fetchAll());
    } catch (Exception $e) {
        sendError('Failed to get behaviors', 500, $e->getMessage());
    }
}

function handleAddBehavior($pdo, $data) {
    $userId = getUserId();
    $description = trim($data['description'] ?? '');
    $points = isset($data['points']) ? (int)$data['points'] : 0;

    if ($description === '') sendError('Description required', 400);
    if (strlen($description) > 1000) sendError('Description too long (max 1000 chars)', 400);
    if ($points === 0) sendError('Points cannot be zero', 400);
    if ($points < -10000 || $points > 10000) sendError('Points out of range (-10000 to 10000)', 400);

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('INSERT INTO behaviors (user_id, description, points) VALUES (?, ?, ?)');
        $stmt->execute([$userId, $description, $points]);

        $currentDelta = $points;
        $totalDelta = max($points, 0);

        $stmt = $pdo->prepare('UPDATE profiles 
            SET current_points = current_points + ?, 
                total_points = total_points + ?,
                updated_at = NOW() 
            WHERE user_id = ?');
        $stmt->execute([$currentDelta, $totalDelta, $userId]);

        $pdo->commit();
        sendJson(['success' => true]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendError('Failed to add behavior', 500, $e->getMessage());
    }
}

function handleGetGifts($pdo) {
    $userId = getUserId();
    try {
        $stmt = $pdo->prepare('SELECT id, name, points, description, image_url, original_url, created_at FROM gifts WHERE user_id = ? ORDER BY created_at DESC');
        $stmt->execute([$userId]);
        sendJson($stmt->fetchAll());
    } catch (Exception $e) {
        sendError('Failed to get gifts', 500, $e->getMessage());
    }
}

function handleAddGift($pdo, $data) {
    $userId = getUserId();
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
        $stmt = $pdo->prepare('INSERT INTO gifts (user_id, name, points, description, image_url, original_url) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $name, $points, $description, $imageUrl, $originalUrl]);
        sendJson(['success' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    } catch (Exception $e) {
        sendError('Failed to add gift', 500, $e->getMessage());
    }
}

function handleRedeemGift($pdo, $data) {
    $userId = getUserId();
    $giftId = isset($data['gift_id']) ? (int)$data['gift_id'] : 0;

    if ($giftId <= 0) sendError('Invalid gift id', 400);

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('SELECT id, name, points, description, image_url, original_url FROM gifts WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE');
        $stmt->execute([$giftId, $userId]);
        $gift = $stmt->fetch();
        if (!$gift) sendError('Gift not found', 404);

        $stmt = $pdo->prepare('SELECT current_points FROM profiles WHERE user_id = ? LIMIT 1 FOR UPDATE');
        $stmt->execute([$userId]);
        $profile = $stmt->fetch();
        if (!$profile || (int)$profile['current_points'] < (int)$gift['points']) {
            sendError('Insufficient points', 400);
        }

        $stmt = $pdo->prepare('DELETE FROM gifts WHERE id = ?');
        $stmt->execute([$giftId]);

        $stmt = $pdo->prepare('INSERT INTO redeemed_gifts 
            (user_id, gift_id, name, points, description, image_url, original_url, redeem_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())');
        $stmt->execute([
            $userId,
            $giftId,
            $gift['name'],
            $gift['points'],
            $gift['description'],
            $gift['image_url'] ?? '',
            $gift['original_url'] ?? ''
        ]);

        $stmt = $pdo->prepare('UPDATE profiles SET current_points = current_points - ?, updated_at = NOW() WHERE user_id = ?');
        $stmt->execute([(int)$gift['points'], $userId]);

        $pdo->commit();
        sendJson(['success' => true]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e->getCode() === 400 || $e->getCode() === 404) {
            sendError($e->getMessage(), $e->getCode());
        }
        sendError('Failed to redeem gift', 500, $e->getMessage());
    }
}

function handleGetRedeemedGifts($pdo) {
    $userId = getUserId();
    try {
        $stmt = $pdo->prepare('SELECT id, name, points, description, image_url, original_url, redeem_date FROM redeemed_gifts WHERE user_id = ? ORDER BY redeem_date DESC LIMIT 500');
        $stmt->execute([$userId]);
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
