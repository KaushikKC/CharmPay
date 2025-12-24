"use client";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import SpotlightCard from "@/components/ui/SpotLightCard";
import BackgroundPattern from "@/components/ui/BackgroundPattern";
import { mockCreatorSubscriptions } from "@/lib/mockSubscriptions";

export default function CreatorPage() {
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
  const totalMonthlyIncome = mockCreatorSubscriptions.reduce(
    (sum, sub) => sum + sub.totalReceived,
    0
  );

  const allPayments = mockCreatorSubscriptions.flatMap(
    (sub) => sub.paymentHistory
  );

  return (
    <div className="min-h-screen bg-black relative">
      <BackgroundPattern />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 uppercase">Creator Dashboard</h1>
          <p className="text-sm sm:text-base text-white/60 font-light">
            View incoming subscriptions and payments
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <SpotlightCard 
            className="border-white/10 bg-black p-6"
            spotlightColor="rgba(0, 245, 255, 0.5)"
          >
            <div className="space-y-2">
              <p className="text-sm text-white/60 font-light">
                Incoming Subscriptions
              </p>
              <p className="text-3xl font-semibold">
                {mockCreatorSubscriptions.length}
              </p>
            </div>
          </SpotlightCard>

          <SpotlightCard 
            className="border-white/10 bg-black p-6"
            spotlightColor="rgba(255, 0, 255, 0.5)"
          >
            <div className="space-y-2">
              <p className="text-sm text-white/60 font-light">
                Monthly BTC Income
              </p>
              <p className="text-3xl font-semibold">
                {totalMonthlyIncome.toFixed(4)} BTC
              </p>
            </div>
          </SpotlightCard>

          <SpotlightCard 
            className="border-white/10 bg-black p-6"
            spotlightColor="rgba(255, 0, 128, 0.5)"
          >
            <div className="space-y-2">
              <p className="text-sm text-white/60 font-light">Total Payments</p>
              <p className="text-3xl font-semibold">{allPayments.length}</p>
            </div>
          </SpotlightCard>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <h2 className="text-xl sm:text-2xl font-semibold">Incoming Subscriptions</h2>

          {mockCreatorSubscriptions.length === 0 ? (
            <Card>
              <div className="text-center py-8 sm:py-12">
                <p className="text-white/60 text-sm sm:text-base">No incoming subscriptions</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {mockCreatorSubscriptions.map((subscription, index) => (
                <Card key={subscription.id} className="relative overflow-hidden group">
                  {/* Subtle gradient accent */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${
                    index % 3 === 0 
                      ? "from-cyan-500/10 to-magenta-500/10" 
                      : index % 3 === 1
                      ? "from-magenta-500/10 to-pink-500/10"
                      : "from-pink-500/10 to-violet-500/10"
                  } opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
                  
                  <div className="relative space-y-3 sm:space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-3">
                          <h3 className="text-base sm:text-lg font-semibold">
                            Subscription {subscription.id}
                          </h3>
                          <Badge
                            variant={
                              subscription.status === "active"
                                ? "active"
                                : "cancelled"
                            }
                          >
                            {subscription.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-sm">
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-colors">
                            <p className="text-white/60 font-light text-xs mb-1">Subscriber</p>
                            <p className="font-mono text-sm text-cyan-400/90 break-all">
                              {subscription.subscriber.slice(0, 10)}...
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-magenta-500/30 transition-colors">
                            <p className="text-white/60 font-light text-xs mb-1">
                              Amount/Interval
                            </p>
                            <p className="font-medium text-magenta-400/90">
                              {subscription.amountPerInterval} BTC /{" "}
                              {subscription.interval}
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-pink-500/30 transition-colors">
                            <p className="text-white/60 font-light text-xs mb-1">
                              Total Received
                            </p>
                            <p className="font-medium text-pink-400/90">
                              {subscription.totalReceived.toFixed(4)} BTC
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-violet-500/30 transition-colors">
                            <p className="text-white/60 font-light text-xs mb-1">
                              Next Payment
                            </p>
                            <p className="font-medium text-violet-400/90">
                              {new Date(
                                subscription.nextPaymentAt
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-3">Payment History</h4>
                        <div className="space-y-2">
                          {subscription.paymentHistory.map((payment, payIndex) => (
                            <div
                              key={payment.id}
                              className={`flex items-center justify-between py-3 px-4 rounded-lg border transition-all ${
                                payIndex % 2 === 0
                                  ? "bg-cyan-500/5 border-cyan-500/10 hover:border-cyan-500/20"
                                  : "bg-magenta-500/5 border-magenta-500/10 hover:border-magenta-500/20"
                              }`}
                            >
                              <div className="flex-1">
                                <p className="font-medium text-cyan-400/90">{payment.amount} BTC</p>
                                <p className="text-sm text-white/50 mt-1">
                                  {new Date(payment.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <Badge
                                variant={
                                  payment.status === "completed"
                                    ? "completed"
                                    : payment.status === "pending"
                                    ? "pending"
                                    : "cancelled"
                                }
                              >
                                {payment.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

