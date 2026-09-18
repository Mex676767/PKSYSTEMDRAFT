import { useEffect } from "react";

export function TabVisibilityPause() {
  useEffect(() => {
    const update = () => {
      document.body.classList.toggle("tab-hidden", document.hidden);
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return null;
}
