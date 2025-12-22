"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { mockWallet } from "@/lib/mockWallet";

export default function ConnectPage() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate wallet connection
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setConnected(true);
    setIsConnecting(false);
    
    // Store mock wallet in localStorage
    localStorage.setItem("wallet", JSON.stringify(mockWallet));
    
    // Redirect to dashboard
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-6">
        <Card>
          <div className="text-center space-y-6">
            <h1 className="text-3xl font-semibold">Connect Wallet</h1>
            <p className="text-white/60 font-light">
              Connect your Bitcoin wallet to start using CharmPay
            </p>
            
            {!connected ? (
              <div className="pt-4">
                <Button
                  variant="primary"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full"
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </Button>
              </div>
            ) : (
              <div className="pt-4 space-y-4">
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-sm text-white/60 mb-2">Address</p>
                  <p className="font-mono text-sm break-all">{mockWallet.address}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-sm text-white/60 mb-2">Balance</p>
                  <p className="text-lg font-semibold">{mockWallet.balanceBTC} BTC</p>
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

