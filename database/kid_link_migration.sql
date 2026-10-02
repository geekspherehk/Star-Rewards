-- ============================================================
-- v3：孩子端「一次性长链接」所需的两处结构
-- 依据：discussion.md 11.9 / 11.10 / 11.11
-- 说明：本地开发可直接执行；**生产库需经用户同意后**再用 run_migration_prod.py 或手工执行。
-- ============================================================

-- 1) users 加一列：家长点「重新生成链接」时 +1，历史 kid token 当场失效
--    （共享平板丢了的唯一处理动作；存量用户默认 0，行为与迁移前一致）
ALTER TABLE `users` ADD COLUMN `kid_token_version` int(11) NOT NULL DEFAULT 0 AFTER `reset_expires`;

-- 2) 一次性票：只存 sha256 哈希，绝不存明文码
CREATE TABLE IF NOT EXISTS `kid_links` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `family_id` bigint(20) NOT NULL,
  `profile_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `status` enum('active','consumed','revoked') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `consumed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_token_hash` (`token_hash`),
  KEY `idx_kidlink_family` (`family_id`),
  KEY `idx_kidlink_profile` (`profile_id`),
  CONSTRAINT `fk_kidlink_family` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kidlink_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kidlink_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
