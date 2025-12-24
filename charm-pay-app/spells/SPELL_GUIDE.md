# CharmPay Spell Guide

## Understanding Spell Structure

A Charms spell defines the **programmable logic** of a transaction - what it does, not how it's signed. Each spell specifies:

1. **Apps**: Which applications are involved (NFT for state, Token for payments)
2. **Inputs**: UTXOs being spent and their current charm states
3. **Outputs**: New UTXOs being created with their charm states
4. **Private Inputs**: UTXOs that need to be spent but aren't visible in the transaction

## Contract Validation Rules

The app contract (`src/lib.rs`) enforces these rules:

### For Token Transfers (when NFT is present):
```
output_token_amount - input_token_amount == incoming_remaining - outgoing_remaining
```

This means:
- If you transfer tokens, the NFT's `remaining` field must decrease by the same amount
- You cannot create tokens without reducing the NFT's remaining balance
- You cannot destroy tokens without increasing the NFT's remaining balance

### For NFT Minting:
- NFT can only be minted with a valid `w` (witness) that matches the NFT identity
- The `w` must reference a UTXO being spent in the transaction

## Spell Examples

### 1. Create Subscription

**Purpose**: Lock funds and create a subscription NFT

**Logic**:
- Takes a regular UTXO (no charms)
- Creates a subscription NFT with `remaining = total_locked_amount`
- Creates locked tokens equal to `total_locked_amount`

**Variables**:
- `in_utxo_0`: UTXO being spent
- `subscriber_addr`: Subscriber's address
- `subscription_id`: Unique subscription ID
- `total_locked_amount`: Amount to lock (in satoshis)

**Validation**: 
- NFT is minted via `can_mint_nft` (requires valid `w` in private_inputs)
- Tokens are created, but since no NFT input exists, this is the initial mint

### 2. Execute Payment

**Purpose**: Transfer payment to recipient and update subscription state

**Logic**:
- Takes subscription NFT (with current remaining balance)
- Takes all locked tokens (current_remaining_balance)
- Outputs updated NFT (with reduced remaining balance)
- Outputs payment to recipient
- Outputs remaining tokens back to subscriber

**Contract Validation**:
```
Input tokens: current_remaining_balance
Output tokens: payment_amount + new_remaining_balance
Net: payment_amount + new_remaining_balance - current_remaining_balance
    = payment_amount + new_remaining_balance - (payment_amount + new_remaining_balance)
    = 0

NFT change: current_remaining_balance - new_remaining_balance = payment_amount

Contract requires: 0 == payment_amount
```

Wait, that's wrong! Let me recalculate:

Actually:
```
Input tokens: current_remaining_balance
Output tokens: payment_amount + new_remaining_balance
Net: payment_amount + new_remaining_balance - current_remaining_balance

NFT change: current_remaining_balance - new_remaining_balance = payment_amount

Contract: (payment_amount + new_remaining_balance - current_remaining_balance) == payment_amount
         payment_amount + new_remaining_balance - current_remaining_balance == payment_amount
         new_remaining_balance == current_remaining_balance
```

This is still wrong! The issue is that `current_remaining_balance = payment_amount + new_remaining_balance`.

So:
```
Input tokens: payment_amount + new_remaining_balance
Output tokens: payment_amount + new_remaining_balance
Net: 0

NFT change: (payment_amount + new_remaining_balance) - new_remaining_balance = payment_amount

Contract: 0 == payment_amount  ❌
```

This doesn't work! The contract requires that when tokens are transferred, the NFT remaining must decrease. But we're not creating or destroying tokens, just transferring them.

I think the issue is that the current contract logic is designed for minting tokens, not transferring them. For subscriptions, we might need to update the contract to allow pure token transfers when the NFT state changes appropriately.

Actually, wait - let me check if the contract allows token transfers when output == input. Looking at the code:

```rust
output_token_amount - input_token_amount == incoming_supply - outgoing_supply
```

If `output_token_amount == input_token_amount` (pure transfer), then:
```
0 == incoming_supply - outgoing_supply
incoming_supply == outgoing_supply
```

So the NFT remaining must stay the same. But for payments, we want the NFT remaining to decrease!

I think we need to update the contract logic to support subscription payments. The current contract is designed for token minting, not subscription payments.

## Recommended Contract Updates

For subscription payments to work, the contract should allow:
1. Token transfers where `output_tokens == input_tokens` (no net change)
2. NFT state changes that match the payment amount
3. Validation that payment amount doesn't exceed remaining balance

This would require updating `can_mint_token` or adding a new validation function for subscription payments.

