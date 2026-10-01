import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { CampaignService } from "./campaign.service";

// Applique périodiquement les passages automatiques de statut des campagnes
// (cf. campaign-schedule.ts) : au démarrage, puis toutes les minutes. Pas d'infra
// supplémentaire : un simple minuteur dans le processus de l'API (`unref` pour ne pas
// retenir son arrêt). Plusieurs instances restent sûres : chaque changement est conditionné
// à l'ancien statut, un seul processus l'applique.
@Injectable()
export class CampaignScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly campaignService: CampaignService) {}

  onModuleInit() {
    if (process.env.CAMPAIGN_SCHEDULE_DISABLED === "true") {
      return;
    }
    const intervalMs = Number(process.env.CAMPAIGN_SCHEDULE_INTERVAL_MS) || 60_000;
    void this.run();
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async run() {
    try {
      await this.campaignService.applySchedule();
    } catch (error) {
      // Base injoignable au démarrage, etc. : on réessaie au prochain passage.
      this.logger.warn(
        `Passage automatique des campagnes impossible : ${(error as Error).message}`,
      );
    }
  }
}
