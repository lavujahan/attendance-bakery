import { Suspense } from "react";
import ReportsWorkspace from "@/components/reports/ReportsWorkspace";

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsWorkspace />
    </Suspense>
  );
}
