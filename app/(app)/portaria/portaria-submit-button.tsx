"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "destructive";
  size?: "default" | "sm";
  loadingText?: string;
};

export function PortariaSubmitButton({
  children,
  className,
  variant = "default",
  size = "default",
  loadingText = "Processando...",
}: Props) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      className={cn("w-full", className)}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
