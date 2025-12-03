-- 简化版增量更新脚本 - 添加用户主题配置功能
-- 在已有数据库中执行此脚本

-- 1. 创建user_configs表（如果不存在）
CREATE TABLE IF NOT EXISTS public.user_configs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_theme TEXT DEFAULT 'classic',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 启用行级安全
ALTER TABLE public.user_configs ENABLE ROW LEVEL SECURITY;

-- 3. 删除已存在的RLS策略并重新创建
DROP POLICY IF EXISTS "用户可以管理自己的 user_configs" ON public.user_configs;

-- 创建新的RLS策略
CREATE POLICY "用户可以管理自己的 user_configs" ON public.user_configs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. 更新用户创建触发器
-- 删除旧的触发器函数（如果存在）
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

-- 5. 为现有用户创建配置记录（如果还没有）
INSERT INTO public.user_configs (user_id, selected_theme)
SELECT id, 'classic'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_configs);

-- 6. 验证安装
SELECT 
  'user_configs表状态' as 检查项,
  CASE WHEN COUNT(*) > 0 THEN '表存在，记录数: ' || COUNT(*) 
       ELSE '表不存在或为空' 
  END as 结果
FROM public.user_configs;