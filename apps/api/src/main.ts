import "reflect-metadata";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  // rawBody: true — le webhook Stripe doit vérifier la signature sur le
  // corps brut de la requête ; le JSON déjà parsé par Nest ne correspond
  // plus octet pour octet, la vérification échouerait systématiquement.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Photos produit uploadées (product.controller.ts) — stockage disque local
  // (§32 : aucune dépendance propriétaire obligatoire, pas de S3). En prod,
  // ce dossier doit être un volume Docker persistant (sinon perdu au rebuild).
  app.useStaticAssets(join(__dirname, "..", "uploads"), { prefix: "/uploads" });

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? "http://localhost:3000",
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix("api/v1", {
    exclude: ["health"],
  });

  const config = new DocumentBuilder()
    .setTitle("PreOrderFlow API")
    .setDescription("API de gestion de préventes, production, stock et expéditions")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`API démarrée sur http://localhost:${port}/api/v1 (docs: /api/docs)`);
}

bootstrap();
