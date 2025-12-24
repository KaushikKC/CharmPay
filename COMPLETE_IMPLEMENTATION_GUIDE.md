# CharmPay: Complete Implementation Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [File Structure](#file-structure)
5. [Quick Start](#quick-start)
6. [References](#references)

## Overview

CharmPay is a **non-custodial Bitcoin subscription system** built on the Charms Protocol. It allows users to:

- ✅ Lock Bitcoin for subscriptions
- ✅ Execute recurring payments
- ✅ Cancel subscriptions and get refunds
- ✅ All without trusting a third party

**Key Technologies:**
- **Charms Protocol**: Bitcoin programmability with zero-knowledge proofs
- **Rust**: Contract validation logic
- **Next.js + TypeScript**: Frontend interface
- **Xverse Wallet**: Bitcoin wallet integration via Sats Connect
- **Bitcoin Testnet4**: Testing network

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface (Next.js)                   │
│  - Create Subscription                                        │
│  - Execute Payments                                          │
│  - Cancel Subscription                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/JSON
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Frontend Integration Layer                      │
│  - Spell JSON Generation (charms.ts)                         │
│  - Wallet Integration (satsConnect.ts)                        │
│  - Flow Orchestration (subscriptionFlow.ts)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Spell JSON + WASM
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Charms Prover API                           │
│  - Validates spell against contract                          │
│  - Generates zk-SNARK proofs                                 │
│  - Returns unsigned transactions                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Validates using
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Rust Contract (WASM Binary)                     │
│  - Subscription creation validation                          │
│  - Payment execution validation                              │
│  - Cancellation validation                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Returns unsigned transactions
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Xverse Wallet (Sats Connect)                │
│  - Signs transactions                                         │
│  - User approval required                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Signed transactions
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Bitcoin Testnet4                            │
│  - Stores transactions                                        │
│  - Confirms blocks                                           │
└─────────────────────────────────────────────────────────────┘
```

## Step-by-Step Implementation

### 1️⃣ Understanding Charms Contracts

**See**: `charm-pay-app/CONTRACT_EXPLANATION.md`

**Key Points:**
- Contracts **validate**, they don't **execute**
- Rust compiles to WASM for zk-proof generation
- Different from Solidity (off-chain vs on-chain)
- Provides cryptographic guarantees

### 2️⃣ Contract Requirements

**Responsibilities:**
1. Initialize subscription (lock BTC, store metadata)
2. Validate billing cycles (check balance, amount, state)
3. Allow cancellation (refund remaining funds)

**State Structure:**
```rust
pub struct SubscriptionState {
    pub subscription_id: String,
    pub recipient: String,
    pub amount_per_cycle: u64,
    pub remaining_balance: u64,
    pub total_locked: u64,
}
```

### 3️⃣ Rust Contract Implementation

**Location**: `charm-pay-app/src/lib.rs`

**Key Functions:**
- `app_contract()`: Main entry point
- `nft_contract_satisfied()`: Validates NFT operations
- `token_contract_satisfied()`: Validates token operations
- `can_execute_subscription_payment()`: Validates payment execution

**Compilation:**
```bash
cd charm-pay-app
app_bin=$(charms app build)
app_vk=$(charms app vk "$app_bin")
```

### 4️⃣ Testing

**Location**: `charm-pay-app/src/lib.rs` (test module)

**Test Cases:**
- Hash function correctness
- Subscription state conversion
- (Full integration tests require Charms SDK test utilities)

**Run Tests:**
```bash
cd charm-pay-app
cargo test
```

### 5️⃣ Spell JSON Templates

**Locations:**
- `charm-pay-app/spells/create-subscription.json`
- `charm-pay-app/spells/execute-payment.json`
- `charm-pay-app/spells/cancel-subscription.json`

**Structure:**
```json
{
  "version": 8,
  "apps": {
    "$00": "n/${app_id}/${app_vk}",
    "$01": "t/${app_id}/${app_vk}"
  },
  "ins": [...],
  "outs": [...]
}
```

### 6️⃣ Frontend Integration

**Files:**
- `frontend/src/lib/charms.ts`: Spell generation, Prover API
- `frontend/src/lib/satsConnect.ts`: Wallet integration
- `frontend/src/lib/subscriptionFlow.ts`: Complete flows

**Key Functions:**
- `createSubscription()`: Full subscription creation flow
- `executePayment()`: Payment execution flow
- `cancelSubscription()`: Cancellation flow

### 7️⃣ Prover API Integration

**Endpoint**: `https://prover.charms.dev/prove`

**Request:**
```json
{
  "spell": {...},
  "app_bin": "base64_wasm",
  "prev_txs": {...},
  "funding_utxo": "...",
  "funding_utxo_value": 100000,
  "change_address": "..."
}
```

**Response:**
```json
[
  {"bitcoin": "02000000..."},  // Commit transaction
  {"bitcoin": "02000000..."}   // Spell transaction
]
```

### 8️⃣ Wallet Signing

**Integration**: Sats Connect (Xverse Wallet)

**Flow:**
1. Connect wallet: `connectWallet()`
2. Sign transaction: `signTransaction(psbt, wallet)`
3. Broadcast: `broadcastTransactions(signedTxs)`

### 9️⃣ End-to-End Flow

**See**: `END_TO_END_FLOW.md`

**Steps:**
1. User connects wallet
2. User creates subscription
3. Frontend builds spell JSON
4. Spell sent to Prover
5. Prover validates contract logic
6. Wallet signs transactions
7. Transactions broadcast to testnet4
8. UI decodes and displays subscription state

### 🔟 Common Mistakes

**See**: `COMMON_MISTAKES.md`

**Key Avoidances:**
- ❌ Skipping contracts
- ❌ Putting logic in frontend
- ❌ Treating Charms like EVM
- ❌ Misusing YAML
- ❌ Expecting automatic execution

## File Structure

```
CharmPay/
├── charm-pay-app/              # Rust contract
│   ├── src/
│   │   └── lib.rs              # Contract logic
│   ├── spells/                 # Spell templates
│   │   ├── create-subscription.json
│   │   ├── execute-payment.json
│   │   └── cancel-subscription.json
│   ├── CONTRACT_EXPLANATION.md
│   └── Cargo.toml
│
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── charms.ts       # Spell generation, Prover API
│   │   │   ├── satsConnect.ts  # Wallet integration
│   │   │   └── subscriptionFlow.ts  # Complete flows
│   │   └── app/                # Next.js pages
│   └── package.json
│
├── IMPLEMENTATION_PLAN.md      # High-level plan
├── CONTRACT_EXPLANATION.md     # Detailed contract explanation
├── END_TO_END_FLOW.md          # Complete user flows
├── COMMON_MISTAKES.md          # What to avoid
└── COMPLETE_IMPLEMENTATION_GUIDE.md  # This file
```

## Quick Start

### 1. Build Contract

```bash
cd charm-pay-app
rustup target add wasm32-wasip1
app_bin=$(charms app build)
app_vk=$(charms app vk "$app_bin")
echo "App VK: $app_vk"
```

### 2. Set Environment Variables

```bash
# frontend/.env.local
NEXT_PUBLIC_CHARMS_APP_VK=your_verification_key_here
NEXT_PUBLIC_CHARMS_PROVER_URL=https://prover.charms.dev/prove
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
npm install charms-js
```

### 4. Run Frontend

```bash
npm run dev
```

### 5. Test Subscription Creation

1. Open `http://localhost:3000/create`
2. Connect Xverse wallet
3. Fill subscription form
4. Submit transaction
5. Approve in wallet
6. Wait for confirmation

## References

### Documentation

- **Charms Docs**: https://docs.charms.dev/
- **Charms Apps Guide**: https://docs.charms.dev/guides/charms-apps/
- **Cast Spell Guide**: https://docs.charms.dev/guides/charms-apps/cast-spell/
- **Spell JSON Reference**: https://docs.charms.dev/references/spell-json/

### Libraries

- **charms-js**: https://www.npmjs.com/package/charms-js
- **Sats Connect**: Xverse wallet integration

### Code Examples

- **Contract**: `charm-pay-app/src/lib.rs`
- **Spell Generation**: `frontend/src/lib/charms.ts`
- **Wallet Integration**: `frontend/src/lib/satsConnect.ts`
- **Complete Flows**: `frontend/src/lib/subscriptionFlow.ts`

## Next Steps

1. **Test on Testnet4**: Deploy and test all flows
2. **Add Error Handling**: Improve user feedback
3. **Add UI Polish**: Improve user experience
4. **Add Monitoring**: Track subscription states
5. **Prepare for Mainnet**: Security audit, testing

## Support

For issues or questions:
1. Check `COMMON_MISTAKES.md` for common issues
2. Review `CONTRACT_EXPLANATION.md` for contract details
3. See `END_TO_END_FLOW.md` for flow explanations
4. Consult Charms documentation: https://docs.charms.dev/

---

**Built with ❤️ using Charms Protocol**

