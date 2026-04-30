import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { applyDatabaseSchema } from "@local-ai-support-bot/db";
import { AppModule } from "./modules/app.module";

async function bootstrap(): Promise<void> {
  await applyDatabaseSchema();
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean);

  app.enableCors({
    origin: allowedOrigins?.length ? allowedOrigins : true
  });

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}

void bootstrap();
