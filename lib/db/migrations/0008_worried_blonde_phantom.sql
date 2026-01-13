CREATE TYPE "public"."budget_period" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TABLE "category_budget_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"budget_amount" numeric(12, 2) NOT NULL,
	"budget_period" "budget_period" NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "budget_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "budget_period" "budget_period";--> statement-breakpoint
ALTER TABLE "category_budget_history" ADD CONSTRAINT "category_budget_history_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;