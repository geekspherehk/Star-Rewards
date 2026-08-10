-- MySQL Database Schema for Star-Rewards App
-- Version 4 (family sharing + multi-child + added_by + analytics_events)
-- Regenerated from live DB on 2026-08-10. Canonical schema source.

-- users
CREATE TABLE `users` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- families
CREATE TABLE `families` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL DEFAULT '我的家庭',
  `invite_code` varchar(8) NOT NULL,
  `invite_expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_invite` (`invite_code`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- family_members
CREATE TABLE `family_members` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `family_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `role` enum('owner','member') NOT NULL DEFAULT 'member',
  `display_name` varchar(60) NOT NULL DEFAULT '',
  `joined_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_family_user` (`family_id`,`user_id`),
  KEY `idx_fm_user` (`user_id`),
  CONSTRAINT `fk_fm_family` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- profiles
CREATE TABLE `profiles` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `name` varchar(50) NOT NULL DEFAULT '孩子',
  `avatar` varchar(20) NOT NULL DEFAULT '⭐',
  `color` varchar(20) NOT NULL DEFAULT '#FFB300',
  `current_points` int(11) DEFAULT 0,
  `total_points` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `family_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_profile_family` (`family_id`),
  CONSTRAINT `fk_profile_family` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- behaviors
CREATE TABLE `behaviors` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `profile_id` bigint(20) NOT NULL,
  `description` text NOT NULL,
  `points` int(11) NOT NULL,
  `timestamp` timestamp NULL DEFAULT current_timestamp(),
  `family_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `fk_behavior_profile` (`profile_id`),
  KEY `idx_behavior_family` (`family_id`),
  CONSTRAINT `behaviors_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_behavior_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- gifts
CREATE TABLE `gifts` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `profile_id` bigint(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `points` int(11) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(2048) DEFAULT '',
  `original_url` varchar(2048) DEFAULT '',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `family_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `fk_gift_profile` (`profile_id`),
  KEY `idx_gift_family` (`family_id`),
  CONSTRAINT `fk_gift_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `gifts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- redeemed_gifts
CREATE TABLE `redeemed_gifts` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `profile_id` bigint(20) NOT NULL,
  `gift_id` bigint(20) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `points` int(11) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(2048) DEFAULT '',
  `original_url` varchar(2048) DEFAULT '',
  `redeem_date` timestamp NULL DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `family_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `fk_redeemed_profile` (`profile_id`),
  KEY `idx_redeemed_family` (`family_id`),
  CONSTRAINT `fk_redeemed_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `redeemed_gifts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- analytics_events
CREATE TABLE `analytics_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `family_id` int(10) unsigned DEFAULT NULL,
  `event` varchar(64) NOT NULL,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_event` (`event`),
  KEY `idx_user` (`user_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- user_configs
CREATE TABLE `user_configs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `selected_theme` varchar(50) DEFAULT 'classic',
  `selected_profile_id` bigint(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `user_configs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
