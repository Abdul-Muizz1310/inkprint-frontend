import { Feather } from "lucide-react";
import Link from "next/link";

export type AppNavProps = {
  active?: "home" | "verify" | "compare" | "leak";
};

export function AppNav({ active }: AppNavProps) {
  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-mono">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-accent-ink">
            <Feather className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            inkprint
            <span className="ml-1 text-accent-ink">.dev</span>
          </span>
        </Link>
        <div className="flex items-center gap-5 font-mono text-xs text-fg-muted">
          <NavLink href="/" label="home" active={active === "home"} />
          <NavLink href="/verify" label="verify" active={active === "verify"} />
          <NavLink href="/compare" label="compare" active={active === "compare"} />
          <a
            href="https://github.com/Abdul-Muizz1310/inkprint-frontend"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            github
          </a>
          <a
            href="https://inkprint-backend.onrender.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            api
          </a>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "relative text-foreground after:absolute after:-bottom-[19px] after:left-0 after:h-[2px] after:w-full after:bg-accent-ink after:shadow-[0_0_8px_rgb(224_181_94_/_0.6)]"
          : "transition-colors hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
}
