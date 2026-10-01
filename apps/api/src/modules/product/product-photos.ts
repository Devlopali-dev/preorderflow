// Un produit porte 3 photos au plus. La limite est contrôlée côté backend :
// l'interface la reflète, mais ne fait pas foi.

export const MAX_PRODUCT_PHOTOS = 3;

export class ProductPhotoLimitError extends Error {
  constructor() {
    super(`Limite de ${MAX_PRODUCT_PHOTOS} photos atteinte pour ce produit`);
    this.name = "ProductPhotoLimitError";
  }
}

export function assertCanAddPhoto(currentCount: number): void {
  if (currentCount >= MAX_PRODUCT_PHOTOS) {
    throw new ProductPhotoLimitError();
  }
}
