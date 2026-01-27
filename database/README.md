# 部署存储过程说明

## 概述
为了确保兑换功能的原子性和数据一致性，我们创建了一个PostgreSQL存储过程`redeem_gift_transaction`，它会在一个事务中完成以下操作：
1. 添加兑换记录到`redeemed_gifts`表
2. 更新用户积分到`profiles`表
3. 从`gifts`表中删除已兑换的礼物

## 部署步骤

### 1. 登录Supabase Dashboard
- 访问 [https://app.supabase.com](https://app.supabase.com)
- 登录您的账户并选择项目

### 2. 打开SQL编辑器
- 在左侧导航栏中点击"SQL Editor"
- 点击"New query"创建新查询

### 3. 执行存储过程
- 复制`database/redeem_gift_procedure.sql`文件中的内容
- 粘贴到SQL编辑器中
- 点击"Run"执行

### 4. 验证部署
- 在左侧导航栏中点击"Database"
- 在"Functions"标签下查找`redeem_gift_transaction`函数
- 确认函数已成功创建

## 存储过程参数

| 参数名 | 类型 | 描述 |
|--------|------|------|
| user_id_param | UUID | 用户ID |
| gift_id_param | INTEGER | 礼物ID |
| gift_name_param | TEXT | 礼物名称 |
| gift_points_param | INTEGER | 礼物所需积分 |
| gift_description_param | TEXT | 礼物描述 |
| redeem_date_param | TIMESTAMPTZ | 兑换时间 |
| current_points_param | INTEGER | 兑换后的用户积分 |

## 错误处理

存储过程会检查以下条件：
- 用户是否存在
- 用户积分是否足够
- 礼物是否存在且属于该用户

如果任何检查失败，存储过程会返回`FALSE`并抛出异常。

## 代码集成

所有三个版本的兑换功能现在都调用这个存储过程：

```javascript
const { data, error } = await supabase.rpc('redeem_gift_transaction', {
    user_id_param: user.user.id,
    gift_id_param: gift.id,
    gift_name_param: gift.name,
    gift_points_param: gift.points,
    gift_description_param: gift.description || '',
    redeem_date_param: now,
    current_points_param: currentPoints - gift.points
});
```

## 优势

使用存储过程的优势：
1. **原子性**：所有操作在一个事务中完成，要么全部成功，要么全部失败
2. **性能**：减少网络往返次数，提高性能
3. **安全性**：在服务器端执行，减少安全风险
4. **一致性**：确保数据始终保持一致状态