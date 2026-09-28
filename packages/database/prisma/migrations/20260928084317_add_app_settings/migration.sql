-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'SETTINGS_UPDATED';

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "emailProvider" TEXT,
    "resendApiKey" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "smtpUser" TEXT,
    "smtpPassword" TEXT,
    "emailFrom" TEXT,
    "ntfyUrl" TEXT,
    "ntfyTopic" TEXT,
    "ntfyAuth" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
