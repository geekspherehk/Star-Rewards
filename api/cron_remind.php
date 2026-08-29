<?php
/**
 * 每日打卡提醒 cron 入口（Hostinger hPanel → Cron Jobs → 类型选 PHP）
 * 直接以 PHP CLI 运行，直连数据库执行全量提醒；不走 HTTP、无密钥泄露。
 * 仅命令行可运行；HTTP 直接访问返回 403。
 *
 * 诊断设计：脚本启动立刻在「api/cron_remind.log」和「/tmp/star_cron_remind.log」
 * 各写一行，并把环境信息 echo 出来 —— 用来判断 cron 是否真的执行了脚本、
 * 以及 PHP 能否写 web 目录。
 *
 * 用法：php api/cron_remind.php
 */
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Forbidden: CLI only');
}

$now = date('Y-m-d H:i:s');
$diag = "=== {$now} cron start | php " . PHP_VERSION . " | sapi=" . php_sapi_name()
    . " | basedir=" . (ini_get('open_basedir') ?: 'none')
    . " | cwd=" . getcwd()
    . " | uid=" . (function_exists('posix_geteuid') ? posix_geteuid() : '?')
    . "\n";
$okApi = @file_put_contents(__DIR__ . '/cron_remind.log', $diag, FILE_APPEND | LOCK_EX);
$okTmp = @file_put_contents('/tmp/star_cron_remind.log', $diag, FILE_APPEND | LOCK_EX);
echo $diag . 'write_api=' . var_export($okApi, true) . ' | write_tmp=' . var_export($okTmp, true) . "\n";

function cron_log($msg) {
    $line = date('Y-m-d H:i:s') . ' ' . $msg . "\n";
    @file_put_contents(__DIR__ . '/cron_remind.log', $line, FILE_APPEND | LOCK_EX);
    @file_put_contents('/tmp/star_cron_remind.log', $line, FILE_APPEND | LOCK_EX);
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
        $msg = 'cron_remind: 非提醒时段（' . (defined('REMIND_HOUR_FROM') ? REMIND_HOUR_FROM : 0) . '-' . (defined('REMIND_HOUR_TO') ? REMIND_HOUR_TO : 23) . '时），未发送';
        echo date('Y-m-d H:i:s') . ' ' . $msg . "\n";
        cron_log($msg);
    } else {
        $msg = 'cron_remind done, sent: ' . $sent;
        echo date('Y-m-d H:i:s') . ' ' . $msg . "\n";
        cron_log($msg);
    }
} catch (Exception $e) {
    $err = 'cron_remind error: ' . $e->getMessage();
    fwrite(STDERR, $err . "\n");
    cron_log($err);
    exit(1);
}
