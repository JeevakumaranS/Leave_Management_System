BEGIN;

ALTER TABLE "approval_tokens" ADD COLUMN "new_id" UUID;

UPDATE "approval_tokens"
SET "new_id" = uuidv7();

ALTER TABLE "approval_tokens" ALTER COLUMN "new_id" SET NOT NULL;
ALTER TABLE "approval_tokens" DROP CONSTRAINT "approval_tokens_pkey";
ALTER TABLE "approval_tokens" DROP COLUMN "id";
ALTER TABLE "approval_tokens" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "approval_tokens" ADD CONSTRAINT "approval_tokens_pkey" PRIMARY KEY ("id");

COMMIT;
