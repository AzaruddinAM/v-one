-- v-one upgrade: UAE VAT / tax system, custom transaction numbers, payment terms & reminders,
-- recurring invoices / bills, vendor credits and delivery challans.
-- Run ONCE on an existing database, AFTER upgrade-2026-11-pdf-templates.sql:
-- hPanel -> Databases -> phpMyAdmin -> select the database -> SQL tab -> paste -> Go.
-- v-one-schema.sql and v-one-demo.sql already end with these statements.

ALTER TABLE `organizations`
  ADD COLUMN `tax_regime` varchar(10) NOT NULL DEFAULT 'gst' AFTER `gstin`,
  ADD COLUMN `number_series` text DEFAULT NULL AFTER `pdf_options`,
  ADD COLUMN `reminder_template` text DEFAULT NULL AFTER `number_series`;

ALTER TABLE `contacts`
  ADD COLUMN `code` varchar(12) DEFAULT NULL AFTER `company_name`;

CREATE TABLE `recurring_profiles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `type` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `contact_id` bigint(20) unsigned NOT NULL,
  `frequency` varchar(10) NOT NULL,
  `interval` smallint(5) unsigned NOT NULL DEFAULT 1,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `next_date` date NOT NULL,
  `status` varchar(10) NOT NULL DEFAULT 'active',
  `auto_send` tinyint(1) NOT NULL DEFAULT 0,
  `payment_terms` varchar(30) DEFAULT NULL,
  `template` longtext NOT NULL,
  `generated_count` int(10) unsigned NOT NULL DEFAULT 0,
  `last_generated_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `recurring_profiles_organization_id_type_status_index` (`organization_id`,`type`,`status`),
  KEY `recurring_profiles_contact_id_foreign` (`contact_id`),
  KEY `recurring_profiles_created_by_foreign` (`created_by`),
  CONSTRAINT `recurring_profiles_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `recurring_profiles_contact_id_foreign` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`),
  CONSTRAINT `recurring_profiles_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `documents`
  ADD COLUMN `payment_terms` varchar(30) DEFAULT NULL AFTER `due_date`,
  ADD COLUMN `recurring_profile_id` bigint(20) unsigned DEFAULT NULL AFTER `converted_from_id`,
  ADD COLUMN `reminded_at` timestamp NULL DEFAULT NULL AFTER `recurring_profile_id`,
  ADD COLUMN `reminder_count` smallint(5) unsigned NOT NULL DEFAULT 0 AFTER `reminded_at`,
  ADD CONSTRAINT `documents_recurring_profile_id_foreign` FOREIGN KEY (`recurring_profile_id`) REFERENCES `recurring_profiles` (`id`) ON DELETE SET NULL;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_11_27_000200_add_billing_features', COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`;
