CREATE TABLE `device_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`manufacturer` text NOT NULL,
	`model` text NOT NULL,
	`slug` text NOT NULL,
	`u_height` integer DEFAULT 1 NOT NULL,
	`is_full_depth` integer DEFAULT true NOT NULL,
	`weight_kg` real,
	`max_power_watts` integer,
	`category` text DEFAULT 'server' NOT NULL,
	`metadata_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `device_catalog_manufacturer_idx` ON `device_catalog` (`manufacturer`);--> statement-breakpoint
CREATE INDEX `device_catalog_category_idx` ON `device_catalog` (`category`);--> statement-breakpoint
CREATE INDEX `device_catalog_slug_idx` ON `device_catalog` (`slug`);