# Quick Start: Using Subscription Spells

This guide shows you how to use the subscription spells to create, execute payments, and cancel subscriptions.

## Prerequisites

1. Build the app and get the verification key:
```bash
cd charm-pay-app
app_bin=$(charms app build)
app_vk=$(charms app vk "$app_bin")
export app_vk
```

2. Get a UTXO to use:
```bash
# Use your Bitcoin wallet to get a UTXO
export in_utxo_0="<your_utxo_id>"
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)
```

## 1. Create a Subscription

Creates a new subscription by locking funds and minting a subscription NFT.

```bash
export subscriber_addr="<subscriber_bitcoin_address>"
export subscription_id="sub_001"
export total_locked_amount=1000000  # 0.01 BTC in satoshis

# Generate the spell
cat ./spells/create-subscription.yaml | envsubst > create-subscription-spell.yaml

# Check the spell (requires prev_txs)
# charms spell check --prev-txs=${prev_txs} --app-bins=${app_bin} < create-subscription-spell.yaml
```

**What this does:**
- Locks `total_locked_amount` tokens
- Creates a subscription NFT with `remaining = total_locked_amount`
- Both are assigned to the subscriber

## 2. Execute a Payment

Executes a subscription payment, transferring funds to the recipient and updating the subscription state.

```bash
export subscription_utxo="<utxo_with_subscription_nft>"
export token_utxo="<utxo_with_locked_tokens>"
export subscription_id="sub_001"
export current_remaining_balance=1000000  # Current locked amount
export payment_amount=100000  # 0.001 BTC per payment
export new_remaining_balance=900000  # Remaining after payment
export subscriber_addr="<subscriber_address>"
export recipient_addr="<recipient_address>"

# Generate the spell
cat ./spells/execute-payment.yaml | envsubst > execute-payment-spell.yaml

# Check the spell
# charms spell check --prev-txs=${prev_txs} --app-bins=${app_bin} < execute-payment-spell.yaml
```

**What this does:**
- Transfers `payment_amount` to the recipient
- Updates subscription NFT: `remaining = new_remaining_balance`
- Returns remaining tokens to subscriber
- Contract validates: `input_tokens == output_tokens` (pure transfer)

## 3. Cancel Subscription

Cancels a subscription and refunds all remaining balance.

```bash
export subscription_utxo="<utxo_with_subscription_nft>"
export token_utxo="<utxo_with_remaining_tokens>"
export subscription_id="sub_001"
export remaining_balance=900000  # Amount to refund
export subscriber_addr="<subscriber_address>"

# Generate the spell
cat ./spells/cancel-subscription.yaml | envsubst > cancel-subscription-spell.yaml

# Check the spell
# charms spell check --prev-txs=${prev_txs} --app-bins=${app_bin} < cancel-subscription-spell.yaml
```

**What this does:**
- Marks subscription as cancelled (NFT with `remaining = 0`)
- Refunds all remaining tokens to subscriber
- Contract validates the refund

## Spell Structure

All spells follow this structure:

```yaml
version: 8

apps:
  $00: n/${app_id}/${app_vk}  # NFT app
  $01: t/${app_id}/${app_vk}  # Token app

ins:
  - utxo_id: ${utxo}
    charms:
      $00: { ... }  # NFT state
      $01: ${amount}  # Token amount

outs:
  - address: ${address}
    charms:
      $00: { ... }  # NFT state
      $01: ${amount}  # Token amount
```

## Contract Validation

The updated contract supports:
1. **Token Minting**: `output_tokens - input_tokens == incoming_remaining - outgoing_remaining`
2. **Subscription Payments**: `output_tokens == input_tokens` when NFT remaining decreases

This allows pure token transfers for subscription payments while maintaining security.

## Next Steps

1. Test spells with `charms spell check`
2. Sign and broadcast transactions using your Bitcoin wallet
3. Track subscription state via NFT UTXOs
4. Integrate with frontend for user-friendly subscription management

