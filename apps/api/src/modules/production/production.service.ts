import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { CompleteProductionBatchDto, CreateProductionBatchDto } from "./dto/create-production-batch.dto";
import {
  assertValidProductionTransition,
  computeCompletionStatus,
  InvalidProductionTransitionError,
} from "./production-status";

@Injectable()
export class ProductionService {
  async list() {
    return prisma.productionBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: true } } },
    });
  }

  async getById(id: string) {
    const batch = await prisma.productionBatch.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!batch) {
      throw new NotFoundException(`Lot de production "${id}" introuvable`);
    }
    return batch;
  }

  async create(dto: CreateProductionBatchDto) {
    return prisma.productionBatch.create({
      data: {
        reference: dto.reference,
        notes: dto.notes,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            quantityPlanned: item.quantityPlanned,
          })),
        },
      },
      include: { items: true },
    });
  }

  async start(id: string) {
    const batch = await this.getById(id);
    this.assertTransition(batch.status, "IN_PROGRESS");
    return prisma.productionBatch.update({
      where: { id: batch.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
  }

  /**
   * Complète (ou complète partiellement) un lot : enregistre les quantités
   * produites et crée les mouvements de stock correspondants dans la même
   * transaction (§12 du cahier des charges — jamais l'un sans l'autre).
   */
  async complete(id: string, dto: CompleteProductionBatchDto) {
    const batch = await this.getById(id);

    const itemIds = new Set(batch.items.map((i) => i.id));
    for (const line of dto.items) {
      if (!itemIds.has(line.productionItemId)) {
        throw new BadRequestException(`Ligne de production "${line.productionItemId}" introuvable`);
      }
    }

    const updatedItems = batch.items.map((item) => {
      const line = dto.items.find((l) => l.productionItemId === item.id);
      const newQuantityProduced = line ? line.quantityProduced : item.quantityProduced;
      return {
        ...item,
        previousQuantityProduced: item.quantityProduced,
        quantityProduced: newQuantityProduced,
        delta: newQuantityProduced - item.quantityProduced,
      };
    });

    if (updatedItems.some((item) => item.delta < 0)) {
      throw new BadRequestException(
        "La quantité produite ne peut pas être inférieure à ce qui a déjà été enregistré",
      );
    }

    const finalStatus = computeCompletionStatus(updatedItems);
    this.assertTransition(batch.status, finalStatus);

    return prisma.$transaction(async (tx) => {
      for (const item of updatedItems) {
        await tx.productionItem.update({
          where: { id: item.id },
          data: { quantityProduced: item.quantityProduced },
        });
        // Un seul mouvement de stock pour le delta réellement nouveau —
        // évite de recompter une quantité déjà mouvementée lors d'un
        // premier passage en PARTIALLY_COMPLETED.
        if (item.delta > 0) {
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              quantity: item.delta,
              type: "PRODUCTION",
              referenceType: "PRODUCTION_BATCH",
              referenceId: batch.id,
              reason: `Production ${batch.reference}`,
            },
          });
        }
      }

      return tx.productionBatch.update({
        where: { id: batch.id },
        data: { status: finalStatus, completedAt: new Date() },
        include: { items: true },
      });
    });
  }

  private assertTransition(
    from: Parameters<typeof assertValidProductionTransition>[0],
    to: Parameters<typeof assertValidProductionTransition>[1],
  ) {
    try {
      assertValidProductionTransition(from, to);
    } catch (error) {
      if (error instanceof InvalidProductionTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
