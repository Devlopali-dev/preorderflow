import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { IS_PUBLIC_KEY } from "../auth/public.decorator";
import { CampaignController } from "./campaign.controller";

const isPublic = (method: keyof CampaignController) =>
  Reflect.getMetadata(IS_PUBLIC_KEY, CampaignController.prototype[method]) === true;

// Un décorateur @Public() posé au mauvais endroit rend publique une route d'administration,
// ou protège une route publique (la page vitrine renvoie alors 401).
describe("CampaignController — routes publiques et privées", () => {
  it("la liste et la lecture d'une campagne sont publiques", () => {
    expect(isPublic("list")).toBe(true);
    expect(isPublic("getOne")).toBe(true);
  });

  it("les ventes par campagne ne sont jamais publiques", () => {
    expect(isPublic("sales")).toBe(false);
  });
});
