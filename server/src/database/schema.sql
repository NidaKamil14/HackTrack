-- ==============================================================================
-- HackTrack Database Schema (MySQL 8.0+ / MariaDB)
-- Software Requirements Specification (SRS) v1.0 Compliant
-- PCCOE Hackathon Competition Management System
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `hacktrack_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `hacktrack_db`;

-- Drop existing tables in reverse dependency order if reconstructing
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `certificates`;
DROP TABLE IF EXISTS `evaluations`;
DROP TABLE IF EXISTS `judge_assignments`;
DROP TABLE IF EXISTS `submissions`;
DROP TABLE IF EXISTS `team_members`;
DROP TABLE IF EXISTS `teams`;
DROP TABLE IF EXISTS `evaluation_criteria`;
DROP TABLE IF EXISTS `announcements`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `hackathons`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------------------
-- 1. Users Table (FR-1, FR-2, FR-42, NFR-9)
-- ------------------------------------------------------------------------------
CREATE TABLE `users` (
  `id` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `role` ENUM('student', 'leader', 'judge', 'admin', 'screening', 'mentor', 'organizer') NOT NULL DEFAULT 'student',
  `role_category` VARCHAR(100) NULL,
  `university` VARCHAR(200) DEFAULT 'University / Organization',
  `member_id` VARCHAR(50) NULL,
  `reset_token` VARCHAR(255) NULL,
  `reset_token_expiry` DATETIME NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Hackathons Table (FR-6 to FR-11, FR-23, BR-4, BR-5)
-- ------------------------------------------------------------------------------
CREATE TABLE `hackathons` (
  `id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `tag_line` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `status` ENUM('draft', 'published', 'registration_closed', 'judging', 'completed') NOT NULL DEFAULT 'draft',
  `min_team_size` INT NOT NULL DEFAULT 1,
  `max_team_size` INT NOT NULL DEFAULT 4,
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME NOT NULL,
  `registration_deadline` DATETIME NOT NULL,
  `submission_deadline` DATETIME NOT NULL,
  `evaluation_deadline` DATETIME NULL,
  `has_screening_round` TINYINT(1) NOT NULL DEFAULT 0,
  `screening_rounds_count` INT NOT NULL DEFAULT 1,
  `has_mentorship` TINYINT(1) NOT NULL DEFAULT 0,
  `evaluation_workflow` ENUM('direct_judging', 'screening_first') NOT NULL DEFAULT 'direct_judging',
  `results_published` TINYINT(1) NOT NULL DEFAULT 0,
  `results_published_at` DATETIME NULL,
  `created_by` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_hackathons_status` (`status`),
  INDEX `idx_hackathons_deadlines` (`registration_deadline`, `submission_deadline`),
  CONSTRAINT `fk_hackathons_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Evaluation Criteria Table (FR-9, FR-22)
-- ------------------------------------------------------------------------------
CREATE TABLE `evaluation_criteria` (
  `id` VARCHAR(50) NOT NULL,
  `hackathon_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `max_score` INT NOT NULL DEFAULT 25,
  `weightage` DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_criteria_hackathon` (`hackathon_id`),
  CONSTRAINT `fk_criteria_hackathon` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Teams Table (FR-12, FR-13, BR-1)
-- ------------------------------------------------------------------------------
CREATE TABLE `teams` (
  `id` VARCHAR(50) NOT NULL,
  `hackathon_id` VARCHAR(50) NOT NULL,
  `leader_id` VARCHAR(50) NOT NULL,
  `team_name` VARCHAR(150) NOT NULL,
  `team_code` VARCHAR(30) NOT NULL,
  `track` VARCHAR(100) NULL,
  `status` ENUM('active', 'disqualified', 'withdrawn') NOT NULL DEFAULT 'active',
  `roster_locked` TINYINT(1) NOT NULL DEFAULT 0,
  `screening_status` ENUM('pending', 'shortlisted', 'rejected') NOT NULL DEFAULT 'pending',
  `mentor_id` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_teams_code` (`team_code`),
  INDEX `idx_teams_hackathon` (`hackathon_id`),
  INDEX `idx_teams_leader` (`leader_id`),
  CONSTRAINT `fk_teams_hackathon` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_teams_leader` FOREIGN KEY (`leader_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_teams_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. Team Members Table (FR-14, FR-15, FR-16, BR-2, BR-3)
-- ------------------------------------------------------------------------------
CREATE TABLE `team_members` (
  `id` VARCHAR(50) NOT NULL,
  `team_id` VARCHAR(50) NOT NULL,
  `hackathon_id` VARCHAR(50) NOT NULL,
  `user_id` VARCHAR(50) NOT NULL,
  `role` ENUM('leader', 'member') NOT NULL DEFAULT 'member',
  `status` ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  -- Enforce BR-2 / FR-16: A student may only join ONE team per hackathon
  UNIQUE KEY `idx_student_single_team_per_hackathon` (`hackathon_id`, `user_id`),
  INDEX `idx_team_members_team` (`team_id`),
  INDEX `idx_team_members_user` (`user_id`),
  CONSTRAINT `fk_tm_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tm_hackathon` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. Submissions Table (FR-17 to FR-21, BR-1, BR-8)
-- ------------------------------------------------------------------------------
CREATE TABLE `submissions` (
  `id` VARCHAR(50) NOT NULL,
  `hackathon_id` VARCHAR(50) NOT NULL,
  `team_id` VARCHAR(50) NOT NULL,
  `submitted_by` VARCHAR(50) NOT NULL,
  `project_title` VARCHAR(200) NOT NULL,
  `abstract` TEXT NOT NULL,
  `track` VARCHAR(100) NULL,
  `repo_url` VARCHAR(255) NULL,
  `demo_url` VARCHAR(255) NULL,
  `presentation_url` VARCHAR(255) NULL,
  `file_url` VARCHAR(255) NULL,
  `is_locked` TINYINT(1) NOT NULL DEFAULT 0,
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_submission_team` (`team_id`),
  INDEX `idx_submission_hackathon` (`hackathon_id`),
  CONSTRAINT `fk_sub_hackathon` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sub_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sub_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. Judge Assignments Table (FR-24, FR-25, BR-7)
-- ------------------------------------------------------------------------------
CREATE TABLE `judge_assignments` (
  `id` VARCHAR(50) NOT NULL,
  `hackathon_id` VARCHAR(50) NOT NULL,
  `judge_id` VARCHAR(50) NOT NULL,
  `submission_id` VARCHAR(50) NOT NULL,
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_judge_submission` (`judge_id`, `submission_id`),
  INDEX `idx_ja_hackathon` (`hackathon_id`),
  CONSTRAINT `fk_ja_hackathon` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ja_judge` FOREIGN KEY (`judge_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ja_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. Evaluations Table (FR-26, FR-27, BR-8)
-- ------------------------------------------------------------------------------
CREATE TABLE `evaluations` (
  `id` VARCHAR(50) NOT NULL,
  `hackathon_id` VARCHAR(50) NOT NULL,
  `submission_id` VARCHAR(50) NOT NULL,
  `judge_id` VARCHAR(50) NOT NULL,
  `criterion_id` VARCHAR(50) NOT NULL,
  `score` DECIMAL(5,2) NOT NULL,
  `remarks` TEXT NULL,
  `is_locked` TINYINT(1) NOT NULL DEFAULT 1,
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_eval_unique_criterion` (`submission_id`, `judge_id`, `criterion_id`),
  INDEX `idx_eval_hackathon` (`hackathon_id`),
  CONSTRAINT `fk_eval_hackathon` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_eval_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_eval_judge` FOREIGN KEY (`judge_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_eval_criterion` FOREIGN KEY (`criterion_id`) REFERENCES `evaluation_criteria` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. Certificates Table (FR-32 to FR-34)
-- ------------------------------------------------------------------------------
CREATE TABLE `certificates` (
  `id` VARCHAR(50) NOT NULL,
  `certificate_code` VARCHAR(60) NOT NULL,
  `hackathon_id` VARCHAR(50) NOT NULL,
  `user_id` VARCHAR(50) NOT NULL,
  `team_id` VARCHAR(50) NOT NULL,
  `certificate_type` ENUM('participation', 'winner', 'runner_up', 'top_shortlist') NOT NULL DEFAULT 'participation',
  `participant_name` VARCHAR(150) NOT NULL,
  `hackathon_title` VARCHAR(255) NOT NULL,
  `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `qr_payload` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_cert_code` (`certificate_code`),
  INDEX `idx_cert_user` (`user_id`),
  CONSTRAINT `fk_cert_hackathon` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cert_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cert_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. Notifications Table (FR-35 to FR-39)
-- ------------------------------------------------------------------------------
CREATE TABLE `notifications` (
  `id` VARCHAR(50) NOT NULL,
  `user_id` VARCHAR(50) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `email_sent` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_notif_user` (`user_id`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 11. Announcements Table (FR-46)
-- ------------------------------------------------------------------------------
CREATE TABLE `announcements` (
  `id` VARCHAR(50) NOT NULL,
  `hackathon_id` VARCHAR(50) NULL,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NOT NULL,
  `target_role` VARCHAR(50) NOT NULL DEFAULT 'all',
  `created_by` VARCHAR(50) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_announcements_hackathon` (`hackathon_id`),
  CONSTRAINT `fk_ann_hackathon` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ann_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 12. Hackathon Codes Table (Access code engine)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `hackathon_codes` (
  `id` VARCHAR(50) NOT NULL,
  `hackathon_id` VARCHAR(50) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `created_by` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `redeemed_by` JSON NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hackathon_codes_code` (`code`),
  CONSTRAINT `fk_hc_hackathon` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
