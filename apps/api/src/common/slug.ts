// « Stylo à bille » -> « stylo-a-bille » : minuscules, sans accents, tirets.
export function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Premier slug libre : `base`, puis `base-2`, `base-3`… (un slug est unique).
export function nextAvailableSlug(base: string, existingSlugs: string[]): string {
  const taken = new Set(existingSlugs);
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
