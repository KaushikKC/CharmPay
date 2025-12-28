# CharmPay: Complete Testing Guide

## Understanding Contract "Deployment" in Charms

### ❌ You DON'T Deploy Contracts Like Ethereum

In Charms, contracts are **NOT deployed on-chain**. Here's how it works:

1. **Compile Contract** → Get WASM binary + Verification Key (VK)
2. **VK is Public** → Anyone can verify proofs with it
3. **Contract Logic Runs Off-Chain** → Prover validates transactions
4. **Proofs Go On-Chain** → Embedded in Bitcoin transactions

**Key Point**: The contract WASM binary and VK are what matter. There's no "deployment transaction" like in Ethereum.

### What You Actually Need

1. **WASM Binary**: Compiled contract (`charm-pay-app.wasm`)
2. **Verification Key (VK)**: Public key for proof verification
3. **App ID**: Derived from your first UTXO (unique per app instance)

These are **files and values**, not on-chain deployments.

---

## Step-by-Step: Testing Your Contract

### Phase 1: Local Contract Testing (No Blockchain)

#### Step 1: Build and Get Verification Key

```bash
cd charm-pay-app

# Build the contract
app_bin=$(charms app build)
# Output: ./target/wasm32-wasip1/release/charm-pay-app.wasm

# Get verification key
app_vk=$(charms app vk "$app_bin")
# Output: A 64-character hex string like: 8fd3f8f51e13664a94a2f2bc968892cdc1d3151261f535d25b5716da5cdff01c

# Save these for later
echo "$app_vk" > .app_vk
echo "$app_bin" > .app_bin_path
```

**What this does:**
- Compiles your Rust contract to WASM
- Generates a cryptographic verification key
- These are **static** - they don't change unless you change the contract

**Where to store:**
- Keep `app_vk` in a file (`.app_vk`) or environment variable
- The WASM binary is at: `./target/wasm32-wasip1/release/charm-pay-app.wasm`

#### Step 2: Run Unit Tests

```bash
cd charm-pay-app
cargo test
```

**What this tests:**
- Helper functions (hash, conversions)
- Contract logic in isolation
- **Does NOT test**: Actual spell validation, blockchain interaction

**Expected output:**
```
running 2 tests
test test::test_subscription_state_to_nft_content ... ok
test test::test_hash ... ok
```

#### Step 3: Test Spell Structure (Without Prover)

You can validate spell JSON structure locally:

```bash
cd charm-pay-app/spells

# Create a test spell with dummy values
cat > test-spell.yaml << 'EOF'
version: 8
apps:
  $00: n/test_app_id/test_app_vk
  $01: t/test_app_id/test_app_vk
ins:
  - utxo_id: "test_txid:0"
    charms: {}
outs:
  - address: "tb1qtest"
    charms:
      $00:
        ticker: "SUBSCRIPTION-sub_001"
        remaining: 1000000
      $01: 1000000
EOF

# Validate structure (this checks JSON/YAML format, not contract logic)
# Note: charms spell check requires actual UTXOs and previous transactions
```

**What this validates:**
- Spell JSON/YAML structure
- Field names and types
- **Does NOT validate**: Contract logic, UTXO existence, signatures

---

### Phase 2: Getting Testnet UTXOs

#### Understanding UTXOs

A **UTXO** (Unspent Transaction Output) is:
- A Bitcoin output that hasn't been spent
- Format: `txid:vout` (transaction ID : output index)
- Example: `d8fa4cdade7ac3dff64047dc73b58591ebe638579881b200d4fea68fc84521f0:0`

#### Option 1: Using Bitcoin Testnet4 Node (Recommended for Development)

If you have `bitcoin-cli` set up:

```bash
# List unspent outputs
bitcoin-cli -testnet4 listunspent

# Output looks like:
# [
#   {
#     "txid": "d8fa4cdade7ac3dff64047dc73b58591ebe638579881b200d4fea68fc84521f0",
#     "vout": 0,
#     "address": "tb1q...",
#     "amount": 0.001,
#     "confirmations": 6
#   }
# ]

# Extract UTXO ID
export in_utxo_0="d8fa4cdade7ac3dff64047dc73b58591ebe638579881b200d4fea68fc84521f0:0"
```

#### Option 2: Using Blockstream API (No Node Required)

```bash
# Get your testnet address (from Xverse wallet or generate one)
YOUR_ADDRESS="tb1qyour_testnet_address_here"

# Fetch UTXOs via API
curl "https://api.blockstream.space/testnet4/api/address/${YOUR_ADDRESS}/utxo"

# Output:
# [
#   {
#     "txid": "abc123...",
#     "vout": 0,
#     "value": 100000,
#     "status": { "confirmed": true }
#   }
# ]

# Extract UTXO ID
export in_utxo_0="abc123...:0"
```

#### Option 3: Using Xverse Wallet (For Frontend Testing)

In your frontend code:
```typescript
// Get UTXOs from connected wallet
const utxos = await getUnspentUtxos(walletAddress, 'testnet');
const fundingUtxo = utxos[0];
const utxoId = `${fundingUtxo.txid}:${fundingUtxo.vout}`;
```

#### Getting Testnet Bitcoin

If you don't have testnet BTC:

1. **Testnet Faucet**: https://bitcoinfaucet.uo1.net/
2. **Mempool Testnet Faucet**: https://mempool.space/testnet4/faucet
3. **Send to your testnet address**

**Important**: You need testnet BTC to pay transaction fees!

---

### Phase 3: Setting Up Environment Variables

#### What You Need

Create a `.env` file or export these in your shell:

```bash
# Contract Verification Key (from Step 1)
export CHARMS_APP_VK="8fd3f8f51e13664a94a2f2bc968892cdc1d3151261f535d25b5716da5cdff01c"

# App ID (derived from first UTXO)
export CHARMS_APP_ID="$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)"

# Prover URL (usually this default)
export CHARMS_PROVER_URL="https://v8.charms.dev/spells/prove"

# Network
export BITCOIN_NETWORK="testnet4"

# Your testnet address
export TESTNET_ADDRESS="tb1qyour_address_here"
```

#### Where to Store

**For Backend/CLI Testing:**
- Create `charm-pay-app/.env.test` file
- Or export in your shell session
- **Don't commit** `.env` files to git

**For Frontend Testing:**
- Create `frontend/.env.local` file
- Prefix with `NEXT_PUBLIC_` for client-side access:
  ```bash
  NEXT_PUBLIC_CHARMS_APP_VK=your_vk_here
  NEXT_PUBLIC_CHARMS_PROVER_URL=https://v8.charms.dev/spells/prove
  ```

#### App ID Calculation

The **App ID** is unique per app instance and derived from your first UTXO:

```bash
# App ID = SHA256 of the first UTXO you use
export in_utxo_0="your_utxo_id_here"
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)

# Example:
# in_utxo_0="abc123:0"
# app_id="def456..." (64 char hex)
```

**Important**: 
- Same UTXO → Same App ID
- Different UTXO → Different App ID
- App ID identifies your app instance on-chain

---

### Phase 4: Testing with Spell Check (Local Validation)

#### What is `charms spell check`?

This command:
- ✅ Validates spell structure
- ✅ Validates against contract logic
- ✅ Checks UTXO references
- ❌ Does NOT broadcast to blockchain
- ❌ Does NOT require signatures

#### Prerequisites

You need:
1. Built contract WASM
2. Spell JSON/YAML
3. Previous transactions (for UTXOs being spent)

#### Getting Previous Transactions

For each UTXO you're spending, you need its previous transaction:

```bash
# If using bitcoin-cli
export prev_tx_hex=$(bitcoin-cli -testnet4 getrawtransaction "txid_of_utxo")

# If using API
export prev_tx_hex=$(curl "https://api.blockstream.space/testnet/api/tx/txid/hex")

# Format for charms spell check
export prev_txs="txid1:${prev_tx_hex_1} txid2:${prev_tx_hex_2}"
```

#### Running Spell Check

```bash
cd charm-pay-app

# Set all variables
export app_vk=$(cat .app_vk)
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)
export subscriber_addr="tb1qyour_address"
export subscription_id="sub_001"
export total_locked_amount=1000000

# Get previous transaction for the UTXO
export prev_tx_hex=$(curl -s "https://api.blockstream.space/testnet/api/tx/$(echo $in_utxo_0 | cut -d: -f1)/hex")
export prev_txs="$(echo $in_utxo_0 | cut -d: -f1):${prev_tx_hex}"

# Generate spell and check
cat spells/create-subscription.yaml | envsubst | \
  charms spell check \
    --prev-txs="${prev_txs}" \
    --app-bins="${app_bin}"
```

**What this validates:**
- Spell structure is correct
- Contract logic accepts the spell
- UTXOs exist and are valid
- State transitions are valid

**If it passes:**
- ✅ Your spell is valid
- ✅ Contract logic is correct
- ✅ Ready for actual blockchain testing

**If it fails:**
- Check error message
- Verify UTXO exists
- Verify spell structure
- Check contract logic

---

### Phase 5: Testing with Prover (Full Validation)

#### What is the Prover?

The Prover:
1. Takes your spell + contract WASM
2. Validates against contract
3. Generates zk-SNARK proof
4. Returns unsigned transactions

#### Prerequisites

1. Contract WASM binary (base64 encoded)
2. Valid spell JSON
3. Previous transactions
4. Funding UTXO (for fees)

#### Encoding WASM to Base64

```bash
# Convert WASM to base64
app_bin_base64=$(base64 -i ./target/wasm32-wasip1/release/charm-pay-app.wasm)

# Or on macOS
app_bin_base64=$(base64 ./target/wasm32-wasip1/release/charm-pay-app.wasm)
```

#### Making Prover Request

```bash
# Prepare spell JSON (with all variables substituted)
cat spells/create-subscription.yaml | envsubst > /tmp/spell.json

# Prepare request
cat > /tmp/prover_request.json << EOF
{
  "spell": $(cat /tmp/spell.json),
  "app_bin": "${app_bin_base64}",
  "prev_txs": {
    "$(echo $in_utxo_0 | cut -d: -f1)": "${prev_tx_hex}"
  },
  "funding_utxo": "${in_utxo_0}",
  "funding_utxo_value": 100000,
  "change_address": "${subscriber_addr}",
  "fee_rate": 1.0
}
EOF

# Send to Prover
curl -X POST https://v8.charms.dev/spells/prove \
  -H "Content-Type: application/json" \
  -d @/tmp/prover_request.json
```

**Response:**
```json
[
  {"bitcoin": "02000000..."},  // Commit transaction (unsigned)
  {"bitcoin": "02000000..."}   // Spell transaction (unsigned)
]
```

**What this means:**
- ✅ Prover validated your spell
- ✅ Generated zk-proof
- ✅ Created transactions
- ⚠️ Transactions are **unsigned** - you must sign them

---

### Phase 6: Signing and Broadcasting (Actual Blockchain Test)

#### Signing Transactions

You need to sign the transactions returned by the Prover. Options:

1. **Using bitcoin-cli** (if you control the UTXO):
```bash
# Sign transaction
signed_tx=$(bitcoin-cli -testnet4 signrawtransactionwithwallet "$tx_hex" | jq -r '.hex')

# Or if using a specific wallet
signed_tx=$(bitcoin-cli -testnet4 signrawtransactionwithwallet "$tx_hex" \
  '[{"txid":"...","vout":0,"scriptPubKey":"...","redeemScript":"..."}]' \
  '["your_private_key"]' | jq -r '.hex')
```

2. **Using Xverse Wallet** (for frontend):
```typescript
const signed = await signTransaction({
  psbt: txHex,
  network: 'testnet'
}, wallet);
```

#### Broadcasting Transactions

```bash
# Broadcast to testnet4
bitcoin-cli -testnet4 sendrawtransaction "$signed_tx"

# Or via API
curl -X POST https://api.blockstream.space/testnet/api/tx \
  -H "Content-Type: text/plain" \
  -d "$signed_tx"
```

**Important**: Broadcast **both** transactions (commit + spell) as a package:

```bash
# Package transactions
bitcoin-cli -testnet4 submitpackage '["'$commit_tx'","'$spell_tx'"]'
```

---

## Testing Workflow Summary

### Development Workflow

1. **Write/Edit Contract** → `src/lib.rs`
2. **Run Tests** → `cargo test`
3. **Build** → `charms app build`
4. **Get VK** → `charms app vk`
5. **Test Spell Structure** → `charms spell check` (local)
6. **Test with Prover** → Send to Prover API
7. **Test on Blockchain** → Sign and broadcast

### What to Test

#### Contract Level:
- ✅ Unit tests pass
- ✅ Spell structure valid
- ✅ Contract accepts valid spells
- ✅ Contract rejects invalid spells

#### Integration Level:
- ✅ Prover accepts spell
- ✅ Proof generation succeeds
- ✅ Transactions are valid Bitcoin transactions

#### Blockchain Level:
- ✅ Transactions broadcast successfully
- ✅ Transactions confirm on-chain
- ✅ Subscription state is correct
- ✅ Payments execute correctly

---

## Common Issues and Solutions

### Issue: "Can't find UTXO"

**Solution:**
- Verify UTXO exists: `curl https://api.blockstream.space/testnet/api/tx/txid`
- Check you have testnet BTC
- Verify address is correct

### Issue: "Invalid spell structure"

**Solution:**
- Check YAML/JSON syntax
- Verify all variables are substituted
- Check field names match contract expectations

### Issue: "Contract validation failed"

**Solution:**
- Review contract logic
- Check state transitions are valid
- Verify amounts match (input = output for payments)

### Issue: "Prover timeout"

**Solution:**
- Proof generation takes ~5 minutes
- Be patient
- Check Prover API status

---

## Next Steps

1. **Test Contract Locally** → Unit tests, spell check
2. **Get Testnet UTXOs** → Use faucet, get real UTXOs
3. **Test with Prover** → Validate full flow
4. **Test on Blockchain** → Sign and broadcast
5. **Integrate Frontend** → Connect UI to flows

---

## Environment Variables Checklist

Create these files:

**`charm-pay-app/.env.test`** (for CLI testing):
```bash
CHARMS_APP_VK=your_verification_key
CHARMS_PROVER_URL=https://v8.charms.dev/spells/prove
BITCOIN_NETWORK=testnet4
```

**`frontend/.env.local`** (for frontend):
```bash
NEXT_PUBLIC_CHARMS_APP_VK=your_verification_key
NEXT_PUBLIC_CHARMS_PROVER_URL=https://v8.charms.dev/spells/prove
```

**Don't commit these to git!** Add to `.gitignore`.

