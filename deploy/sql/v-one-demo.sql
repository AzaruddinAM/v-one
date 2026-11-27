-- v-one database (demo) — import into your empty MySQL database using phpMyAdmin → Import
-- Generated 2026-10-27
-- Demo login: phone 9876543210 / password Admin@123  (change it after first login!)
SET NAMES utf8mb4;
-- MariaDB dump 10.19  Distrib 10.11.14-MariaDB, for debian-linux-gnu (x86_64)
--
-- ------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `accounts`
--

DROP TABLE IF EXISTS `accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `code` varchar(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(20) NOT NULL,
  `sub_type` varchar(40) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `opening_balance` decimal(15,2) NOT NULL DEFAULT 0.00,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_organization_id_code_unique` (`organization_id`,`code`),
  KEY `accounts_organization_id_type_index` (`organization_id`,`type`),
  CONSTRAINT `accounts_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts`
--

/*!40000 ALTER TABLE `accounts` DISABLE KEYS */;
INSERT INTO `accounts` VALUES
(1,1,'1000','Cash in Hand','asset','cash',NULL,50000.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:29'),
(2,1,'1010','Bank Account','asset','bank',NULL,750000.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:29'),
(3,1,'1100','Accounts Receivable','asset','receivable',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(4,1,'1200','Inventory Asset','asset','inventory',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(5,1,'1300','Input Tax Credit','asset','tax',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(6,1,'1500','Furniture & Equipment','asset','fixed_asset',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(7,1,'2000','Accounts Payable','liability','payable',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(8,1,'2100','GST Payable','liability','tax',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(9,1,'2200','Loans','liability','loan',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(10,1,'3000','Owner\'s Equity','equity','equity',NULL,800000.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:29'),
(11,1,'3100','Retained Earnings','equity','equity',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(12,1,'4000','Sales','income','sales',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(13,1,'4100','Service Income','income','sales',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(14,1,'4900','Other Income','income','other_income',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(15,1,'5000','Cost of Goods Sold','expense','cogs',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(16,1,'5100','Rent','expense','expense',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(17,1,'5200','Salaries & Wages','expense','expense',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(18,1,'5300','Utilities','expense','expense',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(19,1,'5400','Office Supplies','expense','expense',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(20,1,'5500','Travel & Conveyance','expense','expense',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(21,1,'5600','Advertising & Marketing','expense','expense',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(22,1,'5700','Bank Charges','expense','expense',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(23,1,'5800','Internet & Telephone','expense','expense',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(24,1,'5900','Repairs & Maintenance','expense','expense',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(25,1,'5990','Miscellaneous Expenses','expense','expense',NULL,0.00,1,1,'2026-10-27 22:57:28','2026-10-27 22:57:28');
/*!40000 ALTER TABLE `accounts` ENABLE KEYS */;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` bigint(20) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` bigint(20) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;

--
-- Table structure for table `contacts`
--

DROP TABLE IF EXISTS `contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `contacts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `type` varchar(10) NOT NULL,
  `name` varchar(255) NOT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `gstin` varchar(30) DEFAULT NULL,
  `pan` varchar(20) DEFAULT NULL,
  `billing_address` text DEFAULT NULL,
  `shipping_address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `pincode` varchar(20) DEFAULT NULL,
  `opening_balance` decimal(15,2) NOT NULL DEFAULT 0.00,
  `payment_terms` smallint(5) unsigned NOT NULL DEFAULT 30,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `contacts_organization_id_type_name_index` (`organization_id`,`type`,`name`),
  CONSTRAINT `contacts_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contacts`
--

/*!40000 ALTER TABLE `contacts` DISABLE KEYS */;
INSERT INTO `contacts` VALUES
(1,1,'customer','Anil Kumar','Kumar Electronics','anil@example.com','9847000010',NULL,NULL,NULL,NULL,'Kochi','Kerala','India',NULL,0.00,15,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(2,1,'customer','Fathima Rahman','Rahman Stores','fathima@example.com','9847000011',NULL,NULL,NULL,NULL,'Kozhikode','Kerala','India',NULL,0.00,20,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(3,1,'customer','Suresh Nair','Nair & Sons','suresh@example.com','9847000012',NULL,NULL,NULL,NULL,'Thrissur','Kerala','India',NULL,0.00,25,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(4,1,'customer','Priya Menon','Menon Retail','priya@example.com','9847000013',NULL,NULL,NULL,NULL,'Kannur','Kerala','India',NULL,0.00,30,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(5,1,'customer','Mohammed Ashraf','Ashraf Traders','mohammed@example.com','9847000014',NULL,NULL,NULL,NULL,'Mangaluru','Kerala','India',NULL,0.00,35,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(6,1,'vendor','Ravi Wholesale','Ravi Wholesale Pvt Ltd',NULL,NULL,NULL,NULL,NULL,NULL,'Bengaluru',NULL,'India',NULL,0.00,30,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(7,1,'vendor','Malabar Distributors','Malabar Distributors',NULL,NULL,NULL,NULL,NULL,NULL,'Kozhikode',NULL,'India',NULL,0.00,30,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(8,1,'vendor','TechSupply Co','TechSupply India',NULL,NULL,NULL,NULL,NULL,NULL,'Chennai',NULL,'India',NULL,0.00,30,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29');
/*!40000 ALTER TABLE `contacts` ENABLE KEYS */;

--
-- Table structure for table `document_items`
--

DROP TABLE IF EXISTS `document_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `document_id` bigint(20) unsigned NOT NULL,
  `item_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `quantity` decimal(15,3) NOT NULL DEFAULT 1.000,
  `unit` varchar(20) DEFAULT NULL,
  `rate` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tax_id` bigint(20) unsigned DEFAULT NULL,
  `tax_rate` decimal(6,2) NOT NULL DEFAULT 0.00,
  `tax_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `sort` smallint(5) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `document_items_document_id_foreign` (`document_id`),
  KEY `document_items_item_id_foreign` (`item_id`),
  KEY `document_items_tax_id_foreign` (`tax_id`),
  CONSTRAINT `document_items_document_id_foreign` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `document_items_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `document_items_tax_id_foreign` FOREIGN KEY (`tax_id`) REFERENCES `taxes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_items`
--

/*!40000 ALTER TABLE `document_items` DISABLE KEYS */;
INSERT INTO `document_items` VALUES
(1,1,1,'Wireless Mouse',NULL,1.000,'pcs',650.00,0.00,4,18.00,117.00,650.00,0),
(2,1,2,'Mechanical Keyboard',NULL,1.000,'pcs',2450.00,0.00,4,18.00,441.00,2450.00,1),
(3,1,6,'Annual Maintenance',NULL,3.000,'nos',12000.00,0.00,4,18.00,6480.00,36000.00,2),
(4,2,5,'Basmati Rice 5kg',NULL,3.000,'pack',540.00,0.00,2,5.00,81.00,1620.00,0),
(5,2,6,'Annual Maintenance',NULL,1.000,'nos',12000.00,0.00,4,18.00,2160.00,12000.00,1),
(6,3,7,'Installation Service',NULL,1.000,'hrs',800.00,0.00,4,18.00,144.00,800.00,0),
(7,4,7,'Installation Service',NULL,4.000,'hrs',800.00,0.00,4,18.00,576.00,3200.00,0),
(8,5,3,'27\" LED Monitor',NULL,1.000,'pcs',14500.00,0.00,4,18.00,2610.00,14500.00,0),
(9,5,4,'A4 Paper Ream',NULL,1.000,'box',320.00,0.00,3,12.00,38.40,320.00,1),
(10,5,5,'Basmati Rice 5kg',NULL,2.000,'pack',540.00,0.00,2,5.00,54.00,1080.00,2),
(11,6,2,'Mechanical Keyboard',NULL,3.000,'pcs',2450.00,0.00,4,18.00,1323.00,7350.00,0),
(12,6,3,'27\" LED Monitor',NULL,4.000,'pcs',14500.00,0.00,4,18.00,10440.00,58000.00,1),
(13,6,5,'Basmati Rice 5kg',NULL,4.000,'pack',540.00,0.00,2,5.00,108.00,2160.00,2),
(14,7,3,'27\" LED Monitor',NULL,3.000,'pcs',14500.00,0.00,4,18.00,7830.00,43500.00,0),
(15,7,5,'Basmati Rice 5kg',NULL,3.000,'pack',540.00,0.00,2,5.00,81.00,1620.00,1),
(16,7,7,'Installation Service',NULL,4.000,'hrs',800.00,0.00,4,18.00,576.00,3200.00,2),
(17,8,4,'A4 Paper Ream',NULL,2.000,'box',320.00,0.00,3,12.00,76.80,640.00,0),
(18,8,5,'Basmati Rice 5kg',NULL,2.000,'pack',540.00,0.00,2,5.00,54.00,1080.00,1),
(19,8,6,'Annual Maintenance',NULL,2.000,'nos',12000.00,0.00,4,18.00,4320.00,24000.00,2),
(20,9,3,'27\" LED Monitor',NULL,1.000,'pcs',14500.00,0.00,4,18.00,2610.00,14500.00,0),
(21,9,6,'Annual Maintenance',NULL,1.000,'nos',12000.00,0.00,4,18.00,2160.00,12000.00,1),
(22,10,1,'Wireless Mouse',NULL,2.000,'pcs',650.00,0.00,4,18.00,234.00,1300.00,0),
(23,10,3,'27\" LED Monitor',NULL,1.000,'pcs',14500.00,0.00,4,18.00,2610.00,14500.00,1),
(24,10,6,'Annual Maintenance',NULL,3.000,'nos',12000.00,0.00,4,18.00,6480.00,36000.00,2),
(25,11,5,'Basmati Rice 5kg',NULL,4.000,'pack',540.00,0.00,2,5.00,108.00,2160.00,0),
(26,12,1,'Wireless Mouse',NULL,1.000,'pcs',650.00,0.00,4,18.00,117.00,650.00,0),
(27,12,4,'A4 Paper Ream',NULL,1.000,'box',320.00,0.00,3,12.00,38.40,320.00,1),
(28,12,7,'Installation Service',NULL,2.000,'hrs',800.00,0.00,4,18.00,288.00,1600.00,2),
(29,13,6,'Annual Maintenance',NULL,2.000,'nos',12000.00,0.00,4,18.00,4320.00,24000.00,0),
(30,14,3,'27\" LED Monitor',NULL,2.000,'pcs',14500.00,0.00,4,18.00,5220.00,29000.00,0),
(31,14,5,'Basmati Rice 5kg',NULL,4.000,'pack',540.00,0.00,2,5.00,108.00,2160.00,1),
(32,14,6,'Annual Maintenance',NULL,2.000,'nos',12000.00,0.00,4,18.00,4320.00,24000.00,2),
(33,15,2,'Mechanical Keyboard',NULL,4.000,'pcs',2450.00,0.00,4,18.00,1764.00,9800.00,0),
(34,15,3,'27\" LED Monitor',NULL,3.000,'pcs',14500.00,0.00,4,18.00,7830.00,43500.00,1),
(35,16,2,'Mechanical Keyboard',NULL,1.000,'pcs',2450.00,0.00,4,18.00,441.00,2450.00,0),
(36,17,3,'27\" LED Monitor',NULL,1.000,'pcs',14500.00,0.00,4,18.00,2610.00,14500.00,0),
(37,18,7,'Installation Service',NULL,2.000,'hrs',800.00,0.00,4,18.00,288.00,1600.00,0),
(38,19,4,'A4 Paper Ream',NULL,10.000,'box',240.00,0.00,3,12.00,288.00,2400.00,0),
(39,19,5,'Basmati Rice 5kg',NULL,10.000,'pack',430.00,0.00,2,5.00,215.00,4300.00,1),
(40,20,2,'Mechanical Keyboard',NULL,10.000,'pcs',1700.00,0.00,4,18.00,3060.00,17000.00,0),
(41,20,4,'A4 Paper Ream',NULL,10.000,'box',240.00,0.00,3,12.00,288.00,2400.00,1),
(42,21,1,'Wireless Mouse',NULL,10.000,'pcs',420.00,0.00,4,18.00,756.00,4200.00,0),
(43,21,3,'27\" LED Monitor',NULL,10.000,'pcs',11200.00,0.00,4,18.00,20160.00,112000.00,1),
(44,22,3,'27\" LED Monitor',NULL,2.000,'pcs',14500.00,0.00,4,18.00,5220.00,29000.00,0),
(45,22,7,'Installation Service',NULL,3.000,'hrs',800.00,0.00,4,18.00,432.00,2400.00,1),
(46,23,3,'27\" LED Monitor',NULL,5.000,'pcs',11200.00,0.00,4,18.00,10080.00,56000.00,0);
/*!40000 ALTER TABLE `document_items` ENABLE KEYS */;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `type` varchar(20) NOT NULL,
  `number` varchar(40) NOT NULL,
  `reference` varchar(60) DEFAULT NULL,
  `contact_id` bigint(20) unsigned NOT NULL,
  `date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax_total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `adjustment` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `amount_paid` decimal(15,2) NOT NULL DEFAULT 0.00,
  `balance` decimal(15,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `terms` text DEFAULT NULL,
  `converted_from_id` bigint(20) unsigned DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `documents_organization_id_type_number_unique` (`organization_id`,`type`,`number`),
  KEY `documents_contact_id_foreign` (`contact_id`),
  KEY `documents_converted_from_id_foreign` (`converted_from_id`),
  KEY `documents_created_by_foreign` (`created_by`),
  KEY `documents_organization_id_type_status_index` (`organization_id`,`type`,`status`),
  KEY `documents_organization_id_type_date_index` (`organization_id`,`type`,`date`),
  KEY `documents_organization_id_contact_id_index` (`organization_id`,`contact_id`),
  CONSTRAINT `documents_contact_id_foreign` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`),
  CONSTRAINT `documents_converted_from_id_foreign` FOREIGN KEY (`converted_from_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL,
  CONSTRAINT `documents_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `documents_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documents`
--

/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
INSERT INTO `documents` VALUES
(1,1,'invoice','INV-00001',NULL,3,'2026-05-04','2026-05-29','paid',39100.00,0.00,7038.00,0.00,46138.00,46138.00,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(2,1,'invoice','INV-00002',NULL,1,'2026-05-11','2026-05-26','paid',13620.00,0.00,2241.00,0.00,15861.00,15861.00,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(3,1,'invoice','INV-00003',NULL,2,'2026-05-18','2026-06-07','paid',800.00,0.00,144.00,0.00,944.00,944.00,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(4,1,'invoice','INV-00004',NULL,1,'2026-06-04','2026-06-19','paid',3200.00,0.00,576.00,0.00,3776.00,3776.00,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(5,1,'invoice','INV-00005',NULL,2,'2026-06-11','2026-07-01','paid',15900.00,0.00,2702.40,0.00,18602.40,18602.40,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(6,1,'invoice','INV-00006',NULL,5,'2026-06-18','2026-07-23','paid',67510.00,0.00,11871.00,0.00,79381.00,79381.00,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(7,1,'invoice','INV-00007',NULL,1,'2026-07-04','2026-07-19','paid',48320.00,0.00,8487.00,0.00,56807.00,56807.00,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(8,1,'invoice','INV-00008',NULL,5,'2026-07-11','2026-08-15','paid',25720.00,0.00,4450.80,0.00,30170.80,30170.80,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(9,1,'invoice','INV-00009',NULL,3,'2026-07-18','2026-08-12','paid',26500.00,0.00,4770.00,0.00,31270.00,31270.00,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(10,1,'invoice','INV-00010',NULL,2,'2026-08-04','2026-08-24','paid',51800.00,0.00,9324.00,0.00,61124.00,61124.00,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(11,1,'invoice','INV-00011',NULL,3,'2026-08-11','2026-09-05','paid',2160.00,0.00,108.00,0.00,2268.00,2268.00,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(12,1,'invoice','INV-00012',NULL,4,'2026-08-18','2026-09-17','paid',2570.00,0.00,443.40,0.00,3013.40,3013.40,0.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(13,1,'invoice','INV-00013',NULL,5,'2026-09-04','2026-10-09','partial',24000.00,0.00,4320.00,0.00,28320.00,14160.00,14160.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(14,1,'invoice','INV-00014',NULL,4,'2026-09-11','2026-10-11','partial',55160.00,0.00,9648.00,0.00,64808.00,32404.00,32404.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(15,1,'invoice','INV-00015',NULL,3,'2026-09-18','2026-10-13','partial',53300.00,0.00,9594.00,0.00,62894.00,31447.00,31447.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(16,1,'invoice','INV-00016',NULL,4,'2026-10-04','2026-11-03','sent',2450.00,0.00,441.00,0.00,2891.00,0.00,2891.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(17,1,'invoice','INV-00017',NULL,1,'2026-10-11','2026-10-26','overdue',14500.00,0.00,2610.00,0.00,17110.00,0.00,17110.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(18,1,'invoice','INV-00018',NULL,5,'2026-10-18','2026-11-22','sent',1600.00,0.00,288.00,0.00,1888.00,0.00,1888.00,NULL,'Payment due within the agreed credit period. Thank you for your business!',NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(19,1,'bill','BILL-00001','VB-1001',6,'2026-08-06','2026-09-05','paid',6700.00,0.00,503.00,0.00,7203.00,7203.00,0.00,NULL,NULL,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(20,1,'bill','BILL-00002','VB-1002',7,'2026-09-06','2026-10-06','overdue',19400.00,0.00,3348.00,0.00,22748.00,0.00,22748.00,NULL,NULL,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(21,1,'bill','BILL-00003','VB-1003',8,'2026-10-06','2026-11-05','open',116200.00,0.00,20916.00,0.00,137116.00,0.00,137116.00,NULL,NULL,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(22,1,'estimate','EST-00001',NULL,1,'2026-10-24','2026-11-08','sent',31400.00,0.00,5652.00,0.00,37052.00,0.00,0.00,NULL,NULL,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(23,1,'purchase_order','PO-00001',NULL,8,'2026-10-26',NULL,'open',56000.00,0.00,10080.00,0.00,66080.00,0.00,0.00,NULL,NULL,NULL,1,'2026-10-27 22:57:29','2026-10-27 22:57:29');
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;

--
-- Table structure for table `expenses`
--

DROP TABLE IF EXISTS `expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenses` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `date` date NOT NULL,
  `account_id` bigint(20) unsigned NOT NULL,
  `paid_through_id` bigint(20) unsigned DEFAULT NULL,
  `contact_id` bigint(20) unsigned DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `tax_id` bigint(20) unsigned DEFAULT NULL,
  `tax_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL,
  `reference` varchar(60) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `expenses_account_id_foreign` (`account_id`),
  KEY `expenses_paid_through_id_foreign` (`paid_through_id`),
  KEY `expenses_contact_id_foreign` (`contact_id`),
  KEY `expenses_tax_id_foreign` (`tax_id`),
  KEY `expenses_organization_id_date_index` (`organization_id`,`date`),
  CONSTRAINT `expenses_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`),
  CONSTRAINT `expenses_contact_id_foreign` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `expenses_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `expenses_paid_through_id_foreign` FOREIGN KEY (`paid_through_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `expenses_tax_id_foreign` FOREIGN KEY (`tax_id`) REFERENCES `taxes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenses`
--

/*!40000 ALTER TABLE `expenses` DISABLE KEYS */;
INSERT INTO `expenses` VALUES
(1,1,'2026-07-02',16,2,NULL,25000.00,NULL,0.00,25000.00,NULL,'Rent for Jul 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(2,1,'2026-08-02',16,2,NULL,25000.00,NULL,0.00,25000.00,NULL,'Rent for Aug 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(3,1,'2026-09-02',16,2,NULL,25000.00,NULL,0.00,25000.00,NULL,'Rent for Sep 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(4,1,'2026-10-02',16,2,NULL,25000.00,NULL,0.00,25000.00,NULL,'Rent for Oct 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(5,1,'2026-07-02',17,2,NULL,60000.00,NULL,0.00,60000.00,NULL,'Salaries & Wages for Jul 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(6,1,'2026-08-02',17,2,NULL,60000.00,NULL,0.00,60000.00,NULL,'Salaries & Wages for Aug 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(7,1,'2026-09-02',17,2,NULL,60000.00,NULL,0.00,60000.00,NULL,'Salaries & Wages for Sep 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(8,1,'2026-10-02',17,2,NULL,60000.00,NULL,0.00,60000.00,NULL,'Salaries & Wages for Oct 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(9,1,'2026-07-02',18,2,NULL,4200.00,NULL,0.00,4200.00,NULL,'Utilities for Jul 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(10,1,'2026-08-02',18,2,NULL,4200.00,NULL,0.00,4200.00,NULL,'Utilities for Aug 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(11,1,'2026-09-02',18,2,NULL,4200.00,NULL,0.00,4200.00,NULL,'Utilities for Sep 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(12,1,'2026-10-02',18,2,NULL,4200.00,NULL,0.00,4200.00,NULL,'Utilities for Oct 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(13,1,'2026-07-02',23,2,NULL,1800.00,NULL,0.00,1800.00,NULL,'Internet & Telephone for Jul 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(14,1,'2026-08-02',23,2,NULL,1800.00,NULL,0.00,1800.00,NULL,'Internet & Telephone for Aug 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(15,1,'2026-09-02',23,2,NULL,1800.00,NULL,0.00,1800.00,NULL,'Internet & Telephone for Sep 2026','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(16,1,'2026-10-02',23,2,NULL,1800.00,NULL,0.00,1800.00,NULL,'Internet & Telephone for Oct 2026','2026-10-27 22:57:29','2026-10-27 22:57:29');
/*!40000 ALTER TABLE `expenses` ENABLE KEYS */;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` varchar(255) NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `sku` varchar(60) DEFAULT NULL,
  `type` varchar(10) NOT NULL DEFAULT 'goods',
  `unit` varchar(20) NOT NULL DEFAULT 'pcs',
  `hsn_code` varchar(20) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `sales_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `purchase_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax_id` bigint(20) unsigned DEFAULT NULL,
  `track_inventory` tinyint(1) NOT NULL DEFAULT 0,
  `stock_on_hand` decimal(15,3) NOT NULL DEFAULT 0.000,
  `reorder_level` decimal(15,3) NOT NULL DEFAULT 0.000,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `items_tax_id_foreign` (`tax_id`),
  KEY `items_organization_id_name_index` (`organization_id`,`name`),
  KEY `items_organization_id_sku_index` (`organization_id`,`sku`),
  CONSTRAINT `items_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `items_tax_id_foreign` FOREIGN KEY (`tax_id`) REFERENCES `taxes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `items`
--

/*!40000 ALTER TABLE `items` DISABLE KEYS */;
INSERT INTO `items` VALUES
(1,1,'Wireless Mouse','WM-100','goods','pcs',NULL,'Products',NULL,650.00,420.00,4,1,96.000,5.000,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(2,1,'Mechanical Keyboard','KB-200','goods','pcs',NULL,'Products',NULL,2450.00,1700.00,4,1,61.000,5.000,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(3,1,'27\" LED Monitor','MN-270','goods','pcs',NULL,'Products',NULL,14500.00,11200.00,4,1,34.000,5.000,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(4,1,'A4 Paper Ream','PP-A4','goods','box',NULL,'Products',NULL,320.00,240.00,3,1,136.000,5.000,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(5,1,'Basmati Rice 5kg','RC-5K','goods','pack',NULL,'Products',NULL,540.00,430.00,2,1,48.000,5.000,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(6,1,'Annual Maintenance','SRV-AMC','service','nos',NULL,'Services',NULL,12000.00,0.00,4,0,0.000,0.000,1,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(7,1,'Installation Service','SRV-INS','service','hrs',NULL,'Services',NULL,800.00,0.00,4,0,0.000,0.000,1,'2026-10-27 22:57:29','2026-10-27 22:57:29');
/*!40000 ALTER TABLE `items` ENABLE KEYS */;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` smallint(5) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;

--
-- Table structure for table `journal_lines`
--

DROP TABLE IF EXISTS `journal_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `journal_lines` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `journal_id` bigint(20) unsigned NOT NULL,
  `account_id` bigint(20) unsigned NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `credit` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `journal_lines_journal_id_foreign` (`journal_id`),
  KEY `journal_lines_account_id_foreign` (`account_id`),
  CONSTRAINT `journal_lines_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`),
  CONSTRAINT `journal_lines_journal_id_foreign` FOREIGN KEY (`journal_id`) REFERENCES `journals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_lines`
--

/*!40000 ALTER TABLE `journal_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `journal_lines` ENABLE KEYS */;

--
-- Table structure for table `journals`
--

DROP TABLE IF EXISTS `journals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `journals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `number` varchar(40) NOT NULL,
  `date` date NOT NULL,
  `reference` varchar(60) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `journals_organization_id_number_unique` (`organization_id`,`number`),
  CONSTRAINT `journals_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journals`
--

/*!40000 ALTER TABLE `journals` DISABLE KEYS */;
/*!40000 ALTER TABLE `journals` ENABLE KEYS */;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES
(1,'0001_01_01_000000_create_users_table',1),
(2,'0001_01_01_000001_create_cache_table',1),
(3,'0001_01_01_000002_create_jobs_table',1),
(4,'2019_12_14_000001_create_personal_access_tokens_table',1),
(5,'2026_01_01_000100_create_accounting_tables',1),
(6,'2026_11_26_000100_add_pdf_template_to_organizations',1),
(7,'2026_11_27_000100_add_pdf_options_to_organizations',1);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;

--
-- Table structure for table `organizations`
--

DROP TABLE IF EXISTS `organizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `organizations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `industry` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) NOT NULL DEFAULT 'India',
  `pincode` varchar(20) DEFAULT NULL,
  `gstin` varchar(30) DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'INR',
  `currency_symbol` varchar(5) NOT NULL DEFAULT '₹',
  `fiscal_year_start` tinyint(3) unsigned NOT NULL DEFAULT 4,
  `date_format` varchar(20) NOT NULL DEFAULT 'dd/MM/yyyy',
  `invoice_terms` text DEFAULT NULL,
  `invoice_notes` text DEFAULT NULL,
  `pdf_template` varchar(20) NOT NULL DEFAULT 'classic',
  `pdf_accent` varchar(7) NOT NULL DEFAULT '#4f46e5',
  `pdf_footer` text DEFAULT NULL,
  `pdf_options` longtext DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organizations`
--

/*!40000 ALTER TABLE `organizations` DISABLE KEYS */;
INSERT INTO `organizations` VALUES
(1,'V-One Demo Traders','9876543210','accounts@vone.demo',NULL,'2nd Floor, MG Road','Kasaragod','Kerala','India','671121','32ABCDE1234F1Z5','INR','₹',4,'dd/MM/yyyy','Payment due within the agreed credit period. Thank you for your business!',NULL,'classic','#4f46e5',NULL,NULL,'2026-10-27 22:57:28','2026-10-27 22:57:28');
/*!40000 ALTER TABLE `organizations` ENABLE KEYS */;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `direction` varchar(3) NOT NULL,
  `number` varchar(40) NOT NULL,
  `contact_id` bigint(20) unsigned NOT NULL,
  `document_id` bigint(20) unsigned DEFAULT NULL,
  `account_id` bigint(20) unsigned DEFAULT NULL,
  `date` date NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `mode` varchar(20) NOT NULL DEFAULT 'cash',
  `reference` varchar(60) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payments_organization_id_direction_number_unique` (`organization_id`,`direction`,`number`),
  KEY `payments_contact_id_foreign` (`contact_id`),
  KEY `payments_document_id_foreign` (`document_id`),
  KEY `payments_account_id_foreign` (`account_id`),
  KEY `payments_organization_id_direction_date_index` (`organization_id`,`direction`,`date`),
  CONSTRAINT `payments_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payments_contact_id_foreign` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`),
  CONSTRAINT `payments_document_id_foreign` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payments_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES
(1,1,'in','PR-00001',3,1,NULL,'2026-05-14',46138.00,'upi',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(2,1,'in','PR-00002',1,2,NULL,'2026-05-21',15861.00,'cash',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(3,1,'in','PR-00003',2,3,NULL,'2026-05-28',944.00,'upi',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(4,1,'in','PR-00004',1,4,NULL,'2026-06-14',3776.00,'cash',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(5,1,'in','PR-00005',2,5,NULL,'2026-06-21',18602.40,'bank_transfer',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(6,1,'in','PR-00006',5,6,NULL,'2026-06-28',79381.00,'bank_transfer',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(7,1,'in','PR-00007',1,7,NULL,'2026-07-14',56807.00,'bank_transfer',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(8,1,'in','PR-00008',5,8,NULL,'2026-07-21',30170.80,'cash',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(9,1,'in','PR-00009',3,9,NULL,'2026-07-28',31270.00,'bank_transfer',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(10,1,'in','PR-00010',2,10,NULL,'2026-08-14',61124.00,'bank_transfer',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(11,1,'in','PR-00011',3,11,NULL,'2026-08-21',2268.00,'bank_transfer',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(12,1,'in','PR-00012',4,12,NULL,'2026-08-28',3013.40,'upi',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(13,1,'in','PR-00013',5,13,NULL,'2026-09-14',14160.00,'bank_transfer',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(14,1,'in','PR-00014',4,14,NULL,'2026-09-21',32404.00,'upi',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(15,1,'in','PR-00015',3,15,NULL,'2026-09-28',31447.00,'upi',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(16,1,'out','PM-00001',6,19,NULL,'2026-08-18',7203.00,'bank_transfer',NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;

--
-- Table structure for table `stock_movements`
--

DROP TABLE IF EXISTS `stock_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_movements` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `item_id` bigint(20) unsigned NOT NULL,
  `document_id` bigint(20) unsigned DEFAULT NULL,
  `type` varchar(20) NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `date` date NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `stock_movements_item_id_foreign` (`item_id`),
  KEY `stock_movements_document_id_foreign` (`document_id`),
  KEY `stock_movements_organization_id_item_id_index` (`organization_id`,`item_id`),
  CONSTRAINT `stock_movements_document_id_foreign` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_movements_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_movements_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_movements`
--

/*!40000 ALTER TABLE `stock_movements` DISABLE KEYS */;
INSERT INTO `stock_movements` VALUES
(1,1,1,NULL,'adjustment',90.000,'2026-04-27','Opening stock','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(2,1,2,NULL,'adjustment',60.000,'2026-04-27','Opening stock','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(3,1,3,NULL,'adjustment',40.000,'2026-04-27','Opening stock','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(4,1,4,NULL,'adjustment',120.000,'2026-04-27','Opening stock','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(5,1,5,NULL,'adjustment',60.000,'2026-04-27','Opening stock','2026-10-27 22:57:29','2026-10-27 22:57:29'),
(6,1,1,1,'invoice',-1.000,'2026-05-04',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(7,1,2,1,'invoice',-1.000,'2026-05-04',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(8,1,5,2,'invoice',-3.000,'2026-05-11',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(9,1,3,5,'invoice',-1.000,'2026-06-11',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(10,1,4,5,'invoice',-1.000,'2026-06-11',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(11,1,5,5,'invoice',-2.000,'2026-06-11',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(12,1,2,6,'invoice',-3.000,'2026-06-18',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(13,1,3,6,'invoice',-4.000,'2026-06-18',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(14,1,5,6,'invoice',-4.000,'2026-06-18',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(15,1,3,7,'invoice',-3.000,'2026-07-04',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(16,1,5,7,'invoice',-3.000,'2026-07-04',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(17,1,4,8,'invoice',-2.000,'2026-07-11',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(18,1,5,8,'invoice',-2.000,'2026-07-11',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(19,1,3,9,'invoice',-1.000,'2026-07-18',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(20,1,1,10,'invoice',-2.000,'2026-08-04',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(21,1,3,10,'invoice',-1.000,'2026-08-04',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(22,1,5,11,'invoice',-4.000,'2026-08-11',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(23,1,1,12,'invoice',-1.000,'2026-08-18',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(24,1,4,12,'invoice',-1.000,'2026-08-18',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(25,1,3,14,'invoice',-2.000,'2026-09-11',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(26,1,5,14,'invoice',-4.000,'2026-09-11',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(27,1,2,15,'invoice',-4.000,'2026-09-18',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(28,1,3,15,'invoice',-3.000,'2026-09-18',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(29,1,2,16,'invoice',-1.000,'2026-10-04',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(30,1,3,17,'invoice',-1.000,'2026-10-11',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(31,1,4,19,'bill',10.000,'2026-08-06',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(32,1,5,19,'bill',10.000,'2026-08-06',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(33,1,2,20,'bill',10.000,'2026-09-06',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(34,1,4,20,'bill',10.000,'2026-09-06',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(35,1,1,21,'bill',10.000,'2026-10-06',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29'),
(36,1,3,21,'bill',10.000,'2026-10-06',NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29');
/*!40000 ALTER TABLE `stock_movements` ENABLE KEYS */;

--
-- Table structure for table `taxes`
--

DROP TABLE IF EXISTS `taxes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  `rate` decimal(6,2) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'GST',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `taxes_organization_id_is_active_index` (`organization_id`,`is_active`),
  CONSTRAINT `taxes_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `taxes`
--

/*!40000 ALTER TABLE `taxes` DISABLE KEYS */;
INSERT INTO `taxes` VALUES
(1,1,'GST 0%',0.00,'GST',1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(2,1,'GST 5%',5.00,'GST',1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(3,1,'GST 12%',12.00,'GST',1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(4,1,'GST 18%',18.00,'GST',1,'2026-10-27 22:57:28','2026-10-27 22:57:28'),
(5,1,'GST 28%',28.00,'GST',1,'2026-10-27 22:57:28','2026-10-27 22:57:28');
/*!40000 ALTER TABLE `taxes` ENABLE KEYS */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'admin',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_phone_unique` (`phone`),
  KEY `users_organization_id_foreign` (`organization_id`),
  CONSTRAINT `users_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,1,'Admin','9876543210','admin@vone.demo','$2y$12$PdtMa06iCXEKx7mslcmHgugg87cF5aTIbz5obVwoO9i70WZf.Lr.i','admin',1,NULL,NULL,'2026-10-27 22:57:29','2026-10-27 22:57:29');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-27 17:27:29

-- ---------------------------------------------------------------
-- Billing features (same as upgrade-2026-11-billing-features.sql)
-- ---------------------------------------------------------------
DROP TABLE IF EXISTS `recurring_profiles`;
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
