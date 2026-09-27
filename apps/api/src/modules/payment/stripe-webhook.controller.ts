import { BadRequestException, Controller, Post, RawBodyRequest, Req } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Request } from "express";
import Stripe from "stripe";
import { PaymentService } from "./payment.service";
import { getStripeClient } from "./stripe-client";
import { Public } from "../auth/public.decorator";

// Stripe appelle cette route directement — jamais de JWT, l'authenticité
// est garantie par la vérification de signature ci-dessous (secret
// STRIPE_WEBHOOK_SECRET, jamais le corps de la requête pris tel quel).
@Public()
@ApiExcludeController()
@Controller("webhooks/stripe")
export class StripeWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret || !req.rawBody) {
      throw new BadRequestException("Signature Stripe manquante ou webhook non configuré");
    }

    let event: Stripe.Event;
    try {
      event = getStripeClient().webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch (error) {
      throw new BadRequestException(`Signature Stripe invalide: ${(error as Error).message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.paymentService.confirmByProviderReference(session.id);
    }

    return { received: true };
  }
}
