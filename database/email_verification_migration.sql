-- ── 邮箱验证：users 表加验证状态 + 一次性验证令牌 ──
-- email_verified：0=未验证 1=已验证（默认 0，新注册走验证流程）
-- verify_token_hash：验证链接令牌的 SHA-256 哈希（不存原文，拖库也无法直接用）
-- verify_expires：令牌过期时间，由 MySQL 时钟生成，避免 PHP/MySQL 时区差导致多有效 8 小时
ALTER TABLE `users`
  ADD COLUMN `email_verified` tinyint(1) NOT NULL DEFAULT 0 AFTER `password_hash`,
  ADD COLUMN `verify_token_hash` char(64) DEFAULT NULL AFTER `email_verified`,
  ADD COLUMN `verify_expires` datetime DEFAULT NULL AFTER `verify_token_hash`,
  ADD KEY `idx_users_verify` (`verify_token_hash`);

-- 老用户（验证功能上线前已注册）直接视为已验证，不弹验证提示，避免打扰已在用的用户
UPDATE `users` SET `email_verified` = 1 WHERE `email_verified` = 0;
