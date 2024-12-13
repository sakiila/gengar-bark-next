WITH
-- 基础数据处理: 处理时区、格式标准化、构建时长解析
-- local_time: UTC转北京时间(+8小时)
-- email_lower: 邮箱地址转小写，用于统一大小写
-- repository_lower: 仓库名转小写，用于统一大小写
-- branch_lower: 分支名转小写，用于统一大小写
-- duration_seconds: 将不同格式的构建时长统一转换为秒数
base_stats AS (SELECT *,
                      created_at + INTERVAL '8 hour' as local_time,
    LOWER(email)                   as email_lower,
    LOWER(repository)              as repository_lower,
    LOWER(branch)                  as branch_lower,
    CASE
    WHEN duration ~ '(\d+) min (\d+) sec'
    THEN CAST(SUBSTRING(duration FROM '(\d+) min') AS INTEGER) * 60 +
    CAST(SUBSTRING(duration FROM '(\d+) sec') AS INTEGER)
    WHEN duration ~ '(\d+) min$'
    THEN CAST(SUBSTRING(duration FROM '(\d+) min') AS INTEGER) * 60
    WHEN duration ~ '(\d+) sec'
    THEN CAST(SUBSTRING(duration FROM '(\d+) sec') AS INTEGER)
    ELSE 0
END                        as duration_seconds
               FROM build_record
               WHERE EXTRACT(YEAR FROM created_at + INTERVAL '8 hour') = 2024),

-- 构建热力图数据: 按用户、星期和小时统计构建次数
-- day: 星期(0=周日,1=周一,...,6=周六)
-- hour: 小时(0-23)
-- build_count: 该时间段的构建次数
heatmap_stats AS (SELECT email_lower                   as email,
                         EXTRACT(DOW FROM local_time)  as day,
                         EXTRACT(HOUR FROM local_time) as hour,
                         COUNT(*)                      as build_count
                  FROM base_stats
                  GROUP BY email_lower, EXTRACT(DOW FROM local_time), EXTRACT(HOUR FROM local_time)),

-- 用户主要统计指标
-- total_builds: 总构建次数
-- first_build_time: 首次构建时间
-- last_build_time: 最后构建时间
-- successful_builds: 成功构建次数
-- avg_build_duration: 平均构建时长(秒)
-- max_build_duration: 最长构建时长(秒)
-- min_build_duration: 最短构建时长(秒)
user_main_stats AS (SELECT email_lower                                        as email,
                           COUNT(*)                                           as total_builds,
                           MIN(local_time)                                    as first_build_time,
                           MAX(local_time)                                    as last_build_time,
                           COUNT(CASE WHEN text ILIKE '%SUCCESS%' THEN 1 END) as successful_builds,
                           ROUND(AVG(duration_seconds), 2)                    as avg_build_duration,
                           MAX(duration_seconds)                              as max_build_duration,
                           MIN(duration_seconds)                              as min_build_duration
                    FROM base_stats
                    GROUP BY email_lower),

-- 月度构建趋势分析
-- month: 按月分组的时间戳
-- builds_count: 月度构建总数
-- success_count: 月度成功构建数
-- avg_duration: 月度平均构建时长(秒)
monthly_trends AS (SELECT email_lower                                        as email,
                          DATE_TRUNC('month', local_time)                    as month,
                          COUNT(*)                                           as builds_count,
                          COUNT(CASE WHEN text ILIKE '%SUCCESS%' THEN 1 END) as success_count,
                          ROUND(AVG(duration_seconds), 2)                    as avg_duration
                   FROM base_stats
                   GROUP BY email_lower, DATE_TRUNC('month', local_time)),

-- 仓库级别统计
-- repo_builds: 仓库构建总数
-- repo_successes: 仓库成功构建数
-- branch_count: 仓库分支数
-- avg_repo_duration: 仓库平均构建时长
-- first_repo_build: 仓库首次构建时间
-- last_repo_build: 仓库最后构建时间
repository_stats AS (SELECT email_lower                                        as email,
                            repository_lower                                   as repository,
                            COUNT(*)                                           as repo_builds,
                            COUNT(CASE WHEN text ILIKE '%SUCCESS%' THEN 1 END) as repo_successes,
                            COUNT(DISTINCT branch_lower)                       as branch_count,
                            ROUND(AVG(duration_seconds), 2)                    as avg_repo_duration,
                            MIN(local_time)                                    as first_repo_build,
                            MAX(local_time)                                    as last_repo_build
                     FROM base_stats
                     GROUP BY email_lower, repository_lower),

-- 按小时分布的构建数量统计
-- hour_of_day: 小时(0-23)
-- day_of_week: 星期(0-6)
-- builds_in_timeframe: 时段构建数
time_distribution AS (SELECT email_lower                   as email,
                             EXTRACT(HOUR FROM local_time) as hour_of_day,
                             EXTRACT(DOW FROM local_time)  as day_of_week,
                             COUNT(*)                      as builds_in_timeframe
                      FROM base_stats
                      GROUP BY email_lower, EXTRACT(HOUR FROM local_time), EXTRACT(DOW FROM local_time)),

-- 每日高峰时段识别
-- peak_hour: 构建次数最多的小时
-- peak_hour_builds: 该小时的构建次数
peak_times AS (SELECT email,
                      hour_of_day         as peak_hour,
                      builds_in_timeframe as peak_hour_builds
               FROM (SELECT email,
                            hour_of_day,
                            builds_in_timeframe,
                            ROW_NUMBER() OVER (PARTITION BY email ORDER BY builds_in_timeframe DESC) as rn
                     FROM time_distribution) ranked
               WHERE rn = 1),

-- 每周高峰日识别
-- peak_day: 构建次数最多的星期
-- peak_day_builds: 该星期的构建次数
weekly_peaks AS (SELECT email,
                        day_of_week         as peak_day,
                        builds_in_timeframe as peak_day_builds
                 FROM (SELECT email,
                              day_of_week,
                              SUM(builds_in_timeframe)                                                      as builds_in_timeframe,
                              ROW_NUMBER() OVER (PARTITION BY email ORDER BY SUM(builds_in_timeframe) DESC) as rn
                       FROM time_distribution
                       GROUP BY email, day_of_week) ranked
                 WHERE rn = 1),

-- 工作日统计（每天只统计一次）
-- email: 用户邮箱
-- work_date: 工作日期
-- is_weekend: 是否为周末
consecutive_days_temp AS (SELECT DISTINCT email_lower                            as email,
                                          DATE(local_time)                       as work_date,
                                          EXTRACT(DOW FROM local_time) IN (0, 6) as is_weekend
                          FROM base_stats),

-- 连续工作日计算
-- grp: 用于识别连续日期组的标识
consecutive_days AS (SELECT email,
                            work_date,
                            work_date - (DENSE_RANK() OVER (PARTITION BY email ORDER BY work_date))::integer *
                                        INTERVAL '1 day' as grp
                     FROM consecutive_days_temp),

-- 工作模式统计（每天去重）
-- max_continuous_days: 最长连续工作天数
-- weekend_days: 周末工作天数
-- total_days: 总工作天数
-- total_months: 跨越月份数
work_pattern_stats AS (WITH daily_stats AS (SELECT email,
                                                   work_date,
                                                   is_weekend,
                                                   DATE_TRUNC('month', work_date) as work_month
                                            FROM consecutive_days_temp
                                            GROUP BY email, work_date, is_weekend, DATE_TRUNC('month', work_date))
                       SELECT d.email,
                              MAX(streak.streak_length)                               as max_continuous_days,
                              COUNT(DISTINCT CASE WHEN is_weekend THEN work_date END) as weekend_days,
                              COUNT(DISTINCT work_date)                               as total_days,
                              COUNT(DISTINCT work_month)                              as total_months
                       FROM daily_stats d
                                LEFT JOIN (SELECT email,
                                                  grp,
                                                  COUNT(DISTINCT work_date) as streak_length
                                           FROM consecutive_days
                                           GROUP BY email, grp) streak ON d.email = streak.email
                       GROUP BY d.email),

-- 用户排名计算
-- builds_rank: 按构建次数排名
-- success_rate_rank: 按成功率排名
user_ranks AS (SELECT email_lower                          as email,
                      RANK() OVER (ORDER BY COUNT(*) DESC) as builds_rank,
                      RANK() OVER (
                          ORDER BY COUNT(CASE WHEN text ILIKE '%SUCCESS%' THEN 1 END)::float / NULLIF(COUNT(*), 0) DESC
                          )                                as success_rate_rank
               FROM base_stats
               GROUP BY email_lower)

-- 最终数据输出
-- 包含所有用户的详细构建统计信息、活跃度分析、工作模式等
SELECT
    -- 基本信息
    u.email,                                                                                                        -- 用户邮箱
    u.total_builds,                                                                                                 -- 总构建次数
    TO_CHAR(u.first_build_time, 'YYYY-MM-DD HH24:MI:SS')                             as first_build_time,           -- 首次构建时间
    TO_CHAR(u.last_build_time, 'YYYY-MM-DD HH24:MI:SS')                              as last_build_time,            -- 最后构建时间

    -- 成功率
    ROUND(CAST(u.successful_builds AS DECIMAL) / NULLIF(u.total_builds, 0) * 100, 2) as success_rate,               -- 构建成功率(%)

    -- 构建时长统计
    u.avg_build_duration                                                             as avg_duration_seconds,       -- 平均构建时长(秒)
    u.max_build_duration                                                             as max_duration_seconds,       -- 最长构建时长(秒)
    u.min_build_duration                                                             as min_duration_seconds,       -- 最短构建时长(秒)

    -- 仓库和分支统计
    (SELECT COUNT(DISTINCT repository_lower)
     FROM base_stats b
     WHERE b.email_lower = u.email)                                                  as total_repositories,         -- 总仓库数

    (SELECT COUNT(DISTINCT branch_lower)
     FROM base_stats b
     WHERE b.email_lower = u.email)                                                  as total_branches,             -- 总分支数

    -- 最活跃仓库信息
    (SELECT repository || ' (' || repo_builds || ' builds, ' ||
            ROUND(CAST(repo_successes AS DECIMAL) / NULLIF(repo_builds, 0) * 100, 1) || '% success, ' ||
            '首次: ' || TO_CHAR(first_repo_build, 'YYYY-MM-DD HH24:MI:SS') || ', ' ||
            '最后: ' || TO_CHAR(last_repo_build, 'YYYY-MM-DD HH24:MI:SS') || ')'
     FROM repository_stats rs
     WHERE rs.email = u.email
     ORDER BY rs.repo_builds DESC
                                                                                        LIMIT 1)                                                                        as most_active_repository,     -- 最活跃仓库详情

    -- 月度构建趋势
    (SELECT STRING_AGG(
                    TO_CHAR(month, 'YYYY-MM') || ': ' || builds_count || ' builds (' ||
                    ROUND(CAST(success_count AS DECIMAL) / NULLIF(builds_count, 0) * 100, 1) || '% success)',
                    '; '
                    ORDER BY month
            )
     FROM monthly_trends mt
     WHERE mt.email = u.email)                                                       as monthly_breakdown,          -- 月度构建详情

    -- 最活跃时间段
    CASE
        WHEN pt.peak_hour >= 0 AND pt.peak_hour < 6 THEN '凌晨'
        WHEN pt.peak_hour >= 6 AND pt.peak_hour < 12 THEN '上午'
        WHEN pt.peak_hour >= 12 AND pt.peak_hour < 18 THEN '下午'
        ELSE '晚上'
END || ' ' || pt.peak_hour || '点 (' || pt.peak_hour_builds ||
    ' builds)'                                                                       as most_active_time,           -- 最活跃时间段

    -- 最活跃工作日
    CASE wp.peak_day
        WHEN 0 THEN '周日'
        WHEN 1 THEN '周一'
        WHEN 2 THEN '周二'
        WHEN 3 THEN '周三'
        WHEN 4 THEN '周四'
        WHEN 5 THEN '周五'
        WHEN 6 THEN '周六'
END || ' (' || wp.peak_day_builds ||
    ' builds)'                                                                       as most_active_day,            -- 最活跃工作日

    -- 工作模式统计
    wps.max_continuous_days                                                          as longest_working_streak,     -- 最长连续工作天数
    ROUND(CAST(wps.weekend_days AS DECIMAL) / NULLIF(wps.total_days, 0) * 100,
          1)                                                                         as weekend_working_percentage, -- 周末工作占比(%)
    wps.weekend_days || ' 个周末工作日 / ' || wps.total_days || ' 总工作日 (跨度 ' || wps.total_months ||
    ' 个月)'                                                                         as weekend_pattern,            -- 周末工作模式

    -- 日均构建次数
    ROUND(CAST(u.total_builds AS DECIMAL) /
          NULLIF(EXTRACT(DAYS FROM (u.last_build_time - u.first_build_time)), 0),
          2)                                                                         as avg_daily_builds,           -- 日均构建次数

    -- 排名信息
    ur.builds_rank,                                                                                                 -- 构建次数排名
    ur.success_rate_rank,                                                                                           -- 成功率排名

    -- 热力图数据
    (SELECT json_agg(json_build_object(
            'day', day, -- 星期几(0-6)
            'hour', hour, -- 小时(0-23)
            'value', build_count -- 构建次数
                     ))
     FROM heatmap_stats hs
     WHERE hs.email = u.email)                                                       as heatmap_data                -- 热力图数据(JSON格式)

FROM user_main_stats u
         LEFT JOIN peak_times pt ON u.email = pt.email
         LEFT JOIN weekly_peaks wp ON u.email = wp.email
         LEFT JOIN work_pattern_stats wps ON u.email = wps.email
         LEFT JOIN user_ranks ur ON u.email = ur.email
ORDER BY u.total_builds DESC;
