import Image from "next/image";
import { cn } from "@/lib/utils";
import { vehicleImage } from "@/lib/frotas/vehicle-image";

type Props = {
  className?: string;
  frota?: string | number | null;
  /** Modelo cadastrado: define se a arte é carro, utilitário ou caminhão. */
  modelo?: string | null;
  title?: string;
  priority?: boolean;
};

export function BemolTruck({ className, modelo, title, priority = false }: Props) {
  const art = vehicleImage(modelo);

  return (
    <div className={cn("truck-slot t1", className)}>
      <Image
        className="t-img"
        src={art.src}
        alt={title ?? art.alt}
        width={art.width}
        height={art.height}
        priority={priority}
        sizes="200px"
      />
    </div>
  );
}
