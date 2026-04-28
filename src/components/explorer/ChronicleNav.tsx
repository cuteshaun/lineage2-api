import Link from "next/link";
import type { Chronicle } from "@/lib/chronicles";

export function ChronicleNav({
  chronicle,
  section,
}: {
  chronicle: Chronicle;
  section?: "items" | "npcs" | "monsters" | "armor-sets" | "classes";
}) {
  const links: Array<{ href: string; label: string; key: typeof section }> = [
    { href: `/${chronicle}/items`, label: "Items", key: "items" },
    {
      href: `/${chronicle}/armor-sets`,
      label: "Armor Sets",
      key: "armor-sets",
    },
    { href: `/${chronicle}/classes`, label: "Classes", key: "classes" },
    { href: `/${chronicle}/npcs`, label: "NPCs", key: "npcs" },
    { href: `/${chronicle}/monsters`, label: "Monsters", key: "monsters" },
  ];

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
        <Link
          href={`/${chronicle}`}
          className="font-mono text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          lineage2-api · {chronicle}
        </Link>
        <nav className="flex gap-4 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                section === link.key
                  ? "font-semibold text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
