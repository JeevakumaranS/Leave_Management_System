BEGIN;

ALTER TABLE "leave_requests" ADD COLUMN "new_id" UUID;

UPDATE "leave_requests"
SET "new_id" = uuidv7();

ALTER TABLE "leave_requests" ALTER COLUMN "new_id" SET NOT NULL;
ALTER TABLE "leave_requests" DROP CONSTRAINT "leave_requests_pkey";
ALTER TABLE "leave_requests" DROP COLUMN "id";
ALTER TABLE "leave_requests" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id");

COMMIT;
