# CharmPay: Complete Implementation Plan

## Overview

CharmPay is a non-custodial Bitcoin subscription system built on Charms Protocol. This document provides a complete, step-by-step implementation guide.

## Architecture

```
┌─────────────────┐
│  Next.js UI     │  ← User Interface
└────────┬────────┘
         │
         │ HTTP
         ▼
┌─────────────────┐
│  Charms Prover  │  ← Validates & Generates Proofs
│      API        │
└────────┬────────┘
         │
         │ Validates against
         ▼
┌─────────────────┐
│  Rust Contract  │  ← Business Logic (zk-verified)
│  (WASM Binary)  │
└─────────────────┘
         │
         │ Creates
         ▼
┌─────────────────┐
│  Spell JSON     │  ← Transaction Description
└────────┬────────┘
         │
         │ Signed by
         ▼
┌─────────────────┐
│  Xverse Wallet  │  ← User's Bitcoin Wallet
└────────┬────────┘
         │
         │ Broadcasts
         ▼
┌─────────────────┐
│  Bitcoin Testnet│  ← Bitcoin Network
└─────────────────┘
```

## Step-by-Step Implementation

### Step 1: Understanding Charms Contracts

**Why Rust Contracts?**
- Charms uses zero-knowledge proofs for validation
- Rust compiles to WASM, which can be efficiently proven
- Contracts define **validation rules**, not execution logic
- Unlike Solidity, contracts don't execute on-chain - they're verified off-chain

**What Problem They Solve:**
- State validation: "Is this transaction valid according to the rules?"
- Not execution: "Execute this transaction"
- Enables trustless Bitcoin programmability

**Difference from Solidity:**
- Solidity: Code executes on-chain (Ethereum VM)
- Charms: Code validates off-chain, proofs are verified on-chain
- Charms is more like "transaction validation rules" than "smart contracts"

**Why Not Frontend/YAML Only:**
- Frontend can be manipulated by users
- YAML is just data, not logic
- Contracts provide cryptographic guarantees

### Step 2: Contract Requirements

**CharmPay Contract Responsibilities:**
1. Initialize subscription: Lock BTC, store metadata
2. Validate billing cycles: Check balance, amount, state
3. Allow cancellation: Return remaining funds

**What Should NOT Be in Contract:**
- UI logic
- API calls
- Wallet interactions
- Transaction building (that's the spell)

### Step 3: Contract Implementation

See `charm-pay-app/src/lib.rs` for full implementation.

### Step 4: Testing

Unit tests validate contract logic without blockchain.

### Step 5: Compilation

Use `charms app build` to compile to WASM and get verification key.

### Step 6: Spell JSON

Spells describe transactions, contracts validate them.

### Step 7: Prover API Integration

Frontend sends spell JSON, Prover validates and generates proofs.

### Step 8: Wallet Signing

Xverse/Sats Connect signs the transactions returned by Prover.

### Step 9: End-to-End Flow

Complete user journey from subscription creation to payment execution.

### Step 10: Common Mistakes

What to avoid when building with Charms.

