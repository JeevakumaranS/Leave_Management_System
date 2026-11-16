BEGIN;

ALTER TABLE "user" ADD COLUMN "new_id" UUID;

UPDATE "user"
SET "new_id" = uuidv7();

ALTER TABLE "user" ALTER COLUMN "new_id" SET NOT NULL;
ALTER TABLE "user" DROP CONSTRAINT "employees_pkey";
ALTER TABLE "user" DROP COLUMN "id";
ALTER TABLE "user" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "user" ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id");

COMMIT;
