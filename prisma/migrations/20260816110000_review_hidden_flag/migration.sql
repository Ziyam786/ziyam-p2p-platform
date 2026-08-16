-- Admin soft-moderation for reviews: hide without deleting.
ALTER TABLE "Review" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
