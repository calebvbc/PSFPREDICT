CREATE TYPE "public"."match_round" AS ENUM('round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'in_progress', 'final');--> statement-breakpoint
CREATE TABLE "feed_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"round" "match_round" NOT NULL,
	"kickoff_at" timestamp with time zone NOT NULL,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"home_team_id" text NOT NULL,
	"home_team_name" text NOT NULL,
	"home_team_logo_url" text,
	"home_team_color" text,
	"home_team_placeholder" boolean DEFAULT false NOT NULL,
	"away_team_id" text NOT NULL,
	"away_team_name" text NOT NULL,
	"away_team_logo_url" text,
	"away_team_color" text,
	"away_team_placeholder" boolean DEFAULT false NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"winner_team_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"username" text NOT NULL,
	"username_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"participant_id" integer NOT NULL,
	"match_id" integer NOT NULL,
	"home_score" integer NOT NULL,
	"away_score" integer NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "matches_external_id_unique" ON "matches" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "matches_kickoff_at_idx" ON "matches" USING btree ("kickoff_at");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_username_normalized_unique" ON "participants" USING btree ("username_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "predictions_participant_match_unique" ON "predictions" USING btree ("participant_id","match_id");