"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import BackgroundPattern from "@/components/ui/BackgroundPattern";
import {
  connectXverseWallet,
  isXverseInstalled,
  storeWallet,
  getStoredWallet,
  type XverseWallet,
} from "@/lib/xverseWallet";

export default function ConnectPage() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [wallet, setWallet] = useState<XverseWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWalletDetected, setIsWalletDetected] = useState(false);

  useEffect(() => {
    // Check if wallet is already connected
    const stored = getStoredWallet();
    if (stored) {
      setWallet(stored);
      setConnected(true);
      // Redirect if already connected
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    }

    // Check if Xverse is installed
    setIsWalletDetected(isXverseInstalled());
  }, [router]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await connectXverseWallet();

      if (result.success && result.wallet) {
        setWallet(result.wallet);
        setConnected(true);
        storeWallet(result.wallet);

        // Redirect to dashboard
        setTimeout(() => {
          router.push("/dashboard");
        }, 1000);
      } else {
        setError(result.error || "Failed to connect wallet");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative">
      <BackgroundPattern />
      <div className="relative z-10 max-w-md w-full px-6">
        <Card>
          <div className="text-center space-y-6">
            <h1 className="text-3xl font-semibold">Connect Wallet</h1>
            <p className="text-white/60 font-light">
              Connect your Xverse wallet to start using CharmPay
            </p>

            {!isWalletDetected && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  Xverse wallet not detected. Please install the{" "}
                  <a
                    href="https://www.xverse.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-yellow-300"
                  >
                    Xverse extension
                  </a>
                  .
                </p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {!connected ? (
              <div className="pt-4 space-y-4">
                <Button
                  variant="primary"
                  onClick={handleConnect}
                  disabled={isConnecting || !isWalletDetected}
                  className="w-full"
                >
                  {isConnecting ? "Connecting..." : "Connect Xverse Wallet"}
                </Button>
                {isWalletDetected && (
                  <p className="text-xs text-white/40">
                    You'll be prompted to approve the connection in your Xverse wallet
                  </p>
                )}
              </div>
            ) : (
              <div className="pt-4 space-y-4">
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-sm text-white/60 mb-2">Payment Address</p>
                  <p className="font-mono text-sm break-all">{wallet?.paymentAddress}</p>
                </div>
                {wallet?.ordinalsAddress && wallet.ordinalsAddress !== wallet.paymentAddress && (
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-sm text-white/60 mb-2">Ordinals Address</p>
                    <p className="font-mono text-sm break-all">{wallet.ordinalsAddress}</p>
                  </div>
                )}
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-sm text-white/60 mb-2">Balance</p>
                  <p className="text-lg font-semibold">{wallet?.balanceBTC.toFixed(8)} BTC</p>
                  <p className="text-xs text-white/40 mt-1">Network: {wallet?.network}</p>
                </div>
                <p className="text-sm text-white/60">Redirecting to dashboard...</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

