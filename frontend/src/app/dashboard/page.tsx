"use client";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import OverviewCards from "@/components/dashboard/OverviewCards";
import SubscriptionList from "@/components/dashboard/SubscriptionList";
import BackgroundPattern from "@/components/ui/BackgroundPattern";

export default function DashboardPage() {
  const router = useRouter();
  
  const wallet = useMemo(() => {
    if (typeof window === "undefined") return null;
    const storedWallet = localStorage.getItem("wallet");
    return storedWallet ? JSON.parse(storedWallet) : null;
  }, []);

  useEffect(() => {
    if (!wallet) {
      router.push("/");
    }
  }, [wallet, router]);

  if (!wallet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      <BackgroundPattern />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 uppercase">Dashboard</h1>
          <p className="text-sm sm:text-base text-white/60 font-light">
            Manage your Bitcoin subscriptions
          </p>
        </div>

        <div className="mb-8 sm:mb-12">
          <OverviewCards />
        </div>

        <div>
          <SubscriptionList />
        </div>
      </div>
    </div>
  );
}

