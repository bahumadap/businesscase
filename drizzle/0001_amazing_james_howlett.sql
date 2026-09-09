CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`entity` text NOT NULL,
	`action` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_log_changed_at` ON `audit_log` (`changed_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_entity` ON `audit_log` (`entity`);