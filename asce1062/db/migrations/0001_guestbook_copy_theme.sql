-- Remembers a guest's "send me a copy" opt-in (and the theme to render it in)
-- so entries held for moderation can be copied when they are approved.
ALTER TABLE "Guestbook" ADD COLUMN "copyTheme" text;
