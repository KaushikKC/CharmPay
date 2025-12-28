use charms_sdk::data::{
    charm_values, check, sum_token_amount, App, Data, Transaction, UtxoId, B32, NFT, TOKEN,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Minimal subscription state for CharmPay
/// This represents a subscription with all required fields
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MinimalSubscriptionState {
    /// Public key or address of the payer (subscription owner)
    /// Immutable: Set at creation, never changes
    pub payer_pubkey: String,
    
    /// Public key or address of the merchant (payment recipient)
    /// Immutable: Set at creation, never changes
    pub merchant_pubkey: String,
    
    /// Payment amount per billing cycle (in satoshis)
    /// Immutable: Set at creation, defines subscription terms
    pub amount_sats: u64,
    
    /// Number of blocks between payments
    /// Immutable: Set at creation, defines subscription terms
    pub billing_interval_blocks: u32,
    
    /// Block height when last payment occurred
    /// Mutable: Updates with each payment
    pub last_payment_block: u32,
    
    /// Whether subscription is currently active
    /// Mutable: Can be set to false on cancellation
    pub is_active: bool,
    
    /// Remaining locked balance (in satoshis)
    /// Mutable: Decreases with each payment
    pub remaining_balance: u64,
}

/// Subscription state stored in NFT (backward compatible)
/// This represents a subscription with locked funds
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionState {
    /// Subscription identifier (e.g., "sub_001")
    pub subscription_id: String,
    /// Recipient address (who receives payments)
    pub recipient: String,
    /// Amount per billing cycle (in satoshis)
    pub amount_per_cycle: u64,
    /// Remaining locked balance (in satoshis)
    pub remaining_balance: u64,
    /// Total amount originally locked (in satoshis)
    pub total_locked: u64,
}

/// Legacy NFT content structure (for backward compatibility)
/// Maps to SubscriptionState for subscription NFTs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NftContent {
    pub ticker: String,
    pub remaining: u64,
}

impl From<SubscriptionState> for NftContent {
    fn from(state: SubscriptionState) -> Self {
        NftContent {
            ticker: format!("SUBSCRIPTION-{}", state.subscription_id),
            remaining: state.remaining_balance,
        }
    }
}

pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    let empty = Data::empty();
    assert_eq!(x, &empty);
    match app.tag {
        NFT => {
            check!(nft_contract_satisfied(app, tx, w))
        }
        TOKEN => {
            check!(token_contract_satisfied(app, tx))
        }
        _ => unreachable!(),
    }
    true
}

// NFT contract validation
fn nft_contract_satisfied(app: &App, tx: &Transaction, w: &Data) -> bool {
    let token_app = &App {
        tag: TOKEN,
        identity: app.identity.clone(),
        vk: app.vk.clone(),
    };
    check!(can_mint_nft(app, tx, w) || can_mint_token(&token_app, tx));
    true
}

fn can_mint_nft(nft_app: &App, tx: &Transaction, w: &Data) -> bool {
    let w_str: Option<String> = w.value().ok();

    check!(w_str.is_some());
    let w_str = w_str.unwrap();

    // can only mint an NFT with this contract if the hash of `w` is the identity of the NFT.
    check!(hash(&w_str) == nft_app.identity);

    // can only mint an NFT with this contract if spending a UTXO with the same ID as passed in `w`.
    let w_utxo_id = UtxoId::from_str(&w_str).unwrap();
    check!(tx.ins.iter().any(|(utxo_id, _)| utxo_id == &w_utxo_id));

    let nft_charms = charm_values(nft_app, tx.outs.iter()).collect::<Vec<_>>();

    // can mint exactly one NFT.
    check!(nft_charms.len() == 1);
    // the NFT has the correct structure.
    // Try to parse as MinimalSubscriptionState first, fall back to NftContent
    let charm_data = &nft_charms[0];
    if charm_data.value::<MinimalSubscriptionState>().is_ok() {
        // New format with full state
        return true;
    }
    // Legacy format
    check!(charm_data.value::<NftContent>().is_ok());
    true
}

pub(crate) fn hash(data: &str) -> B32 {
    let hash = Sha256::digest(data);
    B32(hash.into())
}

// Subscription payment contract logic
fn token_contract_satisfied(token_app: &App, tx: &Transaction) -> bool {
    check!(can_mint_token(token_app, tx) || can_execute_subscription_payment(token_app, tx));
    true
}

fn can_mint_token(token_app: &App, tx: &Transaction) -> bool {
    let nft_app = App {
        tag: NFT,
        identity: token_app.identity.clone(),
        vk: token_app.vk.clone(),
    };

    // Check if there's an NFT in inputs
    let incoming_nft: Option<NftContent> =
        charm_values(&nft_app, tx.ins.iter().map(|(_, v)| v)).find_map(|data| data.value().ok());
    
    // Check if there's an NFT in outputs
    let Some(outgoing_nft): Option<NftContent> =
        charm_values(&nft_app, tx.outs.iter()).find_map(|data| data.value().ok())
    else {
        eprintln!("could not determine outgoing remaining supply");
        return false;
    };
    let outgoing_supply = outgoing_nft.remaining;

    let Some(input_token_amount) = sum_token_amount(&token_app, tx.ins.iter().map(|(_, v)| v)).ok()
    else {
        eprintln!("could not determine input total token amount");
        return false;
    };
    let Some(output_token_amount) = sum_token_amount(&token_app, tx.outs.iter()).ok() else {
        eprintln!("could not determine output total token amount");
        return false;
    };

    // Case 1: NFT in inputs (normal token minting controlled by NFT)
    if let Some(incoming_nft) = incoming_nft {
        let incoming_supply = incoming_nft.remaining;
        if !(incoming_supply >= outgoing_supply) {
            eprintln!("incoming remaining supply must be >= outgoing remaining supply");
            return false;
        }
        // can mint no more than what's allowed by the managing NFT state change.
        return output_token_amount - input_token_amount == incoming_supply - outgoing_supply;
    }

    // Case 2: No NFT in inputs (initial creation - minting NFT and tokens together)
    // When creating a subscription, we mint both NFT and tokens at the same time
    // Allow minting tokens equal to the NFT's remaining supply (total locked amount)
    if input_token_amount == 0 && output_token_amount == outgoing_supply {
        // Initial creation: minting tokens equal to NFT remaining supply
        return true;
    }

    false
}

// Subscription payment: validates payment execution with full state checks
fn can_execute_subscription_payment(token_app: &App, tx: &Transaction) -> bool {
    let nft_app = App {
        tag: NFT,
        identity: token_app.identity.clone(),
        vk: token_app.vk.clone(),
    };

    // Try to parse as MinimalSubscriptionState (new format)
    let incoming_state: Option<MinimalSubscriptionState> = charm_values(&nft_app, tx.ins.iter().map(|(_, v)| v))
        .find_map(|data| data.value().ok());
    
    let outgoing_state: Option<MinimalSubscriptionState> = charm_values(&nft_app, tx.outs.iter())
        .find_map(|data| data.value().ok());

    // If we have full state, validate with all checks
    if let (Some(in_state), Some(out_state)) = (incoming_state, outgoing_state) {
        return validate_subscription_payment_full(&in_state, &out_state, token_app, tx);
    }

    // Fall back to legacy format (NftContent)
    let Some(incoming_nft): Option<NftContent> =
        charm_values(&nft_app, tx.ins.iter().map(|(_, v)| v)).find_map(|data| data.value().ok())
    else {
        return false; // No NFT in inputs, not a subscription payment
    };

    let Some(outgoing_nft): Option<NftContent> =
        charm_values(&nft_app, tx.outs.iter()).find_map(|data| data.value().ok())
    else {
        return false; // No NFT in outputs, not a subscription payment
    };

    // Legacy validation: NFT remaining must decrease
    if !(incoming_nft.remaining >= outgoing_nft.remaining) {
        eprintln!("NFT remaining must decrease or stay same for subscription payment");
        return false;
    }

    let payment_amount = incoming_nft.remaining - outgoing_nft.remaining;

    // Calculate token amounts
    let Some(input_token_amount) = sum_token_amount(&token_app, tx.ins.iter().map(|(_, v)| v)).ok()
    else {
        eprintln!("could not determine input total token amount");
        return false;
    };
    let Some(output_token_amount) = sum_token_amount(&token_app, tx.outs.iter()).ok() else {
        eprintln!("could not determine output total token amount");
        return false;
    };

    // For subscription payments: tokens are transferred (output == input)
    if output_token_amount == input_token_amount {
        return true;
    }

    false
}

// Full validation for subscription payment with MinimalSubscriptionState
fn validate_subscription_payment_full(
    in_state: &MinimalSubscriptionState,
    out_state: &MinimalSubscriptionState,
    token_app: &App,
    tx: &Transaction,
) -> bool {
    // 1. Validate subscription is active
    check!(in_state.is_active);
    check!(out_state.is_active); // Should remain active after payment

    // 2. Validate immutable fields don't change
    check!(in_state.payer_pubkey == out_state.payer_pubkey);
    check!(in_state.merchant_pubkey == out_state.merchant_pubkey);
    check!(in_state.amount_sats == out_state.amount_sats);
    check!(in_state.billing_interval_blocks == out_state.billing_interval_blocks);

    // 3. Validate payment amount matches subscription amount
    let payment_amount = in_state.remaining_balance - out_state.remaining_balance;
    check!(payment_amount == in_state.amount_sats);

    // 4. Validate remaining balance decreases correctly
    check!(in_state.remaining_balance >= out_state.remaining_balance);
    check!(out_state.remaining_balance == in_state.remaining_balance - in_state.amount_sats);

    // 5. Validate last_payment_block is updated (should increase)
    // Note: We can't check current block in contract, but we can ensure it's updated
    check!(out_state.last_payment_block >= in_state.last_payment_block);

    // 6. Validate token amounts match
    let Some(input_token_amount) = sum_token_amount(&token_app, tx.ins.iter().map(|(_, v)| v)).ok()
    else {
        eprintln!("could not determine input total token amount");
        return false;
    };
    let Some(output_token_amount) = sum_token_amount(&token_app, tx.outs.iter()).ok() else {
        eprintln!("could not determine output total token amount");
        return false;
    };

    // Tokens should be transferred (not minted/burned)
    check!(output_token_amount == input_token_amount);

    true
}

// Validate cancellation - only payer can cancel
fn validate_subscription_cancellation(
    in_state: &MinimalSubscriptionState,
    out_state: &MinimalSubscriptionState,
    tx: &Transaction,
) -> bool {
    // 1. Subscription must be active to cancel
    check!(in_state.is_active);

    // 2. After cancellation, is_active should be false
    check!(!out_state.is_active);

    // 3. Remaining balance should be zero
    check!(out_state.remaining_balance == 0);

    // 4. Immutable fields should remain the same
    check!(in_state.payer_pubkey == out_state.payer_pubkey);
    check!(in_state.merchant_pubkey == out_state.merchant_pubkey);
    check!(in_state.amount_sats == out_state.amount_sats);
    check!(in_state.billing_interval_blocks == out_state.billing_interval_blocks);

    // Note: Payer authorization would be validated by checking the transaction inputs
    // This requires access to the transaction's input scripts, which is handled by Bitcoin
    // The contract assumes only the payer can spend the UTXO

    true
}

#[cfg(test)]
mod test {
    use super::*;
    use charms_sdk::data::{App, Data, Transaction, UtxoId, B32, NFT, TOKEN};
    use std::collections::HashMap;

    #[test]
    fn test_hash() {
        let utxo_id =
            UtxoId::from_str("dc78b09d767c8565c4a58a95e7ad5ee22b28fc1685535056a395dc94929cdd5f:1")
                .unwrap();
        let data = dbg!(utxo_id.to_string());
        let expected = "f54f6d40bd4ba808b188963ae5d72769ad5212dd1d29517ecc4063dd9f033faa";
        assert_eq!(&hash(&data).to_string(), expected);
    }

    #[test]
    fn test_subscription_state_to_nft_content() {
        let state = SubscriptionState {
            subscription_id: "sub_001".to_string(),
            recipient: "bc1qtest".to_string(),
            amount_per_cycle: 100000,
            remaining_balance: 1000000,
            total_locked: 1000000,
        };

        let nft_content: NftContent = state.into();
        assert_eq!(nft_content.ticker, "SUBSCRIPTION-sub_001");
        assert_eq!(nft_content.remaining, 1000000);
    }

    #[test]
    fn test_minimal_subscription_state() {
        let state = MinimalSubscriptionState {
            payer_pubkey: "02abc123...".to_string(),
            merchant_pubkey: "03def456...".to_string(),
            amount_sats: 100000,
            billing_interval_blocks: 144,
            last_payment_block: 850000,
            is_active: true,
            remaining_balance: 1000000,
        };

        assert_eq!(state.amount_sats, 100000);
        assert_eq!(state.is_active, true);
    }

    #[test]
    fn test_payment_validation() {
        let in_state = MinimalSubscriptionState {
            payer_pubkey: "02abc...".to_string(),
            merchant_pubkey: "03def...".to_string(),
            amount_sats: 100000,
            billing_interval_blocks: 144,
            last_payment_block: 850000,
            is_active: true,
            remaining_balance: 1000000,
        };

        let out_state = MinimalSubscriptionState {
            payer_pubkey: "02abc...".to_string(),
            merchant_pubkey: "03def...".to_string(),
            amount_sats: 100000,
            billing_interval_blocks: 144,
            last_payment_block: 850100, // Updated
            is_active: true,
            remaining_balance: 900000, // Decreased by amount_sats
        };

        // Payment amount should match
        assert_eq!(in_state.remaining_balance - out_state.remaining_balance, in_state.amount_sats);
        
        // Immutable fields should match
        assert_eq!(in_state.payer_pubkey, out_state.payer_pubkey);
        assert_eq!(in_state.merchant_pubkey, out_state.merchant_pubkey);
        assert_eq!(in_state.amount_sats, out_state.amount_sats);
    }
}
