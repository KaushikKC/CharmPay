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
  proverUrl: string = 'https://v8.charms.dev/spells/prove'
): Promise<string[] | ProverResponse> {
  try {
    const response = await fetch(proverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Prover API error (${response.status}): ${error}`);
    }

    // Prover returns [commit_tx, spell_tx] as an array of hex strings
    const result = await response.json();
    
    // Log the raw response for debugging
    console.log('Prover API raw response:', {
      isArray: Array.isArray(result),
      length: Array.isArray(result) ? result.length : 'N/A',
      keys: !Array.isArray(result) && typeof result === 'object' ? Object.keys(result) : [],
      preview: JSON.stringify(result).substring(0, 200)
    });
    
    // Return as array (official format) or as object for backward compatibility
    if (Array.isArray(result)) {
      if (result.length === 2 && result[0] && result[1]) {
        return result;
      } else {
        console.error('Prover returned array with invalid format:', {
          length: result.length,
          hasCommit: !!result[0],
          hasSpell: !!result[1],
          commitType: typeof result[0],
          spellType: typeof result[1]
        });
        throw new Error(`Prover returned invalid array format: expected 2 non-empty strings, got length ${result.length}`);
      }
    }
    
    // If it's an object, extract commit_tx and spell_tx
    if (result && typeof result === 'object') {
      const commitTx = result.commit_tx || result[0] || '';
      const spellTx = result.spell_tx || result[1] || '';
      
      if (!commitTx || !spellTx) {
        console.error('Prover returned object with missing transactions:', {
          hasCommit: !!commitTx,
          hasSpell: !!spellTx,
          commitLength: typeof commitTx === 'string' ? commitTx.length : 'N/A',
          spellLength: typeof spellTx === 'string' ? spellTx.length : 'N/A'
        });
        throw new Error('Prover response missing commit_tx or spell_tx');
      }
      
      return {
        commit_tx: commitTx,
        spell_tx: spellTx,
      };
    }
    
    // Unexpected format
    console.error('Unexpected Prover response format:', result);
    throw new Error('Prover returned unexpected response format');
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

