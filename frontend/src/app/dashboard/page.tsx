"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OverviewCards from "@/components/dashboard/OverviewCards";
import SubscriptionList from "@/components/dashboard/SubscriptionList";
import { mockWallet } from "@/lib/mockWallet";

export default function DashboardPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<typeof mockWallet | null>(null);

  useEffect(() => {
    // Check if wallet is connected
    const storedWallet = localStorage.getItem("wallet");
    if (storedWallet) {
      setWallet(JSON.parse(storedWallet));
    } else {
      // Redirect to connect if no wallet
      router.push("/connect");
    }
  }, [router]);

  if (!wallet) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-white/60 font-light">
            Manage your Bitcoin subscriptions
          </p>
        </div>

        <div className="mb-12">
          <OverviewCards />
        </div>

        <div>
          <SubscriptionList />
        </div>
      </div>
    </div>
  );
}

