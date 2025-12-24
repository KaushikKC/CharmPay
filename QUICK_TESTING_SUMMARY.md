# Quick Testing Summary

## TL;DR: How to Test CharmPay

### 1. Build Contract (One Time)
```bash
cd charm-pay-app
app_bin=$(charms app build)
app_vk=$(charms app vk "$app_bin")
echo "$app_vk" > .app_vk
```

### 2. Get Testnet UTXO
```bash
# Option A: From your wallet address
curl "https://api.blockstream.space/testnet/api/address/YOUR_ADDRESS/utxo"

# Option B: From bitcoin-cli
bitcoin-cli -testnet4 listunspent

# Extract: txid:vout
export in_utxo_0="abc123...:0"
```

### 3. Calculate App ID
```bash
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)
```

### 4. Test Spell Locally
```bash
# Set variables
export app_vk=$(cat .app_vk)
export subscriber_addr="tb1qyour_address"
export subscription_id="sub_001"
export total_locked_amount=1000000

# Get previous transaction
export prev_tx_hex=$(curl -s "https://api.blockstream.space/testnet/api/tx/$(echo $in_utxo_0 | cut -d: -f1)/hex")
export prev_txs="$(echo $in_utxo_0 | cut -d: -f1):${prev_tx_hex}"

# Test spell
cat spells/create-subscription.yaml | envsubst | \
  charms spell check --prev-txs="${prev_txs}" --app-bins="${app_bin}"
```

### 5. Test with Prover (Full Validation)
```bash
# Encode WASM
app_bin_base64=$(base64 ./target/wasm32-wasip1/release/charm-pay-app.wasm)

# Create request
cat > /tmp/request.json << EOF
{
  "spell": $(cat spells/create-subscription.yaml | envsubst | jq -c .),
  "app_bin": "${app_bin_base64}",
  "prev_txs": {"$(echo $in_utxo_0 | cut -d: -f1)": "${prev_tx_hex}"},
  "funding_utxo": "${in_utxo_0}",
  "funding_utxo_value": 100000,
  "change_address": "${subscriber_addr}",
  "fee_rate": 1.0
}
EOF

# Send to Prover
curl -X POST https://prover.charms.dev/prove \
  -H "Content-Type: application/json" \
  -d @/tmp/request.json
```

### 6. Sign and Broadcast (Actual Testnet)
```bash
# Sign transactions (use your wallet)
# Then broadcast
bitcoin-cli -testnet4 submitpackage '["commit_tx","spell_tx"]'
```

## Key Points

1. **No Deployment**: Contracts aren't "deployed" - just compile and use VK
2. **App ID**: Derived from first UTXO (SHA256 of UTXO string)
3. **VK**: Static - doesn't change unless contract changes
4. **Testing Order**: Local → Prover → Blockchain

## Environment Variables Needed

**Backend/CLI:**
- `CHARMS_APP_VK` - Verification key
- `CHARMS_PROVER_URL` - Prover endpoint
- `BITCOIN_NETWORK` - testnet4

**Frontend:**
- `NEXT_PUBLIC_CHARMS_APP_VK` - Verification key
- `NEXT_PUBLIC_CHARMS_PROVER_URL` - Prover endpoint

## Where Things Live

- **WASM Binary**: `charm-pay-app/target/wasm32-wasip1/release/charm-pay-app.wasm`
- **VK**: Store in `.app_vk` or environment variable
- **App ID**: Calculate from UTXO (not stored, calculated each time)
- **UTXOs**: Get from blockchain/API (not stored, fetched when needed)

## Testing Checklist

- [ ] Contract compiles
- [ ] Unit tests pass
- [ ] VK generated
- [ ] Testnet UTXO obtained
- [ ] App ID calculated
- [ ] Spell check passes
- [ ] Prover accepts spell
- [ ] Transactions signed
- [ ] Transactions broadcast
- [ ] Transactions confirmed

See `TESTING_GUIDE.md` for detailed explanations.

