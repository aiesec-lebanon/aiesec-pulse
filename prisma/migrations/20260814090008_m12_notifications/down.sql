-- Rollback for M12.
DROP TABLE IF EXISTS "EmailDelivery";
DROP TABLE IF EXISTS "PushSubscription";
DROP TABLE IF EXISTS "UserDigestSetting";
DROP TABLE IF EXISTS "NotificationPreference";
DROP TABLE IF EXISTS "Notification";
DROP TYPE IF EXISTS "DigestFrequency";
