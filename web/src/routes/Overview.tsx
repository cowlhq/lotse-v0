import { Dashboard } from "@/components/Dashboard";

// Overview is home for everything; a customer's, project's or
// environment's page, chosen in the bar, is home for theirs.
export function Overview() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <Dashboard />
    </div>
  );
}
