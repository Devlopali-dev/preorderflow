import { CustomerSessionPayload } from "./customer-jwt-payload";

declare global {
  namespace Express {
    interface Request {
      customer?: CustomerSessionPayload;
    }
  }
}
