import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { CreateColorDto, UpdateColorDto } from "./dto/color.dto";

// Palette globale. Une couleur se supprime tant qu'aucune variante de produit
// ne l'utilise ; sinon on la désactive (elle reste visible, marquée inactive).
@Injectable()
export class ColorService {
  async list() {
    return prisma.color.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { variants: true } } },
    });
  }

  async create(dto: CreateColorDto) {
    await this.assertNameAvailable(dto.name);
    return prisma.color.create({ data: { name: dto.name.trim(), hex: dto.hex.toLowerCase() } });
  }

  async update(id: string, dto: UpdateColorDto) {
    const color = await prisma.color.findUnique({ where: { id } });
    if (!color) {
      throw new NotFoundException(`Couleur "${id}" introuvable`);
    }
    if (dto.name !== undefined && dto.name.trim().toLowerCase() !== color.name.toLowerCase()) {
      await this.assertNameAvailable(dto.name);
    }
    return prisma.color.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        hex: dto.hex?.toLowerCase(),
        active: dto.active,
      },
    });
  }

  // Refuse si une variante (même inactive) référence la couleur : elle porte
  // du stock, des commandes ou des intérêts qu'on ne doit pas orpheliner.
  async remove(id: string) {
    const color = await prisma.color.findUnique({
      where: { id },
      include: { _count: { select: { variants: true } } },
    });
    if (!color) {
      throw new NotFoundException(`Couleur "${id}" introuvable`);
    }
    if (color._count.variants > 0) {
      throw new BadRequestException(
        `La couleur "${color.name}" est utilisée par ${color._count.variants} variante(s) de produit : désactivez-la plutôt que de la supprimer.`,
      );
    }
    await prisma.color.delete({ where: { id } });
    return { id: color.id, name: color.name };
  }

  // Unicité insensible à la casse : « Rouge » et « rouge » sont la même
  // couleur pour l'admin, même si l'index unique Postgres les distingue.
  private async assertNameAvailable(name: string) {
    const existing = await prisma.color.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(`La couleur "${name.trim()}" existe déjà`);
    }
  }
}
