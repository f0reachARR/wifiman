ALTER TABLE "best_practices" ADD CONSTRAINT "best_practices_scope_target_check" CHECK ((
        ("best_practices"."scope" = 'general' AND "best_practices"."tournament_id" IS NULL AND "best_practices"."target_band" IS NULL AND "best_practices"."target_model" IS NULL)
        OR ("best_practices"."scope" = 'tournament' AND "best_practices"."tournament_id" IS NOT NULL AND "best_practices"."target_band" IS NULL AND "best_practices"."target_model" IS NULL)
        OR ("best_practices"."scope" = 'band' AND "best_practices"."target_band" IS NOT NULL AND "best_practices"."target_model" IS NULL)
        OR ("best_practices"."scope" = 'device' AND "best_practices"."target_model" IS NOT NULL)
      ));--> statement-breakpoint
