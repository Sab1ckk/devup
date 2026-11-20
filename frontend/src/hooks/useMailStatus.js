import { useEffect, useState } from "react";
import { api } from "../lib/api";
export default function useMailStatus(id) {
  const [receipt, setReceipt] = useState(null);
  useEffect(() => {
    if (!id) return;
    let active = true,
      attempts = 0,
      timer;
    const poll = () =>
      api(`/mail/${id}`)
        .then((result) => {
          if (!active) return;
          setReceipt({ id, ...result });
          if (result.message === "Письмо ожидает отправки" && attempts++ < 15)
            timer = setTimeout(poll, 1000);
        })
        .catch(() => {
          if (active) setReceipt({ id, status: "unknown" });
        });
    timer = setTimeout(poll, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);
  return receipt?.id === id ? receipt : null;
}
