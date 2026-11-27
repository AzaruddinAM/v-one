-- v-one upgrade: PDF templates, logo, header/footer and display options (Settings -> PDF templates)
-- Run ONCE on an existing database: hPanel -> Databases -> phpMyAdmin -> select the database -> SQL tab -> paste -> Go.
-- Not needed for a fresh import of v-one-schema.sql or v-one-demo.sql (they already include these columns).

ALTER TABLE `organizations`
  ADD COLUMN `pdf_template` varchar(20) NOT NULL DEFAULT 'classic' AFTER `invoice_notes`,
  ADD COLUMN `pdf_accent` varchar(7) NOT NULL DEFAULT '#4f46e5' AFTER `pdf_template`,
  ADD COLUMN `pdf_footer` text DEFAULT NULL AFTER `pdf_accent`,
  ADD COLUMN `pdf_options` longtext DEFAULT NULL AFTER `pdf_footer`;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_11_26_000100_add_pdf_template_to_organizations', COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`;
INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_11_27_000100_add_pdf_options_to_organizations', MAX(`batch`) FROM `migrations`;
