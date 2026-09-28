-- CreateTable
CREATE TABLE "notification_template_overrides" (
    "template" "NotificationTemplate" NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_template_overrides_pkey" PRIMARY KEY ("template")
);
