/**
 * Get transaction explorer URL for mempool.space testnet4
 * Reference: https://mempool.space/testnet4/tx/{hash}
 */
export function getTransactionExplorerUrl(txHash: string): string {
  return `https://mempool.space/testnet4/tx/${txHash}`;
}

/**
 * Get address explorer URL for mempool.space testnet4
 * Reference: https://mempool.space/testnet4/address/{address}
 */
export function getAddressExplorerUrl(address: string): string {
  return `https://mempool.space/testnet4/address/${address}`;
}

/**
 * Get block explorer URL for mempool.space testnet4
 */
export function getBlockExplorerUrl(blockHash: string): string {
  return `https://mempool.space/testnet4/block/${blockHash}`;
}

