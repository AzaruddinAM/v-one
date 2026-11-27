-- v-one upgrade: transaction locking, retainer (advance) invoices, banking & bank reconciliation.
-- Trial balance, general ledger, day book and customer / vendor balances need no schema change.
-- Run ONCE on an existing database, AFTER upgrade-2026-11-billing-features.sql:
-- hPanel -> Databases -> phpMyAdmin -> select the database -> SQL tab -> paste -> Go.
-- v-one-schema.sql and v-one-demo.sql already end with these statements.

ALTER TABLE `organizations`
  ADD COLUMN `lock_date` date DEFAULT NULL AFTER `reminder_template`;

ALTER TABLE `payments`
  ADD COLUMN `retainer_id` bigint(20) unsigned DEFAULT NULL AFTER `document_id`,
  ADD KEY `payments_retainer_id_foreign` (`retainer_id`),
  ADD CONSTRAINT `payments_retainer_id_foreign` FOREIGN KEY (`retainer_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL;

CREATE TABLE `reconciliations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `account_id` bigint(20) unsigned NOT NULL,
  `statement_date` date NOT NULL,
  `statement_balance` decimal(15,2) NOT NULL,
  `cleared_balance` decimal(15,2) NOT NULL,
  `entries_count` int(10) unsigned NOT NULL DEFAULT 0,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `reconciliations_account_id_foreign` (`account_id`),
  KEY `reconciliations_created_by_foreign` (`created_by`),
  KEY `reconciliations_organization_id_account_id_statement_date_index` (`organization_id`,`account_id`,`statement_date`),
  CONSTRAINT `reconciliations_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reconciliations_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reconciliations_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reconciled_entries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `account_id` bigint(20) unsigned NOT NULL,
  `reconciliation_id` bigint(20) unsigned NOT NULL,
  `entry_key` varchar(60) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reconciled_entries_organization_id_account_id_entry_key_unique` (`organization_id`,`account_id`,`entry_key`),
  KEY `reconciled_entries_account_id_foreign` (`account_id`),
  KEY `reconciled_entries_reconciliation_id_foreign` (`reconciliation_id`),
  CONSTRAINT `reconciled_entries_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reconciled_entries_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reconciled_entries_reconciliation_id_foreign` FOREIGN KEY (`reconciliation_id`) REFERENCES `reconciliations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_11_27_000300_add_accounting_features', COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`;
