import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

function apply(theme: Theme) {
  const root = document.documentElement;
  const isDark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => (typeof localStorage !== "undefined" ? (localStorage.getItem("theme") as Theme) : null) ?? "dark");
  useEffect(() => { apply(theme); localStorage.setItem("theme", theme); }, [theme]);
  useEffect(() => {
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const h = () => apply("system");
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [theme]);
  return { theme, setTheme: setThemeState };
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const opts: { v: Theme; icon: any; label: string }[] = [
    { v: "light", icon: Sun, label: "Light" },
    { v: "system", icon: Monitor, label: "OS" },
    { v: "dark", icon: Moon, label: "Dark" },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
      {opts.map((o) => (
        <button key={o.v} onClick={() => setTheme(o.v)} title={o.label}
          className={`flex h-6 w-6 items-center justify-center rounded-full ${theme === o.v ? "bg-fuchsia-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>
          <o.icon className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}
