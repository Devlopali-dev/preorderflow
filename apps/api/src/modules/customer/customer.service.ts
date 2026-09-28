import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CreateCustomerDto } from "./dto/create-customer.dto";

@Injectable()
export class CustomerService {
  async list() {
    return prisma.customer.findMany({ orderBy: { createdAt: "desc" } });
  }

  async create(dto: CreateCustomerDto) {
    const existing = await prisma.customer.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException(`Un client existe déjà avec l'email "${dto.email}"`);
    }
    return prisma.customer.create({ data: dto });
  }

  async getById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { addresses: true, orders: true },
    });
    if (!customer) {
      throw new NotFoundException(`Client "${id}" introuvable`);
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.getById(id);
    return prisma.customer.update({ where: { id }, data: dto });
  }

  /**
   * Export RGPD (§24) : toutes les données personnelles détenues sur ce
   * client, dans un seul document — profil, adresses, intérêts de
   * recensement, commandes. Rien n'est recalculé côté client : c'est un
   * export brut de ce qui est stocké.
   */
  async exportData(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        interests: { include: { campaign: { select: { name: true, slug: true } } } },
        orders: {
          include: {
            items: { include: { product: { select: { name: true, sku: true } } } },
            payments: true,
            shipment: true,
          },
        },
      },
    });
    if (!customer) {
      throw new NotFoundException(`Client "${id}" introuvable`);
    }
    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        createdAt: customer.createdAt,
      },
      addresses: customer.addresses,
      interests: customer.interests,
      orders: customer.orders,
    };
  }

  /**
   * Anonymisation RGPD (§24) : efface les données personnelles identifiantes
   * du profil, des adresses et des intérêts de recensement — mais jamais
   * les commandes elles-mêmes, dont le snapshot d'adresse est un document
   * comptable à conserver indépendamment de l'identité du client (§24 :
   * "les données du recensement doivent pouvoir être supprimées/anonymisées
   * indépendamment des commandes" — l'inverse aussi : les commandes
   * survivent à l'anonymisation du client).
   */
  async anonymize(id: string) {
    await this.getById(id);

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id },
        data: {
          email: `anonymise-${id}@anonymise.invalid`,
          firstName: "Anonymisé",
          lastName: "Anonymisé",
          phone: null,
        },
      });

      await tx.address.updateMany({
        where: { customerId: id },
        data: {
          firstName: "Anonymisé",
          lastName: "Anonymisé",
          company: null,
          address1: "Anonymisé",
          address2: null,
          phone: null,
        },
      });

      await tx.campaignInterest.updateMany({
        where: { customerId: id },
        data: {
          email: `anonymise-${id}@anonymise.invalid`,
          firstName: "Anonymisé",
          lastName: "Anonymisé",
          phone: null,
          comment: null,
          consentToContact: false,
        },
      });

      return customer;
    });
  }
}
