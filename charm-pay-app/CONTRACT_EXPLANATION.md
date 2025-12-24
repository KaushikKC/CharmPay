# CharmPay Contract Explanation

## 1️⃣ Understanding Charms Contracts

### Why Rust Contracts?

**Charms requires Rust contracts** because:

1. **Zero-Knowledge Proof Generation**: Charms uses zk-SNARKs to prove transaction validity. Rust compiles to WebAssembly (WASM), which can be efficiently proven in zero-knowledge circuits.

2. **Cryptographic Guarantees**: Unlike frontend JavaScript, Rust contracts provide cryptographic guarantees that cannot be manipulated by users.

3. **Off-Chain Validation**: Charms contracts don't execute on-chain like Solidity. Instead, they:
   - Validate transactions **off-chain**
   - Generate **zero-knowledge proofs** of validity
   - Embed proofs in Bitcoin transactions
   - Anyone can verify the proof without re-running the contract

### What Problem They Solve

**State Validation, Not Execution:**

- ✅ **What contracts do**: "Is this transaction valid according to my rules?"
- ❌ **What contracts DON'T do**: "Execute this transaction on-chain"

**Example:**
- Contract checks: "Does this payment have enough balance?"
- Contract does NOT: "Transfer the funds" (Bitcoin does that)

### How They Differ from Solidity

| Aspect | Solidity (Ethereum) | Charms (Bitcoin) |
|--------|---------------------|------------------|
| **Execution** | On-chain (EVM) | Off-chain (WASM) |
| **Validation** | Re-run on every node | Prove once, verify many times |
| **Cost** | Gas per execution | One-time proof generation |
| **Privacy** | All logic visible | Zero-knowledge proofs |
| **Network** | Ethereum | Bitcoin |

### Why Logic Cannot Live Only in Frontend or YAML

**Frontend (JavaScript/TypeScript):**
- ❌ Can be manipulated by users
- ❌ No cryptographic guarantees
- ❌ Can be bypassed

**YAML (Spell JSON):**
- ❌ Just data, not logic
- ❌ No validation rules
- ❌ Anyone can create invalid spells

**Rust Contract:**
- ✅ Cryptographically verified
- ✅ Cannot be bypassed
- ✅ Provides trustless guarantees

## 2️⃣ CharmPay Contract Responsibilities

### What the Contract Does

1. **Initialize Subscription**
   - Validates that a subscription NFT is minted correctly
   - Ensures locked tokens match subscription state
   - Verifies subscription metadata

2. **Validate Billing Cycle**
   - Checks sufficient balance remains
   - Validates payment amount matches `amount_per_cycle`
   - Ensures state transitions correctly (remaining_balance decreases)

3. **Allow Cancellation**
   - Verifies only subscription owner can cancel
   - Ensures all remaining funds are refunded
   - Validates NFT is properly marked as cancelled

### What Should NOT Be in Contract

- ❌ UI logic (button clicks, form validation)
- ❌ API calls (fetching data, sending requests)
- ❌ Wallet interactions (signing, broadcasting)
- ❌ Transaction building (that's the spell JSON's job)
- ❌ Business logic unrelated to state validation

### Contract Inputs/Outputs

**Inputs:**
- `app: &App` - The application context (NFT or TOKEN tag)
- `tx: &Transaction` - The transaction being validated
- `x: &Data` - Public input data (usually empty)
- `w: &Data` - Witness data (for NFT minting)

**Outputs:**
- `bool` - Whether the transaction is valid

**State:**
- Stored in NFT charm data as `SubscriptionState`
- Includes: subscription_id, recipient, amount_per_cycle, remaining_balance, total_locked

## 3️⃣ Contract Implementation Details

### Charms SDK Primitives

The contract uses these SDK functions:

- `charm_values()` - Extract charm data from UTXOs
- `sum_token_amount()` - Sum token amounts across UTXOs
- `check!()` - Assert a condition (returns false if fails)
- `App` - Represents an application (NFT or TOKEN)
- `Transaction` - The transaction being validated
- `Data` - Serialized charm data

### Validation Logic

**Subscription Creation:**
```rust
// 1. Validate NFT is minted with correct witness
// 2. Ensure NFT structure is valid
// 3. Verify tokens are locked correctly
```

**Payment Execution:**
```rust
// 1. Check NFT exists in inputs and outputs
// 2. Validate remaining_balance decreases by payment_amount
// 3. Ensure tokens are transferred correctly (output == input)
// 4. Verify payment goes to correct recipient
```

**Cancellation:**
```rust
// 1. Verify NFT is marked as cancelled (remaining = 0)
// 2. Ensure all tokens are refunded
// 3. Validate no new tokens are created
```

### Zero-Knowledge Verification

**How it works conceptually:**

1. **Prover** (Charms Prover API):
   - Takes spell JSON + contract WASM
   - Runs contract logic
   - Generates zk-SNARK proof that contract validated successfully

2. **Verifier** (Anyone):
   - Takes transaction + proof
   - Verifies proof cryptographically
   - Doesn't need to run contract logic

3. **Bitcoin Network:**
   - Stores transaction with embedded proof
   - Anyone can verify proof without running contract

**Why this matters:**
- ✅ Privacy: Contract logic not visible on-chain
- ✅ Efficiency: Proof verification is fast
- ✅ Trust: Cryptographic guarantees, not social consensus

## 4️⃣ Testing the Contract

### Unit Testing

Tests validate contract logic without blockchain:

```rust
#[test]
fn test_subscription_creation() {
    // Create mock transaction
    // Call app_contract()
    // Assert it returns true
}

#[test]
fn test_insufficient_balance() {
    // Create transaction with insufficient balance
    // Assert contract rejects it
}
```

### Test Cases Required

1. **Valid Subscription Creation**
   - NFT minted correctly
   - Tokens locked correctly
   - State initialized properly

2. **Insufficient Balance**
   - Payment exceeds remaining_balance
   - Contract rejects transaction

3. **Invalid State Mutation**
   - remaining_balance increases (should decrease)
   - Wrong recipient
   - Invalid payment amount

### What Passing Tests Mean

- ✅ Contract logic is correct
- ✅ Validation rules work as expected
- ✅ Edge cases are handled
- ⚠️ **Does NOT mean**: Transaction will succeed on Bitcoin (need valid UTXOs, signatures, etc.)

## 5️⃣ Compilation Process

### Install Charms CLI

```bash
# Set CARGO_TARGET_DIR (required for Charms CLI installation)
export CARGO_TARGET_DIR=$(mktemp -d)/target

# Install Charms CLI
cargo install charms --version=0.10.0

# Verify installation
charms --version
```

### Compile the App

```bash
cd charm-pay-app

# Build the WASM binary
app_bin=$(charms app build)

# Output: ./target/wasm32-wasip1/release/charm-pay-app.wasm
```

### Get Verification Key

```bash
# Generate verification key
app_vk=$(charms app vk "$app_bin")

# Example output: 8fd3f8f51e13664a94a2f2bc968892cdc1d3151261f535d25b5716da5cdff01c
```

### Artifacts Produced

1. **WASM Binary**: `./target/wasm32-wasip1/release/charm-pay-app.wasm`
   - Compiled contract code
   - Used by Prover to generate proofs

2. **Verification Key (VK)**: Hex string (64 characters)
   - Public key for verifying proofs
   - Must be included in spell JSON
   - Anyone can verify proofs with this key

3. **App ID**: Derived from initial UTXO
   - Unique identifier for the app instance
   - Calculated: `sha256(initial_utxo)`

### Why Verification Key is Critical

- **Without VK**: Cannot verify proofs, contract is useless
- **With VK**: Anyone can verify transaction validity without running contract
- **Security**: VK is public, but proofs are private (zero-knowledge)

## 6️⃣ Spell JSON Connection to Contract

### What is a Spell JSON?

A **spell** is a JSON/YAML file that describes:
- What transaction you want to create
- Which UTXOs to spend
- What outputs to create
- What charm states to include

**Key Point**: Spells are **descriptions**, not **execution**.

### Why Spells Reference Verification Key

```json
{
  "apps": {
    "$00": "n/${app_id}/${app_vk}"
  }
}
```

- `app_id`: Identifies which app instance
- `app_vk`: Verification key for proof verification
- Prover uses VK to generate proofs
- Verifiers use VK to verify proofs

### Why Spells Are NOT Contracts

| Spells | Contracts |
|--------|-----------|
| Describe transactions | Validate transactions |
| Created by frontend | Written in Rust |
| Can be invalid | Rejects invalid spells |
| Just data | Contains logic |

**Analogy**: Spell is like a "recipe", contract is like a "quality inspector"

### Spell JSON Structure

```json
{
  "version": 8,
  "apps": {
    "$00": "n/${app_id}/${app_vk}",  // NFT app
    "$01": "t/${app_id}/${app_vk}"   // Token app
  },
  "ins": [
    {
      "utxo_id": "${utxo}",
      "charms": {
        "$00": { /* NFT state */ },
        "$01": 1000000  // Token amount
      }
    }
  ],
  "outs": [
    {
      "address": "${address}",
      "charms": {
        "$00": { /* NFT state */ },
        "$01": 500000  // Token amount
      }
    }
  ]
}
```

**Field Explanations:**

- `version`: Spell format version (currently 8)
- `apps`: Application definitions (NFT and/or TOKEN)
- `ins`: Input UTXOs with their charm states
- `outs`: Output addresses with charm states
- `charms`: The actual charm data (NFT state or token amount)

## 7️⃣ Prover API Integration

### How Frontend Sends Spell JSON

```typescript
const response = await fetch('https://prover.charms.dev/prove', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    spell: spellJson,
    app_bin: wasmBinary,  // Base64 encoded WASM
    prev_txs: previousTransactions,
    funding_utxo: fundingUtxo,
    funding_utxo_value: fundingValue,
    change_address: changeAddress
  })
});
```

### What Prover Returns

```json
[
  {
    "bitcoin": "020000000001015f...57505efa00000000"  // Commit transaction
  },
  {
    "bitcoin": "020000000001025f...e14c656300000000"  // Spell transaction
  }
]
```

**Two Transactions:**

1. **Commit Transaction**: Creates output committing to spell + proof
2. **Spell Transaction**: Contains spell + proof in witness, spends commit output

### Why They Are Unsigned

- Prover doesn't have your private keys
- You must sign with your wallet
- Signing proves you authorized the transaction

### Why ZK Proofs Are Embedded

- Proof is in the witness data of spell transaction
- Anyone can verify proof without running contract
- Provides cryptographic guarantee of validity

## 8️⃣ Wallet Signing Flow

### Why Wallet Signing is Mandatory

- Bitcoin requires signatures to spend UTXOs
- Only wallet owner has private keys
- Signing proves authorization

### Sats Connect Signing

```typescript
import { createSigner, createInscription } from '@sats-connect/core';

// Sign transactions returned by Prover
const signedTxs = await signer.signTransaction({
  psbt: psbtFromProver,
  network: 'testnet4'
});
```

### What Happens if User Rejects

- Transaction is not signed
- Cannot be broadcast
- No funds are spent
- User can try again later

### TypeScript Example

See `frontend/src/lib/charms.ts` for complete implementation.

## 9️⃣ End-to-End Flow

1. **User Connects Wallet**
   - Frontend calls Sats Connect
   - User approves connection
   - Frontend gets wallet address

2. **User Creates Subscription**
   - User fills form (recipient, amount, interval)
   - Frontend builds spell JSON
   - Frontend sends to Prover API

3. **Prover Validates**
   - Prover runs contract logic
   - Generates zk-SNARK proof
   - Returns unsigned transactions

4. **Wallet Signs**
   - Frontend sends transactions to wallet
   - User approves signing
   - Wallet returns signed transactions

5. **Broadcast to Testnet4**
   - Frontend submits package to Bitcoin node
   - Both transactions broadcast together
   - Transaction confirmed on blockchain

6. **UI Updates**
   - Frontend decodes transaction
   - Extracts subscription state
   - Displays in UI

## 🔟 Common Mistakes to Avoid

1. **Trying to Skip Contracts**
   - ❌ "I'll just use YAML"
   - ✅ Contracts are required for validation

2. **Putting Logic in Frontend**
   - ❌ "I'll validate in JavaScript"
   - ✅ Validation must be in contract

3. **Treating Charms like EVM**
   - ❌ "Contracts execute on-chain"
   - ✅ Contracts validate off-chain

4. **Misusing YAML**
   - ❌ "YAML is the contract"
   - ✅ YAML is just transaction description

5. **Expecting Automatic Execution**
   - ❌ "Payments happen automatically"
   - ✅ User must sign each payment transaction

