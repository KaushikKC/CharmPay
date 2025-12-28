/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import BackgroundPattern from "@/components/ui/BackgroundPattern";
import { createSubscription } from "@/lib/subscriptionFlow";
import { loadWasmBinary } from "@/lib/wasmLoader";
import { getStoredWallet, storeWallet } from "@/lib/xverseWallet";
import { connectWallet } from "@/lib/satsConnect";

export default function CreatePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [formData, setFormData] = useState({
    recipient: "",
    amountPerInterval: "",
    interval: "30 days",
    totalLocked: "",
  });

  useEffect(() => {
    // Check if wallet is connected
    const wallet = getStoredWallet();
    setWalletConnected(!!wallet);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // 1. Ensure wallet is connected
      let wallet = getStoredWallet();
      if (!wallet) {
        const connected = await connectWallet();
        wallet = {
          address: connected.address,
          paymentAddress: connected.address,
          ordinalsAddress: connected.address,
          publicKey: connected.publicKey,
          balanceBTC: 0,
          network: connected.network === 'testnet4' ? 'Testnet' : 'Mainnet',
          walletType: 'software',
        };
        storeWallet(wallet);
        setWalletConnected(true);
      }

      // 2. Load WASM binary
      const wasmBinary = await loadWasmBinary();

      // 3. Get app ID and VK from environment
      const appId = process.env.NEXT_PUBLIC_CHARMS_APP_ID || '';
      const appVk = process.env.NEXT_PUBLIC_CHARMS_APP_VK || '';

      if (!appId || !appVk) {
        throw new Error(
          'App ID and Verification Key must be set in environment variables.\n' +
          'Please set NEXT_PUBLIC_CHARMS_APP_ID and NEXT_PUBLIC_CHARMS_APP_VK in .env.local\n' +
          'You can get these by running: cd charm-pay-app && ./setup-env.sh'
        );
      }

      // 4. Convert amounts to satoshis
      const amountPerIntervalSats = Math.floor(parseFloat(formData.amountPerInterval) * 100000000);
      const totalLockedSats = Math.floor(parseFloat(formData.totalLocked) * 100000000);

      if (amountPerIntervalSats <= 0 || totalLockedSats <= 0) {
        throw new Error('Amounts must be greater than 0');
      }

      if (totalLockedSats < amountPerIntervalSats) {
        throw new Error('Total locked amount must be at least equal to amount per interval');
      }

      // 5. Generate subscription ID
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // 6. Create subscription
      const result = await createSubscription({
        recipientAddress: formData.recipient,
        amountPerCycle: amountPerIntervalSats,
        totalLocked: totalLockedSats,
        subscriptionId,
        appId,
        wasmBinary,
      });

      // 7. Store subscription info (you might want to store this in a database)
      const subscriptionInfo = {
        id: subscriptionId,
        recipient: formData.recipient,
        amountPerInterval: formData.amountPerInterval,
        interval: formData.interval,
        totalLocked: formData.totalLocked,
        subscriptionUtxo: result.subscriptionUtxo,
        tokenUtxo: result.tokenUtxo,
        txids: result.txids,
        createdAt: new Date().toISOString(),
      };

      // Store in localStorage for now (in production, use a database)
      const subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '[]');
      subscriptions.push(subscriptionInfo);
      localStorage.setItem('subscriptions', JSON.stringify(subscriptions));

      // 8. Redirect to subscription detail page
      router.push(`/subscription/${subscriptionId}`);
    } catch (err: any) {
      console.error('Error creating subscription:', err);
      setError(err.message || 'Failed to create subscription');
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleConnectWallet = async () => {
    try {
      const connected = await connectWallet();
      const wallet = {
        address: connected.address,
        paymentAddress: connected.address,
        ordinalsAddress: connected.address,
        publicKey: connected.publicKey,
        balanceBTC: 0,
          network: connected.network === 'testnet4' ? 'Testnet' : 'Mainnet',
        walletType: 'software',
      };
      storeWallet(wallet);
      setWalletConnected(true);
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    }
  };

  return (
    <div className="min-h-screen bg-black relative">
      <BackgroundPattern />
      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Create Subscription</h1>
          <p className="text-white/60 font-light">
            Set up a new programmable Bitcoin subscription
          </p>
        </div>

        {!walletConnected && (
          <Card className="mb-6">
            <div className="text-center py-4">
              <p className="text-white/60 mb-4">Connect your wallet to create a subscription</p>
              <Button onClick={handleConnectWallet} variant="primary">
                Connect Wallet
              </Button>
            </div>
          </Card>
        )}

        {error && (
          <Card className="mb-6 border-red-500/50 bg-red-500/10">
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        )}

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Recipient BTC Address"
              name="recipient"
              type="text"
              placeholder="tb1q..."
              value={formData.recipient}
              onChange={handleChange}
              required
              disabled={!walletConnected || isSubmitting}
            />

            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Amount per Interval (BTC)"
                name="amountPerInterval"
                type="number"
                step="0.00000001"
                placeholder="0.001"
                value={formData.amountPerInterval}
                onChange={handleChange}
                required
                disabled={!walletConnected || isSubmitting}
              />

              <Select
                label="Interval"
                name="interval"
                value={formData.interval}
                onChange={handleChange}
                options={[
                  { value: "7 days", label: "Weekly" },
                  { value: "30 days", label: "Monthly" },
                  { value: "90 days", label: "Quarterly" },
                ]}
                disabled={!walletConnected || isSubmitting}
              />
            </div>

            <Input
              label="Total Lock Amount (BTC)"
              name="totalLocked"
              type="number"
              step="0.00000001"
              placeholder="0.01"
              value={formData.totalLocked}
              onChange={handleChange}
              required
              disabled={!walletConnected || isSubmitting}
            />

            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                disabled={!walletConnected || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Creating..." : "Create Charm Subscription"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
