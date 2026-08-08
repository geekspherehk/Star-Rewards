// 多语言配置文件
const translations = {
    zh: {
        appTitle: 'Best Me',
        login: {
            title: '登录',
            email: '邮箱',
            password: '密码',
            loginButton: '登录',
            registerButton: '注册',
            emailPlaceholder: '请输入邮箱',
            passwordPlaceholder: '请输入密码',
            emailRequired: '请输入邮箱',
            passwordRequired: '请输入密码',
            loginSuccess: '登录成功',
            loginFailed: '登录失败',
            logout: '退出登录'
        },
        home: {
            currentPoints: '当前积分',
            totalPoints: '累计获得积分',
            addPoints: '添加积分',
            subtractPoints: '扣减积分',
            addBehavior: '添加行为',
            behaviors: '行为记录',
            gifts: '愿望清单',
            redeemed: '兑换记录',
            logout: '退出登录',
            welcome: '欢迎',
            needLogin: '需要登录才能使用',
            pointsDesc: '记录成长，积累积分',
            giftsDesc: '记录愿望，激励成长',
            diaryDesc: '回顾足迹，见证成长',
            streakDays: '连续打卡天数',
            pointsTrend: '📈 积分趋势',
            diary: '成长日记',
            profile: {
                switch: '切换孩子',
                add: '添加孩子',
                edit: '编辑孩子',
                manage: '管理孩子档案',
                name: '孩子姓名',
                namePlaceholder: '例如：小明',
                avatar: '头像',
                color: '主题色',
                delete: '删除该孩子',
                switched: '已切换到 {name}',
                saved: '孩子档案已保存',
                deleted: '孩子档案已删除',
                nameRequired: '请输入孩子姓名',
                onlyOne: '这是唯一的档案，无法删除',
                switchFailed: '切换失败',
                saveFailed: '保存失败',
                deleteFailed: '删除失败',
                deleteConfirm: '确定要删除这个孩子的档案吗？所有积分和记录将一并删除！'
            },
            achievements: {
                title: '🏆 成就徽章',
                unlocked: '已解锁',
                locked: '未解锁',
                progress: '{current}/{target}',
                first_star: { name: '初次发光', desc: '完成第 1 个行为' },
                ten_actions: { name: '小小行动家', desc: '完成 10 个行为' },
                fifty_actions: { name: '行为大师', desc: '完成 50 个行为' },
                hundred_points: { name: '百分达人', desc: '累计获得 100 积分' },
                five_hundred: { name: '积分富翁', desc: '累计获得 500 积分' },
                thousand_pts: { name: '千分王者', desc: '当前积分达到 1000' },
                streak3: { name: '三日坚持', desc: '连续打卡 3 天' },
                streak7: { name: '一周不间断', desc: '连续打卡 7 天' },
                streak30: { name: '月度之星', desc: '连续打卡 30 天' },
                first_redeem: { name: '初次兑现', desc: '兑换第 1 个愿望' },
                five_redeems: { name: '兑换达人', desc: '兑换 5 个愿望' },
                multi_child: { name: '温馨家庭', desc: '创建第 2 个孩子档案' },
                variety: { name: '全面发展', desc: '在 5 个不同日期记录行为' }
            }
        },
        behaviors: {
            title: '行为记录',
            description: '描述',
            points: '积分',
            date: '日期',
            addBehavior: '添加行为',
            delete: '删除',
            confirmDelete: '确定要删除这条记录吗？',
            quickSelect: '快速选择:',
            preset: {
                sleep: '按时睡觉 +1',
                homework: '作业全对 +2',
                exercise: '早起锻炼 +5',
                test: '小测满分 +20'
            },
            viewTemplates: '✨ 查看更多模板',
            rewardsForHer: '🌸 女性专属奖励',
            addBehaviorButton: '➕ 记录积分'
        },
        gifts: {
            title: '愿望清单',
            name: '礼物名称',
            points: '所需积分',
            description: '描述',
            link: '链接',
            image: '图片',
            addGift: '添加礼物',
            addGiftButton: '添加愿望',
            redeem: '兑换',
            confirmRedeem: '确定要兑换吗？',
            redeemSuccess: '兑换成功',
            redeemFailed: '兑换失败',
            insufficientPoints: '积分不足',
            giftNotFound: '礼物不存在',
            pointsRequired: '需要 {points} 分'
        },
        redeemed: {
            title: '兑换记录',
            name: '礼物名称',
            points: '消耗积分',
            date: '兑换日期',
            noRecords: '暂无兑换记录'
        },
        common: {
            save: '保存',
            cancel: '取消',
            confirm: '确定',
            delete: '删除',
            edit: '编辑',
            add: '添加',
            update: '更新',
            success: '操作成功',
            error: '操作失败',
            loading: '加载中...',
            noData: '暂无数据',
            logoutSuccess: '👋 已退出登录',
            logoutFailed: '❌ 登出失败',
            loginFailed: '❌ 登录失败',
            addPointsSuccess: '积分添加成功',
            addPointsFailed: '❌ 添加积分失败',
            addGiftSuccess: '🎁 礼物 "{name}" 添加成功！',
            addGiftFailed: '添加礼物失败',
            giftNotFound: '❌ 礼物不存在！',
            insufficientPoints: '❌ 积分不足！',
            redeemSuccess: '🎉 兑换成功！',
            redeemFailed: '兑换礼物失败',
            dbConnectionFailed: '❌ 数据库连接失败',
            initFailed: '❌ 应用初始化失败，请刷新页面重试',
            back: '返回',
            noAccount: '还没有账户？',
            hasAccount: '已有账户？',
            registerNow: '立即注册',
            loginNow: '立即登录',
            resendConfirmation: '未收到确认邮件？重新发送',
            noBehaviorRecords: '📋 暂无记录，开始记录您的行为吧！',
            totalRecords: '总记录',
            pointsEarned: '获得积分',
            pointsDeducted: '扣除积分',
            noRedeemedRecords: '🎁 还没有兑换记录，快去兑换喜欢的奖励吧！',
            totalRedeemed: '共兑换',
            items: '件礼物',
            totalPointsSpent: '总计消耗',
            points: '积分',
            redeemButton: '🎁 兑换',
            giftImage: '礼物图片',
            gift: '礼物',
            noDiaryRecords: '还没有成长记录，快来记录第一次积分吧！',
            pointsLabel: '分',
            enterBehaviorDesc: '请输入行为描述！',
            enterValidPoints: '请输入有效的积分变化值！',
            pointsCannotBeZero: '积分变化不能为0！',
            enterGiftName: '请输入礼物名称！',
            enterValidPointsPositive: '请输入有效的积分值（大于0）！',
            confirmRedeemMessage: '确定要兑换 "{name}" 吗？这将消耗 {points} 分。',
            unknownTime: '未知时间',
            justNow: '刚刚',
            minutesAgo: '{minutes} 分钟前',
            hoursAgo: '{hours} 小时前',
            daysAgo: '{days} 天前',
            notLoggedIn: '用户未登录',
            deleted: '已删除',
            deleteFailed: '删除失败',
            pointsAdded: '✅ 成功添加 {points} 分！',
            pointsDeductedMessage: '⚠️ 扣除 {points} 分',
            enterEmailAndPassword: '⚠️ 请输入邮箱和密码',
            passwordMinLength: '⚠️ 密码至少需要6位字符',
            registerSuccess: '✅ 注册成功！请登录',
            registerFailed: '❌ 注册失败',
            loginSuccessMessage: '✅ 登录成功！正在跳转...',
            alreadyLoggedIn: '✅ 检测到已登录状态，正在跳转...',
            enterEmailFirst: '⚠️ 请先输入您的邮箱地址'
        },
        theme: {
            title: '选择你的主题',
            subtitle: '选择一个适合你的激励方式，开启成长之旅',
            original: {
                name: '经典版',
                desc: '简洁实用的积分奖励系统'
            },
            juanwa: {
                name: '卷娃小能手',
                desc: '专为儿童成长设计的激励系统'
            },
            juanziji: {
                name: '卷自己',
                desc: '成年人自律打卡，成就更好的自己'
            }
        },
        juanwa: {
            title: '🌟 卷娃小能手',
            subtitle: '让宝贝快乐成长，每天都有小进步！',
            welcomeBack: '欢迎回来',
            needLogin: '需要登录才能陪宝贝一起成长哦~',
            logout: '退出',
            login: '登录',
            tabPoints: '成长积分',
            tabGifts: '宝贝愿望',
            tabHistory: '成长日记',
            currentPoints: '小星星积分',
            totalPoints: '累计获得',
            recordGrowth: '🌟 记录宝贝的成长瞬间',
            behaviorPlaceholder: '宝贝今天做了什么棒的事情呢？',
            pointsPlaceholder: '奖励小星星（1-10颗）',
            quickRecord: '快速记录:',
            preset: {
                organizeToys: '整理玩具 ⭐3',
                brushTeeth: '洗漱自理 ⭐2',
                doHomework: '认真学习 ⭐5',
                helpParents: '助人为乐 ⭐4',
                earlySleep: '作息规律 ⭐2',
                reading: '爱阅读 ⭐4'
            },
            addStar: '✨ 给小星星',
            addWish: '🎁 添加宝贝的小愿望',
            wishNamePlaceholder: '宝贝想要的奖励是什么？',
            wishPointsPlaceholder: '需要多少小星星？',
            wishDescPlaceholder: '这个奖励有什么特别之处？',
            wishImagePlaceholder: '奖励图片地址（可选）',
            addToWishlist: '🌟 添加到愿望清单',
            wishlistTitle: '🎉 宝贝的愿望清单',
            growthFootprint: '📚 成长足迹',
            wishAchieved: '🏆 愿望达成'
        },
        juanziji: {
            title: '💪 卷自己',
            subtitle: '自律给我自由，坚持就是胜利！',
            welcomeBack: '欢迎回来',
            startJourney: '开始你的自律之旅吧！',
            logout: '退出',
            login: '登录',
            tabEnergy: '能量值',
            tabGoals: '目标奖励',
            tabTrack: '成长轨迹',
            currentEnergy: '当前能量值',
            totalAchievement: '累计成就',
            completeTask: '⚡ 完成自律任务获得能量',
            taskPlaceholder: '今天完成了什么自律任务？',
            energyPlaceholder: '获得能量值（正加负扣）',
            quickCheckIn: '快速打卡:',
            preset: {
                earlyRise: '早起 ⚡10',
                exercise: '运动 ⚡15',
                study: '学习 ⚡12',
                meditation: '冥想 ⚡8',
                healthyDiet: '健康饮食 ⚡10',
                earlySleep: '早睡 ⚡8',
                focus: '专注 ⚡12',
                taskComplete: '任务完成 ⚡20'
            },
            checkIn: '⚡ 打卡获得能量',
            setGoal: '🎯 设置自律目标奖励',
            goalNamePlaceholder: '达成目标后想奖励自己什么？',
            goalPointsPlaceholder: '需要多少能量值？',
            goalDescPlaceholder: '这个奖励有什么特别意义？',
            goalLinkPlaceholder: '奖励链接（可选）',
            goalImagePlaceholder: '奖励图片链接（可选）',
            addGoal: '🎯 添加目标奖励',
            goalListTitle: '🏆 我的目标奖励清单',
            checkInRecord: '📈 自律打卡记录',
            goalAchieved: '🎉 目标达成记录'
        },
        templates: {
            title: '🌟 行为奖励模板库',
            subtitle: '为成长之路提供正向激励，培养良好习惯',
            dailyHabits: '🏠 日常生活好习惯',
            learning: '📚 学习成长类',
            social: '🤝 社交礼仪类',
            health: '💪 健康运动类',
            household: '🏡 家务劳动类',
            creativity: '🎨 创意艺术类',
            back: '返回应用',
            points: '积分'
        },
        rewardsForHer: {
            title: '🌸 精致女性专属奖励库',
            subtitle: '为现代女性量身定制的奖励建议',
            beauty: '💄 美妆护肤',
            fashion: '👗 时尚穿搭',
            lifestyle: '🏠 生活品质',
            wellness: '🧘‍♀️ 身心健康',
            learning: '📚 自我提升',
            entertainment: '🎭 娱乐休闲',
            food: '🍰 美食享受',
            travel: '✈️ 旅行探索',
            back: '返回应用'
        }
    },
    en: {
        appTitle: 'Best Me',
        login: {
            title: 'Login',
            email: 'Email',
            password: 'Password',
            loginButton: 'Login',
            registerButton: 'Register',
            emailPlaceholder: 'Enter email',
            passwordPlaceholder: 'Enter password',
            emailRequired: 'Please enter email',
            passwordRequired: 'Please enter password',
            loginSuccess: 'Login successful',
            loginFailed: 'Login failed',
            logout: 'Logout'
        },
        home: {
            currentPoints: 'Current Points',
            totalPoints: 'Total Points Earned',
            addPoints: 'Add Points',
            subtractPoints: 'Subtract Points',
            addBehavior: 'Add Behavior',
            behaviors: 'Behaviors',
            gifts: 'Wishlist',
            redeemed: 'Redeemed',
            logout: 'Logout',
            welcome: 'Welcome',
            needLogin: 'Login required to use',
            pointsDesc: 'Record growth, earn points',
            giftsDesc: 'Record wishes, stay motivated',
            diaryDesc: 'Review journey, witness growth',
            diary: 'Growth Diary',
            streakDays: 'Day Streak',
            pointsTrend: '📈 Points Trend',
            profile: {
                switch: 'Switch Child',
                add: 'Add Child',
                edit: 'Edit Child',
                manage: 'Manage Children',
                name: 'Child Name',
                namePlaceholder: 'e.g. Xiaoming',
                avatar: 'Avatar',
                color: 'Theme Color',
                delete: 'Delete this child',
                switched: 'Switched to {name}',
                saved: 'Child profile saved',
                deleted: 'Child profile deleted',
                nameRequired: 'Please enter the child name',
                onlyOne: 'This is the only profile and cannot be deleted',
                switchFailed: 'Switch failed',
                saveFailed: 'Save failed',
                deleteFailed: 'Delete failed',
                deleteConfirm: 'Delete this child profile? All points and records will be removed!'
            },
            achievements: {
                title: '🏆 Achievements',
                unlocked: 'Unlocked',
                locked: 'Locked',
                progress: '{current}/{target}',
                first_star: { name: 'First Light', desc: 'Complete your first behavior' },
                ten_actions: { name: 'Little Doer', desc: 'Complete 10 behaviors' },
                fifty_actions: { name: 'Behavior Master', desc: 'Complete 50 behaviors' },
                hundred_points: { name: 'Centurion', desc: 'Earn 100 points total' },
                five_hundred: { name: 'Point Tycoon', desc: 'Earn 500 points total' },
                thousand_pts: { name: 'Thousand King', desc: 'Reach 1000 current points' },
                streak3: { name: '3-Day Streak', desc: 'Check in 3 days in a row' },
                streak7: { name: 'Week Warrior', desc: 'Check in 7 days in a row' },
                streak30: { name: 'Monthly Star', desc: 'Check in 30 days in a row' },
                first_redeem: { name: 'First Reward', desc: 'Redeem your first wish' },
                five_redeems: { name: 'Redeem Pro', desc: 'Redeem 5 wishes' },
                multi_child: { name: 'Happy Family', desc: 'Create a 2nd child profile' },
                variety: { name: 'All-Rounder', desc: 'Log behaviors on 5 different days' }
            }
        },
        behaviors: {
            title: 'Behaviors',
            description: 'Description',
            points: 'Points',
            date: 'Date',
            addBehavior: 'Add Behavior',
            delete: 'Delete',
            confirmDelete: 'Are you sure you want to delete this record?',
            quickSelect: 'Quick Select:',
            preset: {
                sleep: 'On time sleep +1',
                homework: 'Homework all correct +2',
                exercise: 'Early exercise +5',
                test: 'Test full score +20'
            },
            viewTemplates: '✨ View More Templates',
            rewardsForHer: '🌸 Rewards for Her',
            addBehaviorButton: '➕ Add Points'
        },
        gifts: {
            title: 'Wishlist',
            name: 'Gift Name',
            points: 'Points Required',
            description: 'Description',
            link: 'Link',
            image: 'Image',
            addGift: 'Add Gift',
            addGiftButton: 'Add Wish',
            redeem: 'Redeem',
            confirmRedeem: 'Are you sure you want to redeem this?',
            redeemSuccess: 'Redeem successful',
            redeemFailed: 'Redeem failed',
            insufficientPoints: 'Insufficient points',
            giftNotFound: 'Gift not found',
            pointsRequired: 'Requires {points} points'
        },
        redeemed: {
            title: 'Redeemed Items',
            name: 'Gift Name',
            points: 'Points Spent',
            date: 'Redeem Date',
            noRecords: 'No redeemed items yet'
        },
        common: {
            save: 'Save',
            cancel: 'Cancel',
            confirm: 'Confirm',
            delete: 'Delete',
            edit: 'Edit',
            add: 'Add',
            update: 'Update',
            success: 'Operation successful',
            error: 'Operation failed',
            loading: 'Loading...',
            noData: 'No data available',
            logoutSuccess: '👋 Logged out',
            logoutFailed: '❌ Logout failed',
            loginFailed: '❌ Login failed',
            addPointsSuccess: 'Points added successfully',
            addPointsFailed: '❌ Failed to add points',
            addGiftSuccess: '🎁 Gift "{name}" added successfully!',
            addGiftFailed: 'Failed to add gift',
            giftNotFound: '❌ Gift not found!',
            insufficientPoints: '❌ Insufficient points!',
            redeemSuccess: '🎉 Redeem successful!',
            redeemFailed: 'Redeem failed',
            dbConnectionFailed: '❌ Database connection failed',
            initFailed: '❌ Application initialization failed, please refresh and try again',
            back: 'Back',
            noAccount: "Don't have an account?",
            hasAccount: 'Already have an account?',
            registerNow: 'Register now',
            loginNow: 'Login now',
            resendConfirmation: "Didn't receive confirmation email? Resend",
            noBehaviorRecords: '📋 No records yet, start recording your behaviors!',
            totalRecords: 'Total Records',
            pointsEarned: 'Points Earned',
            pointsDeducted: 'Points Deducted',
            noRedeemedRecords: '🎁 No redeemed items yet, go redeem your favorite rewards!',
            totalRedeemed: 'Total Redeemed',
            items: 'items',
            totalPointsSpent: 'Total Points Spent',
            points: 'points',
            redeemButton: '🎁 Redeem',
            giftImage: 'Gift Image',
            gift: 'Gift',
            noDiaryRecords: 'No growth records yet, come record your first points!',
            pointsLabel: 'pts',
            enterBehaviorDesc: 'Please enter behavior description!',
            enterValidPoints: 'Please enter a valid points value!',
            pointsCannotBeZero: 'Points change cannot be zero!',
            enterGiftName: 'Please enter gift name!',
            enterValidPointsPositive: 'Please enter a valid points value (greater than 0)!',
            confirmRedeemMessage: 'Are you sure you want to redeem "{name}"? This will cost {points} points.',
            unknownTime: 'Unknown time',
            justNow: 'Just now',
            minutesAgo: '{minutes} minutes ago',
            hoursAgo: '{hours} hours ago',
            daysAgo: '{days} days ago',
            notLoggedIn: 'Not logged in',
            deleted: 'Deleted',
            deleteFailed: 'Delete failed',
            pointsAdded: '✅ Successfully added {points} points!',
            pointsDeductedMessage: '⚠️ Deducted {points} points',
            enterEmailAndPassword: '⚠️ Please enter email and password',
            passwordMinLength: '⚠️ Password must be at least 6 characters',
            registerSuccess: '✅ Registration successful! Please log in',
            registerFailed: '❌ Registration failed',
            loginSuccessMessage: '✅ Login successful! Redirecting...',
            alreadyLoggedIn: '✅ Already logged in, redirecting...',
            enterEmailFirst: '⚠️ Please enter your email first'
        },
        theme: {
            title: 'Choose Your Theme',
            subtitle: 'Select a motivation style that suits you and start your growth journey',
            original: {
                name: 'Classic',
                desc: 'Simple and practical points reward system'
            },
            juanwa: {
                name: 'Star Kid',
                desc: 'Incentive system designed for child growth'
            },
            juanziji: {
                name: 'Self-Discipline',
                desc: 'Adult self-discipline tracker, become a better you'
            }
        },
        juanwa: {
            title: '🌟 Star Kid',
            subtitle: 'Let your child grow happily, with small progress every day!',
            welcomeBack: 'Welcome back',
            needLogin: 'Login required to accompany your child on their growth journey~',
            logout: 'Logout',
            login: 'Login',
            tabPoints: 'Growth Points',
            tabGifts: 'Wishlist',
            tabHistory: 'Growth Diary',
            currentPoints: 'Star Points',
            totalPoints: 'Total Earned',
            recordGrowth: '🌟 Record your child\'s growth moments',
            behaviorPlaceholder: 'What great thing did your child do today?',
            pointsPlaceholder: 'Reward stars (1-10)',
            quickRecord: 'Quick Record:',
            preset: {
                organizeToys: 'Organize Toys ⭐3',
                brushTeeth: 'Self-care ⭐2',
                doHomework: 'Study Hard ⭐5',
                helpParents: 'Help Others ⭐4',
                earlySleep: 'Regular Schedule ⭐2',
                reading: 'Love Reading ⭐4'
            },
            addStar: '✨ Give Stars',
            addWish: '🎁 Add a wish for your child',
            wishNamePlaceholder: 'What reward does your child want?',
            wishPointsPlaceholder: 'How many stars needed?',
            wishDescPlaceholder: 'What\'s special about this reward?',
            wishImagePlaceholder: 'Reward image URL (optional)',
            addToWishlist: '🌟 Add to Wishlist',
            wishlistTitle: '🎉 Child\'s Wishlist',
            growthFootprint: '📚 Growth Footprint',
            wishAchieved: '🏆 Wishes Achieved'
        },
        juanziji: {
            title: '💪 Self-Discipline',
            subtitle: 'Discipline brings freedom, persistence leads to victory!',
            welcomeBack: 'Welcome back',
            startJourney: 'Start your self-discipline journey!',
            logout: 'Logout',
            login: 'Login',
            tabEnergy: 'Energy',
            tabGoals: 'Goal Rewards',
            tabTrack: 'Growth Track',
            currentEnergy: 'Current Energy',
            totalAchievement: 'Total Achievement',
            completeTask: '⚡ Complete self-discipline tasks to gain energy',
            taskPlaceholder: 'What self-discipline task did you complete today?',
            energyPlaceholder: 'Energy gained (positive add, negative deduct)',
            quickCheckIn: 'Quick Check-in:',
            preset: {
                earlyRise: 'Early Rise ⚡10',
                exercise: 'Exercise ⚡15',
                study: 'Study ⚡12',
                meditation: 'Meditation ⚡8',
                healthyDiet: 'Healthy Diet ⚡10',
                earlySleep: 'Early Sleep ⚡8',
                focus: 'Focus ⚡12',
                taskComplete: 'Task Complete ⚡20'
            },
            checkIn: '⚡ Check-in for Energy',
            setGoal: '🎯 Set Self-Discipline Goal Reward',
            goalNamePlaceholder: 'What do you want to reward yourself with?',
            goalPointsPlaceholder: 'How much energy needed?',
            goalDescPlaceholder: 'What\'s special about this reward?',
            goalLinkPlaceholder: 'Reward link (optional)',
            goalImagePlaceholder: 'Reward image link (optional)',
            addGoal: '🎯 Add Goal Reward',
            goalListTitle: '🏆 My Goal Rewards List',
            checkInRecord: '📈 Check-in Records',
            goalAchieved: '🎉 Goals Achieved'
        },
        templates: {
            title: '🌟 Behavior Reward Templates',
            subtitle: 'Positive incentives for growth, cultivating good habits',
            dailyHabits: '🏠 Daily Life Habits',
            learning: '📚 Learning & Growth',
            social: '🤝 Social Etiquette',
            health: '💪 Health & Exercise',
            household: '🏡 Household Chores',
            creativity: '🎨 Creative Arts',
            back: 'Back to App',
            points: 'Points'
        },
        rewardsForHer: {
            title: '🌸 Rewards for Her',
            subtitle: 'Tailored reward suggestions for modern women',
            beauty: '💄 Beauty & Skincare',
            fashion: '👗 Fashion & Style',
            lifestyle: '🏠 Lifestyle Quality',
            wellness: '🧘‍♀️ Wellness & Health',
            learning: '📚 Self-Improvement',
            entertainment: '🎭 Entertainment',
            food: '🍰 Food & Dining',
            travel: '✈️ Travel & Exploration',
            back: 'Back to App'
        }
    }
};

let currentLanguage = 'zh';

function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updateLanguageUI();
}

function getLanguage() {
    return localStorage.getItem('language') || 'zh';
}

function t(key, params) {
    const keys = key.split('.');
    let value = translations[currentLanguage];
    
    for (const k of keys) {
        if (value && value[k]) {
            value = value[k];
        } else {
            return key;
        }
    }
    
    if (typeof value === 'string') {
        let result = value;
        if (params && typeof params === 'object') {
            Object.keys(params).forEach(p => {
                result = result.replace(new RegExp('\\{' + p + '\\}', 'g'), params[p]);
            });
        }
        return result;
    }
    
    return key;
}

function updateLanguageUI() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translated = t(key);
        // 防御：翻译缺失时保留 HTML 中的默认文本，避免显示 key 名
        if (translated !== key) {
            element.textContent = translated;
        }
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const translated = t(key);
        if (translated !== key) {
            element.placeholder = translated;
        }
    });
}

function initLanguage() {
    currentLanguage = getLanguage();
    updateLanguageUI();
    
    const languageSelector = document.getElementById('language-selector');
    if (languageSelector) {
        languageSelector.value = currentLanguage;
    }
}