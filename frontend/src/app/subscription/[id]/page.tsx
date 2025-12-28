/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import BackgroundPattern from "@/components/ui/BackgroundPattern";
import { getTransactionExplorerUrl } from "@/lib/explorer";
import { executePayment, cancelSubscription, getSubscriptionState } from "@/lib/subscriptionFlow";
import { loadWasmBinary } from "@/lib/wasmLoader";
import { getStoredWallet } from "@/lib/xverseWallet";
import Button from "@/components/ui/Button";

interface Subscription {
  id: string;
  recipient: string;
  amountPerInterval: number;
  interval: string;
  totalLocked: number;
  remainingBalance: number;
  nextPaymentAt: string;
  status: "active" | "cancelled" | "completed";
  paymentHistory: Array<{
    id: string;
    amount: number;
    timestamp: string;
    status: string;
    txid?: string;
  }>;
  createdAt: string;
  subscriptionUtxo?: string;
  tokenUtxo?: string;
}

export default function SubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load subscription from localStorage and blockchain
  useEffect(() => {
    loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const loadSubscription = async () => {
    try {
      // Load from localStorage
      const stored = localStorage.getItem('subscriptions');
      const subscriptions: Subscription[] = stored ? JSON.parse(stored) : [];
      const sub = subscriptions.find((s) => s.id === params.id);

      if (!sub) {
        setLoading(false);
        return;
      }

      // Try to fetch real state from blockchain
      const wallet = getStoredWallet();
      if (wallet && sub.subscriptionUtxo) {
        try {
          const walletOutpoints = new Set<string>();
          const state = await getSubscriptionState(
            sub.subscriptionUtxo,
            walletOutpoints
          );
          
          if (state) {
            sub.remainingBalance = (state.metadata?.remaining || 0) / 100000000;
            sub.status = state.metadata?.remaining === 0 ? 'completed' : 'active';
          }
        } catch (error) {
          console.error('Failed to fetch subscription state:', error);
        }
      }

      setSubscription(sub);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePayment = async () => {
    if (!subscription) return;

    setIsExecuting(true);
    setError(null);

    try {
      const wallet = getStoredWallet();
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      if (!subscription.subscriptionUtxo || !subscription.tokenUtxo) {
        throw new Error('Subscription UTXOs not found');
      }

      // Load WASM binary
      const wasmBinary = await loadWasmBinary();

      // Get app ID and VK
      const appId = process.env.NEXT_PUBLIC_CHARMS_APP_ID || '';
      const appVk = process.env.NEXT_PUBLIC_CHARMS_APP_VK || '';

      if (!appId || !appVk) {
        throw new Error('App ID and Verification Key must be set');
      }

      // Convert amounts to satoshis
      const paymentAmountSats = Math.floor(subscription.amountPerInterval * 100000000);
      const currentRemainingSats = Math.floor(subscription.remainingBalance * 100000000);

      if (currentRemainingSats < paymentAmountSats) {
        throw new Error('Insufficient balance for payment');
      }

      // Execute payment
      const result = await executePayment({
        subscriptionUtxo: subscription.subscriptionUtxo,
        tokenUtxo: subscription.tokenUtxo,
        subscriptionId: subscription.id,
        currentRemainingBalance: currentRemainingSats,
        paymentAmount: paymentAmountSats,
        recipientAddress: subscription.recipient,
        appId,
        wasmBinary,
        walletAddress: wallet.paymentAddress,
      });

      // Update subscription state
      const newRemainingBalance = (currentRemainingSats - paymentAmountSats) / 100000000;
      const newPayment = {
        id: `pay_${Date.now()}`,
        amount: subscription.amountPerInterval,
        timestamp: new Date().toISOString(),
        status: 'completed',
        txid: result.txids[1], // Spell transaction ID
      };

      const updatedSubscription: Subscription = {
        ...subscription,
        remainingBalance: newRemainingBalance,
        subscriptionUtxo: result.newSubscriptionUtxo,
        tokenUtxo: result.newTokenUtxo,
        paymentHistory: [newPayment, ...subscription.paymentHistory],
        status: newRemainingBalance === 0 ? 'completed' : 'active',
      };

      // Update localStorage
      const stored = localStorage.getItem('subscriptions');
      const subscriptions: Subscription[] = stored ? JSON.parse(stored) : [];
      const updated = subscriptions.map((s) => 
        s.id === subscription.id ? updatedSubscription : s
      );
      localStorage.setItem('subscriptions', JSON.stringify(updated));

      setSubscription(updatedSubscription);
    } catch (err: any) {
      console.error('Error executing payment:', err);
      setError(err.message || 'Failed to execute payment');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = async () => {
    if (!subscription) return;

    setIsCancelling(true);
    setError(null);

    try {
      const wallet = getStoredWallet();
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      if (!subscription.subscriptionUtxo || !subscription.tokenUtxo) {
        throw new Error('Subscription UTXOs not found');
      }

      // Load WASM binary
      const wasmBinary = await loadWasmBinary();

      // Get app ID and VK
      const appId = process.env.NEXT_PUBLIC_CHARMS_APP_ID || '';
      const appVk = process.env.NEXT_PUBLIC_CHARMS_APP_VK || '';

      if (!appId || !appVk) {
        throw new Error('App ID and Verification Key must be set');
      }

      // Convert to satoshis
      const remainingBalanceSats = Math.floor(subscription.remainingBalance * 100000000);

      // Cancel subscription
      await cancelSubscription({
        subscriptionUtxo: subscription.subscriptionUtxo,
        tokenUtxo: subscription.tokenUtxo,
        subscriptionId: subscription.id,
        remainingBalance: remainingBalanceSats,
        appId,
        wasmBinary,
        walletAddress: wallet.paymentAddress,
      });

      // Update subscription state
      const updatedSubscription: Subscription = {
        ...subscription,
        status: 'cancelled',
        remainingBalance: 0,
      };

      // Update localStorage
      const stored = localStorage.getItem('subscriptions');
      const subscriptions: Subscription[] = stored ? JSON.parse(stored) : [];
      const updated = subscriptions.map((s) => 
        s.id === subscription.id ? updatedSubscription : s
      );
      localStorage.setItem('subscriptions', JSON.stringify(updated));

      setSubscription(updatedSubscription);
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black relative">
        <BackgroundPattern />
        <p className="relative z-10 text-white/60">Loading...</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black relative">
        <BackgroundPattern />
        <div className="relative z-10 text-center">
          <p className="text-white/60 mb-4">Subscription not found</p>
          <Button onClick={() => router.push('/dashboard')} variant="primary">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const progressPercentage = ((subscription.totalLocked - subscription.remainingBalance) / subscription.totalLocked) * 100;

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

        {error && (
          <Card className="mb-6 border-red-500/50 bg-red-500/10">
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        )}

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
                {subscription.paymentHistory.length === 0 ? (
                  <p className="text-white/60 text-sm">No payments yet</p>
                ) : (
                  subscription.paymentHistory.map((payment, index) => (
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
                          {payment.txid && (
                            <a
                              href={getTransactionExplorerUrl(payment.txid)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-400/70 font-mono mt-1 hover:text-cyan-400 hover:underline block"
                            >
                              {payment.txid.slice(0, 16)}...{payment.txid.slice(-8)}
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-white/50">
                          {new Date(payment.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
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
                  {subscription.remainingBalance.toFixed(8)} BTC
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
