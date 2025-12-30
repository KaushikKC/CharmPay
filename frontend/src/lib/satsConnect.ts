/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Sats Connect Integration for Xverse Wallet
 * 
 * According to official Charms docs, Sats Connect is perfectly fine for wallet connection.
 * The docs mention bitcoinjs-lib for signing, which we use WITH Sats Connect.
 * They work together: Sats Connect = wallet interface, bitcoinjs-lib = signing library
 * 
 * Reference: https://docs.charms.dev/guides/wallet-integration/transactions/signing/
 */

import { 
  connectXverseWallet, 
  getStoredWallet,
  type XverseWallet 
} from './xverseWallet';
import * as bitcoin from 'bitcoinjs-lib';
import { request } from 'sats-connect';

export interface SatsConnectWallet {
  address: string;
  publicKey: string;
  network: 'mainnet' | 'testnet4';
}

export interface SignTransactionRequest {
  psbt: string; // Hex or PSBT encoded transaction
  network: 'mainnet' | 'testnet4';
}

/**
 * Connect to Xverse wallet via Sats Connect
 */
export async function connectWallet(): Promise<SatsConnectWallet> {
  const result = await connectXverseWallet();
  
  if (!result.success || !result.wallet) {
    throw new Error(result.error || 'Failed to connect wallet');
  }

  return {
    address: result.wallet.paymentAddress,
    publicKey: result.wallet.publicKey,
    network: result.wallet.network === 'Testnet' ? 'testnet4' : 'mainnet',
  };
}

/**
 * Get Bitcoin network for bitcoinjs-lib
 */
function getBitcoinNetwork(network: 'mainnet' | 'testnet4'): bitcoin.Network {
  return network === 'testnet4' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
}

/**
 * Create PSBT (bitcoinjs-lib v7 compatible)
 * Note: v7 constructor doesn't take network parameter directly
 */
function createPsbt(_network: 'mainnet' | 'testnet4'): bitcoin.Psbt {
  // bitcoinjs-lib v7: Psbt constructor takes no arguments
  // Network is handled when adding inputs/outputs
  return new bitcoin.Psbt();
}

/**
 * Sign a transaction using Sats Connect + bitcoinjs-lib
 * 
 * According to Charms docs:
 * - Commit transaction: Sign like `bitcoin-cli signrawtransactionwithwallet <commit_tx_hex>`
 * - Spell transaction: Sign with commit tx output data
 * 
 * We use bitcoinjs-lib to parse transactions and Sats Connect to sign via wallet
 */
export async function signTransaction(
  signRequest: SignTransactionRequest,
  wallet: SatsConnectWallet,
  previousTransactions?: Array<{ txid: string; hex: string }> // Optional: previous tx data for PSBT
): Promise<string> {
  try {
    const btcNetwork = getBitcoinNetwork(signRequest.network);
    
    // Parse the hex transaction
    const tx = bitcoin.Transaction.fromHex(signRequest.psbt);
    
    // Create PSBT from transaction for signing
    const psbt = new bitcoin.Psbt({ network: btcNetwork });
    
    // Add inputs with previous transaction outputs
    for (let i = 0; i < tx.ins.length; i++) {
      const input = tx.ins[i];
      const prevTxId = Buffer.from(input.hash).reverse().toString('hex');
      const prevVout = input.index;
      
      // Try to find previous transaction in provided data
      let prevTxHex: string | undefined;
      if (previousTransactions) {
        const prevTx = previousTransactions.find(pt => pt.txid === prevTxId);
        if (prevTx) {
          prevTxHex = prevTx.hex;
        }
      }
      
      // If not provided, fetch it
      if (!prevTxHex) {
        try {
          prevTxHex = await getPreviousTransaction(prevTxId, signRequest.network);
        } catch (error) {
          console.warn(`Failed to fetch previous transaction ${prevTxId} for input ${i}:`, error);
          // Continue - wallet might be able to sign without it
        }
      }
      
      if (prevTxHex) {
        // Parse previous transaction to get output script and value
        const prevTx = bitcoin.Transaction.fromHex(prevTxHex);
        const prevOutput = prevTx.outs[prevVout];
        
        if (prevOutput) {
          // Check if it's a SegWit output (P2WPKH, P2WSH, P2TR)
          const isSegWit = prevOutput.script[0] === 0x00 && 
                          (prevOutput.script[1] === 0x14 || prevOutput.script[1] === 0x20 || prevOutput.script[1] === 0x01);
          
          if (isSegWit) {
            // Use witnessUtxo for SegWit outputs
            psbt.addInput({
              hash: prevTxId,
              index: prevVout,
              witnessUtxo: {
                script: prevOutput.script,
                value: prevOutput.value,
              },
            });
          } else {
            // Use nonWitnessUtxo for legacy outputs
            psbt.addInput({
              hash: prevTxId,
              index: prevVout,
              nonWitnessUtxo: Buffer.from(prevTxHex, 'hex'),
            });
          }
        } else {
          throw new Error(`Previous transaction ${prevTxId} output ${prevVout} not found`);
        }
      } else {
        // Fallback: add input without previous tx data (wallet might handle it)
        console.warn(`Adding input ${i} without previous transaction data - wallet may handle it`);
        psbt.addInput({
          hash: prevTxId,
          index: prevVout,
        } as any);
      }
    }
    
    // Add outputs
    for (const output of tx.outs) {
      // Decode output script to get address
      let address: string;
      try {
        address = bitcoin.address.fromOutputScript(output.script, btcNetwork);
      } catch {
        // If we can't decode, use empty string (PSBT will still work)
        address = '';
      }
      
      psbt.addOutput({
        address,
        value: output.value,
      });
    }
    
    // Convert PSBT to base64 for Sats Connect
    const psbtBase64 = psbt.toBase64();
    
    // Sign using Sats Connect
    const response = await request('signPsbt', {
      psbt: psbtBase64,
      broadcast: false,
    });

    if (response.status === 'success') {
      const result = response.result as any;
      const signedPsbtBase64 = result.psbt || psbtBase64;
      
      // Extract signed transaction hex from PSBT
      const signedPsbt = bitcoin.Psbt.fromBase64(signedPsbtBase64, { network: btcNetwork });
      signedPsbt.finalizeAllInputs();
      const signedTx = signedPsbt.extractTransaction();
      
      return signedTx.toHex();
    }
    
    throw new Error((response.error as any)?.message || 'Failed to sign transaction');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Transaction signing error:', error);
    
    // Provide helpful error message
    throw new Error(
      `Failed to sign transaction: ${message}. ` +
      `This requires proper PSBT creation with previous transaction outputs. ` +
      `See: https://docs.charms.dev/guides/wallet-integration/transactions/signing/`
    );
  }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(
  address: string,
  network: 'mainnet' | 'testnet4' = 'testnet4'
): Promise<number> {
  const apiUrl =
    network === 'testnet4'
      ? `https://mempool.space/testnet4/api/address/${address}`
      : `https://blockstream.info/api/address/${address}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.statusText}`);
    }
    const data = await response.json();

    return (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) / 100000000; // Convert to BTC
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get wallet balance: ${message}`);
  }
}

/**
 * Get unspent UTXOs for an address
 */
export async function getUnspentUtxos(
  address: string,
  network: 'mainnet' | 'testnet4' = 'testnet4'
): Promise<Array<{ txid: string; vout: number; value: number }>> {
  const apiUrl =
    network === 'testnet4'
      ? `https://mempool.space/testnet4/api/address/${address}/utxo`
      : `https://blockstream.info/api/address/${address}/utxo`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
    }
    const utxos = await response.json();

    return utxos.map((utxo: any) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get UTXOs: ${message}`);
  }
}

/**
 * Fetch previous transaction hex for a UTXO
 */
export async function getPreviousTransaction(
  txid: string,
  network: 'mainnet' | 'testnet4' = 'testnet4'
): Promise<string> {
  const apiUrl =
    network === 'testnet4'
      ? `https://mempool.space/testnet4/api/tx/${txid}/hex`
      : `https://blockstream.info/api/tx/${txid}/hex`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${response.statusText}`);
    }
    const txHex = await response.text();
    
    if (txHex.startsWith('<!DOCTYPE')) {
      throw new Error('Transaction not found');
    }
    
    return txHex;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get previous transaction: ${message}`);
  }
}

/**
 * Check if wallet is connected
 */
export function isWalletConnected(): boolean {
  return typeof window !== 'undefined' && getStoredWallet() !== null;
}
