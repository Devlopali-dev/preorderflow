"use client";

import { useState } from "react";
import type { NotificationTemplateDetail } from "@/lib/api";
import { TemplateEditModal } from "./template-edit-modal";

export function TemplateButton({
  template,
  apiUrl,
}: {
  template: NotificationTemplateDetail;
  apiUrl: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`badge ${template.customized ? "badge-primary" : "badge-default"}`}
        onClick={() => setOpen(true)}
      >
        {template.template}
      </button>
      {open && (
        <TemplateEditModal template={template} apiUrl={apiUrl} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
