import { request, RpcErrorCode } from "sats-connect";

export interface XverseWallet {
  address: string;
  paymentAddress: string;
  ordinalsAddress: string;
  publicKey: string;
  balanceBTC: number;
  network: string;
  walletType: string;
}

export interface WalletConnectionResult {
  success: boolean;
  wallet?: XverseWallet;
  error?: string;
}

/**
 * Detect if Xverse wallet is installed
 */
export function isXverseInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof (window as { BitcoinProvider?: unknown }).BitcoinProvider !== "undefined" ||
    typeof (window as { xverse?: unknown }).xverse !== "undefined" ||
    document.querySelector('script[src*="xverse"]') !== null
  );
}

/**
 * Connect to Xverse wallet using Sats Connect
 */
export async function connectXverseWallet(): Promise<WalletConnectionResult> {
  try {
    // Check if wallet is installed
    if (!isXverseInstalled()) {
      return {
        success: false,
        error: "Xverse wallet not detected. Please install Xverse wallet extension.",
      };
    }

    // Request connection with payment and ordinals addresses
    // Note: Type assertion needed as sats-connect types are strict but runtime accepts string literals
    const connectParams = {
      addresses: ["payment", "ordinals"],
      message: "Connect your Xverse wallet to use CharmPay",
      network: "Testnet",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await request("wallet_connect", connectParams as any);

    if (response.status === "success") {
      const result = response.result;
      
      // Extract payment address
      const paymentAddressItem = result.addresses.find(
        (addr: { purpose: string }) => addr.purpose === "payment"
      );
      
      // Extract ordinals address
      const ordinalsAddressItem = result.addresses.find(
        (addr: { purpose: string }) => addr.purpose === "ordinals"
      );

      if (!paymentAddressItem) {
        return {
          success: false,
          error: "Payment address not found",
        };
      }

      // Verify connection is established before fetching balance
      // Small delay to ensure wallet connection is fully processed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fetch balance using sats-connect getBalance method
      // Note: getBalance uses the connected wallet's payment address automatically
      let balanceResult = 0;
      try {
        balanceResult = await fetchBTCBalanceViaSatsConnect();
      } catch (error) {
        console.warn("Failed to fetch balance via sats-connect, using Blockstream fallback:", error);
        // Fallback to Blockstream API if sats-connect fails
        balanceResult = await fetchBTCBalanceFromBlockstream(paymentAddressItem.address, "Testnet");
      }

      const wallet: XverseWallet = {
        address: paymentAddressItem.address, // Use payment address as primary
        paymentAddress: paymentAddressItem.address,
        ordinalsAddress: ordinalsAddressItem?.address || paymentAddressItem.address,
        publicKey: paymentAddressItem.publicKey,
        balanceBTC: balanceResult,
        network: result.network?.bitcoin?.name || "Testnet",
        walletType: result.walletType || "software",
      };

      return {
        success: true,
        wallet,
      };
    } else {
      if (response.error?.code === RpcErrorCode.USER_REJECTION) {
        return {
          success: false,
          error: "Connection request was rejected",
        };
      }
      return {
        success: false,
        error: response.error?.message || "Failed to connect wallet",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to connect to Xverse wallet";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if wallet is connected and has permissions
 */
export async function checkWalletConnection(): Promise<boolean> {
  try {
    // Check current permissions
    const permResponse = await request("wallet_getCurrentPermissions", undefined);
    if (permResponse.status === "success" && permResponse.result && Array.isArray(permResponse.result)) {
      const permissions = permResponse.result as Array<{ type: string; actions: { read?: boolean } }>;
      return permissions.some(perm => perm.actions?.read === true);
    }
    return false;
  } catch (error) {
    console.error("Error checking wallet connection:", error);
    return false;
  }
}

/**
 * Fetch BTC balance using sats-connect getBalance method
 * Reference: https://docs.xverse.app/sats-connect/bitcoin-methods/getbalance
 * 
 * Note: getBalance takes undefined as parameter and automatically uses
 * the connected wallet's payment address. No address parameter needed.
 */
export async function fetchBTCBalanceViaSatsConnect(): Promise<number> {
  try {
    // First verify wallet is connected
    const isConnected = await checkWalletConnection();
    if (!isConnected) {
      console.warn("Wallet not connected, requesting permissions...");
      // Request permissions if not connected
      const permResponse = await request("wallet_requestPermissions", undefined);
      if (permResponse.status !== "success") {
        throw new Error("Failed to get wallet permissions");
      }
    }

    // Use sats-connect getBalance method - takes undefined, uses connected wallet's payment address
    // Reference: https://docs.xverse.app/sats-connect/bitcoin-methods/getbalance
    const response = await request('getBalance', undefined);

    if (response.status === 'success') {
      // getBalance returns: { confirmed: string, unconfirmed: string, total: string }
      // Values are returned as strings in satoshis
      const result = response.result as { confirmed?: string; unconfirmed?: string; total?: string };
      const totalSatoshisStr = result.total ?? result.confirmed ?? "0";
      const totalSatoshis = parseInt(totalSatoshisStr, 10) || 0;
      const balanceBTC = totalSatoshis / 100000000;
      console.log("Balance fetched successfully:", balanceBTC, "BTC");
      return balanceBTC;
    }
    
    // Handle permission errors - request permissions if needed
    if (response.error?.code === RpcErrorCode.ACCESS_DENIED) {
      console.log("Access denied, requesting permissions...");
      // Request permissions and try again
      const permResponse = await request("wallet_requestPermissions", undefined);
      if (permResponse.status === "success") {
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 300));
        // Retry getBalance after permissions granted
        const retryResponse = await request('getBalance', undefined);
        if (retryResponse.status === 'success') {
          const result = retryResponse.result as { confirmed?: string; unconfirmed?: string; total?: string };
          const totalSatoshisStr = result.total ?? result.confirmed ?? "0";
          const totalSatoshis = parseInt(totalSatoshisStr, 10) || 0;
          const balanceBTC = totalSatoshis / 100000000;
          console.log("Balance fetched after permission request:", balanceBTC, "BTC");
          return balanceBTC;
        }
      }
    }
    
    // If sats-connect fails, throw error so caller can use fallback
    console.error("Failed to fetch balance via sats-connect:", response.error);
    throw new Error(response.error?.message || "Failed to fetch balance");
  } catch (error) {
    console.error("Error fetching balance via sats-connect:", error);
    throw error; // Re-throw so caller can handle fallback
  }
}

/**
 * Fetch BTC balance from Blockstream API (fallback method)
 * Uses testnet4 endpoint: https://mempool.space/testnet4/api/address/{address}
 */
export async function fetchBTCBalanceFromBlockstream(
  address: string,
  network: "Mainnet" | "Testnet" | "Signet" | "Regtest" = "Testnet"
): Promise<number> {
  try {
    // Use mempool.space for testnet4 (Bitcoin testnet)
    const apiUrl =
      network === "Testnet"
        ? `https://mempool.space/testnet4/api/address/${address}`
        : `https://blockstream.info/api/address/${address}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch balance from Blockstream");
    }

    const data = await response.json();
    // Balance is returned in satoshis, convert to BTC
    const balanceSatoshis = data.chain_stats?.funded_txo_sum || 0;
    const spentSatoshis = data.chain_stats?.spent_txo_sum || 0;
    const balanceBTC = (balanceSatoshis - spentSatoshis) / 100000000;

    return Math.max(0, balanceBTC);
  } catch (error) {
    console.error("Error fetching balance from Blockstream:", error);
    // Return 0 if balance fetch fails
    return 0;
  }
}

/**
 * Disconnect from Xverse wallet
 */
export async function disconnectXverseWallet(): Promise<boolean> {
  try {
    await request("wallet_disconnect", null);
    return true;
  } catch (error) {
    console.error("Error disconnecting wallet:", error);
    return false;
  }
}

/**
 * Get current connected wallet from localStorage
 */
export function getStoredWallet(): XverseWallet | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("wallet");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as XverseWallet;
  } catch {
    return null;
  }
}

/**
 * Store wallet in localStorage
 */
export function storeWallet(wallet: XverseWallet): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("wallet", JSON.stringify(wallet));
}

/**
 * Clear stored wallet
 */
export function clearStoredWallet(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("wallet");
}

/**
 * Refresh balance for a stored wallet address
 * Uses Blockstream API since we may not have active connection
 */
export async function refreshWalletBalance(address: string, network: string = "Testnet"): Promise<number> {
  return await fetchBTCBalanceFromBlockstream(address, network as "Mainnet" | "Testnet" | "Signet" | "Regtest");
}

/**
 * Update stored wallet balance
 */
export async function updateStoredWalletBalance(): Promise<XverseWallet | null> {
  const stored = getStoredWallet();
  if (!stored) return null;

  try {
    // Try to get balance via sats-connect first (if wallet is still connected)
    const balance = await fetchBTCBalanceViaSatsConnect();
    
    // If sats-connect returns 0 and we have an address, try Blockstream
    const finalBalance = balance > 0 ? balance : await refreshWalletBalance(stored.paymentAddress, stored.network);
    
    const updatedWallet: XverseWallet = {
      ...stored,
      balanceBTC: finalBalance,
    };
    
    storeWallet(updatedWallet);
    return updatedWallet;
  } catch (error) {
    console.error("Error updating wallet balance:", error);
    // Fallback to Blockstream
    const balance = await refreshWalletBalance(stored.paymentAddress, stored.network);
    const updatedWallet: XverseWallet = {
      ...stored,
      balanceBTC: balance,
    };
    storeWallet(updatedWallet);
    return updatedWallet;
  }
}

