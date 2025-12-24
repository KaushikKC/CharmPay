"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import GooeyNav from "@/components/ui/GooeyNav";
import { useMemo, useState, useEffect } from "react";
import Button from "../ui/Button";
import Image from "next/image";
import {
  connectXverseWallet,
  isXverseInstalled,
  getStoredWallet,
  clearStoredWallet,
  storeWallet,
  updateStoredWalletBalance,
  type XverseWallet,
} from "@/lib/xverseWallet";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Creator", href: "/creator" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [wallet, setWallet] = useState<XverseWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWalletDetected, setIsWalletDetected] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check if wallet is already connected
    const stored = getStoredWallet();
    if (stored) {
      setWallet(stored);
      // Refresh balance for stored wallet
      updateStoredWalletBalance().then((updated) => {
        if (updated) {
          setWallet(updated);
        }
      }).catch((error) => {
        console.error("Failed to refresh wallet balance:", error);
      });
    }

    // Check if Xverse is installed
    setIsWalletDetected(isXverseInstalled());
  }, []);

  const activeIndex = useMemo(() => {
    // Only show active state for Dashboard or Creator pages, not for home page
    if (pathname === "/") {
      return -1; // No active item on home page
    }
    const index = NAV_ITEMS.findIndex(item => item.href === pathname);
    return index !== -1 ? index : -1;
  }, [pathname]);

  const handleNavClick = (href: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    // Check if wallet is connected before allowing navigation
    if (!wallet || !wallet.paymentAddress) {
      setAlertMessage("Please connect your wallet first to access this page.");
      setTimeout(() => setAlertMessage(null), 5000);
      return;
    }
    
    // Wallet is connected, allow navigation
    router.push(href);
  };

  const navItems = NAV_ITEMS.map((item) => ({
    label: item.label,
    href: item.href,
    isPrimary: false,
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => handleNavClick(item.href, e),
  }));

  const handleConnect = async () => {
    setIsConnecting(true);
    setAlertMessage(null);
    try {
      const result = await connectXverseWallet();
      if (result.success && result.wallet) {
        setWallet(result.wallet);
        storeWallet(result.wallet); // Store wallet in localStorage
        // Redirect to dashboard after connection
        router.push("/dashboard");
      } else {
        setAlertMessage(result.error || "Failed to connect wallet");
        setTimeout(() => setAlertMessage(null), 5000);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "An error occurred while connecting";
      setAlertMessage(errorMsg);
      setTimeout(() => setAlertMessage(null), 5000);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearStoredWallet();
    setWallet(null);
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/creator")) {
      router.push("/");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full px-6 py-4">
      <div className="max-w-7xl mx-auto space-y-2">
        {/* Alert Message */}
        {alertMessage && (
          <div className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-400 text-center">{alertMessage}</p>
          </div>
        )}
        
        <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl shadow-lg">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-xl font-bold relative z-10">
                <Image src="/logo.svg" alt="CharmPay" width={20} height={20} className="w-10 h-10" />
              </Link>
              <div className="flex items-center">
                <GooeyNav
                  items={navItems}
                  particleCount={15}
                  particleDistances={[90, 10]}
                  particleR={100}
                  initialActiveIndex={activeIndex >= 0 ? activeIndex : -1}
                  animationTime={600}
                  timeVariance={300}
                  colors={[1, 2, 3, 1, 2, 3, 1, 4]}
                />
              </div>
              {wallet && wallet.paymentAddress ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-white/60 font-mono">
                      {wallet.paymentAddress.slice(0, 6)}...{wallet.paymentAddress.slice(-4)}
                    </p>
                    <p className="text-xs text-white/40">{wallet.balanceBTC.toFixed(4)} BTC</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    className="relative z-10 text-sm"
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleConnect}
                  disabled={isConnecting || !isWalletDetected}
                  className="relative z-10"
                >
                  {isConnecting ? "Connecting..." : "Connect wallet"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

