"use client";

import Card from "@/components/ui/Card";
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <div className="space-y-2">
          <p className="text-sm text-white/60 font-light">Active Subscriptions</p>
          <p className="text-3xl font-semibold">{activeSubscriptions}</p>
        </div>
      </Card>
      
      <Card>
        <div className="space-y-2">
          <p className="text-sm text-white/60 font-light">Total BTC Locked</p>
          <p className="text-3xl font-semibold">{totalLocked.toFixed(4)} BTC</p>
        </div>
      </Card>
      
      <Card>
        <div className="space-y-2">
          <p className="text-sm text-white/60 font-light">Remaining Balance</p>
          <p className="text-3xl font-semibold">{totalRemaining.toFixed(4)} BTC</p>
        </div>
      </Card>
      
      <Card>
        <div className="space-y-2">
          <p className="text-sm text-white/60 font-light">Next Payment</p>
          <p className="text-lg font-semibold">
            {nextPayment
              ? new Date(nextPayment.nextPaymentAt).toLocaleDateString()
              : "N/A"}
          </p>
        </div>
      </Card>
    </div>
  );
}

