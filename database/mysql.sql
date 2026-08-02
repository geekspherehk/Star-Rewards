-- MySQL Database Schema for Star-Rewards App
-- Version 2 (security + feature fixes)

-- 1. 创建 users 表
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 创建 profiles 表
CREATE TABLE IF NOT EXISTS profiles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL UNIQUE,
  current_points INT NOT NULL DEFAULT 0,
  total_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_current_points CHECK (current_points >= 0),
  CONSTRAINT chk_total_points CHECK (total_points >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 创建 gifts 表
CREATE TABLE IF NOT EXISTS gifts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  points INT NOT NULL,
  description TEXT,
  image_url VARCHAR(2048) DEFAULT '',
  original_url VARCHAR(2048) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_gifts_user_created (user_id, created_at DESC),
  CONSTRAINT chk_gifts_points CHECK (points > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 创建 redeemed_gifts 表
CREATE TABLE IF NOT EXISTS redeemed_gifts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  gift_id BIGINT,
  name VARCHAR(255) NOT NULL,
  points INT NOT NULL,
  description TEXT,
  image_url VARCHAR(2048) DEFAULT '',
  original_url VARCHAR(2048) DEFAULT '',
  redeem_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_redeemed_user_date (user_id, redeem_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 创建 behaviors 表
CREATE TABLE IF NOT EXISTS behaviors (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  description TEXT NOT NULL,
  points INT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_behaviors_user_time (user_id, timestamp DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. 创建 user_configs 表
CREATE TABLE IF NOT EXISTS user_configs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL UNIQUE,
  selected_theme VARCHAR(50) DEFAULT 'classic',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Migration: 为现有表补充缺失字段（幂等安全）
--    升级 V1 -> V2 时运行（忽略重复字段错误）
-- ALTER TABLE gifts ADD COLUMN image_url VARCHAR(2048) DEFAULT '';
-- ALTER TABLE gifts ADD COLUMN original_url VARCHAR(2048) DEFAULT '';
-- ALTER TABLE redeemed_gifts ADD COLUMN image_url VARCHAR(2048) DEFAULT '';
-- ALTER TABLE redeemed_gifts ADD COLUMN original_url VARCHAR(2048) DEFAULT '';
-- ALTER TABLE profiles MODIFY COLUMN current_points INT NOT NULL DEFAULT 0;
-- ALTER TABLE profiles MODIFY COLUMN total_points INT NOT NULL DEFAULT 0;
