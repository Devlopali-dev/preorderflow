import { describe, expect, it } from "vitest";
import { assertCanAddPhoto, MAX_PRODUCT_PHOTOS, ProductPhotoLimitError } from "./product-photos";

describe("assertCanAddPhoto", () => {
  it("la limite est de 3 photos", () => {
    expect(MAX_PRODUCT_PHOTOS).toBe(3);
  });

  it("accepte une photo tant qu'il y en a moins de 3", () => {
    for (const count of [0, 1, 2]) {
      expect(() => assertCanAddPhoto(count)).not.toThrow();
    }
  });

  it("refuse la quatrième photo", () => {
    expect(() => assertCanAddPhoto(3)).toThrow(ProductPhotoLimitError);
    expect(() => assertCanAddPhoto(5)).toThrow(/3 photos/);
  });
});
