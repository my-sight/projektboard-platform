-- CreateEnum
-- Role ENUM is created inline in table definitions for MySQL
-- SubColumnName ENUM is created inline as well

CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `role` ENUM('ADMIN', 'OWNER', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Board` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `settingsJson` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Board_ownerId_idx`(`ownerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BoardPhase` (
  `id` VARCHAR(191) NOT NULL,
  `boardId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `displayOrder` INTEGER NOT NULL,
  `checklistTemplateJson` JSON NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BoardPhase_boardId_displayOrder_key`(`boardId`, `displayOrder`),
  INDEX `BoardPhase_boardId_idx`(`boardId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProjectCard` (
  `id` VARCHAR(191) NOT NULL,
  `boardId` VARCHAR(191) NOT NULL,
  `phaseId` VARCHAR(191) NOT NULL,
  `number` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `position` DOUBLE NOT NULL DEFAULT 0,
  `statusDot` VARCHAR(191) NOT NULL DEFAULT 'green',
  `batchSK` BOOLEAN NOT NULL DEFAULT false,
  `batchLK` BOOLEAN NOT NULL DEFAULT false,
  `statusShort` VARCHAR(191) NOT NULL DEFAULT '',
  `phaseTargetDate` DATE NULL,
  `imageUrl` LONGTEXT NULL,
  `sop` LONGTEXT NULL,
  `trDate` DATE NULL,
  `trPlanDates` JSON NOT NULL,
  `trActualDate` DATE NULL,
  `projectOwnerId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ProjectCard_boardId_number_key`(`boardId`, `number`),
  INDEX `ProjectCard_phaseId_idx`(`phaseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProjectStatusEntry` (
  `id` VARCHAR(191) NOT NULL,
  `projectCardId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `summary` LONGTEXT NOT NULL,
  `quality` VARCHAR(191) NOT NULL,
  `cost` VARCHAR(191) NOT NULL,
  `schedule` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ProjectStatusEntry_projectCardId_idx`(`projectCardId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProjectTeamMember` (
  `id` VARCHAR(191) NOT NULL,
  `projectCardId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `displayName` VARCHAR(191) NOT NULL,
  `roleText` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  INDEX `ProjectTeamMember_projectCardId_idx`(`projectCardId`),
  INDEX `ProjectTeamMember_userId_idx`(`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubBoard` (
  `id` VARCHAR(191) NOT NULL,
  `projectCardId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SubBoard_projectCardId_key`(`projectCardId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubLane` (
  `id` VARCHAR(191) NOT NULL,
  `subBoardId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `displayName` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `SubLane_subBoardId_idx`(`subBoardId`),
  INDEX `SubLane_userId_idx`(`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubColumn` (
  `id` VARCHAR(191) NOT NULL,
  `subBoardId` VARCHAR(191) NOT NULL,
  `name` ENUM('WAIT', 'USER', 'NEXT_FLOW', 'FLOW', 'DONE') NOT NULL,
  `order` INTEGER NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SubColumn_subBoardId_name_key`(`subBoardId`, `name`),
  INDEX `SubColumn_subBoardId_idx`(`subBoardId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubTaskCard` (
  `id` VARCHAR(191) NOT NULL,
  `subBoardId` VARCHAR(191) NOT NULL,
  `laneId` VARCHAR(191) NOT NULL,
  `columnId` VARCHAR(191) NOT NULL,
  `text` VARCHAR(191) NOT NULL,
  `planDate` DATE NULL,
  `statusDot` VARCHAR(191) NOT NULL DEFAULT 'green',
  `projectNumberBadge` VARCHAR(191) NULL,
  `archivedAt` DATETIME(3) NULL,
  `sortOrder` DOUBLE NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `SubTaskCard_laneId_idx`(`laneId`),
  INDEX `SubTaskCard_columnId_idx`(`columnId`),
  INDEX `SubTaskCard_subBoardId_idx`(`subBoardId`),
  INDEX `SubTaskCard_archivedAt_idx`(`archivedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Board` ADD CONSTRAINT `Board_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BoardPhase` ADD CONSTRAINT `BoardPhase_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `Board`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProjectCard` ADD CONSTRAINT `ProjectCard_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `Board`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProjectCard` ADD CONSTRAINT `ProjectCard_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `BoardPhase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProjectCard` ADD CONSTRAINT `ProjectCard_projectOwnerId_fkey` FOREIGN KEY (`projectOwnerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ProjectStatusEntry` ADD CONSTRAINT `ProjectStatusEntry_projectCardId_fkey` FOREIGN KEY (`projectCardId`) REFERENCES `ProjectCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProjectTeamMember` ADD CONSTRAINT `ProjectTeamMember_projectCardId_fkey` FOREIGN KEY (`projectCardId`) REFERENCES `ProjectCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProjectTeamMember` ADD CONSTRAINT `ProjectTeamMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SubBoard` ADD CONSTRAINT `SubBoard_projectCardId_fkey` FOREIGN KEY (`projectCardId`) REFERENCES `ProjectCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SubLane` ADD CONSTRAINT `SubLane_subBoardId_fkey` FOREIGN KEY (`subBoardId`) REFERENCES `SubBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SubLane` ADD CONSTRAINT `SubLane_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SubColumn` ADD CONSTRAINT `SubColumn_subBoardId_fkey` FOREIGN KEY (`subBoardId`) REFERENCES `SubBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SubTaskCard` ADD CONSTRAINT `SubTaskCard_subBoardId_fkey` FOREIGN KEY (`subBoardId`) REFERENCES `SubBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SubTaskCard` ADD CONSTRAINT `SubTaskCard_laneId_fkey` FOREIGN KEY (`laneId`) REFERENCES `SubLane`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SubTaskCard` ADD CONSTRAINT `SubTaskCard_columnId_fkey` FOREIGN KEY (`columnId`) REFERENCES `SubColumn`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
