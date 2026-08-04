<?php
// ============================================================
// ⚠️ 部署必读：本文件是配置模板（可安全提交到 git）
// 部署时请复制为 .env.php 并填入真实配置：
//
//   1. 登录 Hostinger hPanel → 数据库 → MySQL 数据库
//   2. 找到你的数据库主机(DB_HOST)、名称(DB_NAME)、用户(DB_USER)、密码(DB_PASS)
//   3. 复制本文件为 api/.env.php，替换 XXX 为真实值
//   4. 刷新页面即可
//
// ⚠️ .env.php 已被 .gitignore 排除，绝不会上传到 git，
//    必须通过 hPanel 文件管理器 / FTP 手动创建！
// ============================================================

return [
    'DB_HOST'     => 'XXX',            // 例如: srv544.hstgr.io
    'DB_PORT'     => '3306',           // MySQL 默认端口
    'DB_NAME'     => 'XXX',            // 例如: u812217706_star
    'DB_USER'     => 'XXX',            // 例如: u812217706_chenchen2005
    'DB_PASS'     => 'XXX',            // 数据库密码

    // JWT 签名密钥：务必使用足够随机的长字符串（32+ 字符）
    'TOKEN_SECRET'=> 'XXX',
    'TOKEN_TTL'   => 86400,            // Token 有效期（秒）= 24 小时
];
