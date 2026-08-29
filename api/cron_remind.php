<?php
/**
 * 每日打卡提醒 cron 入口（Hostinger hPanel → Cron Jobs → 类型选 PHP）
 * 直接以 PHP CLI 运行，直连数据库执行全量提醒；不走 HTTP、无密钥泄露。
 * 仅命令行可运行；HTTP 直接访问返回 403。
 *
 * 用法：php api/cron_remind.php
 */
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Forbidden: CLI only');
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/webpush.php';

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
    $sent = wp_remindAll($pdo);
    if ($sent === -1) {
        echo date('Y-m-d H:i:s') . " cron_remind: 非提醒时段（" . (defined('REMIND_HOUR_FROM') ? REMIND_HOUR_FROM : 0) . '-' . (defined('REMIND_HOUR_TO') ? REMIND_HOUR_TO : 23) . "时），未发送\n";
    } else {
        echo date('Y-m-d H:i:s') . " cron_remind done, sent: {$sent}\n";
    }
} catch (Exception $e) {
    fwrite(STDERR, 'cron_remind error: ' . $e->getMessage() . "\n");
    exit(1);
}
