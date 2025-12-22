"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import PaymentHistory from "@/components/subscription/PaymentHistory";
import { mockSubscriptions } from "@/lib/mockSubscriptions";
import { Subscription } from "@/lib/mockSubscriptions";

export default function SubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
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
    // Simulate payment execution
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    if (subscription) {
      // Update subscription (in real app, this would be an API call)
      const newPayment = {
        id: `pay_${Date.now()}`,
        amount: subscription.amountPerInterval,
        timestamp: new Date().toISOString(),
        status: "completed" as const,
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
    // Simulate cancellation
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">Subscription not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-white/60 hover:text-white mb-4 transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold">Subscription {subscription.id}</h1>
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
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <h3 className="text-lg font-semibold mb-4">Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-white/60 font-light">Recipient</p>
                <p className="font-mono text-sm mt-1 break-all">
                  {subscription.recipient}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/60 font-light">Amount per Interval</p>
                <p className="font-semibold mt-1">
                  {subscription.amountPerInterval} BTC
                </p>
              </div>
              <div>
                <p className="text-sm text-white/60 font-light">Interval</p>
                <p className="font-semibold mt-1">{subscription.interval}</p>
              </div>
              <div>
                <p className="text-sm text-white/60 font-light">Total Locked</p>
                <p className="font-semibold mt-1">
                  {subscription.totalLocked} BTC
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold mb-4">Status</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-white/60 font-light">Remaining Balance</p>
                <p className="text-2xl font-semibold mt-1">
                  {subscription.remainingBalance.toFixed(4)} BTC
                </p>
                {subscription.status === "cancelled" && (
                  <p className="text-sm text-white/60 mt-1">
                    Refundable
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-white/60 font-light">Next Payment</p>
                <p className="font-semibold mt-1">
                  {new Date(subscription.nextPaymentAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/60 font-light">Created</p>
                <p className="font-semibold mt-1">
                  {new Date(subscription.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {subscription.status === "active" && (
          <div className="mb-6 flex gap-4">
            <Button
              variant="primary"
              onClick={handleExecutePayment}
              disabled={isExecuting}
            >
              {isExecuting ? "Executing..." : "Trigger Payment"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel Subscription"}
            </Button>
          </div>
        )}

        <PaymentHistory payments={subscription.paymentHistory} />
      </div>
    </div>
  );
}

