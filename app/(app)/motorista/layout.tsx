import { requireMotoristaUser } from "@/lib/rbac";
import { MotoristaBottomBar } from "@/components/motorista/bottom-action-bar";

export default async function MotoristaLayout({ children }: { children: React.ReactNode }) {
  await requireMotoristaUser();
  return (
    <>
      {children}
      <MotoristaBottomBar />
    </>
  );
}
