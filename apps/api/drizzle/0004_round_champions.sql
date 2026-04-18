ALTER TABLE "issue_reports" DROP CONSTRAINT "issue_reports_sync_status_check";--> statement-breakpoint
ALTER TABLE "issue_reports" ADD COLUMN "visibility" text DEFAULT 'team_private' NOT NULL;--> statement-breakpoint
UPDATE "issue_reports" SET "visibility" = 'team_public' WHERE "team_id" IS NULL;--> statement-breakpoint
ALTER TABLE "issue_reports" DROP COLUMN "sync_status";--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_visibility_check" CHECK ("issue_reports"."visibility" IN ('team_private', 'team_public'));
