<?php
// 统一时区：香港时间（+8）——服务器默认 UTC，会导致"今日打卡/提醒时段"按 UTC 算错
date_default_timezone_set('Asia/Hong_Kong');

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

// Web Push（VAPID + cron 密钥，见 api/.env.php）
define('VAPID_PRIVATE_KEY', $env['VAPID_PRIVATE_KEY'] ?? '');
define('VAPID_PUBLIC_KEY', $env['VAPID_PUBLIC_KEY'] ?? '');
define('VAPID_SUBJECT', $env['VAPID_SUBJECT'] ?? 'mailto:admin@gaocaihk.com');
define('PUSH_CRON_KEY', $env['PUSH_CRON_KEY'] ?? '');

// 打卡提醒时间段（服务器时区，含头含尾）：cron 每小时跑，但只在此时段内真正发送
define('REMIND_HOUR_FROM', 18);
define('REMIND_HOUR_TO', 22);

// ── 运营数据看板（getStats / canViewStats）站长白名单 ──
// 站长（运营）账号邮箱，逗号分隔；只有这些账号能查看全站运营数据。
// 未配置则任何人（含孩子账号）都拿不到全站数据 —— 默认拒绝，安全优先。
// 优先级：系统环境变量 > api/.env.php 的 STATS_OWNER_EMAILS > 下方默认数组
$statsOwnerDefaultEmails = [
    'avadesian@qq.com',
];
define('STATS_OWNER_EMAILS', getenv('STATS_OWNER_EMAILS') ?: ($env['STATS_OWNER_EMAILS'] ?? implode(',', $statsOwnerDefaultEmails)));

if (empty(DB_HOST) || empty(DB_NAME) || empty(DB_USER) || empty(DB_PASS)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Database configuration missing. Please set environment variables.',
        'hint'  => 'Create api/.env.php (see api/.env.example.php) or set DB_HOST/DB_NAME/DB_USER/DB_PASS on the server.'
    ]);
    exit;
}

if (empty(TOKEN_SECRET)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Token secret missing. Please set TOKEN_SECRET environment variable.',
        'hint'  => 'Set TOKEN_SECRET in api/.env.php (see api/.env.example.php).'
    ]);
    exit;
}
?>