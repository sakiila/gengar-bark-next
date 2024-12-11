-- 基础数据统计：转换时区、标准化大小写、计算构建时长
WITH base_stats AS (
    SELECT
        *,
        -- 将 UTC 时间转换为北京时间 (+8)
        created_at + INTERVAL '8 hour' as local_time,
     -- 统一邮箱和仓库名为小写，便于分组统计
    LOWER(email) as email_lower,
    LOWER(repository) as repository_lower,
    LOWER(branch) as branch_lower,
     -- 将不同格式的构建时长统一转换为分钟数
    CASE
    WHEN duration ~ '(\d+) min (\d+) sec'
    THEN
    CAST(SUBSTRING(duration FROM '(\d+) min') AS INTEGER) +
    ROUND(CAST(SUBSTRING(duration FROM '(\d+) sec') AS INTEGER) / 60.0, 2)
    WHEN duration ~ '(\d+) min$'
    THEN CAST(SUBSTRING(duration FROM '(\d+) min') AS INTEGER)
    WHEN duration ~ '(\d+) sec'
    THEN ROUND(CAST(SUBSTRING(duration FROM '(\d+) sec') AS INTEGER) / 60.0, 2)
    ELSE 0
END as duration_minutes
    FROM build_record
    WHERE EXTRACT(YEAR FROM created_at + INTERVAL '8 hour') = 2024
),

-- 用户主要统计数据：构建次数、时间范围、成功率等
     user_main_stats AS (
         SELECT
             email_lower as email,
             COUNT(*) as total_builds,                    -- 总构建次数
             MIN(local_time) as first_build_time,         -- 首次构建时间（北京时间）
             MAX(local_time) as last_build_time,          -- 最后构建时间（北京时间）
             COUNT(CASE WHEN text LIKE '%SUCCESS%'
                            THEN 1 END) as successful_builds,        -- 成功构建次数
             ROUND(AVG(duration_minutes), 2) as avg_build_duration,   -- 平均构建时长（分钟）
             MAX(duration_minutes) as max_build_duration,             -- 最长构建时长（分钟）
             MIN(duration_minutes) as min_build_duration              -- 最短构建时长（分钟）
         FROM base_stats
         GROUP BY email_lower
     ),

-- 按月统计构建趋势
     monthly_trends AS (
         SELECT
             email_lower as email,
             DATE_TRUNC('month', local_time) as month,    -- 按月分组
             COUNT(*) as builds_count,                    -- 每月构建总数
             COUNT(CASE WHEN text LIKE '%SUCCESS%'
                            THEN 1 END) as success_count,            -- 每月成功构建数
             ROUND(AVG(duration_minutes), 2) as avg_duration  -- 每月平均构建时长
         FROM base_stats
         GROUP BY email_lower, DATE_TRUNC('month', local_time)
     ),

-- 仓库级别统计
     repository_stats AS (
         SELECT
             email_lower as email,
             repository_lower as repository,
             COUNT(*) as repo_builds,                     -- 仓库构建总数
             COUNT(CASE WHEN text LIKE '%SUCCESS%'
                            THEN 1 END) as repo_successes,           -- 仓库成功构建数
             COUNT(DISTINCT branch_lower) as branch_count, -- 仓库分支数
             ROUND(AVG(duration_minutes), 2) as avg_repo_duration, -- 仓库平均构建时长
             MIN(local_time) as first_repo_build,         -- 仓库首次构建时间
             MAX(local_time) as last_repo_build           -- 仓库最后构建时间
         FROM base_stats
         GROUP BY email_lower, repository_lower
     ),

-- 时间分布统计
     time_distribution AS (
         SELECT
             email_lower as email,
             EXTRACT(HOUR FROM local_time) as hour_of_day,    -- 小时（0-23）
             EXTRACT(DOW FROM local_time) as day_of_week,     -- 星期（0-6，0表示周日）
             COUNT(*) as builds_in_timeframe                  -- 该时间段的构建数
         FROM base_stats
         GROUP BY email_lower,
                  EXTRACT(HOUR FROM local_time),
                  EXTRACT(DOW FROM local_time)
     ),

-- 每日高峰时段统计
     peak_times AS (
         SELECT
             email,
             hour_of_day as peak_hour,
             builds_in_timeframe as peak_hour_builds
         FROM (
                  SELECT
                      email,
                      hour_of_day,
                      builds_in_timeframe,
                      ROW_NUMBER() OVER (PARTITION BY email ORDER BY builds_in_timeframe DESC) as rn
                  FROM time_distribution
              ) ranked
         WHERE rn = 1
     ),

-- 工作日分布统计
     weekly_peaks AS (
         SELECT
             email,
             day_of_week as peak_day,
             builds_in_timeframe as peak_day_builds
         FROM (
                  SELECT
                      email,
                      day_of_week,
                      SUM(builds_in_timeframe) as builds_in_timeframe,
                      ROW_NUMBER() OVER (PARTITION BY email ORDER BY SUM(builds_in_timeframe) DESC) as rn
                  FROM time_distribution
                  GROUP BY email, day_of_week
              ) ranked
         WHERE rn = 1
     ),

-- 工作模式分析：连续工作天数、周末工作等
     consecutive_days_temp AS (
         SELECT DISTINCT
             email_lower as email,
             DATE_TRUNC('day', local_time) as work_date,
             EXTRACT(DOW FROM local_time) IN (0, 6) as is_weekend
         FROM base_stats
     ),

-- 计算连续工作日
     consecutive_days AS (
         SELECT
             email,
             work_date,
             work_date - (DENSE_RANK() OVER (PARTITION BY email ORDER BY work_date))::integer * INTERVAL '1 day' as grp
         FROM consecutive_days_temp
     ),

-- 工作模式统计
     work_pattern_stats AS (
         SELECT
             cd.email,
             MAX(streak.streak_length) as max_continuous_days,    -- 最长连续工作天数
             SUM(CASE WHEN is_weekend THEN 1 END) as weekend_days, -- 周末工作天数
             COUNT(*) as total_days                               -- 总工作天数
         FROM consecutive_days_temp cd
                  LEFT JOIN (
             SELECT
                 email,
                 grp,
                 COUNT(*) as streak_length
             FROM consecutive_days
             GROUP BY email, grp
         ) streak ON cd.email = streak.email
         GROUP BY cd.email
     ),

-- 计算用户总排名信息
     user_ranks AS (
         SELECT
             email_lower as email,
             RANK() OVER (ORDER BY COUNT(*) DESC) as builds_rank,
             RANK() OVER (
                 ORDER BY
                     COUNT(CASE WHEN text LIKE '%SUCCESS%' THEN 1 END)::float /
                     NULLIF(COUNT(*), 0) DESC
                 ) as success_rate_rank
         FROM base_stats
         GROUP BY email_lower
     )

-- 最终统计结果
SELECT
    u.email,                -- 用户邮箱（小写）
    u.total_builds,         -- 总构建次数
    TO_CHAR(u.first_build_time, 'YYYY-MM-DD HH24:MI:SS') as first_build_time,  -- 首次构建时间
    TO_CHAR(u.last_build_time, 'YYYY-MM-DD HH24:MI:SS') as last_build_time,    -- 最后构建时间

    -- 成功率统计
    ROUND(CAST(u.successful_builds AS DECIMAL) / NULLIF(u.total_builds, 0) * 100, 2) as success_rate,

    -- 构建时长统计（单位：分钟）
    u.avg_build_duration as avg_duration_minutes,
    u.max_build_duration as max_duration_minutes,
    u.min_build_duration as min_duration_minutes,

    -- 仓库和分支数量统计
    (
        SELECT COUNT(DISTINCT repository_lower)
        FROM base_stats b
        WHERE b.email_lower = u.email
    ) as total_repositories,

    (
        SELECT COUNT(DISTINCT branch_lower)
        FROM base_stats b
        WHERE b.email_lower = u.email
    ) as total_branches,

    -- 最活跃仓库信息
    (
        SELECT repository || ' (' || repo_builds || ' builds, ' ||
               ROUND(CAST(repo_successes AS DECIMAL) / NULLIF(repo_builds, 0) * 100, 1) || '% success, ' ||
               '首次: ' || TO_CHAR(first_repo_build, 'YYYY-MM-DD HH24:MI:SS') || ', ' ||
               '最后: ' || TO_CHAR(last_repo_build, 'YYYY-MM-DD HH24:MI:SS') || ')'
        FROM repository_stats rs
        WHERE rs.email = u.email
        ORDER BY rs.repo_builds DESC
        LIMIT 1
    ) as most_active_repository,

    -- 月度构建趋势
    (
        SELECT STRING_AGG(
                       TO_CHAR(month, 'YYYY-MM') || ': ' || builds_count || ' builds (' ||
                       ROUND(CAST(success_count AS DECIMAL) / NULLIF(builds_count, 0) * 100, 1) || '% success)',
                       '; '
                       ORDER BY month
               )
        FROM monthly_trends mt
        WHERE mt.email = u.email
    ) as monthly_breakdown,

    -- 最活跃时间段
    CASE
        WHEN pt.peak_hour >= 0 AND pt.peak_hour < 6 THEN '凌晨'
        WHEN pt.peak_hour >= 6 AND pt.peak_hour < 12 THEN '上午'
        WHEN pt.peak_hour >= 12 AND pt.peak_hour < 18 THEN '下午'
        ELSE '晚上'
END || ' ' || pt.peak_hour || '点 (' || pt.peak_hour_builds || ' builds)' as most_active_time,

    -- 最活跃工作日
    CASE wp.peak_day
        WHEN 0 THEN '周日'
        WHEN 1 THEN '周一'
        WHEN 2 THEN '周二'
        WHEN 3 THEN '周三'
        WHEN 4 THEN '周四'
        WHEN 5 THEN '周五'
        WHEN 6 THEN '周六'
END || ' (' || wp.peak_day_builds || ' builds)' as most_active_day,

    -- 工作模式指标
    wps.max_continuous_days as longest_working_streak,   -- 最长连续工作天数
    ROUND(CAST(wps.weekend_days AS DECIMAL) / NULLIF(wps.total_days, 0) * 100, 1)
        as weekend_working_percentage,                   -- 周末工作天数占比
    wps.weekend_days || ' 个周末工作日 / ' || wps.total_days || ' 总工作日'
        as weekend_pattern,                              -- 周末工作详情

    -- 日均构建次数
    ROUND(CAST(u.total_builds AS DECIMAL) /
          NULLIF(EXTRACT(DAYS FROM (u.last_build_time - u.first_build_time)), 0), 2)
        as avg_daily_builds,

    -- 排名信息
    ur.builds_rank,                                     -- 总构建次数排名
    ur.success_rate_rank                                -- 成功率排名

FROM user_main_stats u
         LEFT JOIN peak_times pt ON u.email = pt.email
         LEFT JOIN weekly_peaks wp ON u.email = wp.email
         LEFT JOIN work_pattern_stats wps ON u.email = wps.email
         LEFT JOIN user_ranks ur ON u.email = ur.email
ORDER BY u.total_builds DESC;
