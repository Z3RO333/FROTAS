import { requireAdminUser } from "@/lib/rbac";

export default async function FrotasLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();
  return children;
}
