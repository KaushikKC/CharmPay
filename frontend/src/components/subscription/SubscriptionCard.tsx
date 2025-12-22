"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Subscription } from "@/lib/mockSubscriptions";

interface SubscriptionCardProps {
  subscription: Subscription;
}

export default function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  return (
    <Link href={`/subscription/${subscription.id}`}>
      <Card className="hover:border-white/20 transition-colors cursor-pointer">
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
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-white/60 font-light">Recipient</p>
                <p className="font-medium mt-1">
                  {subscription.recipient.slice(0, 10)}...
                </p>
              </div>
              <div>
                <p className="text-white/60 font-light">Amount/Interval</p>
                <p className="font-medium mt-1">
                  {subscription.amountPerInterval} BTC / {subscription.interval}
                </p>
              </div>
              <div>
                <p className="text-white/60 font-light">Remaining</p>
                <p className="font-medium mt-1">
                  {subscription.remainingBalance.toFixed(4)} BTC
                </p>
              </div>
              <div>
                <p className="text-white/60 font-light">Next Payment</p>
                <p className="font-medium mt-1">
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

