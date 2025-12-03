-- 分步骤安全更新脚本 - 添加用户主题配置功能
-- 建议逐步执行，每步确认成功后再执行下一步

-- =============================================
-- 步骤1: 创建user_configs表
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_configs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_theme TEXT DEFAULT 'classic',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 验证表创建
SELECT 'user_configs表创建成功' as 结果, COUNT(*) as 记录数
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'user_configs';

-- =============================================
-- 步骤2: 启用行级安全
-- =============================================
ALTER TABLE public.user_configs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 步骤3: 创建RLS策略
-- =============================================
-- 先删除已存在的策略
DROP POLICY IF EXISTS "用户可以管理自己的 user_configs" ON public.user_configs;

-- 创建新的RLS策略
CREATE POLICY "用户可以管理自己的 user_configs" ON public.user_configs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 验证策略创建
SELECT 'RLS策略创建成功' as 结果, COUNT(*) as 数量
FROM pg_policies 
WHERE tablename = 'user_configs' 
AND policyname = '用户可以管理自己的 user_configs';

-- =============================================
-- 步骤4: 备份并更新用户创建触发器
-- =============================================
-- 注意：这一步会重新创建触发器函数，确保你了解影响

-- 删除旧的触发器和函数
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 创建新的触发器函数（包含user_configs创建）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, total_points)
  VALUES (new.id, 0);
  
  -- 同时创建 user_configs 记录，默认主题为 classic
  INSERT INTO public.user_configs (user_id, selected_theme)
  VALUES (new.id, 'classic');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 重新创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================
-- 步骤5: 为现有用户创建配置记录
-- =============================================
-- 只为还没有配置的用户创建记录
INSERT INTO public.user_configs (user_id, selected_theme)
SELECT id, 'classic'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_configs);

-- 验证最终状态
SELECT 
  'user_configs最终状态' as 检查项,
  COUNT(*) as 用户配置数
FROM public.user_configs
UNION ALL
SELECT 
  'users表用户数' as 检查项,
  COUNT(*) as 用户数
FROM auth.users;