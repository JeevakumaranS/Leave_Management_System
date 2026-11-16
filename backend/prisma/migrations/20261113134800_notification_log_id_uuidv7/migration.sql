BEGIN;

ALTER TABLE "notification_logs" ADD COLUMN "new_id" UUID;

UPDATE "notification_logs"
SET "new_id" = uuidv7();

ALTER TABLE "notification_logs" ALTER COLUMN "new_id" SET NOT NULL;
ALTER TABLE "notification_logs" DROP CONSTRAINT "notification_logs_pkey";
ALTER TABLE "notification_logs" DROP COLUMN "id";
ALTER TABLE "notification_logs" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");

COMMIT;
