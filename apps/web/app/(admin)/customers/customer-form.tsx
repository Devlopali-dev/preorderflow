"use client";

import type { ChangeEvent } from "react";
import { Button, Input } from "@preorderflow/ui";
import type { CustomerDetail } from "@/lib/api";

// Toutes les informations d'un client : identité et carnet d'adresses. Le même
// formulaire sert à la création et à la modification.

export type AddressType = "BILLING" | "SHIPPING";

export interface AddressFormValue {
  id?: string;
  type: AddressType;
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
}

export interface CustomerFormValue {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  addresses: AddressFormValue[];
}

const MAX_ADDRESSES = 10;

export const EMPTY_CUSTOMER: CustomerFormValue = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  addresses: [],
};

export function emptyAddress(
  type: AddressType,
  identity: { firstName: string; lastName: string },
): AddressFormValue {
  return {
    type,
    firstName: identity.firstName,
    lastName: identity.lastName,
    company: "",
    address1: "",
    address2: "",
    postalCode: "",
    city: "",
    country: "FR",
    phone: "",
  };
}

export function customerToFormValue(customer: CustomerDetail): CustomerFormValue {
  return {
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone ?? "",
    addresses: customer.addresses.map((address) => ({
      id: address.id,
      type: address.type,
      firstName: address.firstName,
      lastName: address.lastName,
      company: address.company ?? "",
      address1: address.address1,
      address2: address.address2 ?? "",
      postalCode: address.postalCode,
      city: address.city,
      country: address.country,
      phone: address.phone ?? "",
    })),
  };
}

// Corps envoyé à l'API. Les champs optionnels vides partent en chaîne vide :
// l'API les enregistre à null. `id` n'est envoyé que pour une adresse existante.
export function toCustomerPayload(value: CustomerFormValue) {
  return {
    email: value.email.trim(),
    firstName: value.firstName.trim(),
    lastName: value.lastName.trim(),
    phone: value.phone.trim(),
    addresses: value.addresses.map(({ id, ...address }) => (id ? { id, ...address } : address)),
  };
}

export const ADDRESS_TYPE_LABEL: Record<AddressType, string> = {
  BILLING: "Facturation",
  SHIPPING: "Livraison",
};

export function CustomerForm({
  value,
  onChange,
}: {
  value: CustomerFormValue;
  onChange: (value: CustomerFormValue) => void;
}) {
  function setField(field: "email" | "firstName" | "lastName" | "phone", next: string) {
    onChange({ ...value, [field]: next });
  }

  function setAddress(index: number, patch: Partial<AddressFormValue>) {
    onChange({
      ...value,
      addresses: value.addresses.map((address, i) =>
        i === index ? { ...address, ...patch } : address,
      ),
    });
  }

  function addAddress() {
    const used = new Set(value.addresses.map((address) => address.type));
    // On propose d'abord le type qui manque : facturation, puis livraison.
    const type: AddressType = !used.has("BILLING") ? "BILLING" : "SHIPPING";
    onChange({ ...value, addresses: [...value.addresses, emptyAddress(type, value)] });
  }

  function removeAddress(index: number) {
    onChange({ ...value, addresses: value.addresses.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <Input
          placeholder="Email"
          type="email"
          value={value.email}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setField("email", e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Prénom
          <Input
            placeholder="Prénom"
            value={value.firstName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField("firstName", e.target.value)}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Nom
          <Input
            placeholder="Nom"
            value={value.lastName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField("lastName", e.target.value)}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Téléphone
        <Input
          placeholder="Téléphone"
          value={value.phone}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setField("phone", e.target.value)}
        />
      </label>

      {value.addresses.map((address, index) => (
        <fieldset
          key={address.id ?? `new-${index}`}
          className="flex flex-col gap-2 rounded border p-3 text-sm"
        >
          <legend className="px-1 font-medium">Adresse {index + 1}</legend>
          <label className="flex flex-col gap-1">
            Type
            <select
              className="select"
              value={address.type}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setAddress(index, { type: e.target.value as AddressType })
              }
            >
              <option value="BILLING">{ADDRESS_TYPE_LABEL.BILLING}</option>
              <option value="SHIPPING">{ADDRESS_TYPE_LABEL.SHIPPING}</option>
            </select>
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              Prénom
              <Input
                value={address.firstName}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setAddress(index, { firstName: e.target.value })
                }
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              Nom
              <Input
                value={address.lastName}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setAddress(index, { lastName: e.target.value })
                }
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            Société (optionnel)
            <Input
              value={address.company}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setAddress(index, { company: e.target.value })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            Adresse
            <Input
              value={address.address1}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setAddress(index, { address1: e.target.value })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            Complément (optionnel)
            <Input
              value={address.address2}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setAddress(index, { address2: e.target.value })
              }
            />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              Code postal
              <Input
                value={address.postalCode}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setAddress(index, { postalCode: e.target.value })
                }
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              Ville
              <Input
                value={address.city}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setAddress(index, { city: e.target.value })
                }
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              Pays
              <Input
                value={address.country}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setAddress(index, { country: e.target.value })
                }
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            Téléphone de livraison (optionnel)
            <Input
              value={address.phone}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setAddress(index, { phone: e.target.value })
              }
            />
          </label>
          <div>
            <Button variant="danger" onClick={() => removeAddress(index)}>
              Retirer l&apos;adresse {index + 1}
            </Button>
          </div>
        </fieldset>
      ))}

      <div>
        <Button
          variant="secondary"
          disabled={value.addresses.length >= MAX_ADDRESSES}
          onClick={addAddress}
        >
          Ajouter une adresse
        </Button>
      </div>
    </div>
  );
}
