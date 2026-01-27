-- 兑换礼物存储过程
-- 确保所有数据库操作的原子性，避免数据不一致问题
CREATE OR REPLACE FUNCTION public.redeem_gift_transaction(
    user_id_param UUID,
    gift_id_param BIGINT,
    gift_name_param TEXT,
    gift_points_param INTEGER,
    gift_description_param TEXT,
    redeem_date_param TIMESTAMPTZ,
    current_points_param INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_points INTEGER;
    gift_exists BOOLEAN;
BEGIN
    -- 检查用户是否存在
    SELECT current_points INTO current_user_points
    FROM public.profiles
    WHERE id = user_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '用户不存在';
    END IF;
    
    -- 检查积分是否足够（使用数据库中的实际积分）
    IF current_user_points < gift_points_param THEN
        RAISE EXCEPTION '积分不足';
    END IF;
    
    -- 检查礼物是否存在
    SELECT EXISTS(SELECT 1 FROM public.gifts WHERE id = gift_id_param AND user_id = user_id_param) INTO gift_exists;
    
    IF NOT gift_exists THEN
        RAISE EXCEPTION '礼物不存在';
    END IF;
    
    -- 开始事务
    -- 1. 添加兑换记录
    INSERT INTO public.redeemed_gifts (
        user_id, 
        gift_id, 
        name, 
        points, 
        description, 
        redeem_date
    ) VALUES (
        user_id_param, 
        gift_id_param, 
        gift_name_param, 
        gift_points_param, 
        gift_description_param, 
        redeem_date_param
    );
    
    -- 2. 更新用户积分（使用计算后的积分）
    UPDATE public.profiles
    SET 
        current_points = current_points_param,
        updated_at = redeem_date_param
    WHERE id = user_id_param;
    
    -- 3. 删除礼物
    DELETE FROM public.gifts
    WHERE id = gift_id_param AND user_id = user_id_param;
    
    -- 返回成功
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        -- 发生任何错误时回滚事务
        RAISE NOTICE '兑换失败: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- 授权给所有认证用户
GRANT EXECUTE ON FUNCTION public.redeem_gift_transaction TO authenticated;