import { requireMotoristaUser } from "@/lib/rbac";
import { MotoristaBottomBar } from "@/components/motorista/bottom-action-bar";

export default async function MotoristaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMotoristaUser();
  return (
    <>
      {children}
      {user.perfil === "MOTORISTA" ? <MotoristaBottomBar /> : null}
    </>
  );
}
