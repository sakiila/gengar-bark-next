-- 1. Entry Reminders (For users who entered today)
CREATE OR REPLACE FUNCTION get_entry_reminders()
    returns SETOF "user"
    language sql
as
$$
SELECT *
FROM "user"
WHERE deleted = false
  AND is_bot = false
  AND team_id = 'T011CF3CMJN'
  AND entry_date = CURRENT_DATE
  AND (
    (tz IS NULL AND EXTRACT(HOUR FROM now() AT TIME ZONE 'Asia/Chongqing') BETWEEN 11 and 12)
        OR
    (tz IS NOT NULL AND EXTRACT(HOUR FROM now() AT TIME ZONE tz) BETWEEN 11 and 12)
    );
$$;

-- 2. Confirm Reminders (For users who confirm today)
CREATE OR REPLACE FUNCTION get_confirm_reminders()
    returns SETOF "user"
    language sql
as
$$
SELECT *
FROM "user"
WHERE deleted = false
  AND is_bot = false
  AND team_id = 'T011CF3CMJN'
  AND confirm_date = CURRENT_DATE
  AND (
    (tz IS NULL AND EXTRACT(HOUR FROM now() AT TIME ZONE 'Asia/Chongqing') BETWEEN 8 and 9)
        OR
    (tz IS NOT NULL AND EXTRACT(HOUR FROM now() AT TIME ZONE tz) BETWEEN 8 and 9)
    );
$$;

-- 3. Birthday Reminders
CREATE OR REPLACE FUNCTION get_birthday_reminders()
    returns SETOF "user"
    language sql
as
$$

SELECT *
FROM "user"
WHERE deleted = false
  AND is_bot = false
  AND team_id = 'T011CF3CMJN'
  AND EXTRACT(MONTH FROM birthday_date) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(DAY FROM birthday_date) = EXTRACT(DAY FROM CURRENT_DATE)
  AND (
    (tz IS NULL AND EXTRACT(HOUR FROM now() AT TIME ZONE 'Asia/Chongqing') BETWEEN 8 and 9)
        OR
    (tz IS NOT NULL AND EXTRACT(HOUR FROM now() AT TIME ZONE tz) BETWEEN 8 and 9)
    );
$$;

-- 4. Anniversary Reminders
CREATE OR REPLACE FUNCTION get_anniversary_reminders()
    returns SETOF "user"
    language sql
as
$$

SELECT *
FROM "user"
WHERE deleted = false
  AND is_bot = false
  AND team_id = 'T011CF3CMJN'
  AND EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(DAY FROM entry_date) = EXTRACT(DAY FROM CURRENT_DATE)
  AND entry_date != CURRENT_DATE
  AND (
    (tz IS NULL AND EXTRACT(HOUR FROM now() AT TIME ZONE 'Asia/Chongqing') BETWEEN 8 and 9)
        OR
    (tz IS NOT NULL AND EXTRACT(HOUR FROM now() AT TIME ZONE tz) BETWEEN 8 and 9)
    );
$$;
