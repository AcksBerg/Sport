import { useEffect, useState } from "react";

export const DisplayModeToggle = () => {
  const [dark, setDark] = useState(
    () => localStorage.getItem("display-mode") === "dark",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("display-mode", dark ? "dark" : "light");
  }, [dark]);
  return (
    <button
      type="button"
      aria-label="Darstellungsmodus wechseln"
      onClick={() => setDark((value) => !value)}
      className="button-secondary h-10 w-10 p-0"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
};
