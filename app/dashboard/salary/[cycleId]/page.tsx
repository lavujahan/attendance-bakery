import SalaryCycleWorkspace from "@/components/salary/SalaryCycleWorkspace";

export default async function SalaryCycleDetailPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  return <SalaryCycleWorkspace cycleId={cycleId} />;
}
