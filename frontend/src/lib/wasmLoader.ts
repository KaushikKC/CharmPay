/**
 * WASM Binary Loader for Charms Contract
 * 
 * Loads and converts WASM binary to base64 for Prover API
 */

/**
 * Load WASM binary from public directory or API route
 */
export async function loadWasmBinary(): Promise<string> {
  try {
    // Try to load from public directory first
    const response = await fetch('/charm-pay-app.wasm');
    
    if (!response.ok) {
      // If not in public, try API route
      const apiResponse = await fetch('/api/wasm');
      if (!apiResponse.ok) {
        throw new Error('WASM binary not found. Please build the contract and place it in public/');
      }
      const blob = await apiResponse.blob();
      return await blobToBase64(blob);
    }
    
    const blob = await response.blob();
    return await blobToBase64(blob);
  } catch (error: any) {
    throw new Error(`Failed to load WASM binary: ${error.message}`);
  }
}

/**
 * Convert blob to base64
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Calculate App ID from UTXO
 */
export function calculateAppId(utxo: string): string {
  // App ID = SHA256 of UTXO string
  // This needs to be done client-side or server-side
  // For now, we'll need to use a crypto library or API
  // Using Web Crypto API
  return new Promise<string>((resolve) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(utxo);
    
    crypto.subtle.digest('SHA-256', data).then((hashBuffer) => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      resolve(hashHex);
    });
  }) as any; // Type assertion for async function
}

/**
 * Calculate App ID synchronously (using a simple hash for now)
 * Note: This is a placeholder - should use proper SHA256
 */
export function calculateAppIdSync(utxo: string): string {
  // For production, use proper SHA256 implementation
  // This is a simplified version
  let hash = 0;
  for (let i = 0; i < utxo.length; i++) {
    const char = utxo.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

