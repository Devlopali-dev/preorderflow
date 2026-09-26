import { AdminRole } from "@preorderflow/database";

export interface JwtPayload {
  sub: string;
  email: string;
  role: AdminRole;
}
