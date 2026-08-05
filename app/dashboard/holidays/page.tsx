import HolidayTable from "@/components/holidays/HolidayTable";

export default function HolidaysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Holidays</h1>
        <p className="text-sm text-slate-500">
          Manage the holiday calendar per godown. Every Sunday is a holiday by default — remove a Sunday to make it a
          working day, or add any other date as a custom holiday.
        </p>
      </div>

      <HolidayTable />
    </div>
  );
}
