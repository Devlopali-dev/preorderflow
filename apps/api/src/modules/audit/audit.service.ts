import { Injectable } from "@nestjs/common";
import { prisma, AuditAction } from "@preorderflow/database";

@Injectable()
export class AuditService {
  async log(userId: string, action: AuditAction, entityType: string, entityId: string, metadata?: object) {
    await prisma.auditLog.create({
      data: { userId, action, entityType, entityId, metadata },
    });
  }

  async list(limit = 100) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
  }
}
