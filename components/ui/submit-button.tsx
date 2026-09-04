"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

type SubmitButtonProps = ButtonProps & {
  pendingLabel?: string;
  confirmMessage?: string;
};

export function SubmitButton({
  children,
  pendingLabel = "Aguarde...",
  confirmMessage,
  disabled,
  onClick,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !confirmMessage) return;
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
      {...props}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}
