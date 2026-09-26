export interface CustomerSessionPayload {
  sub: string; // customerId
  type: "customer";
}

export interface MagicLinkPayload {
  sub: string; // customerId
  type: "magic-link";
}
