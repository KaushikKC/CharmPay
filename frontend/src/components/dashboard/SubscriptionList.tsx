"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
// import Badge from "@/components/ui/Badge";
import SubscriptionCard from "@/components/subscription/SubscriptionCard";
import { mockSubscriptions } from "@/lib/mockSubscriptions";
import Button from "../ui/Button";

export default function SubscriptionList() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Active Subscriptions</h2>
        <Link href="/create" className="w-full sm:w-auto">
          <Button variant="primary" className="w-full sm:w-auto">Create Subscription</Button>
        </Link>
      </div>
      
      {mockSubscriptions.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-white/60 mb-4">No active subscriptions</p>
            <Link href="/create">
              <button className="bg-white text-black hover:bg-white/90 px-6 py-3 rounded-lg font-medium transition-colors">
                Create Your First Subscription
              </button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {mockSubscriptions.map((subscription) => (
            <SubscriptionCard key={subscription.id} subscription={subscription} />
          ))}
        </div>
      )}
    </div>
  );
}

