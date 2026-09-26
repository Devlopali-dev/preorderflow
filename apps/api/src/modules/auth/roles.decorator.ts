import { SetMetadata } from "@nestjs/common";
import { AdminRole } from "@preorderflow/database";

export const ROLES_KEY = "roles";
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
