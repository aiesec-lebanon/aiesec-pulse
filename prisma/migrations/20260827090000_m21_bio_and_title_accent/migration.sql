-- M21: two author-owned editorial fields.
--
-- `User.bio` is the member's own standfirst, shown on their profile and on any
-- story they wrote. It is Pulse-owned: GIS carries no such field and offers no
-- way for an application to write one back, so unlike every other column on
-- `User` it is never overwritten by a sync.
--
-- `Post.titleAccent` is the phrase inside a headline the author chose to set
-- italic in the topic's colour. Stored as the substring, not an offset pair:
-- editing the rest of the headline then cannot corrupt it, and a phrase that no
-- longer appears is ignored at render rather than mis-highlighting.
--
-- Both nullable, both with no default. Nothing is backfilled — an invented bio
-- or an inferred accent is exactly what the design system forbids.

ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "Post" ADD COLUMN "titleAccent" TEXT;
