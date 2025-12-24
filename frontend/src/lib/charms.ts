/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Charms Protocol Integration for CharmPay
 * 
 * This module handles:
 * - Spell JSON generation
 * - Prover API communication
 * - Transaction signing with Sats Connect
 * - Transaction broadcasting
 */

import { extractCharmsForWallet } from 'charms-js';

// Types
export interface SubscriptionState {
  subscription_id: string;
  recipient: string;
  amount_per_cycle: number; // in satoshis
  remaining_balance: number; // in satoshis
  total_locked: number; // in satoshis
}

export interface Spell {
  version: number;
  apps: Record<string, string>;
  ins?: Array<{
    utxo_id: string;
    charms: Record<string, any>;
  }>;
  outs: Array<{
    address: string;
    charms: Record<string, any>;
    sats?: number;
  }>;
  private_inputs?: Record<string, string>;
}

export interface ProverRequest {
  spell: Spell;
  app_bin: string; // Base64 encoded WASM
  prev_txs: Record<string, string>; // txid -> hex
  funding_utxo: string;
  funding_utxo_value: number;
  change_address: string;
  fee_rate?: number;
}

export interface ProverResponse {
  transactions: Array<{
    bitcoin: string; // Hex encoded transaction
  }>;
}

/**
 * Generate spell JSON for creating a subscription
 */
export function createSubscriptionSpell(params: {
  appId: string;
  appVk: string;
  subscriberAddress: string;
  subscriptionId: string;
  totalLockedAmount: number; // satoshis
  fundingUtxo: string;
}): Spell {
  return {
    version: 8,
    apps: {
      $00: `n/${params.appId}/${params.appVk}`, // NFT app
      $01: `t/${params.appId}/${params.appVk}`, // Token app
    },
    private_inputs: {
      $00: params.fundingUtxo,
    },
    ins: [
      {
        utxo_id: params.fundingUtxo,
        charms: {},
      },
    ],
    outs: [
      {
        address: params.subscriberAddress,
        charms: {
          $00: {
            ticker: `SUBSCRIPTION-${params.subscriptionId}`,
            remaining: params.totalLockedAmount,
          },
        },
      },
      {
        address: params.subscriberAddress,
        charms: {
          $01: params.totalLockedAmount,
        },
      },
    ],
  };
}

/**
 * Generate spell JSON for executing a payment
 */
export function executePaymentSpell(params: {
  appId: string;
  appVk: string;
  subscriptionUtxo: string;
  tokenUtxo: string;
  subscriptionId: string;
  currentRemainingBalance: number;
  paymentAmount: number;
  newRemainingBalance: number;
  subscriberAddress: string;
  recipientAddress: string;
}): Spell {
  return {
    version: 8,
    apps: {
      $00: `n/${params.appId}/${params.appVk}`,
      $01: `t/${params.appId}/${params.appVk}`,
    },
    ins: [
      {
        utxo_id: params.subscriptionUtxo,
        charms: {
          $00: {
            ticker: `SUBSCRIPTION-${params.subscriptionId}`,
            remaining: params.currentRemainingBalance,
          },
        },
      },
      {
        utxo_id: params.tokenUtxo,
        charms: {
          $01: params.currentRemainingBalance,
        },
      },
    ],
    outs: [
      {
        address: params.subscriberAddress,
        charms: {
          $00: {
            ticker: `SUBSCRIPTION-${params.subscriptionId}`,
            remaining: params.newRemainingBalance,
          },
        },
      },
      {
        address: params.recipientAddress,
        charms: {
          $01: params.paymentAmount,
        },
      },
      {
        address: params.subscriberAddress,
        charms: {
          $01: params.newRemainingBalance,
        },
      },
    ],
  };
}

/**
 * Generate spell JSON for cancelling a subscription
 */
export function cancelSubscriptionSpell(params: {
  appId: string;
  appVk: string;
  subscriptionUtxo: string;
  tokenUtxo: string;
  subscriptionId: string;
  remainingBalance: number;
  subscriberAddress: string;
}): Spell {
  return {
    version: 8,
    apps: {
      $00: `n/${params.appId}/${params.appVk}`,
      $01: `t/${params.appId}/${params.appVk}`,
    },
    ins: [
      {
        utxo_id: params.subscriptionUtxo,
        charms: {
          $00: {
            ticker: `SUBSCRIPTION-${params.subscriptionId}`,
            remaining: params.remainingBalance,
          },
        },
      },
      {
        utxo_id: params.tokenUtxo,
        charms: {
          $01: params.remainingBalance,
        },
      },
    ],
    outs: [
      {
        address: params.subscriberAddress,
        charms: {
          $00: {
            ticker: `SUBSCRIPTION-${params.subscriptionId}-CANCELLED`,
            remaining: 0,
          },
        },
      },
      {
        address: params.subscriberAddress,
        charms: {
          $01: params.remainingBalance,
        },
      },
    ],
  };
}

/**
 * Send spell to Prover API and get unsigned transactions
 */
export async function proveSpell(
  request: ProverRequest,
  proverUrl: string = 'https://prover.charms.dev/prove'
): Promise<ProverResponse> {
  const response = await fetch(proverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Prover API error: ${error}`);
  }

  return response.json();
}

/**
 * Sign transactions using Sats Connect
 * Note: This is a placeholder - actual implementation depends on Sats Connect API
 */
export async function signTransactions(
  transactions: string[], // Hex encoded transactions
  wallet: any // Sats Connect wallet instance
): Promise<string[]> {
  // TODO: Implement actual Sats Connect signing
  // This will depend on the Sats Connect API
  throw new Error('Sats Connect signing not yet implemented');
}

/**
 * Broadcast transactions to Bitcoin network
 */
export async function broadcastTransactions(
  transactions: string[], // Hex encoded signed transactions
  network: 'mainnet' | 'testnet4' = 'testnet4'
): Promise<string[]> {
  // For testnet4, you can use a public API or your own node
  const apiUrl =
    network === 'testnet4'
      ? 'https://api.blockstream.space/testnet/api/tx'
      : 'https://blockstream.info/api/tx';

  const txids: string[] = [];

  for (const txHex of transactions) {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: txHex,
    });

    if (!response.ok) {
      throw new Error(`Failed to broadcast transaction: ${await response.text()}`);
    }

    const txid = await response.text();
    txids.push(txid);
  }

  return txids;
}

/**
 * Extract charms from a transaction for a wallet
 */
export async function extractCharms(
  txHex: string,
  txId: string,
  walletOutpoints: Set<string>, // Set of "txid:vout"
  network: 'mainnet' | 'testnet4' = 'testnet4'
) {
  return extractCharmsForWallet(txHex, txId, walletOutpoints, network);
}

/**
 * Calculate app ID from initial UTXO
 */
export function calculateAppId(utxo: string): string {
  // App ID is sha256 of the initial UTXO
  // This should be done server-side or with a crypto library
  // For now, return placeholder
  return 'app_id_placeholder';
}

