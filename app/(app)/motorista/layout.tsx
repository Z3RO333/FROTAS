import { requireMotoristaUser } from "@/lib/rbac";

export default async function MotoristaLayout({ children }: { children: React.ReactNode }) {
  await requireMotoristaUser();
  return children;
}
