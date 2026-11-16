-- The admin "flagged" tab lists entries that carry classifier reasons, newest
-- first. Most entries carry none, so without this the tab would walk the whole
-- table to fill one page. A partial index holds only the flagged rows, in id
-- order, so the tab reads just the rows it shows.
CREATE INDEX IF NOT EXISTS "ix_guestbook_flagged" ON "Guestbook" ("id") WHERE "moderationReason" IS NOT NULL;
