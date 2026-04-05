<?php
// 数据库配置 - 必须通过环境变量设置，禁止硬编码凭据
// 部署时请在服务器环境中设置以下变量：
//   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
//
// Hostinger 设置方法：
//   1. 进入 hPanel -> Advanced -> PHP Configuration
//   2. 在 PHP Variables 或 .htaccess 中设置
//   3. 或在同目录创建 .env.php（已加入 .gitignore）返回数组

function loadDbConfig() {
    $env = [];
    $candidates = [
        __DIR__ . '/.env.php',
        dirname(__DIR__) . '/.env.php'
    ];
    foreach ($candidates as $envFile) {
        if (file_exists($envFile)) {
            $loaded = require $envFile;
            if (is_array($loaded)) {
                $env = array_merge($env, $loaded);
            }
        }
    }
    return $env;
}

$env = loadDbConfig();

define('DB_HOST', getenv('DB_HOST') ?: ($env['DB_HOST'] ?? ''));
define('DB_PORT', getenv('DB_PORT') ?: ($env['DB_PORT'] ?? '3306'));
define('DB_NAME', getenv('DB_NAME') ?: ($env['DB_NAME'] ?? ''));
define('DB_USER', getenv('DB_USER') ?: ($env['DB_USER'] ?? ''));
define('DB_PASS', getenv('DB_PASS') ?: ($env['DB_PASS'] ?? ''));

// Token 签名密钥 - 必须设置，用于 JWT-like 签名
// 请使用足够随机的长字符串（建议 32+ 字符）
define('TOKEN_SECRET', getenv('TOKEN_SECRET') ?: ($env['TOKEN_SECRET'] ?? ''));

// Token 有效期（秒）
define('TOKEN_TTL', getenv('TOKEN_TTL') ?: ($env['TOKEN_TTL'] ?? 86400));

if (empty(DB_HOST) || empty(DB_NAME) || empty(DB_USER) || empty(DB_PASS)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Database configuration missing. Please set environment variables.']);
    exit;
}

if (empty(TOKEN_SECRET)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Token secret missing. Please set TOKEN_SECRET environment variable.']);
    exit;
}
?>