"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@preorderflow/ui";
import type { Product } from "@/lib/api";
import { ConfirmModal } from "@/components/confirm-modal";
import { CampaignPaymentLinkField } from "@/components/campaign-payment-link-field";
import { CampaignShippingField } from "@/components/campaign-shipping-field";
import { getClientAuthHeaders } from "@/lib/auth";
import { slugify } from "@/lib/slugify";

// Même limite que la modale d'édition : 5 aperçus (images + PDF) par campagne.
const MAX_MEDIA = 5;

async function failure(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null);
  return new Error(body?.message?.toString() ?? `Erreur (${res.status})`);
}

export function CampaignCreateModal({
  apiUrl,
  products,
  onClose,
}: {
  apiUrl: string;
  products: Product[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Tant que le slug n'a pas été modifié à la main, il suit le nom.
  const [slugEdited, setSlugEdited] = useState(false);

  // Produits archivés : proposés en fin de liste, marqués « archivé », et leur
  // choix demande de confirmer la réactivation du produit.
  const [reactivatedIds, setReactivatedIds] = useState<string[]>([]);
  const isActive = (product: Product) => product.active || reactivatedIds.includes(product.id);
  const orderedProducts = [
    ...products.filter((product) => isActive(product)),
    ...products.filter((product) => !isActive(product)),
  ];
  const [productId, setProductId] = useState(products.find((p) => p.active)?.id ?? "");
  const [archivedToConfirm, setArchivedToConfirm] = useState<Product | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [shippingEnabled, setShippingEnabled] = useState(true);
  const [images, setImages] = useState<File[]>([]);
  const [pdf, setPdf] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La création se fait en plusieurs appels (campagne, images, PDF). On garde ce
  // qui est déjà fait : un nouvel essai après un échec partiel reprend où il
  // s'est arrêté au lieu de créer un doublon.
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState(0);
  const [pdfUploaded, setPdfUploaded] = useState(false);

  const mediaCount = images.length + (pdf ? 1 : 0);

  // Aperçus des images choisies : des URL locales, libérées dès que la liste change.
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  // Un seul champ pour les images et le PDF. Au plus 5 aperçus (images + PDF) dont un seul
  // PDF : les fichiers en trop sont écartés, avec un message.
  function handlePickFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const isPdf = (file: File) => file.type === "application/pdf";
    const pickedPdfs = picked.filter(isPdf);
    const pickedImages = picked.filter((file) => !isPdf(file));

    const newPdf = pdf ? null : (pickedPdfs[0] ?? null);
    const room = MAX_MEDIA - mediaCount - (newPdf ? 1 : 0);
    const keptImages = pickedImages.slice(0, Math.max(0, room));

    if (newPdf) setPdf(newPdf);
    if (keptImages.length > 0) setImages((current) => [...current, ...keptImages]);

    const extraPdfs = pickedPdfs.length - (newPdf ? 1 : 0);
    if (extraPdfs > 0) {
      setError("Une campagne accepte un seul PDF : les PDF en trop ont été écartés.");
    } else if (pickedImages.length > keptImages.length) {
      setError(
        `Une campagne accepte ${MAX_MEDIA} aperçus au maximum (images et PDF) : les fichiers en trop ont été écartés.`,
      );
    } else {
      setError(null);
    }
  }

  function handleSelectProduct(e: ChangeEvent<HTMLSelectElement>) {
    const product = products.find((p) => p.id === e.target.value);
    if (product && !isActive(product)) {
      setArchivedToConfirm(product);
      return;
    }
    setProductId(e.target.value);
  }

  async function handleReactivateProduct() {
    if (!archivedToConfirm) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/products/${archivedToConfirm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({ active: true }),
      });
      if (!res.ok) throw await failure(res);
      setReactivatedIds((current) => [...current, archivedToConfirm.id]);
      setProductId(archivedToConfirm.id);
      setArchivedToConfirm(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setArchivedToConfirm(null);
    } finally {
      setSaving(false);
    }
  }

  async function upload(campaignId: string, endpoint: "photo" | "document", file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaignId}/${endpoint}`, {
      method: "POST",
      headers: { ...getClientAuthHeaders() },
      body: formData,
    });
    if (!res.ok) throw await failure(res);
  }

  async function handleCreate() {
    setError(null);
    if (!productId) {
      setError("Choisissez un produit.");
      return;
    }
    if (images.length + (pdf ? 1 : 0) > MAX_MEDIA) {
      setError(`Une campagne accepte ${MAX_MEDIA} aperçus au maximum (images et PDF).`);
      return;
    }

    setSaving(true);
    let campaignId = createdCampaignId;
    try {
      if (!campaignId) {
        const res = await fetch(`${apiUrl}/api/v1/campaigns`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
          body: JSON.stringify({
            name,
            slug,
            productId,
            paymentLink: paymentLink.trim() || undefined,
            shippingEnabled,
            startDate: startDate ? new Date(startDate).toISOString() : undefined,
            endDate: endDate ? new Date(endDate).toISOString() : undefined,
          }),
        });
        if (!res.ok) throw await failure(res);
        campaignId = (await res.json()).id as string;
        setCreatedCampaignId(campaignId);
      }

      for (let index = uploadedImages; index < images.length; index += 1) {
        await upload(campaignId, "photo", images[index]!);
        setUploadedImages(index + 1);
      }
      if (pdf && !pdfUploaded) {
        await upload(campaignId, "document", pdf);
        setPdfUploaded(true);
      }

      onClose();
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      if (campaignId) {
        // La campagne existe déjà : la liste doit la montrer, et un nouvel essai
        // terminera les envois restants.
        setError(`Campagne créée, mais un envoi a échoué : ${message}. Réessayez pour terminer.`);
        router.refresh();
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  const created = Boolean(createdCampaignId);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Nouvelle campagne"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {created ? "Fermer" : "Annuler"}
          </Button>
          <Button variant="primary" loading={saving} onClick={handleCreate}>
            {created ? "Réessayer" : "Créer"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Nom
          <Input
            placeholder="Nom"
            value={name}
            disabled={created}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Slug
          <Input
            placeholder="Slug"
            value={slug}
            disabled={created}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Produit
          <select
            className="select"
            value={productId}
            disabled={created}
            onChange={handleSelectProduct}
          >
            {productId === "" && (
              <option value="" disabled>
                Choisir un produit…
              </option>
            )}
            {orderedProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {isActive(product) ? product.name : `${product.name} (archivé)`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Début
          <Input
            type="date"
            value={startDate}
            disabled={created}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Fin (deadline)
          <Input
            type="date"
            value={endDate}
            disabled={created}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
          />
        </label>
        <p className="form-hint">
          Le statut passe automatiquement à « commandes ouvertes » à la date de début, et à «
          commandes fermées » après la date de fin (incluse).
        </p>
        <CampaignPaymentLinkField
          value={paymentLink}
          onChange={setPaymentLink}
          disabled={created}
        />
        <CampaignShippingField
          checked={shippingEnabled}
          onChange={setShippingEnabled}
          disabled={created}
        />
        <div className="flex flex-col gap-2 text-sm">
          <span className="form-label">
            Aperçus ({images.length + (pdf ? 1 : 0)}/{MAX_MEDIA})
          </span>
          <label className="flex flex-col gap-1">
            <span className="form-label">Ajouter une image ou un PDF</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={created || mediaCount >= MAX_MEDIA}
              onChange={handlePickFiles}
            />
          </label>
          {mediaCount > 0 && (
            // Petits aperçus sur une seule ligne, bouton Retirer dessous (comme pour un produit).
            <ul className="flex flex-nowrap gap-3">
              {images.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex flex-col items-center gap-1">
                  <img
                    src={previewUrls[index]}
                    alt={`Aperçu ${file.name}`}
                    className="h-20 w-20 rounded object-cover"
                  />
                  <Button
                    variant="secondary"
                    disabled={index < uploadedImages}
                    aria-label={`Retirer l'image ${file.name}`}
                    onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                  >
                    Retirer
                  </Button>
                </li>
              ))}
              {pdf && (
                <li className="flex flex-col items-center gap-1">
                  <div
                    role="img"
                    aria-label={`Aperçu du PDF ${pdf.name}`}
                    title={pdf.name}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded bg-bg-subtle p-1 text-center text-xs"
                  >
                    <strong>PDF</strong>
                    <span className="w-full truncate">{pdf.name}</span>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={pdfUploaded}
                    aria-label={`Retirer le PDF ${pdf.name}`}
                    onClick={() => setPdf(null)}
                  >
                    Retirer
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      {archivedToConfirm && (
        <ConfirmModal
          title="Réactiver le produit"
          message={`Le produit "${archivedToConfirm.name}" est archivé. Le réactiver pour l'utiliser dans cette campagne ?`}
          confirmLabel="Réactiver"
          loading={saving}
          onConfirm={handleReactivateProduct}
          onCancel={() => setArchivedToConfirm(null)}
        />
      )}
    </Modal>
  );
}
