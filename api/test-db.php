<?php
require_once 'config.php';

header('Content-Type: text/plain');

echo "DB_HOST: " . DB_HOST . "\n";
echo "DB_PORT: " . DB_PORT . "\n";
echo "DB_NAME: " . DB_NAME . "\n";
echo "DB_USER: " . DB_USER . "\n";

try {
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    echo "✅ 数据库连接成功!\n";
    
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "表: " . implode(", ", $tables) . "\n";
} catch (PDOException $e) {
    echo "❌ 数据库连接失败: " . $e->getMessage() . "\n";
}
?>
