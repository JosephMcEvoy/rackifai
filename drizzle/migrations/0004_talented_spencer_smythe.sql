CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`email` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
