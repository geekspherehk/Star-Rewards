-- ── 找回密码：users 表加一次性重置令牌字段 ──
-- 存 SHA-256 哈希（不存原文），30 分钟过期；forgot_password 每次签发覆盖旧令牌
ALTER TABLE `users` ADD COLUMN `reset_token_hash` char(64) DEFAULT NULL, ADD COLUMN `reset_expires` datetime DEFAULT NULL, ADD KEY `idx_users_reset` (`reset_token_hash`);
