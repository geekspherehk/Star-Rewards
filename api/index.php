<?php
require_once 'config.php';

// ── Analytics event tracking (埋点) ──
define('TRACK_ALLOWED_EVENTS', [
    'register', 'login', 'add_behavior', 'add_gift', 'redeem',
    'view_poster', 'share_poster', 'create_invite', 'join_family',
    'open_family', 'view_seo_article', 'first_session',
    'growth_add', 'achieve_cert', 'share_wechat', 'share_whatsapp', 'share_pinterest'
]);

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

// Resolve the real client IP, accounting for CDN/reverse-proxy headers.
// Hostinger fronts requests with Cloudflare, so REMOTE_ADDR is the edge IP,
// not the visitor — keying rate limits on it would penalize everyone behind
// the same edge. Prefer the forwarded client IP when present.
function getClientIp() {
    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '',
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '',
        $_SERVER['HTTP_X_REAL_IP'] ?? '',
        $_SERVER['REMOTE_ADDR'] ?? ''
    ];
    foreach ($candidates as $c) {
        $c = trim($c);
        if ($c === '') continue;
        if (strpos($c, ',') !== false) {
            $c = trim(explode(',', $c)[0]);
        }
        if (filter_var($c, FILTER_VALIDATE_IP)) {
            return $c;
        }
    }
    return 'unknown';
}

// Simple file-based rate limiter
function rateLimit($action, $maxAttempts, $windowSeconds) {
    $ip = getClientIp();
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

// Resolve which child profile a request targets (family-scoped): explicit profile_id (if in family) → selected → first in family
function resolveProfileId($pdo, $familyId, $userId, $data) {
    $pid = isset($data['profile_id']) ? (int)$data['profile_id'] : 0;
    if ($pid > 0 && profileBelongsToFamily($pdo, $familyId, $pid)) {
        return $pid;
    }
    $sel = getSelectedProfileId($pdo, $userId);
    if ($sel && profileBelongsToFamily($pdo, $familyId, $sel)) return $sel;
    $stmt = $pdo->prepare('SELECT id FROM profiles WHERE family_id = ? ORDER BY id ASC LIMIT 1');
    $stmt->execute([$familyId]);
    $row = $stmt->fetch();
    return $row ? (int)$row['id'] : null;
}

// ── Family sharing helpers ──
define('FAMILY_MAX_MEMBERS', 5);

function getFamilyIdOfUser($pdo, $userId) {
    $stmt = $pdo->prepare('SELECT family_id FROM family_members WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row ? (int)$row['family_id'] : null;
}

function requireFamilyMember($pdo, $userId) {
    $fid = getFamilyIdOfUser($pdo, $userId);
    if (!$fid) sendError('You are not in a family', 403);
    return $fid;
}

function profileBelongsToFamily($pdo, $familyId, $profileId) {
    $stmt = $pdo->prepare('SELECT id FROM profiles WHERE id = ? AND family_id = ?');
    $stmt->execute([$profileId, $familyId]);
    return (bool)$stmt->fetch();
}

function generateInviteCode($pdo) {
    $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // unambiguous: no 0/O/1/I/L
    $len = strlen($alphabet);
    for ($i = 0; $i < 50; $i++) {
        $code = '';
        for ($j = 0; $j < 6; $j++) $code .= $alphabet[random_int(0, $len - 1)];
        $stmt = $pdo->prepare('SELECT 1 FROM families WHERE invite_code = ?');
        $stmt->execute([$code]);
        if (!$stmt->fetch()) return $code;
    }
    sendError('Failed to generate invite code', 500);
}

function getFamilyInfo($pdo, $familyId, $userId) {
    $stmt = $pdo->prepare('SELECT id, name, invite_code, invite_expires_at, created_at FROM families WHERE id = ?');
    $stmt->execute([$familyId]);
    $family = $stmt->fetch();
    if (!$family) return null;
    $stmt = $pdo->prepare('SELECT user_id, role, display_name, joined_at FROM family_members WHERE family_id = ? ORDER BY joined_at ASC');
    $stmt->execute([$familyId]);
    $members = $stmt->fetchAll();
    foreach ($members as &$m) {
        $m['is_self'] = ((int)$m['user_id'] === (int)$userId);
    }
    $family['member_count'] = count($members);
    $family['max_members'] = FAMILY_MAX_MEMBERS;
    // 把 invite_link 一并放进 family 对象，前端统一从 currentFamily.family.invite_link 读取
    $family['invite_link'] = 'https://stellar.gaocaihk.com/?invite=' . $family['invite_code'];
    return [
        'family' => $family,
        'members' => $members,
        'invite_link' => $family['invite_link']
    ];
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
    case 'getFamily':
        handleGetFamily($pdo);
        break;
    case 'inviteMember':
        handleInviteMember($pdo, $data);
        break;
    case 'joinFamily':
        handleJoinFamily($pdo, $data);
        break;
    case 'removeMember':
        handleRemoveMember($pdo, $data);
        break;
    case 'leaveFamily':
        handleLeaveFamily($pdo, $data);
        break;
    case 'updateMemberName':
        handleUpdateMemberName($pdo, $data);
        break;
    case 'track':
        handleTrackEvent($pdo, $data);
        break;
    case 'get_growth_extras':
        handleGetGrowthExtras($pdo, $data);
        break;
    case 'add_milestone':
        handleAddMilestone($pdo, $data);
        break;
    case 'add_growth_note':
        handleAddGrowthNote($pdo, $data);
        break;
    case 'add_child_voice':
        handleAddChildVoice($pdo, $data);
        break;
    default:
        sendError('Invalid action', 400);
}

function handleRegister($pdo, $data) {
    rateLimit('register', 5, 60); // 5 attempts per 60 seconds
    $email = validateEmail($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $inviteCode = strtoupper(trim($data['family_code'] ?? ($data['invite'] ?? '')));

    if (!$email) sendError('Invalid email format', 400);
    if (!validatePassword($password)) sendError('Password must be 6-255 characters', 400);
    if ($inviteCode !== '' && !preg_match('/^[0-9A-Z]{6}$/', $inviteCode)) sendError('Invalid invite code (6 characters)', 400);

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
        $local = explode('@', $email)[0];
        if ($inviteCode !== '') {
            // 注册即加入邀请的家庭（不创建 solo 家庭）
            $stmt = $pdo->prepare('SELECT id, invite_expires_at FROM families WHERE invite_code = ? LIMIT 1 FOR UPDATE');
            $stmt->execute([$inviteCode]);
            $family = $stmt->fetch();
            if (!$family) sendError('Invite code not found', 404);
            if ($family['invite_expires_at'] && strtotime($family['invite_expires_at']) < time()) sendError('Invite code expired', 410);
            $familyId = (int)$family['id'];
            $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM family_members WHERE family_id = ?');
            $stmt->execute([$familyId]);
            if ((int)$stmt->fetch()['cnt'] >= FAMILY_MAX_MEMBERS) sendError('Family is full (max ' . FAMILY_MAX_MEMBERS . ')', 403);
            $stmt = $pdo->prepare('INSERT INTO family_members (family_id, user_id, role, display_name) VALUES (?, ?, "member", ?)');
            $stmt->execute([$familyId, $userId, $local]);
        } else {
            // create a solo family for the new user (owner) so every account belongs to a family
            $code = generateInviteCode($pdo);
            $stmt = $pdo->prepare('INSERT INTO families (name, invite_code, invite_expires_at) VALUES (?, ?, NULL)');
            $stmt->execute([$local . ' 的家庭', $code]);
            $familyId = (int)$pdo->lastInsertId();
            $stmt = $pdo->prepare('INSERT INTO family_members (family_id, user_id, role, display_name) VALUES (?, ?, "owner", ?)');
            $stmt->execute([$familyId, $userId, $local]);
        }

        $stmt = $pdo->prepare('INSERT INTO profiles (user_id, family_id, name, avatar, color, current_points, total_points) VALUES (?, ?, ?, ?, ?, 0, 0)');
        $stmt->execute([$userId, $familyId, '孩子', '⭐', '#FFB300']);
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
            'family_id' => $familyId,
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
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = getSelectedProfileId($pdo, $userId);
    if (!$profileId || !profileBelongsToFamily($pdo, $familyId, $profileId)) {
        $stmt = $pdo->prepare('SELECT id FROM profiles WHERE family_id = ? ORDER BY id ASC LIMIT 1');
        $stmt->execute([$familyId]);
        $row = $stmt->fetch();
        $profileId = $row ? (int)$row['id'] : null;
    }
    try {
        $stmt = $pdo->prepare('SELECT id, name, avatar, color, current_points, total_points FROM profiles WHERE id = ? AND family_id = ?');
        $stmt->execute([$profileId, $familyId]);
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
    $familyId = requireFamilyMember($pdo, $userId);
    try {
        $stmt = $pdo->prepare('SELECT id, name, avatar, color, current_points, total_points FROM profiles WHERE family_id = ? ORDER BY id ASC');
        $stmt->execute([$familyId]);
        sendJson($stmt->fetchAll());
    } catch (Exception $e) {
        sendError('Failed to get profiles', 500, $e->getMessage());
    }
}

function handleAddProfile($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $name = trim($data['name'] ?? '');
    if ($name === '') sendError('Child name required', 400);
    if (strlen($name) > 50) sendError('Name too long (max 50)', 400);
    $avatar = isset($data['avatar']) ? trim($data['avatar']) : '⭐';
    if ($avatar === '' || strlen($avatar) > 20) $avatar = '⭐';
    $color = isset($data['color']) ? trim($data['color']) : '#FFB300';
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = '#FFB300';
    try {
        $stmt = $pdo->prepare('INSERT INTO profiles (user_id, family_id, name, avatar, color, current_points, total_points) VALUES (?, ?, ?, ?, ?, 0, 0)');
        $stmt->execute([$userId, $familyId, $name, $avatar, $color]);
        $id = (int)$pdo->lastInsertId();
        sendJson(['success' => true, 'id' => $id, 'name' => $name, 'avatar' => $avatar, 'color' => $color, 'current_points' => 0, 'total_points' => 0], 201);
    } catch (Exception $e) {
        sendError('Failed to add child', 500, $e->getMessage());
    }
}

function handleUpdateProfile($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : 0;
    if ($profileId <= 0) sendError('Invalid profile id', 400);
    if (!profileBelongsToFamily($pdo, $familyId, $profileId)) sendError('Profile not found', 404);

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
    $params[] = $familyId;

    try {
        $stmt = $pdo->prepare('UPDATE profiles SET ' . implode(', ', $fields) . ' WHERE id = ? AND family_id = ?');
        $stmt->execute($params);
        sendJson(['success' => true]);
    } catch (Exception $e) {
        sendError('Failed to update child', 500, $e->getMessage());
    }
}

function handleDeleteProfile($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : 0;
    if ($profileId <= 0) sendError('Invalid profile id', 400);
    if (!profileBelongsToFamily($pdo, $familyId, $profileId)) sendError('Profile not found', 404);

    $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM profiles WHERE family_id = ?');
    $stmt->execute([$familyId]);
    if ((int)$stmt->fetch()['cnt'] <= 1) {
        sendError('Cannot delete the only child profile', 400);
    }

    try {
        $pdo->beginTransaction();
        $sel = getSelectedProfileId($pdo, $userId);
        if ($sel == $profileId) {
            $stmt = $pdo->prepare('SELECT id FROM profiles WHERE family_id = ? AND id != ? ORDER BY id ASC LIMIT 1');
            $stmt->execute([$familyId, $profileId]);
            $next = $stmt->fetch();
            $nextId = $next ? (int)$next['id'] : null;
            $stmt = $pdo->prepare('UPDATE user_configs SET selected_profile_id = ? WHERE user_id = ?');
            $stmt->execute([$nextId, $userId]);
        }
        $stmt = $pdo->prepare('DELETE FROM profiles WHERE id = ? AND family_id = ?');
        $stmt->execute([$profileId, $familyId]);
        $pdo->commit();
        sendJson(['success' => true]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendError('Failed to delete child', 500, $e->getMessage());
    }
}

function handleSetSelectedProfile($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : 0;
    if ($profileId <= 0) sendError('Invalid profile id', 400);
    if (!profileBelongsToFamily($pdo, $familyId, $profileId)) sendError('Profile not found', 404);
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
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = resolveProfileId($pdo, $familyId, $userId, $data);
    try {
        $stmt = $pdo->prepare('SELECT b.id, b.profile_id, b.description, b.points, b.timestamp, fm.display_name AS added_by_name
            FROM behaviors b LEFT JOIN family_members fm ON fm.user_id = b.user_id AND fm.family_id = b.family_id
            WHERE b.family_id = ? AND b.profile_id = ? ORDER BY b.timestamp DESC LIMIT 500');
        $stmt->execute([$familyId, $profileId]);
        sendJson($stmt->fetchAll());
    } catch (Exception $e) {
        sendError('Failed to get behaviors', 500, $e->getMessage());
    }
}

function handleAddBehavior($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = resolveProfileId($pdo, $familyId, $userId, $data);
    $description = trim($data['description'] ?? '');
    $points = isset($data['points']) ? (int)$data['points'] : 0;

    if ($description === '') sendError('Description required', 400);
    if (strlen($description) > 1000) sendError('Description too long (max 1000 chars)', 400);
    if ($points === 0) sendError('Points cannot be zero', 400);
    if ($points < -10000 || $points > 10000) sendError('Points out of range (-10000 to 10000)', 400);

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('INSERT INTO behaviors (user_id, family_id, profile_id, description, points) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $familyId, $profileId, $description, $points]);
        // 必须在 UPDATE 之前取值：该环境的 PDO 驱动在 UPDATE 后 lastInsertId() 会返回 0
        $behaviorId = (int)$pdo->lastInsertId();

        $currentDelta = $points;
        $totalDelta = max($points, 0);

        $stmt = $pdo->prepare('UPDATE profiles 
            SET current_points = current_points + ?, 
                total_points = total_points + ?,
                updated_at = NOW() 
            WHERE id = ? AND family_id = ?');
        $stmt->execute([$currentDelta, $totalDelta, $profileId, $familyId]);

        // Fetch updated points
        $stmt = $pdo->prepare('SELECT current_points, total_points FROM profiles WHERE id = ? AND family_id = ?');
        $stmt->execute([$profileId, $familyId]);
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
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = resolveProfileId($pdo, $familyId, $userId, $data);
    try {
        $stmt = $pdo->prepare('SELECT g.id, g.profile_id, g.name, g.points, g.description, g.image_url, g.original_url, g.created_at, fm.display_name AS added_by_name
            FROM gifts g LEFT JOIN family_members fm ON fm.user_id = g.user_id AND fm.family_id = g.family_id
            WHERE g.family_id = ? AND g.profile_id = ? ORDER BY g.created_at DESC');
        $stmt->execute([$familyId, $profileId]);
        sendJson($stmt->fetchAll());
    } catch (Exception $e) {
        sendError('Failed to get gifts', 500, $e->getMessage());
    }
}

function handleAddGift($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = resolveProfileId($pdo, $familyId, $userId, $data);
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
        $stmt = $pdo->prepare('INSERT INTO gifts (user_id, family_id, profile_id, name, points, description, image_url, original_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $familyId, $profileId, $name, $points, $description, $imageUrl, $originalUrl]);
        sendJson(['success' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    } catch (Exception $e) {
        sendError('Failed to add gift', 500, $e->getMessage());
    }
}

function handleRedeemGift($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = resolveProfileId($pdo, $familyId, $userId, $data);
    $giftId = isset($data['gift_id']) ? (int)$data['gift_id'] : 0;

    if ($giftId <= 0) sendError('Invalid gift id', 400);

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('SELECT id, name, points, description, image_url, original_url FROM gifts WHERE id = ? AND family_id = ? AND profile_id = ? LIMIT 1 FOR UPDATE');
        $stmt->execute([$giftId, $familyId, $profileId]);
        $gift = $stmt->fetch();
        if (!$gift) sendError('Gift not found', 404);

        $stmt = $pdo->prepare('SELECT current_points FROM profiles WHERE id = ? AND family_id = ? LIMIT 1 FOR UPDATE');
        $stmt->execute([$profileId, $familyId]);
        $profile = $stmt->fetch();
        if (!$profile || (int)$profile['current_points'] < (int)$gift['points']) {
            sendError('Insufficient points', 400);
        }

        $stmt = $pdo->prepare('DELETE FROM gifts WHERE id = ?');
        $stmt->execute([$giftId]);

        $stmt = $pdo->prepare('INSERT INTO redeemed_gifts 
            (user_id, family_id, profile_id, gift_id, name, points, description, image_url, original_url, redeem_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())');
        $stmt->execute([
            $userId,
            $familyId,
            $profileId,
            $giftId,
            $gift['name'],
            $gift['points'],
            $gift['description'],
            $gift['image_url'] ?? '',
            $gift['original_url'] ?? ''
        ]);

        $stmt = $pdo->prepare('UPDATE profiles SET current_points = current_points - ?, updated_at = NOW() WHERE id = ? AND family_id = ?');
        $stmt->execute([(int)$gift['points'], $profileId, $familyId]);

        // Bridge: a redeemed wish becomes a longitudinal growth milestone (category='达成愿望').
        // Additive only — redeemed_gifts is untouched, gifts/redeemed remain the source of truth for points.
        $stmt = $pdo->prepare('INSERT INTO milestones (family_id, profile_id, user_id, category, title, detail, occurred_on) VALUES (?, ?, ?, ?, ?, ?, CURDATE())');
        $stmt->execute([
            $familyId,
            $profileId,
            $userId,
            '达成愿望',
            $gift['name'],
            $gift['description'] ?? ''
        ]);

        $stmt = $pdo->prepare('SELECT id, current_points FROM profiles WHERE id = ? AND family_id = ?');
        $stmt->execute([$profileId, $familyId]);
        $profile = $stmt->fetch();
        $stmt = $pdo->prepare('SELECT id FROM redeemed_gifts WHERE family_id = ? AND profile_id = ? AND gift_id = ? ORDER BY id DESC LIMIT 1');
        $stmt->execute([$familyId, $profileId, $giftId]);
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
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = resolveProfileId($pdo, $familyId, $userId, $data);
    try {
        $stmt = $pdo->prepare('SELECT r.id, r.profile_id, r.name, r.points, r.description, r.image_url, r.original_url, r.redeem_date, fm.display_name AS added_by_name
            FROM redeemed_gifts r LEFT JOIN family_members fm ON fm.user_id = r.user_id AND fm.family_id = r.family_id
            WHERE r.family_id = ? AND r.profile_id = ? ORDER BY r.redeem_date DESC LIMIT 500');
        $stmt->execute([$familyId, $profileId]);
        sendJson($stmt->fetchAll());
    } catch (Exception $e) {
        sendError('Failed to get redeemed gifts', 500, $e->getMessage());
    }
}

// ── Plan A: growth-record data layer (longitudinal asset) ──
function handleGetGrowthExtras($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = resolveProfileId($pdo, $familyId, $userId, $data);
    try {
        $out = [
            'milestones' => [],
            'growth_notes' => [],
            'child_voice' => [],
        ];
        if ($profileId) {
            $q = function($sql) use ($pdo, $familyId, $profileId) {
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$familyId, $profileId]);
                return $stmt->fetchAll();
            };
            $out['milestones'] = $q('SELECT id, category, title, detail, occurred_on, photo_url, created_at FROM milestones WHERE family_id = ? AND profile_id = ? ORDER BY COALESCE(occurred_on, created_at) DESC LIMIT 500');
            $out['growth_notes'] = $q('SELECT id, title, body, mood, occurred_on, photo_urls, created_at FROM growth_notes WHERE family_id = ? AND profile_id = ? ORDER BY COALESCE(occurred_on, created_at) DESC LIMIT 500');
            $out['child_voice'] = $q('SELECT id, content, recorded_on, created_at FROM child_voice WHERE family_id = ? AND profile_id = ? ORDER BY COALESCE(recorded_on, created_at) DESC LIMIT 500');
        }
        sendJson($out);
    } catch (Exception $e) {
        sendError('Failed to get growth extras', 500, $e->getMessage());
    }
}

function handleAddMilestone($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = resolveProfileId($pdo, $familyId, $userId, $data);
    if (!$profileId) sendError('No profile selected', 400);
    $category = trim($data['category'] ?? '其他');
    $title = trim($data['title'] ?? '');
    $detail = isset($data['detail']) ? trim($data['detail']) : '';
    $occurredOn = isset($data['occurred_on']) ? trim($data['occurred_on']) : null;
    $photoUrl = isset($data['photo_url']) ? trim($data['photo_url']) : '';

    if ($title === '') sendError('Title required', 400);
    if (strlen($title) > 255) sendError('Title too long (max 255)', 400);
    if (strlen($detail) > 4000) sendError('Detail too long (max 4000)', 400);
    if (strlen($photoUrl) > 2048) sendError('Photo URL too long', 400);
    if (!in_array($category, ['首次', '成长', '获奖', '习惯', '学习', '达成愿望', '其他'], true)) {
        $category = '其他';
    }
    if ($occurredOn !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $occurredOn)) {
        $occurredOn = null;
    }
    try {
        $stmt = $pdo->prepare('INSERT INTO milestones (family_id, profile_id, user_id, category, title, detail, occurred_on, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$familyId, $profileId, $userId, $category, $title, $detail, $occurredOn, $photoUrl]);
        sendJson(['success' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    } catch (Exception $e) {
        sendError('Failed to add milestone', 500, $e->getMessage());
    }
}

function handleAddGrowthNote($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = resolveProfileId($pdo, $familyId, $userId, $data);
    if (!$profileId) sendError('No profile selected', 400);
    $title = trim($data['title'] ?? '');
    $body = isset($data['body']) ? trim($data['body']) : '';
    $mood = isset($data['mood']) ? trim($data['mood']) : 'happy';
    $occurredOn = isset($data['occurred_on']) ? trim($data['occurred_on']) : null;

    if ($title === '') sendError('Title required', 400);
    if (strlen($title) > 255) sendError('Title too long (max 255)', 400);
    if (strlen($body) > 8000) sendError('Body too long (max 8000)', 400);
    if (!in_array($mood, ['happy', 'proud', 'calm', 'thinking', 'sad'], true)) {
        $mood = 'happy';
    }
    if ($occurredOn !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $occurredOn)) {
        $occurredOn = null;
    }
    try {
        $stmt = $pdo->prepare('INSERT INTO growth_notes (family_id, profile_id, user_id, title, body, mood, occurred_on) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$familyId, $profileId, $userId, $title, $body, $mood, $occurredOn]);
        sendJson(['success' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    } catch (Exception $e) {
        sendError('Failed to add growth note', 500, $e->getMessage());
    }
}

function handleAddChildVoice($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $profileId = resolveProfileId($pdo, $familyId, $userId, $data);
    if (!$profileId) sendError('No profile selected', 400);
    $content = isset($data['content']) ? trim($data['content']) : '';
    $recordedOn = isset($data['recorded_on']) ? trim($data['recorded_on']) : null;

    if ($content === '') sendError('Content required', 400);
    if (strlen($content) > 4000) sendError('Content too long (max 4000)', 400);
    if ($recordedOn !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $recordedOn)) {
        $recordedOn = null;
    }
    try {
        $stmt = $pdo->prepare('INSERT INTO child_voice (family_id, profile_id, user_id, content, recorded_on) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$familyId, $profileId, $userId, $content, $recordedOn]);
        sendJson(['success' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    } catch (Exception $e) {
        sendError('Failed to add child voice', 500, $e->getMessage());
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
    $familyId = requireFamilyMember($pdo, $userId);
    $behaviorId = isset($data['id']) ? (int)$data['id'] : 0;
    if ($behaviorId <= 0) sendError('Invalid behavior ID', 400);

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT points, profile_id FROM behaviors WHERE id = ? AND family_id = ? LIMIT 1 FOR UPDATE');
        $stmt->execute([$behaviorId, $familyId]);
        $row = $stmt->fetch();
        if (!$row) {
            $pdo->rollBack();
            sendError('Behavior not found', 404);
        }
        $stmt = $pdo->prepare('DELETE FROM behaviors WHERE id = ? AND family_id = ?');
        $stmt->execute([$behaviorId, $familyId]);
        // 积分回滚：删除一条行为记录时把当时产生的积分变动从 current_points 中扣除
        // （points 可正可负：+10 的记录删除后 current_points -10；-5 的记录删除后 current_points +5）
        $stmt = $pdo->prepare('UPDATE profiles SET current_points = GREATEST(current_points - ?, 0), updated_at = NOW() WHERE id = ? AND family_id = ?');
        $stmt->execute([(int)$row['points'], (int)$row['profile_id'], $familyId]);
        $pdo->commit();
        sendJson(['success' => true, 'points_rolled_back' => (int)$row['points']]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendError('Failed to delete behavior', 500, $e->getMessage());
    }
}

function handleDeleteGift($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $giftId = isset($data['id']) ? (int)$data['id'] : 0;
    if ($giftId <= 0) sendError('Invalid gift ID', 400);

    try {
        $stmt = $pdo->prepare('DELETE FROM gifts WHERE id = ? AND family_id = ?');
        $stmt->execute([$giftId, $familyId]);
        if ($stmt->rowCount() === 0) {
            sendError('Gift not found', 404);
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

// ── Family sharing actions ──
function handleGetFamily($pdo) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    try {
        $info = getFamilyInfo($pdo, $familyId, $userId);
        if (!$info) sendError('Family not found', 404);
        sendJson($info);
    } catch (Exception $e) {
        sendError('Failed to get family', 500, $e->getMessage());
    }
}

function handleInviteMember($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    rateLimit('inviteMember', 10, 3600);
    try {
        $stmt = $pdo->prepare('SELECT role FROM family_members WHERE family_id = ? AND user_id = ?');
        $stmt->execute([$familyId, $userId]);
        $m = $stmt->fetch();
        if (!$m || $m['role'] !== 'owner') sendError('Only the family owner can invite', 403);
        $code = generateInviteCode($pdo);
        $stmt = $pdo->prepare('UPDATE families SET invite_code = ?, invite_expires_at = NULL WHERE id = ?');
        $stmt->execute([$code, $familyId]);
        sendJson([
            'success' => true,
            'invite_code' => $code,
            'invite_link' => 'https://stellar.gaocaihk.com/?invite=' . $code
        ]);
    } catch (Exception $e) {
        sendError('Failed to create invite', 500, $e->getMessage());
    }
}

function handleJoinFamily($pdo, $data) {
    $userId = getUserId();
    $code = strtoupper(trim($data['code'] ?? ''));
    if (!preg_match('/^[0-9A-Z]{6}$/', $code)) sendError('Invalid invite code (6 characters)', 400);

    $displayName = isset($data['display_name']) ? trim($data['display_name']) : '';
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT id, invite_expires_at FROM families WHERE invite_code = ? LIMIT 1 FOR UPDATE');
        $stmt->execute([$code]);
        $family = $stmt->fetch();
        if (!$family) sendError('Invite code not found', 404);
        if ($family['invite_expires_at'] && strtotime($family['invite_expires_at']) < time()) sendError('Invite code expired', 410);
        $familyId = (int)$family['id'];

        // 已在家庭中的处理：仅当现有家庭是「solo 家庭」（自己一人且为 owner）时允许转换加入；
        // 否则必须先退出当前家庭（owner 需先移除其他成员）。
        $currentFid = getFamilyIdOfUser($pdo, $userId);
        if ($currentFid === $familyId) sendError('You are already in this family', 409);
        if ($currentFid) {
            $stmt = $pdo->prepare('SELECT role FROM family_members WHERE family_id = ? AND user_id = ?');
            $stmt->execute([$currentFid, $userId]);
            $me = $stmt->fetch();
            $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM family_members WHERE family_id = ?');
            $stmt->execute([$currentFid]);
            $cnt = (int)$stmt->fetch()['cnt'];
            if (!($me && $me['role'] === 'owner' && $cnt === 1)) {
                sendError('You are already in a family. Leave it first.', 409);
            }
            // 先把数据迁移到新家庭，再解散旧的 solo 家庭（profiles.family_id 是 ON DELETE CASCADE，
            // 顺序必须是：迁移 → 删除旧家庭，否则档案会被级联删除）
            $stmt = $pdo->prepare('UPDATE profiles SET family_id = ? WHERE user_id = ?');
            $stmt->execute([$familyId, $userId]);
            $stmt = $pdo->prepare('UPDATE behaviors b JOIN profiles p ON b.profile_id = p.id SET b.family_id = ? WHERE p.user_id = ?');
            $stmt->execute([$familyId, $userId]);
            $stmt = $pdo->prepare('UPDATE gifts g JOIN profiles p ON g.profile_id = p.id SET g.family_id = ? WHERE p.user_id = ?');
            $stmt->execute([$familyId, $userId]);
            $stmt = $pdo->prepare('UPDATE redeemed_gifts r JOIN profiles p ON r.profile_id = p.id SET r.family_id = ? WHERE p.user_id = ?');
            $stmt->execute([$familyId, $userId]);
            $stmt = $pdo->prepare('UPDATE milestones SET family_id = ? WHERE family_id = ?');
            $stmt->execute([$familyId, $currentFid]);
            $stmt = $pdo->prepare('UPDATE analytics_events SET family_id = ? WHERE family_id = ?');
            $stmt->execute([$familyId, $currentFid]);
            $stmt = $pdo->prepare('DELETE FROM family_members WHERE family_id = ?');
            $stmt->execute([$currentFid]);
            $stmt = $pdo->prepare('DELETE FROM families WHERE id = ?');
            $stmt->execute([$currentFid]);
        }

        $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM family_members WHERE family_id = ?');
        $stmt->execute([$familyId]);
        if ((int)$stmt->fetch()['cnt'] >= FAMILY_MAX_MEMBERS) sendError('Family is full (max ' . FAMILY_MAX_MEMBERS . ')', 403);

        if ($displayName === '' || strlen($displayName) > 60) {
            $stmt = $pdo->prepare('SELECT email FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            $u = $stmt->fetch();
            $displayName = $u ? explode('@', $u['email'])[0] : '成员';
        }

        $stmt = $pdo->prepare('INSERT INTO family_members (family_id, user_id, role, display_name) VALUES (?, ?, "member", ?)');
        $stmt->execute([$familyId, $userId, $displayName]);

        // move the joining user's existing profiles + their records into the new family (preserve data)
        // (solo 家庭转换时上方已迁移；此处兜底覆盖无家庭/普通加入场景)
        $stmt = $pdo->prepare('UPDATE profiles SET family_id = ? WHERE user_id = ? AND family_id <> ?');
        $stmt->execute([$familyId, $userId, $familyId]);
        $stmt = $pdo->prepare('UPDATE behaviors b JOIN profiles p ON b.profile_id = p.id SET b.family_id = ? WHERE p.user_id = ? AND b.family_id <> ?');
        $stmt->execute([$familyId, $userId, $familyId]);
        $stmt = $pdo->prepare('UPDATE gifts g JOIN profiles p ON g.profile_id = p.id SET g.family_id = ? WHERE p.user_id = ? AND g.family_id <> ?');
        $stmt->execute([$familyId, $userId, $familyId]);
        $stmt = $pdo->prepare('UPDATE redeemed_gifts r JOIN profiles p ON r.profile_id = p.id SET r.family_id = ? WHERE p.user_id = ? AND r.family_id <> ?');
        $stmt->execute([$familyId, $userId, $familyId]);

        $pdo->commit();
        sendJson(getFamilyInfo($pdo, $familyId, $userId));
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendError('Failed to join family', 500, $e->getMessage());
    }
}

function handleRemoveMember($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $targetId = isset($data['user_id']) ? (int)$data['user_id'] : 0;
    if ($targetId <= 0) sendError('Invalid member', 400);
    if ($targetId === (int)$userId) sendError('Use leave instead of removing yourself', 400);
    try {
        $stmt = $pdo->prepare('SELECT role FROM family_members WHERE family_id = ? AND user_id = ?');
        $stmt->execute([$familyId, $userId]);
        $m = $stmt->fetch();
        if (!$m || $m['role'] !== 'owner') sendError('Only the family owner can remove members', 403);
        $stmt = $pdo->prepare('DELETE FROM family_members WHERE family_id = ? AND user_id = ?');
        $stmt->execute([$familyId, $targetId]);
        if ($stmt->rowCount() === 0) sendError('Member not found', 404);
        // The removed member's profiles stay in the family (shared assets); they lose access.
        sendJson(['success' => true]);
    } catch (Exception $e) {
        sendError('Failed to remove member', 500, $e->getMessage());
    }
}

function handleLeaveFamily($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    try {
        $stmt = $pdo->prepare('SELECT role FROM family_members WHERE family_id = ? AND user_id = ?');
        $stmt->execute([$familyId, $userId]);
        $m = $stmt->fetch();
        if (!$m) sendError('You are not in this family', 404);
        if ($m['role'] === 'owner') sendError('Owner cannot leave. Remove other members or transfer ownership first.', 400);
        $stmt = $pdo->prepare('DELETE FROM family_members WHERE family_id = ? AND user_id = ?');
        $stmt->execute([$familyId, $userId]);
        // The member's profiles stay in the family (shared). They lose access.
        sendJson(['success' => true, 'left' => true]);
    } catch (Exception $e) {
        sendError('Failed to leave family', 500, $e->getMessage());
    }
}

function handleUpdateMemberName($pdo, $data) {
    $userId = getUserId();
    $familyId = requireFamilyMember($pdo, $userId);
    $name = trim($data['display_name'] ?? '');
    if ($name === '' || strlen($name) > 60) sendError('Invalid display name', 400);
    try {
        $stmt = $pdo->prepare('UPDATE family_members SET display_name = ? WHERE family_id = ? AND user_id = ?');
        $stmt->execute([$name, $familyId, $userId]);
        sendJson(['success' => true, 'display_name' => $name]);
    } catch (Exception $e) {
        sendError('Failed to update name', 500, $e->getMessage());
    }
}

function handleTrackEvent($pdo, $data) {
    try {
    $userId = getUserId();
    rateLimit('track', 120, 60); // generous: up to 120 events / minute / IP
    $event = trim($data['event'] ?? '');
    if ($event === '' || !in_array($event, TRACK_ALLOWED_EVENTS, true)) {
        sendError('Invalid event', 400);
    }
    $meta = $data['meta'] ?? null;
    if ($meta !== null && !is_array($meta)) {
        $meta = null;
    }
    if ($meta !== null) {
        // bound payload size (defensive)
        $encoded = json_encode($meta, JSON_UNESCAPED_UNICODE);
        if ($encoded === false || strlen($encoded) > 2000) {
            $meta = null;
        }
    }
    $familyId = getFamilyIdOfUser($pdo, $userId);
        $stmt = $pdo->prepare('INSERT INTO analytics_events (user_id, family_id, event, meta) VALUES (?, ?, ?, ?)');
        $stmt->execute([
            $userId,
            $familyId,
            $event,
            $meta === null ? null : json_encode($meta, JSON_UNESCAPED_UNICODE)
        ]);
        sendJson(['success' => true]);
    } catch (Throwable $e) {
        sendError('Failed to record event', 500, $e->getMessage());
    }
}
