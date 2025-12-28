/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Complete Subscription Flow Implementation
 * 
 * This module orchestrates the entire subscription lifecycle:
 * 1. Create subscription
 * 2. Execute payments
 * 3. Cancel subscription
 */

import {
  createSubscriptionSpell,
  executePaymentSpell,
  cancelSubscriptionSpell,
  proveSpell,
  broadcastTransactions,
  type Spell,
} from './charms';
import { 
  connectWallet, 
  signTransaction, 
  getUnspentUtxos, 
  getPreviousTransaction,
  type SatsConnectWallet 
} from './satsConnect';
import { extractCharms } from './charms';

// Configuration
const PROVER_URL = process.env.NEXT_PUBLIC_CHARMS_PROVER_URL || 'https://v8.charms.dev/spells/prove';
const NETWORK: 'mainnet' | 'testnet4' = 'testnet4';
const APP_VK = process.env.NEXT_PUBLIC_CHARMS_APP_VK || ''; // Set in .env.local

/**
 * Track used funding UTXOs to avoid "duplicate funding UTXO spend" errors
 * According to Charms docs, each spell needs a unique funding UTXO
 */
const USED_UTXOS_KEY = 'charmpay_used_utxos';

function getUsedUtxos(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(USED_UTXOS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function markUtxoAsUsed(utxoId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const used = getUsedUtxos();
    used.add(utxoId);
    localStorage.setItem(USED_UTXOS_KEY, JSON.stringify(Array.from(used)));
  } catch (error) {
    console.warn('Failed to mark UTXO as used:', error);
  }
}

function clearUsedUtxos(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(USED_UTXOS_KEY);
  } catch (error) {
    console.warn('Failed to clear used UTXOs:', error);
  }
}

/**
 * Select a fresh funding UTXO that hasn't been used yet
 * According to Charms docs: "duplicate funding UTXO spend with different spell" error
 * occurs when the same UTXO is used for multiple spells
 */
function selectFreshFundingUtxo(
  utxos: Array<{ txid: string; vout: number; value: number }>
): { txid: string; vout: number; value: number } | null {
  const usedUtxos = getUsedUtxos();
  
  // Find first UTXO that hasn't been used
  for (const utxo of utxos) {
    const utxoId = `${utxo.txid}:${utxo.vout}`;
    if (!usedUtxos.has(utxoId)) {
      return utxo;
    }
  }
  
  // All UTXOs have been used - clear the cache and try again
  // (This handles the case where transactions have been confirmed)
  console.warn('All UTXOs appear to be used, clearing cache and refreshing...');
  clearUsedUtxos();
  
  // Return first UTXO after clearing cache
  return utxos.length > 0 ? utxos[0] : null;
}

/**
 * Fetch previous transactions for UTXOs
 * Returns an array of transaction objects with chain variant (as required by Prover API)
 * Format: [{ bitcoin: "hex..." }, { bitcoin: "hex..." }]
 */
async function fetchPreviousTransactions(
  utxos: Array<{ txid: string; vout: number }>,
  network: 'mainnet' | 'testnet4' = 'testnet4'
): Promise<Array<{ bitcoin: string }>> {
  const prevTxs: Array<{ bitcoin: string }> = [];
  
  for (const utxo of utxos) {
    try {
      const txHex = await getPreviousTransaction(utxo.txid, network);
      // Wrap in object with "bitcoin" variant as required by Prover API
      prevTxs.push({ bitcoin: txHex });
    } catch (error) {
      console.error(`Failed to fetch previous transaction for ${utxo.txid}:`, error);
      // Continue with other UTXOs
    }
  }
  
  return prevTxs;
}

/**
 * Create a new subscription
 */
export async function createSubscription(params: {
  recipientAddress: string;
  amountPerCycle: number; // satoshis
  totalLocked: number; // satoshis
  subscriptionId: string;
  appId: string;
  wasmBinary: string; // Base64 encoded WASM
}) {
  // 1. Connect wallet
  const wallet = await connectWallet();

  // 2. Get funding UTXO
  // According to Charms docs, each spell needs a unique funding UTXO
  // to avoid "duplicate funding UTXO spend with different spell" error
  const utxos = await getUnspentUtxos(wallet.address, NETWORK);
  if (utxos.length === 0) {
    throw new Error('No UTXOs available for funding');
  }

  // Select a fresh UTXO that hasn't been used for another spell
  let fundingUtxo = selectFreshFundingUtxo(utxos);
  if (!fundingUtxo) {
    throw new Error('No available UTXOs for funding. All UTXOs have been used. Please wait for transactions to confirm or fund your wallet with more testnet Bitcoin.');
  }

  let fundingUtxoId = `${fundingUtxo.txid}:${fundingUtxo.vout}`;
  
  // 4. Try to prove spell with retry logic for duplicate UTXO errors
  // The Prover tracks UTXOs server-side, so we need to retry with different UTXOs
  let proverResponse;
  let attempts = 0;
  const maxAttempts = Math.min(utxos.length, 5); // Try up to 5 different UTXOs
  
  while (attempts < maxAttempts) {
    // Mark this UTXO as used to prevent reuse
    markUtxoAsUsed(fundingUtxoId);
    console.log(`Attempt ${attempts + 1}/${maxAttempts}: Using funding UTXO: ${fundingUtxoId} (value: ${fundingUtxo.value} sats)`);

    // Generate spell JSON
    const spell = createSubscriptionSpell({
      appId: params.appId,
      appVk: APP_VK,
      subscriberAddress: wallet.address,
      subscriptionId: params.subscriptionId,
      totalLockedAmount: params.totalLocked,
      fundingUtxo: fundingUtxoId,
    });

    // Get previous transactions (required by Prover)
    const prevTxs = await fetchPreviousTransactions(
      [{ txid: fundingUtxo.txid, vout: fundingUtxo.vout }],
      NETWORK
    );

    // Send to Prover
    // binaries map: app VK (hex) -> app binary (base64)
    const binaries: Record<string, string> = {};
    if (APP_VK) {
      binaries[APP_VK] = params.wasmBinary;
    }

    try {
      proverResponse = await proveSpell(
        {
          chain: 'bitcoin', // Required: specify chain type
          spell,
          binaries,
          prev_txs: prevTxs,
          funding_utxo: fundingUtxoId,
          funding_utxo_value: fundingUtxo.value,
          change_address: wallet.address,
          fee_rate: 1.0, // sat/vbyte
        },
        PROVER_URL
      );
      
      // Success! Break out of retry loop
      break;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if it's a duplicate UTXO error
      if (errorMessage.includes('duplicate funding UTXO') || errorMessage.includes('duplicate funding UTXO spend')) {
        console.warn(`UTXO ${fundingUtxoId} is already in use, trying next UTXO...`);
        
        // Mark this UTXO as used (Prover rejected it)
        markUtxoAsUsed(fundingUtxoId);
        
        // Try next UTXO
        attempts++;
        if (attempts >= maxAttempts) {
          // Clear cache and try one more time with fresh UTXOs
          clearUsedUtxos();
          const freshUtxos = await getUnspentUtxos(wallet.address, NETWORK);
          if (freshUtxos.length === 0) {
            throw new Error('No UTXOs available for funding. All UTXOs have been used or are pending.');
          }
          fundingUtxo = freshUtxos[0];
          fundingUtxoId = `${fundingUtxo.txid}:${fundingUtxo.vout}`;
          continue;
        }
        
        // Select next fresh UTXO
        const nextUtxo = selectFreshFundingUtxo(utxos);
        if (!nextUtxo) {
          // All UTXOs used, clear cache and refresh
          clearUsedUtxos();
          const freshUtxos = await getUnspentUtxos(wallet.address, NETWORK);
          if (freshUtxos.length === 0) {
            throw new Error('No UTXOs available for funding. Please fund your wallet with more testnet Bitcoin.');
          }
          fundingUtxo = freshUtxos[0];
          fundingUtxoId = `${fundingUtxo.txid}:${fundingUtxo.vout}`;
        } else {
          fundingUtxo = nextUtxo;
          fundingUtxoId = `${fundingUtxo.txid}:${fundingUtxo.vout}`;
        }
        
        continue; // Retry with next UTXO
      } else {
        // Different error, don't retry
        throw error;
      }
    }
  }
  
  if (!proverResponse) {
    throw new Error(`Failed to prove spell after ${maxAttempts} attempts. All UTXOs appear to be in use. Please wait for pending transactions to confirm or fund your wallet with more testnet Bitcoin.`);
  }

  // 6. Extract transactions from Prover response
  // Prover returns [commit_tx, spell_tx] as an array of hex strings
  console.log('Prover response type:', typeof proverResponse, Array.isArray(proverResponse));
  console.log('Prover response:', JSON.stringify(proverResponse).substring(0, 500));
  
  let transactions: string[];
  if (Array.isArray(proverResponse)) {
    transactions = proverResponse;
  } else if (proverResponse && typeof proverResponse === 'object') {
    // Handle object format { commit_tx, spell_tx }
    const responseObj = proverResponse as { commit_tx?: string; spell_tx?: string; [key: string]: unknown };
    transactions = [
      responseObj.commit_tx || '',
      responseObj.spell_tx || ''
    ];
  } else {
    console.error('Unexpected Prover response format:', proverResponse);
    throw new Error('Invalid Prover response format - expected array or object with commit_tx and spell_tx');
  }
  
  // Validate transactions are not empty
  if (!transactions || transactions.length < 2) {
    console.error('Invalid Prover response - not enough transactions:', {
      length: transactions?.length,
      transactions: transactions?.map((tx, i) => ({
        index: i,
        type: typeof tx,
        length: typeof tx === 'string' ? tx.length : 'N/A',
        preview: typeof tx === 'string' ? tx.substring(0, 100) : String(tx)
      }))
    });
    throw new Error(`Invalid transaction response from Prover API - expected 2 transactions, got ${transactions?.length || 0}`);
  }

  // Validate transaction format (should be hex strings)
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (typeof tx !== 'string') {
      console.error(`Transaction ${i + 1} is not a string:`, typeof tx, tx);
      throw new Error(`Transaction ${i + 1} is invalid: expected string, got ${typeof tx}`);
    }
    if (tx.length === 0) {
      console.error(`Transaction ${i + 1} is empty`);
      throw new Error(`Transaction ${i + 1} is invalid: expected non-empty hex string, got empty string`);
    }
    if (tx.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(tx)) {
      console.error(`Transaction ${i + 1} is not valid hex:`, {
        length: tx.length,
        preview: tx.substring(0, 100),
        isHex: /^[0-9a-fA-F]+$/.test(tx)
      });
      throw new Error(`Transaction ${i + 1} is not valid hex: length=${tx.length}, preview=${tx.substring(0, 50)}`);
    }
  }

  // Log transaction info for debugging
  console.log('Transactions from Prover:', {
    count: transactions.length,
    commit_tx_length: transactions[0]?.length || 0,
    spell_tx_length: transactions[1]?.length || 0,
    commit_tx_preview: transactions[0]?.substring(0, 100),
  });

  // 7. Sign transactions
  // Note: Prover returns unsigned hex transactions that need signing
  // Sats Connect requires PSBT format, but we'll try signing hex directly first
  const signedTxs: string[] = [];
  for (let i = 0; i < transactions.length; i++) {
    const txHex = transactions[i];
    
    try {
      console.log(`Signing transaction ${i + 1}...`);
      const signed = await signTransaction(
        {
          psbt: txHex, // Hex encoded transaction
          network: NETWORK,
        },
        wallet
      );
      
      // Validate signed transaction
      if (!signed || signed.length === 0) {
        throw new Error('Signed transaction is empty');
      }
      
      signedTxs.push(signed);
      console.log(`Transaction ${i + 1} signed successfully`);
    } catch (error: unknown) {
      // If signing fails, provide helpful error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to sign transaction ${i + 1}:`, errorMessage);
      throw new Error(
        `Failed to sign transaction ${i + 1}: ${errorMessage}. ` +
        `Transactions from Prover need to be signed before broadcasting. ` +
        `Currently, hex-to-PSBT conversion is not implemented. ` +
        `You need to add bitcoinjs-lib to convert hex transactions to PSBT format for signing.`
      );
    }
  }

  // 8. Broadcast transactions as a package (both must be broadcast together)
  // Note: Charms uses a two-transaction model - both must be broadcast
  console.log('Broadcasting transactions...');
  const txids = await broadcastTransactions(signedTxs, NETWORK);

  // Note: After successful broadcast, the funding UTXO is spent
  // We keep it marked as used to prevent reuse until it's confirmed
  // In production, you might want to clear used UTXOs after confirmation
  
  return {
    subscriptionId: params.subscriptionId,
    txids,
    subscriptionUtxo: `${txids[1]}:0`, // Spell transaction creates subscription NFT
    tokenUtxo: `${txids[1]}:1`, // Spell transaction creates locked tokens
  };
}

/**
 * Execute a subscription payment
 */
export async function executePayment(params: {
  subscriptionUtxo: string;
  tokenUtxo: string;
  subscriptionId: string;
  currentRemainingBalance: number;
  paymentAmount: number;
  recipientAddress: string;
  appId: string;
  wasmBinary: string;
  walletAddress: string;
}) {
  // 1. Generate spell JSON
  const spell = executePaymentSpell({
    appId: params.appId,
    appVk: APP_VK,
    subscriptionUtxo: params.subscriptionUtxo,
    tokenUtxo: params.tokenUtxo,
    subscriptionId: params.subscriptionId,
    currentRemainingBalance: params.currentRemainingBalance,
    paymentAmount: params.paymentAmount,
    newRemainingBalance: params.currentRemainingBalance - params.paymentAmount,
    subscriberAddress: params.walletAddress,
    recipientAddress: params.recipientAddress,
  });

  // 2. Get previous transactions
  const prevTxs = await fetchPreviousTransactions(
    [
      { txid: params.subscriptionUtxo.split(':')[0], vout: parseInt(params.subscriptionUtxo.split(':')[1]) },
      { txid: params.tokenUtxo.split(':')[0], vout: parseInt(params.tokenUtxo.split(':')[1]) },
    ],
    NETWORK
  );

  // 3. Get funding UTXO
  // For payment execution, we also need a unique funding UTXO
  const wallet = await connectWallet();
  const utxos = await getUnspentUtxos(wallet.address, NETWORK);
  if (utxos.length === 0) {
    throw new Error('No UTXOs available for funding');
  }
  
  // Select a fresh UTXO
  const fundingUtxo = selectFreshFundingUtxo(utxos);
  if (!fundingUtxo) {
    throw new Error('No available UTXOs for funding. All UTXOs have been used.');
  }
  
  const fundingUtxoId = `${fundingUtxo.txid}:${fundingUtxo.vout}`;
  markUtxoAsUsed(fundingUtxoId);
  console.log(`Selected fresh funding UTXO for payment: ${fundingUtxoId}`);

  // 4. Send to Prover
  const binaries: Record<string, string> = {};
  if (APP_VK) {
    binaries[APP_VK] = params.wasmBinary;
  }

  const proverResponse = await proveSpell(
    {
      chain: 'bitcoin', // Required: specify chain type
      spell,
      binaries,
      prev_txs: prevTxs,
      funding_utxo: fundingUtxoId,
      funding_utxo_value: fundingUtxo.value,
      change_address: wallet.address,
      fee_rate: 1.0,
    },
    PROVER_URL
  );

  // 5. Sign and broadcast
  const transactions = Array.isArray(proverResponse) 
    ? proverResponse 
    : [proverResponse.commit_tx, proverResponse.spell_tx];
  
  const signedTxs: string[] = [];
  for (const txHex of transactions) {
    const signed = await signTransaction(
      {
        psbt: txHex,
        network: NETWORK,
      },
      wallet
    );
    signedTxs.push(signed);
  }

  const txids = await broadcastTransactions(signedTxs, NETWORK);

  return {
    txids,
    newSubscriptionUtxo: `${txids[1]}:0`, // Updated subscription NFT
    newTokenUtxo: `${txids[1]}:2`, // Remaining tokens
  };
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(params: {
  subscriptionUtxo: string;
  tokenUtxo: string;
  subscriptionId: string;
  remainingBalance: number;
  appId: string;
  wasmBinary: string;
  walletAddress: string;
}) {
  // 1. Generate spell JSON
  const spell = cancelSubscriptionSpell({
    appId: params.appId,
    appVk: APP_VK,
    subscriptionUtxo: params.subscriptionUtxo,
    tokenUtxo: params.tokenUtxo,
    subscriptionId: params.subscriptionId,
    remainingBalance: params.remainingBalance,
    subscriberAddress: params.walletAddress,
  });

  // 2. Get previous transactions and funding UTXO
  const wallet = await connectWallet();
  const prevTxs = await fetchPreviousTransactions(
    [
      { txid: params.subscriptionUtxo.split(':')[0], vout: parseInt(params.subscriptionUtxo.split(':')[1]) },
      { txid: params.tokenUtxo.split(':')[0], vout: parseInt(params.tokenUtxo.split(':')[1]) },
    ],
    NETWORK
  );
  const utxos = await getUnspentUtxos(wallet.address, NETWORK);
  if (utxos.length === 0) {
    throw new Error('No UTXOs available for funding');
  }
  
  // Select a fresh UTXO (avoid duplicate funding UTXO error)
  const fundingUtxo = selectFreshFundingUtxo(utxos);
  if (!fundingUtxo) {
    throw new Error('No available UTXOs for funding. All UTXOs have been used.');
  }
  
  const fundingUtxoId = `${fundingUtxo.txid}:${fundingUtxo.vout}`;
  markUtxoAsUsed(fundingUtxoId);
  console.log(`Selected fresh funding UTXO for cancellation: ${fundingUtxoId}`);

  // 3. Send to Prover
  const binaries: Record<string, string> = {};
  if (APP_VK) {
    binaries[APP_VK] = params.wasmBinary;
  }

  const proverResponse = await proveSpell(
    {
      chain: 'bitcoin', // Required: specify chain type
      spell,
      binaries,
      prev_txs: prevTxs,
      funding_utxo: fundingUtxoId,
      funding_utxo_value: fundingUtxo.value,
      change_address: wallet.address,
      fee_rate: 1.0,
    },
    PROVER_URL
  );

  // 4. Sign and broadcast
  const transactions = Array.isArray(proverResponse) 
    ? proverResponse 
    : [proverResponse.commit_tx, proverResponse.spell_tx];
  
  const signedTxs: string[] = [];
  for (const txHex of transactions) {
    const signed = await signTransaction(
      {
        psbt: txHex,
        network: NETWORK,
      },
      wallet
    );
    signedTxs.push(signed);
  }

  const txids = await broadcastTransactions(signedTxs, NETWORK);

  return {
    txids,
    refundUtxo: `${txids[1]}:1`, // Refunded tokens
  };
}

/**
 * Fetch subscription state from blockchain
 */
export async function getSubscriptionState(
  subscriptionUtxo: string,
  walletOutpoints: Set<string>
): Promise<{ metadata?: { remaining?: number; ticker?: string } } | null> {
  // Parse UTXO
  const [txid] = subscriptionUtxo.split(':');
  
  // Fetch transaction
  const apiUrl = `https://mempool.space/testnet4/api/tx/${txid}/hex`;
  const response = await fetch(apiUrl);
  const txHex = await response.text();

  // Extract charms
  const charms = await extractCharms(txHex, txid, walletOutpoints, NETWORK);

  // Find subscription charm
  const subscriptionCharm = charms.find((charm) => 
    charm.metadata?.ticker?.startsWith('SUBSCRIPTION-')
  );

  return subscriptionCharm || null;
}

