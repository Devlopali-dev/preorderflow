import { describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { AppModule } from "./app.module";

describe("AppModule", () => {
  it("se compile sans erreur", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
