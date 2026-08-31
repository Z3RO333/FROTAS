import { requireMotoristaUser } from "@/lib/rbac";
import { MotoristaBottomBar } from "@/components/motorista/bottom-action-bar";

export default async function MotoristaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMotoristaUser();
  const showBottomBar = user.perfil === "MOTORISTA" || user.perfil === "MOTORISTA_INTERNO";
  return (
    <>
      {children}
      {showBottomBar ? <MotoristaBottomBar perfil={user.perfil} /> : null}
    </>
  );
}
