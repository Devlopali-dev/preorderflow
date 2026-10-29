-- Message groupé aux clients depuis la liste des commandes.
ALTER TYPE "NotificationTemplate" ADD VALUE 'BULK_MESSAGE';
ALTER TYPE "AuditAction" ADD VALUE 'ORDERS_BULK_MESSAGE_SENT';
