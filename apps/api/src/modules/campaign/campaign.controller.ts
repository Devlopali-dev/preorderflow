import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CampaignService } from "./campaign.service";
import {
  CreateCampaignDto,
  CreateInterestDto,
  UpdateCampaignDto,
  UpdateCampaignStatusDto,
} from "./dto/create-campaign.dto";
import { Public } from "../auth/public.decorator";

@ApiTags("campaigns")
@Controller("campaigns")
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  // Lecture publique : page vitrine de campagne (§19) + dashboard admin.
  @Public()
  @Get()
  list() {
    return this.campaignService.list();
  }

  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.campaignService.create(dto);
  }

  @Public()
  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.campaignService.getBySlugOrId(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignService.update(id, dto);
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateCampaignStatusDto) {
    return this.campaignService.updateStatus(id, dto.status as never);
  }

  @Public()
  @Get(":id/statistics")
  getStatistics(@Param("id") id: string) {
    return this.campaignService.getStatistics(id);
  }

  // Formulaire public de recensement — rate-limité en plus du throttler
  // global (cf. docs/security.md), au-delà de l'anti-spam honeypot.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(":id/interests")
  registerInterest(@Param("id") id: string, @Body() dto: CreateInterestDto) {
    return this.campaignService.registerInterest(id, dto);
  }
}
