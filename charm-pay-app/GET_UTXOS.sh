#!/bin/bash

# Script to get UTXOs for testing
# Usage: ./GET_UTXOS.sh [address]

YOUR_ADDRESS="${1:-tb1qsrpkkd3c6qxla92d0ej5n436vr26azylj3rts9}"

echo "🔍 Checking address: ${YOUR_ADDRESS}"
echo ""

# Check address info
echo "📊 Address Info:"
ADDRESS_INFO=$(curl -s "https://mempool.space/testnet4/api/address/${YOUR_ADDRESS}")
echo "$ADDRESS_INFO" | jq '.'

# Get balance
FUNDED=$(echo "$ADDRESS_INFO" | jq -r '.chain_stats.funded_txo_sum // 0')
SPENT=$(echo "$ADDRESS_INFO" | jq -r '.chain_stats.spent_txo_sum // 0')
BALANCE=$((FUNDED - SPENT))

echo ""
echo "💰 Balance: ${BALANCE} sats"
echo ""

# Get UTXOs (use testnet4, not testnet)
echo "📦 UTXOs:"
UTXOS=$(curl -s "https://mempool.space/testnet4/api/address/${YOUR_ADDRESS}/utxo")

if [ "$UTXOS" = "[]" ] || [ -z "$UTXOS" ]; then
    echo "❌ No UTXOs found!"
    echo ""
    echo "📝 You need to:"
    echo "1. Get testnet Bitcoin from a faucet:"
    echo "   - https://bitcoinfaucet.uo1.net/"
    echo "   - https://testnet-faucet.mempool.space/"
    echo "   - https://coinfaucet.eu/en/btc-testnet/"
    echo ""
    echo "2. Send testnet BTC to this address:"
    echo "   ${YOUR_ADDRESS}"
    echo ""
    echo "3. Wait for confirmation (1-2 blocks)"
    echo ""
    echo "4. Run this script again"
    exit 1
else
    echo "$UTXOS" | jq '.'
    echo ""
    
    # Get first UTXO
    FIRST_UTXO=$(echo "$UTXOS" | jq -r '.[0] | "\(.txid):\(.vout)"')
    FIRST_VALUE=$(echo "$UTXOS" | jq -r '.[0].value')
    
    echo "✅ First UTXO found:"
    echo "   UTXO: ${FIRST_UTXO}"
    echo "   Value: ${FIRST_VALUE} sats"
    echo ""
    echo "📋 Export this:"
    echo "   export in_utxo_0=\"${FIRST_UTXO}\""
    echo "   export utxo_value=${FIRST_VALUE}"
    echo ""
    
    # Get previous transaction
    UTXO_TXID=$(echo "$FIRST_UTXO" | cut -d: -f1)
    echo "🔗 Getting previous transaction..."
    PREV_TX=$(curl -s "https://mempool.space/testnet4/api/tx/${UTXO_TXID}/hex")
    
    if [ -n "$PREV_TX" ] && [ "${PREV_TX:0:2}" != "<!" ]; then
        echo "✅ Previous transaction found"
        echo "   export prev_tx_hex=\"${PREV_TX}\""
        echo "   export prev_txs=\"${UTXO_TXID}:${PREV_TX}\""
    else
        echo "⚠️  Could not fetch previous transaction"
    fi
fi

