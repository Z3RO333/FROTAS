import { DriverChecklistForm } from "@/components/checklists/driver-checklist-form";
import { listFrotasForOperationalForms } from "@/lib/repos/frotas";
import { requireAppUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function FazerChecklistPage() {
  await requireAppUser();
  const frotas = await listFrotasForOperationalForms();
  return <DriverChecklistForm frotas={frotas} />;
}
