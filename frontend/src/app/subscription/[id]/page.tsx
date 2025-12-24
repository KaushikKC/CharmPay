/* eslint-disable react-hooks/purity */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import BackgroundPattern from "@/components/ui/BackgroundPattern";
import { mockSubscriptions } from "@/lib/mockSubscriptions";
import { Subscription, Payment } from "@/lib/mockSubscriptions";
import { getTransactionExplorerUrl } from "@/lib/explorer";

export default function SubscriptionDetailPage() {
  const params = useParams();
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  // Find subscription by ID
  useEffect(() => {
    const sub = mockSubscriptions.find((s) => s.id === params.id);
    setSubscription(sub || null);
  }, [params.id]);

  const handleExecutePayment = async () => {
    setIsExecuting(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    if (subscription) {
      const newPayment: Payment = {
        id: `pay_${Date.now()}`,
        amount: subscription.amountPerInterval,
        timestamp: new Date().toISOString(),
        status: "completed",
      };
      
      setSubscription({
        ...subscription,
        remainingBalance: subscription.remainingBalance - subscription.amountPerInterval,
        paymentHistory: [newPayment, ...subscription.paymentHistory],
        nextPaymentAt: new Date(
          new Date(subscription.nextPaymentAt).getTime() + 30 * 24 * 60 * 60 * 1000
        ).toISOString().split("T")[0],
      });
    }
    
    setIsExecuting(false);
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    if (subscription) {
      setSubscription({
        ...subscription,
        status: "cancelled",
      });
    }
    
    setIsCancelling(false);
  };

  if (!subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black relative">
        <BackgroundPattern />
        <p className="relative z-10 text-white/60">Subscription not found</p>
      </div>
    );
  }

  const progressPercentage = ((subscription.totalLocked - subscription.remainingBalance) / subscription.totalLocked) * 100;

  // Generate mock transaction IDs for payment history
  // In production, these would come from actual transaction hashes
  const getTransactionId = (paymentId: string): string => {
    const hash = paymentId.split('_')[1];
    // Generate a mock transaction hash (64 hex characters for Bitcoin tx hash)
    const randomPart1 = Math.random().toString(16).substring(2, 18).padStart(16, '0');
    const randomPart2 = Math.random().toString(16).substring(2, 18).padStart(16, '0');
    const randomPart3 = Math.random().toString(16).substring(2, 18).padStart(16, '0');
    const randomPart4 = Math.random().toString(16).substring(2, 18).padStart(16, '0');
    return `${hash}${randomPart1}${randomPart2}${randomPart3}${randomPart4}`.slice(0, 64);
  };

  return (
    <div className="min-h-screen bg-black relative">
      <BackgroundPattern />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Top Section */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Subscription Details</h1>
            <div className="flex items-center gap-3">
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
              <p className="text-white/60 text-sm">{subscription.id}</p>
            </div>
          </div>
          
          {subscription.status === "active" && (
            <div className="flex gap-3">
              <button
                onClick={handleExecutePayment}
                disabled={isExecuting}
                className="px-4 py-2 text-sm font-medium border border-white/20 rounded-lg hover:border-white/40 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {isExecuting ? "Executing..." : "Execute Payment Now"}
              </button>
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="px-4 py-2 text-sm font-medium border border-red-500/50 rounded-lg hover:border-red-500/70 transition-colors disabled:opacity-50 bg-red-500/15 hover:bg-red-500/30"
              >
                {isCancelling ? "Cancelling..." : "Cancel Subscription"}
              </button>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Subscription Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-1">
                    RECIPIENT ADDRESS
                  </p>
                  <p className="font-mono text-sm font-semibold">
                    {subscription.recipient}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-1">
                    PAYMENT INTERVAL
                  </p>
                  <p className="font-semibold">{subscription.interval}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-1">
                    AMOUNT PER CYCLE
                  </p>
                  <p className="font-semibold">{subscription.amountPerInterval} BTC</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-1">
                    NEXT EXECUTION AT
                  </p>
                  <p className="font-semibold">{subscription.nextPaymentAt}</p>
                </div>
              </div>
            </Card>

            {/* Payment History */}
            <Card>
              <h3 className="text-lg font-semibold mb-4">Payment History</h3>
              <div className="space-y-3">
                {subscription.paymentHistory.map((payment, index) => (
                  <div
                    key={payment.id}
                    className={`relative overflow-hidden rounded-lg border ${
                      index % 2 === 0
                        ? "bg-cyan-500/5 border-cyan-500/10"
                        : "bg-magenta-500/5 border-magenta-500/10"
                    }`}
                  >
                   
                    <div className="pl-4 pr-4 py-3 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-cyan-400/90">{payment.amount} BTC</p>
                        <a
                          href={getTransactionExplorerUrl(getTransactionId(payment.id))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400/70 font-mono mt-1 hover:text-cyan-400 hover:underline block"
                        >
                          {getTransactionId(payment.id).slice(0, 16)}...{getTransactionId(payment.id).slice(-8)}
                        </a>
                      </div>
                      <p className="text-xs text-white/50">
                        {new Date(payment.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Panel - Protocol Lock */}
          <div className="lg:col-span-1">
            <Card>
              <h3 className="text-lg font-semibold mb-2">Protocol Lock</h3>
              <p className="text-sm text-white/60 mb-6">
                These funds are currently locked in a Time-Lock Script on the Bitcoin blockchain.
              </p>
              
              <div className="mb-6">
                <p className="text-3xl font-bold mb-4">
                  {subscription.remainingBalance.toFixed(4)} BTC
                </p>
                
                {/* Progress Bar */}
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                
                <p className="text-xs text-white/60">
                  Initial Deposit: {subscription.totalLocked} BTC
                </p>
              </div>

              {/* Execution Stats */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-white/60">Success Rate</p>
                  <p className="font-semibold">100%</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-white/60">Uptime</p>
                  <p className="font-semibold">99.9%</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

