import { DriverChecklistForm } from "@/components/checklists/driver-checklist-form";
import { listFrotasForOperationalForms } from "@/lib/repos/frotas";
import { requireAppUser } from "@/lib/rbac";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function FazerChecklistPage() {
  const user = await requireAppUser();
  const [frotas, requestHeaders] = await Promise.all([
    listFrotasForOperationalForms(),
    headers(),
  ]);
  const agoraInicial = Number(requestHeaders.get("x-request-time"));
  return (
    <DriverChecklistForm
      frotas={frotas}
      agoraInicial={Number.isFinite(agoraInicial) ? agoraInicial : 0}
      draftOwner={user.email}
    />
  );
}
