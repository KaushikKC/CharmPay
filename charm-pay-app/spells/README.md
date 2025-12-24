# CharmPay Subscription Spells

This directory contains Charms spell definitions for subscription payment logic.

## Spell Overview

### 1. `create-subscription.yaml`
Creates a new subscription by:
- Minting a subscription NFT that tracks subscription state (ID, remaining balance)
- Locking tokens for future subscription payments
- Assigning the subscription to the subscriber's address

**Variables:**
- `app_id`: Application ID (derived from initial UTXO)
- `app_vk`: Application verification key
- `in_utxo_0`: UTXO being spent to create subscription
- `subscriber_addr`: Subscriber's Bitcoin address
- `subscription_id`: Unique subscription identifier
- `total_locked_amount`: Total amount to lock for subscription (in satoshis)

**Usage:**
```bash
export app_vk=$(charms app vk)
export in_utxo_0="<utxo_id>"
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)
export subscriber_addr="<subscriber_address>"
export subscription_id="sub_001"
export total_locked_amount=1000000  # 0.01 BTC in satoshis

cat ./spells/create-subscription.yaml | envsubst | charms spell check --prev-txs=${prev_txs} --app-bins=${app_bin}
```

### 2. `execute-payment.yaml`
Executes a subscription payment by:
- Transferring the payment amount to the recipient
- Updating the subscription NFT state (reducing remaining balance)
- Returning remaining locked tokens to subscriber

**Variables:**
- `app_id`: Application ID
- `app_vk`: Application verification key
- `subscription_utxo`: UTXO containing the subscription NFT
- `payment_token_utxo`: UTXO containing locked tokens for payment
- `subscription_id`: Subscription identifier
- `current_remaining_balance`: Current remaining balance before payment
- `new_remaining_balance`: Remaining balance after payment
- `payment_amount`: Amount to pay this interval
- `subscriber_addr`: Subscriber's address
- `recipient_addr`: Recipient's address (creator/merchant)

**Usage:**
```bash
export subscription_utxo="<subscription_nft_utxo>"
export payment_token_utxo="<locked_tokens_utxo>"
export subscription_id="sub_001"
export current_remaining_balance=700000  # 0.007 BTC
export payment_amount=100000  # 0.001 BTC per payment
export new_remaining_balance=600000  # 0.006 BTC after payment
export subscriber_addr="<subscriber_address>"
export recipient_addr="<recipient_address>"

cat ./spells/execute-payment.yaml | envsubst | charms spell check --prev-txs=${prev_txs} --app-bins=${app_bin}
```

### 3. `cancel-subscription.yaml`
Cancels a subscription and refunds remaining balance by:
- Burning the subscription NFT (no NFT output)
- Returning all remaining locked tokens to the subscriber

**Variables:**
- `app_id`: Application ID
- `app_vk`: Application verification key
- `subscription_utxo`: UTXO containing the subscription NFT
- `token_utxo`: UTXO containing remaining locked tokens
- `subscription_id`: Subscription identifier
- `remaining_balance`: Remaining balance to refund
- `subscriber_addr`: Subscriber's address (receives refund)

**Usage:**
```bash
export subscription_utxo="<subscription_nft_utxo>"
export token_utxo="<remaining_tokens_utxo>"
export subscription_id="sub_001"
export remaining_balance=600000  # 0.006 BTC to refund
export subscriber_addr="<subscriber_address>"

cat ./spells/cancel-subscription.yaml | envsubst | charms spell check --prev-txs=${prev_txs} --app-bins=${app_bin}
```

## Spell Structure

Each spell follows the Charms spell format (version 8):

- **`version`**: Spell format version (8)
- **`apps`**: Application definitions using `$00`, `$01`, etc.
  - `n/${app_id}/${app_vk}`: NFT app for state management
  - `t/${app_id}/${app_vk}`: Token app for payments
- **`ins`**: Input UTXOs with their charm states
- **`outs`**: Output addresses with charm states
- **`private_inputs`**: Private inputs (for creating subscriptions)

## Notes

- All amounts are in **satoshis** (1 BTC = 100,000,000 satoshis)
- The subscription NFT uses the `ticker` field to store the subscription ID
- The `remaining` field in the NFT tracks the remaining locked balance
- Tokens represent the actual locked funds that can be transferred
- The app contract validates that token transfers match the NFT state changes

## Important: Contract Validation

The current app contract (`src/lib.rs`) validates token operations using:
```
output_token_amount - input_token_amount == incoming_remaining - outgoing_remaining
```

**For subscription payments**, this means:
- When executing a payment, tokens are transferred (not minted/burned)
- The contract may need updates to support pure token transfers with NFT state changes
- Currently, the contract is designed for token minting scenarios

**Recommendation**: Review and potentially update the contract's `token_contract_satisfied` function to support subscription payment logic where:
1. Tokens are transferred (output == input, net change = 0)
2. NFT remaining decreases by the payment amount
3. Payment amount doesn't exceed remaining balance

See `SPELL_GUIDE.md` for detailed contract validation analysis.

## Integration with Frontend

These spells can be integrated with the frontend by:
1. Generating spell JSON from templates using environment variables
2. Using the Charms SDK to sign and broadcast transactions
3. Tracking subscription state via the NFT UTXOs

