/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import SubscriptionCard from "@/components/subscription/SubscriptionCard";
import Button from "../ui/Button";
import { getStoredWallet } from "@/lib/xverseWallet";
import { getSubscriptionState } from "@/lib/subscriptionFlow";

interface Subscription {
  id: string;
  recipient: string;
  amountPerInterval: number;
  interval: string;
  totalLocked: number;
  remainingBalance: number;
  nextPaymentAt: string;
  status: "active" | "cancelled" | "completed";
  paymentHistory: any[];
  createdAt: string;
  subscriptionUtxo?: string;
  tokenUtxo?: string;
}

export default function SubscriptionList() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      // Load from localStorage (in production, fetch from blockchain/database)
      const stored = localStorage.getItem('subscriptions');
      const storedSubs: Subscription[] = stored ? JSON.parse(stored) : [];

      // Try to fetch real state from blockchain for each subscription
      const wallet = getStoredWallet();
      if (wallet) {
        const updatedSubs = await Promise.all(
          storedSubs.map(async (sub) => {
            if (sub.subscriptionUtxo) {
              try {
                // Fetch real state from blockchain
                const walletOutpoints = new Set<string>();
                // Add wallet's UTXOs to outpoints set
                const state = await getSubscriptionState(
                  sub.subscriptionUtxo,
                  walletOutpoints
                );
                
                if (state) {
                  // Update subscription with real data
                  const remaining = (state.metadata?.remaining || 0) / 100000000;
                  const status: 'active' | 'cancelled' | 'completed' = 
                    remaining === 0 ? 'completed' : 'active';
                  return {
                    ...sub,
                    remainingBalance: remaining,
                    status,
                  };
                }
              } catch (error) {
                console.error(`Failed to fetch state for ${sub.id}:`, error);
              }
            }
            return sub;
          })
        );
        setSubscriptions(updatedSubs);
      } else {
        setSubscriptions(storedSubs);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-semibold">Active Subscriptions</h2>
          <Link href="/create" className="w-full sm:w-auto">
            <Button variant="primary" className="w-full sm:w-auto">Create Subscription</Button>
          </Link>
        </div>
        <Card>
          <div className="text-center py-12">
            <p className="text-white/60">Loading subscriptions...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Active Subscriptions</h2>
        <Link href="/create" className="w-full sm:w-auto">
          <Button variant="primary" className="w-full sm:w-auto">Create Subscription</Button>
        </Link>
      </div>
      
      {subscriptions.length === 0 ? (
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
          {subscriptions.map((subscription) => (
            <SubscriptionCard key={subscription.id} subscription={subscription} />
          ))}
        </div>
      )}
    </div>
  );
}
