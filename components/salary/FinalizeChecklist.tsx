import { Check, X } from "lucide-react";
import type { FinalizeChecklistResult } from "@/types/salary";

export default function FinalizeChecklist({ checklist }: { checklist: FinalizeChecklistResult }) {
  return (
    <ul className="space-y-2">
      {checklist.items.map((item) => (
        <li key={item.key} className="flex items-start gap-2 text-sm">
          {item.passed ? (
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          ) : (
            <X className="mt-0.5 size-4 shrink-0 text-rose-600" />
          )}
          <span className={item.passed ? "text-slate-700" : "text-rose-700"}>
            {item.label}
            {item.detail && <span className="block text-xs text-slate-500">{item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
