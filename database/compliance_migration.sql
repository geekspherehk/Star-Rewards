-- 合规迁移：记录监护人同意时间（儿童类产品合规必需）
-- 执行顺序：本迁移必须在部署 api/index.php 之前运行，否则注册时 INSERT consented_at 会 500。
-- 运行方式：scripts/run_migration_prod.py database/compliance_migration.sql

ALTER TABLE `users`
  ADD COLUMN `consented_at` datetime DEFAULT NULL COMMENT '监护人同意时间戳；NULL=未记录同意'
  AFTER `verify_expires`;

-- 老用户已在用，回填为注册时间，视为已同意监护人条款（不强制其重新注册）
UPDATE `users` SET `consented_at` = `created_at` WHERE `consented_at` IS NULL;
