"use client";

import { useState } from "react";
import type { Campaign } from "@/lib/api";
import { CampaignEditModal } from "./campaign-edit-modal";

export function CampaignNameButton({ campaign, apiUrl }: { campaign: Campaign; apiUrl: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="underline" onClick={() => setOpen(true)}>
        {campaign.name}
      </button>
      {open && <CampaignEditModal campaign={campaign} apiUrl={apiUrl} onClose={() => setOpen(false)} />}
    </>
  );
}
