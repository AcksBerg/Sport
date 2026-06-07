import { NavLink, Outlet } from "react-router-dom";
import { DisplayModeToggle } from "./displayModeToggle";

const nav = [
  ["/", "Start"],
  ["/nutzer", "Nutzer"],
  ["/sportart", "Sportarten"],
];

export function Layout() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-20 border-b border-outline-variant bg-surface-container-low/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <NavLink to="/" className="mr-auto text-lg font-black tracking-tight">
            Sportleistung
          </NavLink>
          <nav className="flex gap-1">
            {nav.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-primary text-on-primary" : "hover:bg-surface-container"}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <DisplayModeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
