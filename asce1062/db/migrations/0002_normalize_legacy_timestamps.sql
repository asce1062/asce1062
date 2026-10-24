-- Rows written by the SQL default (CURRENT_TIMESTAMP) store "YYYY-MM-DD HH:MM:SS"
-- in UTC; the app writes ISO 8601 ("YYYY-MM-DDTHH:MM:SS.sssZ"). Rewrite the
-- legacy shape to ISO so every date column compares and sorts as one format.
-- Only valid legacy values are touched (right shape, and strftime round-trips
-- them unchanged); anything else is left as is rather than nulled.

UPDATE "Guestbook" SET "timestamp" = strftime('%Y-%m-%dT%H:%M:%fZ', "timestamp")
WHERE "timestamp" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'
AND strftime('%Y-%m-%d %H:%M:%S', "timestamp") = "timestamp";

UPDATE "Guestbook" SET "moderatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', "moderatedAt")
WHERE "moderatedAt" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'
AND strftime('%Y-%m-%d %H:%M:%S', "moderatedAt") = "moderatedAt";

UPDATE "Guestbook" SET "adminNotifiedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', "adminNotifiedAt")
WHERE "adminNotifiedAt" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'
AND strftime('%Y-%m-%d %H:%M:%S', "adminNotifiedAt") = "adminNotifiedAt";

UPDATE "Guestbook" SET "copySentAt" = strftime('%Y-%m-%dT%H:%M:%fZ', "copySentAt")
WHERE "copySentAt" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'
AND strftime('%Y-%m-%d %H:%M:%S', "copySentAt") = "copySentAt";

UPDATE "GuestbookModerationLog" SET "at" = strftime('%Y-%m-%dT%H:%M:%fZ', "at")
WHERE "at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'
AND strftime('%Y-%m-%d %H:%M:%S', "at") = "at";
