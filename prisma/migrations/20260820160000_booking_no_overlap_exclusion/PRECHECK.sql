-- RUN THIS BEFORE APPLYING THE MIGRATION.
--
-- An exclusion constraint cannot be added to a table that already violates it.
-- If this query returns any rows, the migration WILL fail -- resolve the
-- existing overlaps first (cancel the erroneous duplicate, or correct its
-- dates) and re-run until it returns nothing.
SELECT
  a.id            AS booking_a,
  b.id            AS booking_b,
  a."carId",
  a.status        AS status_a,
  b.status        AS status_b,
  a."startTime"   AS a_start, a."endTime" AS a_end,
  b."startTime"   AS b_start, b."endTime" AS b_end
FROM "Booking" a
JOIN "Booking" b
  ON a."carId" = b."carId"
 AND a.id < b.id
 AND a.status <> 'CANCELLED'
 AND b.status <> 'CANCELLED'
 AND tstzrange(a."startTime", a."endTime", '[)')
  && tstzrange(b."startTime", b."endTime", '[)')
ORDER BY a."carId", a."startTime";
