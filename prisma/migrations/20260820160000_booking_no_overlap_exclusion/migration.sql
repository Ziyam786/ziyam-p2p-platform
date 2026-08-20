-- Defence-in-depth against double-booking.
--
-- The guest booking path (booking.routes.ts) already wraps its overlap check
-- and insert in a SERIALIZABLE transaction and translates Postgres' P2034
-- serialization failure into a 409, which is correct. The admin path
-- (admin.routes.ts POST /admin/bookings) does NOT: it runs a plain
-- findFirst-then-create with no transaction, so an admin phone-booking racing
-- a guest checkout can still double-book the same car.
--
-- Rather than patch each call site and hope every future one remembers, this
-- makes overlap structurally impossible at the storage layer. Any write path
-- -- present or future, application code or a manual psql session -- now gets
-- a constraint violation instead of a silently double-booked car.
--
-- btree_gist is required to mix an equality column (carId, a uuid/text) with
-- a range column in one GiST exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- The predicate mirrors the application's own definition of "occupying the
-- calendar" exactly (status NOT IN ('CANCELLED')) so the constraint can never
-- be STRICTER than the app -- a stricter constraint would reject writes the
-- app considers legitimate and surface as a 500 instead of a clean 409.
--
-- Note: this deliberately treats REJECTED as still occupying, because the
-- application currently does too. That is very likely an application bug (a
-- host-rejected booking should free the dates back up), but fixing it belongs
-- in the app layer, in its own change, not smuggled in through a migration.
--
-- '[)' = half-open range: a booking ending at 10:00 and one starting at 10:00
-- do NOT overlap, matching the app's strict `startTime < end AND endTime > start`.
-- Booking.startTime/endTime are Prisma `DateTime` columns, which map to
-- Postgres `timestamp` (no time zone) by default -- not `timestamptz`. Using
-- tstzrange() here would force an implicit timestamp->timestamptz cast, which
-- depends on the session's `timezone` setting and so isn't IMMUTABLE; Postgres
-- refuses to build a GiST index over a non-immutable expression. tsrange()
-- matches the real column type and needs no cast.
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_overlapping_active_dates"
  EXCLUDE USING gist (
    "carId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
  )
  WHERE (status <> 'CANCELLED');
