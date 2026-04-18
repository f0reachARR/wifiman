CREATE UNIQUE INDEX "team_accesses_single_active_per_team" ON "team_accesses" USING btree ("team_id") WHERE "team_accesses"."revoked_at" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("user"."role" IN ('user', 'operator'));--> statement-breakpoint
ALTER TABLE "best_practices" ADD CONSTRAINT "best_practices_scope_check" CHECK ("best_practices"."scope" IN ('general', 'tournament', 'band', 'device'));--> statement-breakpoint
ALTER TABLE "best_practices" ADD CONSTRAINT "best_practices_target_band_check" CHECK ("best_practices"."target_band" IS NULL OR "best_practices"."target_band" IN ('2.4GHz', '5GHz', '6GHz'));--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_severity_check" CHECK ("notices"."severity" IN ('info', 'warning', 'critical'));--> statement-breakpoint
ALTER TABLE "observed_wifis" ADD CONSTRAINT "observed_wifis_source_check" CHECK ("observed_wifis"."source" IN ('wild', 'analyzer_import', 'manual'));--> statement-breakpoint
ALTER TABLE "observed_wifis" ADD CONSTRAINT "observed_wifis_band_check" CHECK ("observed_wifis"."band" IN ('2.4GHz', '5GHz', '6GHz'));--> statement-breakpoint
ALTER TABLE "sync_records" ADD CONSTRAINT "sync_records_action_check" CHECK ("sync_records"."action" IN ('create', 'update', 'delete'));--> statement-breakpoint
ALTER TABLE "sync_records" ADD CONSTRAINT "sync_records_status_check" CHECK ("sync_records"."status" IN ('pending', 'processing', 'failed', 'done'));