import { OrdensTabs } from "@/components/manutencao/ordens-tabs";

export default function OrdensLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5"><OrdensTabs />{children}</div>;
}
