"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import GooeyNav from "@/components/ui/GooeyNav";
import { useMemo } from "react";
import Button from "../ui/Button";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Creator", href: "/creator" },
  // { label: "Connect Wallet", href: "/connect" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const activeIndex = useMemo(() => {
    const index = NAV_ITEMS.findIndex(item => item.href === pathname);
    return index !== -1 ? index : -1;
  }, [pathname]);

  const navItems = NAV_ITEMS.map((item) => ({
    label: item.label,
    href: item.href,
    isPrimary: item.label === "Connect Wallet",
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      router.push(item.href);
    },
  }));

  return (
    <header className="sticky top-0 z-50 w-full px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl shadow-lg">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-xl font-bold relative z-10">
                CharmPay
              </Link>
              <div className="flex items-center">
                <GooeyNav
                  items={navItems}
                  particleCount={15}
                  particleDistances={[90, 10]}
                  particleR={100}
                  initialActiveIndex={activeIndex}
                  animationTime={600}
                  timeVariance={300}
                  colors={[1, 2, 3, 1, 2, 3, 1, 4]}
                />
              </div>
              <Link href="/connect">
                <Button variant="primary" className="relative z-10">
                   Connect wallet
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

