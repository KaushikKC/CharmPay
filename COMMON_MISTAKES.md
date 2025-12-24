# Common Mistakes to Avoid in CharmPay

## 1. Trying to Skip Contracts

### ❌ Wrong Approach
```typescript
// "I'll just validate in the frontend"
function createSubscription(data) {
  if (data.amount > 0) {
    // Create transaction
  }
}
```

### ✅ Correct Approach
```rust
// Contract validates in Rust
fn validate_subscription(tx: &Transaction) -> bool {
    check!(amount > 0);
    // ... more validation
}
```

**Why**: Frontend validation can be bypassed. Contracts provide cryptographic guarantees.

## 2. Putting Logic in Frontend

### ❌ Wrong Approach
```typescript
// Frontend calculates payment
const payment = calculatePayment(subscription);
// Frontend validates
if (payment > subscription.balance) {
  throw new Error('Insufficient balance');
}
```

### ✅ Correct Approach
```rust
// Contract validates
fn validate_payment(tx: &Transaction) -> bool {
    check!(payment_amount <= remaining_balance);
    // Validation happens in contract
}
```

**Why**: Frontend logic can be manipulated. Contract logic is cryptographically verified.

## 3. Treating Charms like EVM

### ❌ Wrong Approach
```typescript
// "Contracts execute on-chain like Solidity"
await contract.executePayment(subscriptionId);
// Expecting automatic execution
```

### ✅ Correct Approach
```typescript
// Contracts validate off-chain
// User must sign each transaction
const spell = createPaymentSpell(...);
const txs = await proveSpell(spell);
await signAndBroadcast(txs);
```

**Why**: Charms contracts validate, they don't execute. Users must sign each transaction.

## 4. Misusing YAML/JSON

### ❌ Wrong Approach
```yaml
# "YAML is the contract"
version: 8
apps:
  $00: n/app_id/vk
# Expecting YAML to validate logic
```

### ✅ Correct Approach
```yaml
# YAML describes transaction
version: 8
apps:
  $00: n/app_id/vk
# Contract validates the transaction
```

**Why**: YAML is just data. Contracts contain the validation logic.

## 5. Expecting Automatic Execution

### ❌ Wrong Approach
```typescript
// "Payments happen automatically"
setInterval(() => {
  await executePayment(subscriptionId);
  // Expecting this to work automatically
}, 30 * 24 * 60 * 60 * 1000);
```

### ✅ Correct Approach
```typescript
// User must sign each payment
// Frontend can prompt user
async function executePayment() {
  const spell = createPaymentSpell(...);
  const txs = await proveSpell(spell);
  // User must approve in wallet
  await signAndBroadcast(txs);
}
```

**Why**: Bitcoin requires signatures. No automatic execution without user approval.

## 6. Not Handling Errors Properly

### ❌ Wrong Approach
```typescript
try {
  await createSubscription(data);
} catch (e) {
  console.log(e);
  // No user feedback
}
```

### ✅ Correct Approach
```typescript
try {
  await createSubscription(data);
} catch (e) {
  if (e.message.includes('insufficient')) {
    showError('Insufficient balance');
  } else if (e.message.includes('validation')) {
    showError('Invalid subscription data');
  } else {
    showError('Transaction failed. Please try again.');
  }
}
```

**Why**: Users need clear error messages to understand what went wrong.

## 7. Not Validating Inputs

### ❌ Wrong Approach
```typescript
// Trusting user input
const spell = createSubscriptionSpell({
  amount: userInput.amount, // No validation
  recipient: userInput.recipient, // No validation
});
```

### ✅ Correct Approach
```typescript
// Validate inputs
if (userInput.amount <= 0) {
  throw new Error('Amount must be positive');
}
if (!isValidAddress(userInput.recipient)) {
  throw new Error('Invalid recipient address');
}
const spell = createSubscriptionSpell({
  amount: userInput.amount,
  recipient: userInput.recipient,
});
```

**Why**: Invalid inputs waste user's time and transaction fees.

## 8. Not Fetching Previous Transactions

### ❌ Wrong Approach
```typescript
const response = await proveSpell({
  spell,
  prev_txs: {}, // Empty!
  // ...
});
```

### ✅ Correct Approach
```typescript
// Fetch previous transactions
const prevTxs = await fetchPreviousTransactions(utxos);
const response = await proveSpell({
  spell,
  prev_txs: prevTxs,
  // ...
});
```

**Why**: Prover needs previous transactions to validate inputs.

## 9. Not Handling Wallet Disconnection

### ❌ Wrong Approach
```typescript
const wallet = await connectWallet();
// Assume wallet stays connected
await createSubscription(data);
```

### ✅ Correct Approach
```typescript
let wallet = null;
try {
  wallet = await connectWallet();
} catch (e) {
  showError('Please connect your wallet');
  return;
}

// Check if still connected before each operation
if (!isWalletConnected()) {
  wallet = await connectWallet();
}
```

**Why**: Users may disconnect wallet. Always check connection status.

## 10. Not Testing Contract Logic

### ❌ Wrong Approach
```rust
// No tests
fn validate_payment(tx: &Transaction) -> bool {
    // Logic not tested
    true
}
```

### ✅ Correct Approach
```rust
#[test]
fn test_payment_validation() {
    // Test valid payment
    // Test insufficient balance
    // Test invalid amount
}
```

**Why**: Contract bugs can lock funds. Always test thoroughly.

## 11. Hardcoding Values

### ❌ Wrong Approach
```typescript
const APP_VK = '8fd3f8f51e13664a94a2f2bc968892cdc1d3151261f535d25b5716da5cdff01c';
// Hardcoded in code
```

### ✅ Correct Approach
```typescript
const APP_VK = process.env.NEXT_PUBLIC_CHARMS_APP_VK;
// From environment variables
```

**Why**: Different environments need different keys. Use environment variables.

## 12. Not Handling Network Errors

### ❌ Wrong Approach
```typescript
const response = await fetch(proverUrl, ...);
// No retry logic
```

### ✅ Correct Approach
```typescript
async function proveSpellWithRetry(request, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await proveSpell(request);
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(1000 * (i + 1)); // Exponential backoff
    }
  }
}
```

**Why**: Network can be unreliable. Retry logic improves reliability.

## Summary

**Key Principles:**

1. ✅ **Contracts validate, frontend describes**
2. ✅ **Users sign, contracts don't execute**
3. ✅ **YAML is data, Rust is logic**
4. ✅ **Always handle errors gracefully**
5. ✅ **Test contract logic thoroughly**
6. ✅ **Use environment variables**
7. ✅ **Handle network failures**
8. ✅ **Validate all inputs**

**Remember**: Charms is about **cryptographic validation**, not **on-chain execution**. Think of it as "transaction validation rules" rather than "smart contracts."

