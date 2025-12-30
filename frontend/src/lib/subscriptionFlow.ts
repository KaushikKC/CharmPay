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
import * as bitcoin from 'bitcoinjs-lib';

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
  // Note: The Prover tracks UTXOs server-side, so even if a UTXO appears unspent,
  // it might be in use if there's a pending transaction
  let utxos = await getUnspentUtxos(wallet.address, NETWORK);
  if (utxos.length === 0) {
    throw new Error('No UTXOs available for funding. Please fund your wallet with testnet Bitcoin.');
  }
  
  // Filter out UTXOs that are marked as used locally
  // This helps avoid retrying UTXOs we know are problematic
  const usedUtxos = getUsedUtxos();
  const availableUtxos = utxos.filter(utxo => {
    const utxoId = `${utxo.txid}:${utxo.vout}`;
    return !usedUtxos.has(utxoId);
  });
  
  // If we have available UTXOs after filtering, use those
  // Otherwise, clear cache and use all UTXOs (they might have been confirmed)
  if (availableUtxos.length > 0) {
    utxos = availableUtxos;
    console.log(`Filtered to ${utxos.length} available UTXOs (excluding ${usedUtxos.size} used)`);
  } else {
    console.warn('All UTXOs are marked as used locally. Clearing cache and trying all UTXOs...');
    clearUsedUtxos();
    // Keep original utxos list
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
  const maxAttempts = Math.min(utxos.length, 5); // Try up to 5 different UTXOs per refresh cycle
  let refreshCycles = 0;
  const maxRefreshCycles = 2; // Maximum number of times to refresh UTXO list (prevents infinite loop)
  
  // Store the first spell JSON to compare with subsequent attempts
  let firstSpellHash: string | null = null;
  
  while (attempts < maxAttempts && refreshCycles < maxRefreshCycles) {
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

    // Log spell JSON for debugging (to check if it's changing)
    // IMPORTANT: The spell JSON SHOULD change when we use a different UTXO
    // because fundingUtxo is part of the spell structure
    const spellHash = JSON.stringify(spell);
    const spellHashShort = spellHash.substring(0, 300);
    
    // Extract just the parts that should NOT change (to verify consistency)
    const spellWithoutUtxo = {
      version: spell.version,
      apps: spell.apps,
      subscriptionId: params.subscriptionId,
      totalLocked: params.totalLocked,
      subscriberAddress: wallet.address,
    };
    const spellWithoutUtxoHash = JSON.stringify(spellWithoutUtxo);
    
    if (firstSpellHash === null) {
      firstSpellHash = spellHash;
      console.log(`📝 First spell JSON generated:`, {
        fundingUtxo: fundingUtxoId,
        subscriptionId: params.subscriptionId,
        totalLocked: params.totalLocked,
        subscriberAddress: wallet.address,
        spellWithoutUtxo: spellWithoutUtxoHash,
        fullSpellPreview: spellHashShort + '...',
      });
    } else {
      // Compare spell parts that should NOT change
      const previousSpellWithoutUtxo = JSON.parse(firstSpellHash);
      const previousSpellWithoutUtxoHash = JSON.stringify({
        version: previousSpellWithoutUtxo.version,
        apps: previousSpellWithoutUtxo.apps,
        subscriptionId: params.subscriptionId,
        totalLocked: params.totalLocked,
        subscriberAddress: wallet.address,
      });
      
      const consistentPartsMatch = spellWithoutUtxoHash === previousSpellWithoutUtxoHash;
      
      console.log(`📝 Spell JSON (attempt ${attempts + 1}):`, {
        fundingUtxo: fundingUtxoId,
        consistentPartsMatch: consistentPartsMatch,
        spellWithoutUtxo: spellWithoutUtxoHash.substring(0, 200),
        fullSpellPreview: spellHashShort + '...',
      });
      
      if (!consistentPartsMatch) {
        console.error('❌ ERROR: Spell JSON has INCONSISTENT parts (should be same)!', {
          previous: previousSpellWithoutUtxoHash.substring(0, 200),
          current: spellWithoutUtxoHash.substring(0, 200),
        });
        throw new Error('Spell JSON has inconsistent parts between attempts. This should not happen!');
      } else {
        console.log('✅ Spell JSON consistent parts match (only fundingUtxo changed, which is expected)');
      }
    }

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
      console.log(`Including binary for app VK: ${APP_VK.substring(0, 16)}... (binary length: ${params.wasmBinary.length})`);
    } else {
      console.warn('APP_VK is not set - binaries map will be empty');
    }

    try {
      console.log(`Attempting to prove spell with UTXO ${fundingUtxoId}...`);
      console.log('📤 Prover request details:', {
        funding_utxo: fundingUtxoId,
        funding_utxo_value: fundingUtxo.value,
        change_address: wallet.address,
        fee_rate: 1.0,
        prev_txs_count: prevTxs.length,
        binaries_count: Object.keys(binaries).length,
        spell_version: spell.version,
        spell_apps: Object.keys(spell.apps),
        spell_ins_count: spell.ins?.length || 0,
        spell_outs_count: spell.outs?.length || 0,
        spell_private_inputs: spell.private_inputs,
      });
      
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
      console.log('✅ Prover API call successful!');
      break;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log the full error for debugging
      console.error(`Prover API error for UTXO ${fundingUtxoId}:`, errorMessage);
      
      // Check if it's a duplicate UTXO error
      if (errorMessage.includes('duplicate funding UTXO') || errorMessage.includes('duplicate funding UTXO spend')) {
        console.warn(`UTXO ${fundingUtxoId} is already in use, trying next UTXO...`);
        
        // Mark this UTXO as used (Prover rejected it)
        markUtxoAsUsed(fundingUtxoId);
        
        // Try next UTXO
        attempts++;
        
        // If we've tried all available UTXOs, refresh the list (but limit refresh cycles)
        if (attempts >= maxAttempts || attempts >= utxos.length) {
          refreshCycles++;
          
          if (refreshCycles >= maxRefreshCycles) {
            // We've exhausted all retry attempts
            throw new Error(
              `Failed to create subscription after ${refreshCycles} refresh cycles and ${attempts} UTXO attempts.\n\n` +
              `All available UTXOs are being rejected by the Prover with "duplicate funding UTXO spend with different spell".\n\n` +
              `This usually means:\n` +
              `1. The Prover's server-side cache has these UTXOs marked as used\n` +
              `2. You have pending transactions that are using these UTXOs\n` +
              `3. The spell JSON is changing between attempts (should not happen)\n\n` +
              `Solutions:\n` +
              `- Wait 10-15 minutes for the Prover's cache to clear and pending transactions to confirm\n` +
              `- Fund your wallet with more testnet Bitcoin to get fresh UTXOs\n` +
              `- Check mempool.space/testnet4 for pending transactions\n` +
              `- Try again later after transactions have confirmed`
            );
          }
          
          console.warn(`Tried ${attempts} UTXOs, all appear to be in use. Refreshing UTXO list (cycle ${refreshCycles}/${maxRefreshCycles})...`);
          
          // Add a delay before refreshing to give Prover time to clear cache
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
          
          // Clear cache and refresh UTXOs from blockchain
          clearUsedUtxos();
          const freshUtxos = await getUnspentUtxos(wallet.address, NETWORK);
          
          if (freshUtxos.length === 0) {
            throw new Error(
              'No UTXOs available for funding. All UTXOs appear to be in use.\n\n' +
              'Possible reasons:\n' +
              '1. You have pending transactions that are using these UTXOs\n' +
              '2. The Prover has these UTXOs marked as used from previous attempts\n' +
              '3. You need more testnet Bitcoin\n\n' +
              'Solutions:\n' +
              '- Wait 5-10 minutes for pending transactions to confirm\n' +
              '- Fund your wallet with more testnet Bitcoin\n' +
              '- Check mempool.space/testnet4 for pending transactions'
            );
          }
          
          // Reset attempts and try with fresh UTXOs
          attempts = 0;
          utxos = freshUtxos;
          fundingUtxo = freshUtxos[0];
          fundingUtxoId = `${fundingUtxo.txid}:${fundingUtxo.vout}`;
          console.log(`Refreshed UTXO list, found ${freshUtxos.length} UTXOs. Trying again...`);
          continue;
        }
        
        // Select next fresh UTXO from current list
        const nextUtxo = selectFreshFundingUtxo(utxos);
        if (!nextUtxo) {
          // All UTXOs in current list are used - this will trigger refresh in next iteration
          // Increment attempts to trigger refresh logic
          attempts = maxAttempts;
          continue;
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
  
  // Check if we exited the loop without success
  if (!proverResponse) {
    if (refreshCycles >= maxRefreshCycles) {
      throw new Error(
        `Failed to create subscription after ${maxRefreshCycles} refresh cycles and ${attempts} UTXO attempts.\n\n` +
        `All available UTXOs are being rejected by the Prover with "duplicate funding UTXO spend with different spell".\n\n` +
        `This usually means:\n` +
        `1. The Prover's server-side cache has these UTXOs marked as used\n` +
        `2. You have pending transactions that are using these UTXOs\n` +
        `3. The spell JSON is changing between attempts (should not happen)\n\n` +
        `Solutions:\n` +
        `- Wait 10-15 minutes for the Prover's cache to clear and pending transactions to confirm\n` +
        `- Fund your wallet with more testnet Bitcoin to get fresh UTXOs\n` +
        `- Check mempool.space/testnet4 for pending transactions\n` +
        `- Try again later after transactions have confirmed`
      );
    } else {
      throw new Error(
        `Failed to prove spell after ${attempts} attempts. All UTXOs appear to be in use. ` +
        `Please wait for pending transactions to confirm or fund your wallet with more testnet Bitcoin.`
      );
    }
  }

  // 6. Extract transactions from Prover response
  // Prover returns [commit_tx, spell_tx] as an array
  // Each transaction can be a hex string or an object with bitcoin/cardano field
  console.log('Prover response type:', typeof proverResponse, Array.isArray(proverResponse));
  console.log('Prover response:', JSON.stringify(proverResponse).substring(0, 500));
  
  let transactions: string[];
  if (Array.isArray(proverResponse)) {
    // Handle array format - could be ["hex1", "hex2"] or [{"bitcoin": "hex1"}, {"bitcoin": "hex2"}]
    transactions = proverResponse.map((tx, index) => {
      if (typeof tx === 'string') {
        // Already a hex string
        return tx;
      } else if (tx && typeof tx === 'object' && 'bitcoin' in tx) {
        // Object with bitcoin field: { bitcoin: "hex..." }
        const txObj = tx as { bitcoin: string };
        return txObj.bitcoin;
      } else if (tx && typeof tx === 'object' && 'cardano' in tx) {
        // Object with cardano field (for Cardano chain)
        const txObj = tx as { cardano: string };
        return txObj.cardano;
      } else {
        console.error(`Transaction ${index + 1} has unexpected format:`, tx);
        throw new Error(`Transaction ${index + 1} is invalid: expected string or object with bitcoin/cardano field, got ${typeof tx}`);
      }
    });
  } else if (proverResponse && typeof proverResponse === 'object') {
    // Handle object format { commit_tx, spell_tx }
    const responseObj = proverResponse as { commit_tx?: string | { bitcoin?: string }; spell_tx?: string | { bitcoin?: string }; [key: string]: unknown };
    
    // Extract hex from commit_tx (could be string or object)
    const commitTx = responseObj.commit_tx;
    const commitTxHex = typeof commitTx === 'string' 
      ? commitTx 
      : (commitTx && typeof commitTx === 'object' && 'bitcoin' in commitTx)
        ? (commitTx as { bitcoin: string }).bitcoin
        : '';
    
    // Extract hex from spell_tx (could be string or object)
    const spellTx = responseObj.spell_tx;
    const spellTxHex = typeof spellTx === 'string'
      ? spellTx
      : (spellTx && typeof spellTx === 'object' && 'bitcoin' in spellTx)
        ? (spellTx as { bitcoin: string }).bitcoin
        : '';
    
    transactions = [commitTxHex, spellTxHex];
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
  // We need to fetch previous transactions for PSBT creation
  const signedTxs: string[] = [];
  
  // For the commit transaction (first one), we need the funding UTXO's previous transaction
  // For the spell transaction (second one), we need the commit transaction's outputs
  let commitTxHex: string | undefined;
  
  for (let i = 0; i < transactions.length; i++) {
    const txHex = transactions[i];
    
    try {
      console.log(`Signing transaction ${i + 1} (${i === 0 ? 'commit' : 'spell'})...`);
      
      // Prepare previous transactions for PSBT
      const previousTxs: Array<{ txid: string; hex: string }> = [];
      
      if (i === 0) {
        // Commit transaction: needs the funding UTXO's previous transaction
        const prevTxHex = await getPreviousTransaction(fundingUtxo.txid, NETWORK);
        previousTxs.push({ txid: fundingUtxo.txid, hex: prevTxHex });
      } else if (i === 1 && commitTxHex) {
        // Spell transaction: needs the commit transaction (which we just signed)
        // Extract commit tx ID from the signed commit transaction
        const commitTx = bitcoin.Transaction.fromHex(commitTxHex);
        const commitTxId = commitTx.getId();
        previousTxs.push({ txid: commitTxId, hex: commitTxHex });
      }
      
      const signed = await signTransaction(
        {
          psbt: txHex, // Hex encoded transaction
          network: NETWORK,
        },
        wallet,
        previousTxs.length > 0 ? previousTxs : undefined
      );
      
      // Validate signed transaction
      if (!signed || signed.length === 0) {
        throw new Error('Signed transaction is empty');
      }
      
      signedTxs.push(signed);
      
      // Store commit tx for spell tx signing
      if (i === 0) {
        commitTxHex = signed;
      }
      
      console.log(`Transaction ${i + 1} signed successfully`);
    } catch (error: unknown) {
      // If signing fails, provide helpful error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to sign transaction ${i + 1}:`, errorMessage);
      throw new Error(
        `Failed to sign transaction ${i + 1}: ${errorMessage}. ` +
        `Make sure previous transactions are available and the wallet has the necessary keys.`
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

