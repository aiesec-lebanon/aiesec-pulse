-- The credential admin is neither a member nor the scheduler, so its audit
-- rows need an actor type of their own.
ALTER TYPE "ActorType" ADD VALUE IF NOT EXISTS 'ADMIN';
