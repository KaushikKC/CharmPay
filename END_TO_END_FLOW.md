# CharmPay: End-to-End Flow

## Complete User Journey

This document describes the complete flow from user perspective to blockchain confirmation.

## Flow 1: Creating a Subscription

### Step-by-Step

1. **User Opens App**
   - User navigates to `/create` page
   - Fills in subscription form:
     - Recipient address
     - Amount per cycle (in BTC)
     - Total amount to lock

2. **User Connects Wallet**
   ```typescript
   const wallet = await connectWallet();
   // User approves connection in Xverse wallet
   // Returns: { address, publicKey, network }
   ```

3. **Frontend Builds Spell JSON**
   ```typescript
   const spell = createSubscriptionSpell({
     appId: calculateAppId(fundingUtxo),
     appVk: APP_VK,
     subscriberAddress: wallet.address,
     subscriptionId: generateSubscriptionId(),
     totalLockedAmount: totalLocked * 100000000, // Convert to satoshis
     fundingUtxo: `${utxo.txid}:${utxo.vout}`,
   });
   ```

4. **Frontend Sends to Prover**
   ```typescript
   const response = await proveSpell({
     spell,
     app_bin: wasmBinaryBase64,
     prev_txs: previousTransactions,
     funding_utxo: fundingUtxoId,
     funding_utxo_value: utxo.value,
     change_address: wallet.address,
   });
   ```

5. **Prover Validates Contract**
   - Prover loads WASM binary
   - Runs `app_contract()` function
   - Validates spell against contract rules
   - Generates zk-SNARK proof
   - Returns two unsigned transactions

6. **Wallet Signs Transactions**
   ```typescript
   for (const tx of response.transactions) {
     const signed = await signTransaction({
       psbt: tx.bitcoin,
       network: 'testnet',
     }, wallet);
     signedTxs.push(signed);
   }
   ```

7. **Transactions Broadcast**
   ```typescript
   const txids = await broadcastTransactions(signedTxs, 'testnet');
   ```

8. **UI Updates**
   - Frontend extracts charms from transaction
   - Displays subscription in dashboard
   - Shows subscription NFT and locked tokens

## Flow 2: Executing a Payment

### Step-by-Step

1. **User Triggers Payment**
   - User clicks "Execute Payment" button
   - Frontend fetches current subscription state

2. **Frontend Builds Payment Spell**
   ```typescript
   const spell = executePaymentSpell({
     appId,
     appVk,
     subscriptionUtxo: currentSubscriptionUtxo,
     tokenUtxo: currentTokenUtxo,
     subscriptionId,
     currentRemainingBalance,
     paymentAmount: amountPerCycle,
     newRemainingBalance: currentRemainingBalance - amountPerCycle,
     subscriberAddress: wallet.address,
     recipientAddress: subscription.recipient,
   });
   ```

3. **Prover Validates Payment**
   - Contract checks:
     - ✅ Sufficient balance
     - ✅ Correct payment amount
     - ✅ Valid state transition
   - Generates proof

4. **Wallet Signs & Broadcasts**
   - Same as subscription creation

5. **UI Updates**
   - Shows payment in history
   - Updates remaining balance
   - Displays next payment date

## Flow 3: Cancelling Subscription

### Step-by-Step

1. **User Clicks Cancel**
   - User confirms cancellation
   - Frontend fetches current state

2. **Frontend Builds Cancellation Spell**
   ```typescript
   const spell = cancelSubscriptionSpell({
     appId,
     appVk,
     subscriptionUtxo,
     tokenUtxo,
     subscriptionId,
     remainingBalance,
     subscriberAddress: wallet.address,
   });
   ```

3. **Prover Validates Cancellation**
   - Contract checks:
     - ✅ Subscription exists
     - ✅ All tokens refunded
     - ✅ NFT marked as cancelled

4. **Wallet Signs & Broadcasts**
   - Same as above

5. **UI Updates**
   - Subscription marked as cancelled
   - Shows refunded amount
   - Removes from active subscriptions

## Technical Details

### Transaction Structure

Each spell creates **two transactions**:

1. **Commit Transaction**
   - Creates Taproot output
   - Commits to spell + proof
   - Spent by spell transaction

2. **Spell Transaction**
   - Contains spell JSON in witness
   - Contains zk-SNARK proof
   - Creates subscription outputs

### State Management

**Subscription State** is stored in NFT charm data:
```json
{
  "ticker": "SUBSCRIPTION-sub_001",
  "remaining": 1000000
}
```

**Locked Tokens** are stored as TOKEN charms:
```json
{
  "$01": 1000000  // Amount in satoshis
}
```

### Contract Validation

For each transaction, the contract:

1. **Extracts charm data** from inputs/outputs
2. **Validates state transitions**:
   - Subscription creation: NFT minted correctly
   - Payment: Balance decreases by payment amount
   - Cancellation: All funds refunded
3. **Returns true/false** (valid/invalid)

### Proof Generation

The Prover:
1. Loads contract WASM
2. Runs contract logic
3. Generates zk-SNARK proof
4. Embeds proof in transaction witness

### Verification

Anyone can verify:
1. Extract proof from transaction
2. Use verification key (public)
3. Verify proof cryptographically
4. No need to run contract logic

## Error Handling

### Common Errors

1. **Insufficient Balance**
   - Contract rejects transaction
   - Prover returns error
   - Frontend shows error message

2. **Invalid State**
   - Contract rejects transaction
   - User must refresh state

3. **Wallet Rejection**
   - User cancels signing
   - Transaction not broadcast
   - No funds spent

4. **Network Errors**
   - Retry logic in frontend
   - Show error to user
   - Allow manual retry

## Security Considerations

1. **Contract Validation**: All logic validated cryptographically
2. **Wallet Signing**: User must approve every transaction
3. **Zero-Knowledge**: Contract logic not visible on-chain
4. **Non-Custodial**: User controls funds at all times

## Performance

- **Proof Generation**: ~5 minutes (being optimized)
- **Verification**: <1 second
- **Transaction Confirmation**: ~10 minutes (Bitcoin testnet)
- **Total Flow**: ~15-20 minutes end-to-end

