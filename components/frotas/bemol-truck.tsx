import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  frota?: string | number | null;
  title?: string;
  priority?: boolean;
};

export function BemolTruck({ className, title = "Caminhão Bemol", priority = false }: Props) {
  return (
    <div className={cn("truck-slot t1", className)}>
      <Image
        className="t-img"
        src="/assets/caminhao-bemol.png"
        alt={title}
        width={396}
        height={247}
        priority={priority}
        sizes="200px"
      />
    </div>
  );
}
