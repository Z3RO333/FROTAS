import { DriverChecklistForm } from "@/components/checklists/driver-checklist-form";
import { listFrotas } from "@/lib/repos/frotas";
import { requireAppUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function FazerChecklistPage() {
  await requireAppUser();
  const { rows } = await listFrotas({ pageSize: 200 });

  return <DriverChecklistForm frotas={rows} />;
}
