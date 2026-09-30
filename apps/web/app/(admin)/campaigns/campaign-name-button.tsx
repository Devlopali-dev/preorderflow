"use client";

import { useState } from "react";
import type { Campaign } from "@/lib/api";
import { CampaignEditModal } from "./campaign-edit-modal";

export function CampaignNameButton({
  campaign,
  apiUrl,
  isAdmin,
}: {
  campaign: Campaign;
  apiUrl: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="underline" onClick={() => setOpen(true)}>
        {campaign.name}
      </button>
      {open && (
        <CampaignEditModal
          campaign={campaign}
          apiUrl={apiUrl}
          isAdmin={isAdmin}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
