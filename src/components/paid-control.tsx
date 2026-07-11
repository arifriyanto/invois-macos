"use client";
import { InvoiceStatusPill } from "@/components/invoice-status-pill";
import { useEditorActions } from "@/lib/editor-actions";
import { useStore } from "@/lib/store";

// Editor toolbar paid control — same status pill as the invoice list. Click to
// toggle paid/unpaid (boolean for now; dated paid is planned for a later version).
// Only shown once the invoice is a real (saved) record.
export function PaidControl() {
  const actions = useEditorActions();
  const { invoice } = useStore();
  if (!actions?.saved) return null;
  return (
    <InvoiceStatusPill
      size="toolbar"
      paid={actions.paid}
      due={invoice.due}
      onToggle={() => actions.setPaid(!actions.paid)}
    />
  );
}
