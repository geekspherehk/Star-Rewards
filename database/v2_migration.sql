-- Star-Rewards V2 Migration — 全人版愿望清单体系
-- 基于《愿望清单体系 V2 · 全人版》方法论：8 大素养 × 愿望/打卡/成长指标 三层模型
-- 在现有 V5 schema 之上增量升级；幂等（可重复执行：IF NOT EXISTS / 列存在性检查由迁移工具处理）
-- 说明：本文件为开发期迁移脚本，正式上线前需在测试库验证后按需执行

-- ── 1) 激活 behaviors.dimension（V5 已建但空置），补齐 V2 绑定字段 ──
ALTER TABLE `behaviors`
  MODIFY COLUMN `dimension` varchar(20) DEFAULT NULL,
  ADD COLUMN `related_categories` varchar(255) DEFAULT NULL AFTER `dimension`,
  ADD COLUMN `effort_type` varchar(20) DEFAULT NULL AFTER `related_categories`,
  ADD COLUMN `wish_id` bigint(20) DEFAULT NULL AFTER `effort_type`;

-- ── 2) wishes：挂在 8 大素养下的成长愿望（替代「愿望=礼物」混用） ──
-- category 枚举（8 大素养）：
--   self_drive 自驱力 / money 理财力 / empathy 共情力 / relationship 关系力
--   planning 规划力 / resilience 抗挫力 / health 健康力 / aesthetics 审美力
CREATE TABLE IF NOT EXISTS `wishes` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `family_id` bigint(20) NOT NULL,
  `profile_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `category` varchar(20) NOT NULL DEFAULT 'self_drive',
  `related_categories` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `wish_type` enum('experience','persistence','challenge') NOT NULL DEFAULT 'experience',
  `persistence_days` int(11) NOT NULL DEFAULT 0,
  `difficulty_coef` decimal(3,2) NOT NULL DEFAULT 1.00,
  `stars` int(11) NOT NULL DEFAULT 1,
  `effort_label` varchar(40) DEFAULT NULL,
  `points_target` int(11) NOT NULL DEFAULT 0,
  `image_url` varchar(2048) DEFAULT '',
  `original_url` varchar(2048) DEFAULT '',
  `status` enum('active','achieved') NOT NULL DEFAULT 'active',
  `achieved_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_wish_family` (`family_id`),
  KEY `idx_wish_profile` (`profile_id`),
  CONSTRAINT `fk_wish_family` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wish_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wish_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3) checkins：坚持型/挑战型愿望的每日打卡（习惯内化协议的数据层） ──
-- 阶段状态机：建立（连续 1-6 天）→ 稳定（7-20 天）→ 内化（≥21 天或达到目标天数）
CREATE TABLE IF NOT EXISTS `checkins` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `family_id` bigint(20) NOT NULL,
  `profile_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `wish_id` bigint(20) DEFAULT NULL,
  `checkin_date` date NOT NULL,
  `note` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_wish_date` (`wish_id`,`checkin_date`),
  KEY `idx_ck_family` (`family_id`),
  KEY `idx_ck_profile` (`profile_id`),
  CONSTRAINT `fk_ck_family` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ck_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ck_wish` FOREIGN KEY (`wish_id`) REFERENCES `wishes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4) monthly_focus：两段式自主 — 孩子每月自选 1 个「本月主打瓣」 ──
CREATE TABLE IF NOT EXISTS `monthly_focus` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `family_id` bigint(20) NOT NULL,
  `profile_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `category` varchar(20) NOT NULL,
  `focus_month` char(7) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_profile_month` (`profile_id`,`focus_month`),
  KEY `idx_mf_family` (`family_id`),
  CONSTRAINT `fk_mf_family` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mf_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mf_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5) growth_indicators：家长每周对照勾选每类「萌芽→成长→绽放」三级指标 ──
CREATE TABLE IF NOT EXISTS `growth_indicators` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `family_id` bigint(20) NOT NULL,
  `profile_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `category` varchar(20) NOT NULL,
  `level` enum('sprout','growing','bloom') NOT NULL DEFAULT 'sprout',
  `week_start` date NOT NULL,
  `note` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_cat_week` (`profile_id`,`category`,`week_start`),
  KEY `idx_gi_family` (`family_id`),
  CONSTRAINT `fk_gi_family` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gi_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gi_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 6) user_badges：8 枚角色徽章 + 全能小星星（解锁即长期留存） ──
CREATE TABLE IF NOT EXISTS `user_badges` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `family_id` bigint(20) NOT NULL,
  `profile_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `badge_code` varchar(40) NOT NULL,
  `unlocked_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_profile_badge` (`profile_id`,`badge_code`),
  KEY `idx_ub_family` (`family_id`),
  CONSTRAINT `fk_ub_family` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ub_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ub_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 7) gifts 去贿赂化：类别 + 兑现方式（online 线上直接发放 / offline 线下兑现保留温度） ──
ALTER TABLE `gifts`
  ADD COLUMN `category` varchar(20) DEFAULT NULL AFTER `points`,
  ADD COLUMN `fulfillment` enum('online','offline') NOT NULL DEFAULT 'online' AFTER `category`;

-- ── 8) profiles：星币宝藏屋预算上限（0 = 不设上限，练「取舍」） ──
ALTER TABLE `profiles`
  ADD COLUMN `budget_cap` int(11) NOT NULL DEFAULT 0 AFTER `bio_note`;
