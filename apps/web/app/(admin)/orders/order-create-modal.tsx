"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { Campaign, CustomerSummary, Product } from "@/lib/api";
import { isArchivedCampaign } from "@/lib/campaign-status";
import { getClientAuthHeaders } from "@/lib/auth";
import { variantLabel } from "@/lib/variants";

const NEW_CUSTOMER = "__new__";

export function OrderCreateModal({
  apiUrl,
  products,
  customers,
  campaigns,
  onClose,
}: {
  apiUrl: string;
  products: Product[];
  customers: CustomerSummary[];
  campaigns: Campaign[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(NEW_CUSTOMER);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  // Une ligne de commande vise une variante (couleur) : « Stylo — Rouge ».
  const allOptions = products.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      label: variantLabel(product.name, variant.color),
      archived: !product.active || !variant.active,
    })),
  );
  // Les produits archivés restent visibles pour mémoire, en fin de liste, mais
  // ne se commandent plus.
  const variantOptions = allOptions.filter((option) => !option.archived);
  const archivedOptions = allOptions.filter((option) => option.archived);
  // Panier : variantId → quantité. Une variante absente n'est pas commandée.
  const [lines, setLines] = useState<Record<string, number>>({});
  const [address1, setAddress1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("FR");
  // Campagne d'origine, facultative : son lien de paiement servira au règlement.
  const [campaignId, setCampaignId] = useState("");
  const openCampaigns = campaigns.filter((campaign) => !isArchivedCampaign(campaign.status));
  // Campagne sans livraison : remise en main propre, ni adresse ni frais de port.
  const shippingDisabled =
    campaigns.find((campaign) => campaign.id === campaignId)?.shippingEnabled === false;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExistingCustomer = customerId !== NEW_CUSTOMER;
  const selectedItems = Object.entries(lines).map(([variantId, quantity]) => ({
    variantId,
    quantity,
  }));

  function setLineQuantity(id: string, value: number) {
    setLines((prev) => ({ ...prev, [id]: Math.max(1, Math.floor(value) || 1) }));
  }

  function removeLine(id: string) {
    setLines((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleSelectCustomer(e: ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setCustomerId(id);
    const customer = customers.find((c) => c.id === id);
    if (customer) {
      setCustomerEmail(customer.email);
      setCustomerFirstName(customer.firstName);
      setCustomerLastName(customer.lastName);
    } else {
      setCustomerEmail("");
      setCustomerFirstName("");
      setCustomerLastName("");
    }
  }

  async function handleCreate() {
    if (selectedItems.length === 0) {
      setError("Ajoutez au moins un produit à la commande.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // POST /orders retrouve le client par email (upsert côté API) — pas
      // besoin d'un customerId séparé, choisir un client existant revient
      // juste à préremplir ces champs avec ses infos réelles.
      const res = await fetch(`${apiUrl}/api/v1/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          customerEmail,
          customerFirstName,
          customerLastName,
          campaignId: campaignId || undefined,
          items: selectedItems,
          ...(shippingDisabled
            ? { deliveryMethod: "PICKUP" }
            : {
                shippingAddress: {
                  firstName: customerFirstName,
                  lastName: customerLastName,
                  address1,
                  postalCode,
                  city,
                  country,
                },
              }),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Nouvelle commande"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={saving} onClick={handleCreate}>
            Créer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Client
          <select className="select" value={customerId} onChange={handleSelectCustomer}>
            <option value={NEW_CUSTOMER}>Nouveau client</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.firstName} {customer.lastName} ({customer.email})
              </option>
            ))}
          </select>
        </label>
        {openCampaigns.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            Campagne (optionnel)
            <select
              className="select"
              value={campaignId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setCampaignId(e.target.value)}
            >
              <option value="">Aucune</option>
              {openCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Email du client
          <Input
            placeholder="Email du client"
            type="email"
            value={customerEmail}
            disabled={isExistingCustomer}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomerEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Prénom
          <Input
            placeholder="Prénom"
            value={customerFirstName}
            disabled={isExistingCustomer}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomerFirstName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nom
          <Input
            placeholder="Nom"
            value={customerLastName}
            disabled={isExistingCustomer}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomerLastName(e.target.value)}
          />
        </label>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1">Produits</legend>
          <ul className="flex max-h-56 flex-col divide-y overflow-y-auto rounded border">
            {variantOptions.map((option) => {
              const quantity = lines[option.id];
              return (
                <li key={option.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1">{option.label}</span>
                  {quantity === undefined ? (
                    <Button
                      variant="secondary"
                      onClick={() => setLineQuantity(option.id, 1)}
                      aria-label={`Ajouter ${option.label}`}
                    >
                      Ajouter
                    </Button>
                  ) : (
                    <>
                      <Input
                        type="number"
                        min={1}
                        className="w-20"
                        aria-label={`Quantité ${option.label}`}
                        value={quantity}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setLineQuantity(option.id, Number(e.target.value))
                        }
                      />
                      <Button
                        variant="secondary"
                        onClick={() => removeLine(option.id)}
                        aria-label={`Retirer ${option.label}`}
                      >
                        Retirer
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
            {archivedOptions.map((option) => (
              <li key={option.id} className="flex items-center gap-2 px-3 py-2 italic opacity-60">
                {option.label} (archivé)
              </li>
            ))}
          </ul>
        </fieldset>
        {shippingDisabled && (
          <p className="text-sm opacity-70" data-testid="shipping-disabled-note">
            La livraison n'est pas proposée pour cette campagne : remise en main propre, sans frais
            de port.
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm" hidden={shippingDisabled}>
          Adresse
          <Input
            placeholder="Adresse"
            value={address1}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAddress1(e.target.value)}
          />
        </label>
        <div className="flex gap-2" hidden={shippingDisabled}>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Code postal
            <Input
              placeholder="Code postal"
              value={postalCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPostalCode(e.target.value)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Ville
            <Input
              placeholder="Ville"
              value={city}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Pays
            <Input
              placeholder="Pays"
              value={country}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
