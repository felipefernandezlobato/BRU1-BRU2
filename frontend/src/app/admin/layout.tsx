"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";

const tabs = [
  { label: "Dashboard", href: "/admin" },
  { label: "Analiticas", href: "/admin/analytics" },
  { label: "Articulos", href: "/admin/items" },
  { label: "Categorias", href: "/admin/categories" },
  { label: "Equipo", href: "/admin/team" },
  { label: "Ajustes", href: "/admin/settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {(user) => <AdminLayoutInner user={user}>{children}</AdminLayoutInner>}
    </AppShell>
  );
}

function AdminLayoutInner({ user, children }: { user: { role: string }; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  if (user.role !== "admin") {
    router.replace("/");
    return null;
  }

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <div>
      <nav className="bg-white border-b border-[#E5E7EB] sticky top-[64px] z-[9] overflow-x-auto">
        <div className="flex max-w-2xl mx-auto px-4">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-[#861A22] text-[#861A22]"
                    : "border-transparent text-[#9CA3AF] hover:text-[#6B7280]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
