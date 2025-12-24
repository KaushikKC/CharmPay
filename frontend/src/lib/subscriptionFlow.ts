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
import { connectWallet, signTransaction, getUnspentUtxos, type SatsConnectWallet } from './satsConnect';
import { extractCharms } from './charms';

// Configuration
const PROVER_URL = process.env.NEXT_PUBLIC_CHARMS_PROVER_URL || 'https://prover.charms.dev/prove';
const NETWORK: 'mainnet' | 'testnet' = 'testnet';
const APP_VK = process.env.NEXT_PUBLIC_CHARMS_APP_VK || ''; // Set in .env.local

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
  const utxos = await getUnspentUtxos(wallet.address, NETWORK);
  if (utxos.length === 0) {
    throw new Error('No UTXOs available for funding');
  }

  const fundingUtxo = utxos[0];
  const fundingUtxoId = `${fundingUtxo.txid}:${fundingUtxo.vout}`;

  // 3. Generate spell JSON
  const spell = createSubscriptionSpell({
    appId: params.appId,
    appVk: APP_VK,
    subscriberAddress: wallet.address,
    subscriptionId: params.subscriptionId,
    totalLockedAmount: params.totalLocked,
    fundingUtxo: fundingUtxoId,
  });

  // 4. Get previous transactions (required by Prover)
  const prevTxs: Record<string, string> = {};
  // TODO: Fetch actual previous transactions
  // This requires querying the blockchain for each UTXO

  // 5. Send to Prover
  const proverResponse = await proveSpell(
    {
      spell,
      app_bin: params.wasmBinary,
      prev_txs: prevTxs,
      funding_utxo: fundingUtxoId,
      funding_utxo_value: fundingUtxo.value,
      change_address: wallet.address,
      fee_rate: 1.0, // sat/vbyte
    },
    PROVER_URL
  );

  // 6. Sign transactions
  const signedTxs: string[] = [];
  for (const tx of proverResponse.transactions) {
    // Convert hex to PSBT format (simplified - actual implementation may differ)
    const signed = await signTransaction(
      {
        psbt: tx.bitcoin, // May need conversion
        network: NETWORK,
      },
      wallet
    );
    signedTxs.push(signed);
  }

  // 7. Broadcast transactions
  const txids = await broadcastTransactions(signedTxs, NETWORK);

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
  const prevTxs: Record<string, string> = {};
  // TODO: Fetch actual previous transactions

  // 3. Get funding UTXO
  const wallet = await connectWallet();
  const utxos = await getUnspentUtxos(wallet.address, NETWORK);
  if (utxos.length === 0) {
    throw new Error('No UTXOs available for funding');
  }
  const fundingUtxo = utxos[0];
  const fundingUtxoId = `${fundingUtxo.txid}:${fundingUtxo.vout}`;

  // 4. Send to Prover
  const proverResponse = await proveSpell(
    {
      spell,
      app_bin: params.wasmBinary,
      prev_txs: prevTxs,
      funding_utxo: fundingUtxoId,
      funding_utxo_value: fundingUtxo.value,
      change_address: wallet.address,
      fee_rate: 1.0,
    },
    PROVER_URL
  );

  // 5. Sign and broadcast
  const signedTxs: string[] = [];
  for (const tx of proverResponse.transactions) {
    const signed = await signTransaction(
      {
        psbt: tx.bitcoin,
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
  const prevTxs: Record<string, string> = {};
  const utxos = await getUnspentUtxos(wallet.address, NETWORK);
  if (utxos.length === 0) {
    throw new Error('No UTXOs available for funding');
  }
  const fundingUtxo = utxos[0];
  const fundingUtxoId = `${fundingUtxo.txid}:${fundingUtxo.vout}`;

  // 3. Send to Prover
  const proverResponse = await proveSpell(
    {
      spell,
      app_bin: params.wasmBinary,
      prev_txs: prevTxs,
      funding_utxo: fundingUtxoId,
      funding_utxo_value: fundingUtxo.value,
      change_address: wallet.address,
      fee_rate: 1.0,
    },
    PROVER_URL
  );

  // 4. Sign and broadcast
  const signedTxs: string[] = [];
  for (const tx of proverResponse.transactions) {
    const signed = await signTransaction(
      {
        psbt: tx.bitcoin,
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
): Promise<any> {
  // Parse UTXO
  const [txid, vout] = subscriptionUtxo.split(':');
  
  // Fetch transaction
  const apiUrl = `https://api.blockstream.space/testnet/api/tx/${txid}/hex`;
  const response = await fetch(apiUrl);
  const txHex = await response.text();

  // Extract charms
  const charms = await extractCharms(txHex, txid, walletOutpoints, NETWORK);

  // Find subscription charm
  const subscriptionCharm = charms.find((charm) => 
    charm.metadata?.ticker?.startsWith('SUBSCRIPTION-')
  );

  return subscriptionCharm;
}

