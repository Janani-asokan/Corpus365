ALTER TABLE `orders` ADD `payment_provider` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `provider_order_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_url` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `subscription_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_provider_order_id_unique` ON `orders` (`provider_order_id`);