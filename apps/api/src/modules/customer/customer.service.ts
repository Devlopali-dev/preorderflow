import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@preorderflow/database";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { CustomerAddressDto } from "./dto/customer-address.dto";

// Un champ optionnel vide (chaîne vide ou espaces) est stocké à null.
function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Les champs d'une adresse, prêts à écrire (hors `id`, jamais pris du client).
function addressData(address: CustomerAddressDto) {
  return {
    type: address.type,
    firstName: address.firstName.trim(),
    lastName: address.lastName.trim(),
    company: emptyToNull(address.company),
    address1: address.address1.trim(),
    address2: emptyToNull(address.address2),
    postalCode: address.postalCode.trim(),
    city: address.city.trim(),
    country: address.country.trim(),
    phone: emptyToNull(address.phone),
  };
}

// Suffixe d'email d'un client anonymisé (cf. anonymize) : plus aucune donnée
// personnelle à modifier, et surtout pas de nouvelle à ajouter.
const ANONYMIZED_EMAIL_SUFFIX = "@anonymise.invalid";

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
    return prisma.customer.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: emptyToNull(dto.phone),
        addresses: { create: (dto.addresses ?? []).map(addressData) },
      },
      include: { addresses: true },
    });
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

  // Met à jour toutes les informations du client. Si `addresses` est fourni, le
  // carnet est synchronisé dans une seule transaction : adresses avec `id`
  // mises à jour, sans `id` créées, absentes supprimées (les commandes gardent
  // un instantané JSON de leurs adresses, aucune n'y fait référence).
  async update(id: string, dto: UpdateCustomerDto) {
    const customer = await this.getById(id);
    if (customer.email.endsWith(ANONYMIZED_EMAIL_SUFFIX)) {
      throw new BadRequestException(
        "Ce client est anonymisé : ses informations ne sont plus modifiables",
      );
    }

    if (dto.email !== undefined && dto.email.toLowerCase() !== customer.email.toLowerCase()) {
      const clash = await prisma.customer.findUnique({ where: { email: dto.email } });
      if (clash) {
        throw new BadRequestException(`Un client existe déjà avec l'email "${dto.email}"`);
      }
    }

    const keptAddresses = (dto.addresses ?? []).filter((address) => address.id);
    const ownAddressIds = new Set(customer.addresses.map((address) => address.id));
    if (keptAddresses.some((address) => !ownAddressIds.has(address.id!))) {
      throw new BadRequestException("Une adresse n'appartient pas à ce client");
    }

    return prisma.$transaction(async (tx) => {
      if (dto.addresses) {
        await tx.address.deleteMany({
          where: { customerId: id, id: { notIn: keptAddresses.map((address) => address.id!) } },
        });
        for (const address of keptAddresses) {
          await tx.address.update({ where: { id: address.id! }, data: addressData(address) });
        }
        for (const address of dto.addresses.filter((a) => !a.id)) {
          await tx.address.create({ data: { customerId: id, ...addressData(address) } });
        }
      }

      return tx.customer.update({
        where: { id },
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone === undefined ? undefined : emptyToNull(dto.phone),
        },
        include: { addresses: true },
      });
    });
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
        interests: {
          include: {
            campaign: { select: { name: true, slug: true } },
            items: {
              include: { variant: { select: { sku: true, color: { select: { name: true } } } } },
            },
          },
        },
        orders: {
          include: {
            items: {
              include: {
                variant: {
                  select: {
                    sku: true,
                    color: { select: { name: true } },
                    product: { select: { name: true } },
                  },
                },
              },
            },
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
