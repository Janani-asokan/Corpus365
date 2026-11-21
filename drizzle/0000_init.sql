CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."commission_kind" AS ENUM('sale', 'renewal', 'hardware', 'launch_bonus');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('pending', 'in_payout', 'paid', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'demo', 'trial', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."order_kind" AS ENUM('retail', 'renewal', 'partner_bulk');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."partner_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('live', 'coming_soon', 'quote_only');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('app', 'hardware');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('open', 'quoted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client', 'partner', 'admin');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'cancelled', 'expired');--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_id" text,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"subscription_id" uuid,
	"kind" "commission_kind" NOT NULL,
	"description" text NOT NULL,
	"base_amount" bigint NOT NULL,
	"rate" integer NOT NULL,
	"tier" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"status" "commission_status" DEFAULT 'pending' NOT NULL,
	"payout_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commissions_order_item_kind_key" UNIQUE("order_item_id","kind"),
	CONSTRAINT "commissions_amounts_nonnegative" CHECK ("commissions"."base_amount" >= 0 and "commissions"."amount" >= 0),
	CONSTRAINT "commissions_rate_range" CHECK ("commissions"."rate" between 0 and 10000),
	CONSTRAINT "commissions_tier_valid" CHECK ("commissions"."tier" in ('channel', 'silver', 'gold', 'platinum')),
	CONSTRAINT "commissions_payout_consistency" CHECK (("commissions"."status" in ('in_payout', 'paid')) = ("commissions"."payout_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text,
	"phone" text,
	"product_id" uuid,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_has_contact" CHECK ("leads"."email" is not null or "leads"."phone" is not null)
);
--> statement-breakpoint
CREATE TABLE "licence_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"order_item_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"redeemed_at" timestamp with time zone,
	"redeemed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "licence_keys_redemption_consistent" CHECK (("licence_keys"."redeemed_at" is null) = ("licence_keys"."redeemed_by_user_id" is null))
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"plan_id" uuid,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" bigint NOT NULL,
	"line_total" bigint NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_line_total" CHECK ("order_items"."unit_price" >= 0 and "order_items"."line_total" = "order_items"."unit_price" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text DEFAULT 'C365-' || lpad(nextval('order_number_seq')::text, 6, '0') NOT NULL,
	"user_id" uuid NOT NULL,
	"partner_id" uuid,
	"kind" "order_kind" NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"subtotal" bigint NOT NULL,
	"tax" bigint NOT NULL,
	"total" bigint NOT NULL,
	"billing_name" text NOT NULL,
	"billing_company" text,
	"billing_gstin" text,
	"subscription_id" uuid,
	"payment_provider" text,
	"provider_order_id" text,
	"payment_reference" text,
	"payment_url" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_amounts_valid" CHECK ("orders"."subtotal" >= 0 and "orders"."tax" >= 0 and "orders"."total" = "orders"."subtotal" + "orders"."tax"),
	CONSTRAINT "orders_paid_consistency" CHECK (("orders"."status" = 'paid') = ("orders"."paid_at" is not null)),
	CONSTRAINT "orders_renewal_has_subscription" CHECK (("orders"."kind" = 'renewal') = ("orders"."subscription_id" is not null)),
	CONSTRAINT "orders_gstin_format" CHECK ("orders"."billing_gstin" is null or "orders"."billing_gstin" ~ '^[0-9]{2}[A-Z0-9]{13}$')
);
--> statement-breakpoint
CREATE TABLE "partner_price_tiers" (
	"product_id" uuid NOT NULL,
	"min_quantity" integer NOT NULL,
	"unit_price" bigint NOT NULL,
	CONSTRAINT "partner_price_tiers_product_id_min_quantity_pk" PRIMARY KEY("product_id","min_quantity"),
	CONSTRAINT "partner_price_tiers_min_quantity_positive" CHECK ("partner_price_tiers"."min_quantity" > 0),
	CONSTRAINT "partner_price_tiers_unit_price_positive" CHECK ("partner_price_tiers"."unit_price" > 0)
);
--> statement-breakpoint
CREATE TABLE "partner_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"status" "partner_status" DEFAULT 'pending' NOT NULL,
	"profession" text NOT NULL,
	"region" text NOT NULL,
	"experience" text,
	"payout_upi" text,
	"agreement_accepted_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_profiles_code_format" CHECK ("partner_profiles"."code" ~ '^[A-Z0-9]{4,12}$'),
	CONSTRAINT "partner_profiles_approved_has_date" CHECK ("partner_profiles"."status" <> 'approved' or "partner_profiles"."approved_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"period" char(7) NOT NULL,
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"reference" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_period_format" CHECK ("payouts"."period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "payouts_amount_positive" CHECK ("payouts"."amount" > 0),
	CONSTRAINT "payouts_paid_consistency" CHECK (("payouts"."status" = 'paid') = ("payouts"."paid_at" is not null and "payouts"."reference" is not null))
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"interval" "billing_interval" NOT NULL,
	"price" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_product_interval_key" UNIQUE("product_id","interval"),
	CONSTRAINT "plans_price_positive" CHECK ("plans"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "product_type" NOT NULL,
	"category" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"features" text[] DEFAULT '{}'::text[] NOT NULL,
	"works_with" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "product_status" NOT NULL,
	"icon" text NOT NULL,
	"trial_days" integer,
	"unit_price" bigint,
	"hardware_margin" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_format" CHECK ("products"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "products_unit_price_positive" CHECK ("products"."unit_price" is null or "products"."unit_price" > 0),
	CONSTRAINT "products_margin_range" CHECK ("products"."hardware_margin" is null or "products"."hardware_margin" between 0 and 10000),
	CONSTRAINT "products_trial_days_range" CHECK ("products"."trial_days" is null or "products"."trial_days" between 1 and 90)
);
--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid,
	"partner_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"city" text NOT NULL,
	"message" text,
	"status" "quote_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"plan_id" uuid,
	"partner_id" uuid,
	"status" "subscription_status" NOT NULL,
	"license_key" text NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"renewal_count" integer DEFAULT 0 NOT NULL,
	"from_licence_key_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_product_key" UNIQUE("user_id","product_id"),
	CONSTRAINT "subscriptions_period_order" CHECK ("subscriptions"."current_period_end" > "subscriptions"."current_period_start"),
	CONSTRAINT "subscriptions_renewal_count_nonnegative" CHECK ("subscriptions"."renewal_count" >= 0),
	CONSTRAINT "subscriptions_paid_has_plan" CHECK ("subscriptions"."status" = 'trialing' or "subscriptions"."plan_id" is not null or "subscriptions"."status" = 'expired')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"phone" text,
	"company_name" text,
	"city" text,
	"referred_by_partner_id" uuid,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_not_self_referred" CHECK ("users"."referred_by_partner_id" is distinct from "users"."id")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licence_keys" ADD CONSTRAINT "licence_keys_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licence_keys" ADD CONSTRAINT "licence_keys_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licence_keys" ADD CONSTRAINT "licence_keys_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licence_keys" ADD CONSTRAINT "licence_keys_redeemed_by_user_id_users_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_price_tiers" ADD CONSTRAINT "partner_price_tiers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_from_licence_key_id_licence_keys_id_fk" FOREIGN KEY ("from_licence_key_id") REFERENCES "public"."licence_keys"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_partner_id_users_id_fk" FOREIGN KEY ("referred_by_partner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "commissions_partner_status_idx" ON "commissions" USING btree ("partner_id","status","created_at");--> statement-breakpoint
CREATE INDEX "commissions_payout_idx" ON "commissions" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "commissions_order_idx" ON "commissions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "leads_partner_updated_idx" ON "leads" USING btree ("partner_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "licence_keys_key_key" ON "licence_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "licence_keys_partner_idx" ON "licence_keys" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "licence_keys_order_item_idx" ON "licence_keys" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_key" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_order_key" ON "orders" USING btree ("payment_provider","provider_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_one_open_renewal_key" ON "orders" USING btree ("subscription_id") WHERE "orders"."kind" = 'renewal' and "orders"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_partner_idx" ON "orders" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "orders_subscription_idx" ON "orders" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_profiles_code_key" ON "partner_profiles" USING btree ("code");--> statement-breakpoint
CREATE INDEX "partner_profiles_status_idx" ON "partner_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payouts_partner_idx" ON "payouts" USING btree ("partner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_key" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_listing_idx" ON "products" USING btree ("type","status","sort_order");--> statement-breakpoint
CREATE INDEX "quote_requests_status_created_idx" ON "quote_requests" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_license_key_key" ON "subscriptions" USING btree ("license_key");--> statement-breakpoint
CREATE INDEX "subscriptions_partner_status_idx" ON "subscriptions" USING btree ("partner_id","status");--> statement-breakpoint
CREATE INDEX "subscriptions_due_idx" ON "subscriptions" USING btree ("status","current_period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_referred_by_idx" ON "users" USING btree ("referred_by_partner_id");