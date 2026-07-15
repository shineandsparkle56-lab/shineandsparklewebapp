import { useState, useCallback } from "react";

type ToastType = "success" | "error";

export function useToast(durationMs = 3500) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("success");

  const show = useCallback(
    (msg: string, t: ToastType = "success") => {
      setMessage(msg);
      setType(t);
      setTimeout(() => setMessage(""), durationMs);
    },
    [durationMs]
  );

  return { message, type, show };
}
