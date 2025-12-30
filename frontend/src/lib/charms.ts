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
  chain: 'bitcoin' | 'cardano'; // Chain type
  spell: Spell;
  binaries: Record<string, string>; // app VK (hex) -> app binary (base64 encoded RISC-V ELF)
  prev_txs: Array<{ bitcoin: string } | { cardano: string }>; // Array of transaction objects with chain variant
  funding_utxo: string;
  funding_utxo_value: number;
  change_address: string;
  fee_rate?: number;
}

export interface ProverResponse {
  commit_tx: string; // Hex encoded commit transaction
  spell_tx: string; // Hex encoded spell transaction
}

/**
 * Generate spell JSON for creating a subscription
 * 
 * NOTE: The contract expects MinimalSubscriptionState with all fields.
 * However, for backward compatibility, we're using the simplified format
 * with just ticker and remaining. The contract should handle both formats.
 */
export function createSubscriptionSpell(params: {
  appId: string;
  appVk: string;
  subscriberAddress: string;
  subscriptionId: string;
  totalLockedAmount: number; // satoshis
  fundingUtxo: string;
  payerPubkey?: string; // Optional: payer public key
  merchantPubkey?: string; // Optional: merchant public key
  amountSats?: number; // Optional: amount per cycle
  billingIntervalBlocks?: number; // Optional: billing interval
  lastPaymentBlock?: number; // Optional: last payment block (usually 0 for new subscriptions)
}): Spell {
  // Use simplified format for backward compatibility
  // The contract should accept both formats
  const nftContent: any = {
    ticker: `SUBSCRIPTION-${params.subscriptionId}`,
    remaining: params.totalLockedAmount,
  };

  // If full state fields are provided, include them
  // This matches the MinimalSubscriptionState structure
  if (params.payerPubkey && params.merchantPubkey && params.amountSats !== undefined) {
    nftContent.payer_pubkey = params.payerPubkey;
    nftContent.merchant_pubkey = params.merchantPubkey;
    nftContent.amount_sats = params.amountSats;
    nftContent.billing_interval_blocks = params.billingIntervalBlocks || 144; // Default: ~1 day
    nftContent.last_payment_block = params.lastPaymentBlock || 0; // Default: 0 for new subscriptions
    nftContent.is_active = true;
    nftContent.remaining_balance = params.totalLockedAmount;
  }

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
          $00: nftContent,
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
  proverUrl: string = 'https://v8.charms.dev/spells/prove'
): Promise<string[] | ProverResponse> {
  try {
    // Log request details for debugging (without sensitive data)
    // Also log the full spell JSON to see what's being sent
    const spellJson = JSON.stringify(request.spell);
    console.log('Prover API request:', {
      chain: request.chain,
      funding_utxo: request.funding_utxo,
      funding_utxo_value: request.funding_utxo_value,
      change_address: request.change_address,
      fee_rate: request.fee_rate,
      prev_txs_count: request.prev_txs?.length || 0,
      binaries_count: Object.keys(request.binaries || {}).length,
      spell_version: request.spell?.version,
      spell_apps_count: Object.keys(request.spell?.apps || {}).length,
      spell_ins_count: request.spell?.ins?.length || 0,
      spell_outs_count: request.spell?.outs?.length || 0,
      spell_private_inputs: request.spell?.private_inputs,
      full_spell_json: spellJson.substring(0, 500) + '...', // First 500 chars
    });
    
    const response = await fetch(proverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorText = await response.text();
        // Try to parse as JSON first
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorText;
        } catch {
          // Not JSON, use as-is
          errorMessage = errorText;
        }
      } catch {
        errorMessage = `HTTP ${response.status} ${response.statusText}`;
      }
      
      // Log the full error for debugging
      console.error('Prover API error details:', {
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
        url: proverUrl
      });
      
      throw new Error(`Prover API error (${response.status}): ${errorMessage}`);
    }

    // Prover returns [commit_tx, spell_tx] as an array
    // Each transaction can be a hex string or an object with bitcoin/cardano field
    const result = await response.json();
    
    // Log the raw response for debugging
    console.log('Prover API raw response:', {
      isArray: Array.isArray(result),
      length: Array.isArray(result) ? result.length : 'N/A',
      keys: !Array.isArray(result) && typeof result === 'object' ? Object.keys(result) : [],
      preview: JSON.stringify(result).substring(0, 200),
      firstItemType: Array.isArray(result) && result.length > 0 ? typeof result[0] : 'N/A',
      firstItemKeys: Array.isArray(result) && result.length > 0 && typeof result[0] === 'object' ? Object.keys(result[0]) : []
    });
    
    // Return as-is - let subscriptionFlow.ts handle the format conversion
    // The Prover can return:
    // - Array of hex strings: ["hex1", "hex2"]
    // - Array of objects: [{"bitcoin": "hex1"}, {"bitcoin": "hex2"}]
    // - Object: { commit_tx: "hex1", spell_tx: "hex2" }
    // - Object with nested objects: { commit_tx: {"bitcoin": "hex1"}, spell_tx: {"bitcoin": "hex2"} }
    return result;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(
        `Cannot connect to Prover API at ${proverUrl}. ` +
        `Please check:\n` +
        `1. The Prover URL is correct (check NEXT_PUBLIC_CHARMS_PROVER_URL)\n` +
        `2. You have internet connectivity\n` +
        `3. The Prover service is running\n` +
        `Note: The Charms Prover may need to be run locally or use a different endpoint.`
      );
    }
    throw error;
  }
}

/**
 * Sign transactions using Sats Connect
 * Note: This is a placeholder - actual implementation depends on Sats Connect API
 */
export async function signTransactions(
  _transactions: string[], // Hex encoded transactions
  _wallet: any // Sats Connect wallet instance
): Promise<string[]> {
  // TODO: Implement actual Sats Connect signing
  // This will depend on the Sats Connect API
  throw new Error('Sats Connect signing not yet implemented');
}

/**
 * Broadcast transactions to Bitcoin network as a package
 */
export async function broadcastTransactions(
  transactions: string[], // Hex encoded signed transactions [commit_tx, spell_tx]
  network: 'mainnet' | 'testnet4' = 'testnet4'
): Promise<string[]> {
  // Validate we have exactly 2 transactions (commit + spell)
  if (transactions.length !== 2) {
    throw new Error(`Expected 2 transactions (commit + spell), got ${transactions.length}`);
  }

  // Validate transaction hex format
  for (let i = 0; i < transactions.length; i++) {
    const txHex = transactions[i];
    
    if (!txHex || txHex.length === 0) {
      throw new Error(`Transaction ${i + 1} is empty`);
    }

    if (txHex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(txHex)) {
      throw new Error(`Transaction ${i + 1} is not valid hex: ${txHex.substring(0, 100)}...`);
    }
  }

  // According to Charms docs, broadcast as a package
  // For mempool.space, we can try broadcasting individually first
  // (Package submission might require Bitcoin Core node)
  const apiUrl =
    network === 'testnet4'
      ? 'https://mempool.space/testnet4/api/tx'
      : 'https://blockstream.info/api/tx';

  const txids: string[] = [];

  // Broadcast commit transaction first
  console.log('Broadcasting commit transaction...');
  const commitResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: transactions[0],
  });

  if (!commitResponse.ok) {
    const errorText = await commitResponse.text();
    throw new Error(`Failed to broadcast commit transaction: ${errorText}`);
  }

  const commitTxid = (await commitResponse.text()).trim();
  txids.push(commitTxid);
  console.log('Commit transaction broadcast:', commitTxid);

  // Wait a moment for commit tx to propagate
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Broadcast spell transaction (depends on commit tx)
  console.log('Broadcasting spell transaction...');
  const spellResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: transactions[1],
  });

  if (!spellResponse.ok) {
    const errorText = await spellResponse.text();
    throw new Error(`Failed to broadcast spell transaction: ${errorText}`);
  }

  const spellTxid = (await spellResponse.text()).trim();
  txids.push(spellTxid);
  console.log('Spell transaction broadcast:', spellTxid);

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
export function calculateAppId(_utxo: string): string {
  // App ID is sha256 of the initial UTXO
  // This should be done server-side or with a crypto library
  // For now, return placeholder
  return 'app_id_placeholder';
}

