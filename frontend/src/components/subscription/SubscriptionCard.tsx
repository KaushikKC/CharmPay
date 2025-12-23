"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Subscription } from "@/lib/mockSubscriptions";

interface SubscriptionCardProps {
  subscription: Subscription;
}

export default function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  const getStatusColor = () => {
    if (subscription.status === "active") return "from-cyan-500/20 to-magenta-500/20";
    if (subscription.status === "cancelled") return "from-red-500/20 to-orange-500/20";
    return "from-green-500/20 to-emerald-500/20";
  };

  return (
    <Link href={`/subscription/${subscription.id}`} className="block">
      <Card className="hover:border-white/20 transition-colors cursor-pointer ">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">
                Subscription {subscription.id}
              </h3>
              <Badge
                variant={
                  subscription.status === "active"
                    ? "active"
                    : subscription.status === "cancelled"
                    ? "cancelled"
                    : "completed"
                }
              >
                {subscription.status}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-sm">
              <div className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-colors">
                <p className="text-white/60 font-light text-xs mb-1">Recipient</p>
                <p className="font-medium font-mono text-cyan-400/90">
                  {subscription.recipient.slice(0, 10)}...
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-magenta-500/30 transition-colors">
                <p className="text-white/60 font-light text-xs mb-1">Amount/Interval</p>
                <p className="font-medium text-magenta-400/90">
                  {subscription.amountPerInterval} BTC / {subscription.interval}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-pink-500/30 transition-colors">
                <p className="text-white/60 font-light text-xs mb-1">Remaining</p>
                <p className="font-medium text-pink-400/90">
                  {subscription.remainingBalance.toFixed(4)} BTC
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-violet-500/30 transition-colors">
                <p className="text-white/60 font-light text-xs mb-1">Next Payment</p>
                <p className="font-medium text-violet-400/90">
                  {new Date(subscription.nextPaymentAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

