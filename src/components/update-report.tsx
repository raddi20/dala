"use client";

import { useState } from "react";
import { ReportForm } from "@/components/report-form";

export function UpdateReport({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="inline-flex min-h-11 items-center text-sm font-semibold text-gold-d" onClick={() => setOpen(true)}>
        Report this note
      </button>
    );
  }
  return <ReportForm shopUpdateId={id} />;
}
