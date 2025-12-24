"use client";

import SpotlightCard from "@/components/ui/SpotLightCard";
import { mockSubscriptions } from "@/lib/mockSubscriptions";

export default function OverviewCards() {
  const activeSubscriptions = mockSubscriptions.filter(
    (sub) => sub.status === "active"
  ).length;
  
  const totalLocked = mockSubscriptions.reduce(
    (sum, sub) => sum + sub.totalLocked,
    0
  );
  
  const totalRemaining = mockSubscriptions.reduce(
    (sum, sub) => sum + sub.remainingBalance,
    0
  );

  const nextPayment = mockSubscriptions
    .filter((sub) => sub.status === "active")
    .sort((a, b) => new Date(a.nextPaymentAt).getTime() - new Date(b.nextPaymentAt).getTime())[0];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <SpotlightCard 
        className="border-white/10 bg-black p-6"
        spotlightColor="rgba(0, 245, 255, 0.5)"
      >
        <div className="space-y-2">
          <p className="text-sm text-white/60 font-light">Active Subscriptions</p>
          <p className="text-3xl font-semibold">{activeSubscriptions}</p>
        </div>
      </SpotlightCard>
      
      <SpotlightCard 
        className="border-white/10 bg-black p-6"
        spotlightColor="rgba(255, 0, 255, 0.5)"
      >
        <div className="space-y-2">
          <p className="text-sm text-white/60 font-light">Total BTC Locked</p>
          <p className="text-3xl font-semibold">{totalLocked.toFixed(4)} BTC</p>
        </div>
      </SpotlightCard>
      
      <SpotlightCard 
        className="border-white/10 bg-black p-6"
        spotlightColor="rgba(255, 0, 128, 0.5)"
      >
        <div className="space-y-2">
          <p className="text-sm text-white/60 font-light">Remaining Balance</p>
          <p className="text-3xl font-semibold">{totalRemaining.toFixed(4)} BTC</p>
        </div>
      </SpotlightCard>
      
      <SpotlightCard 
        className="border-white/10 bg-black p-6"
        spotlightColor="rgba(139, 0, 255, 0.5)"
      >
        <div className="space-y-2">
          <p className="text-sm text-white/60 font-light">Next Payment</p>
          <p className="text-lg font-semibold">
            {nextPayment
              ? new Date(nextPayment.nextPaymentAt).toLocaleDateString()
              : "N/A"}
          </p>
        </div>
      </SpotlightCard>
    </div>
  );
}

