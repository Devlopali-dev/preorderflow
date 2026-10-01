import { Injectable } from "@nestjs/common";
import { AdminRole, prisma } from "@preorderflow/database";

// Vérifie qu'un jeton admin désigne toujours un compte utilisable. Un jeton ne
// prouve que « ce compte existait et avait ce rôle quand il a été émis » : après
// une réinitialisation de la base, une désactivation ou un changement de rôle,
// la base reste la seule source de vérité (CLAUDE.md §26).
@Injectable()
export class AdminSessionService {
  async findActive(id: string): Promise<{ id: string; role: AdminRole } | null> {
    return prisma.adminUser.findFirst({
      where: { id, active: true },
      select: { id: true, role: true },
    });
  }
}
