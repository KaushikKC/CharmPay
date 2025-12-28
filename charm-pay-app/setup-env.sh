#!/bin/bash

# Script to set up .env file with UTXO values
# Run: ./setup-env.sh
# NOTE: This fetches REAL UTXOs from the blockchain in real-time

YOUR_ADDRESS="tb1qsrpkkd3c6qxla92d0ej5n436vr26azylj3rts9"

echo "🔧 Setting up .env file with REAL UTXOs from blockchain..."
echo ""

# Get UTXOs (REAL-TIME from blockchain)
echo "🔄 Fetching fresh UTXOs from testnet4..."
UTXOS=$(curl -s "https://mempool.space/testnet4/api/address/${YOUR_ADDRESS}/utxo")
UTXO_COUNT=$(echo "$UTXOS" | jq 'length')

if [ "$UTXO_COUNT" -eq 0 ]; then
    echo "❌ No UTXOs found!"
    echo "💡 Get testnet Bitcoin from: https://bitcoinfaucet.uo1.net/"
    exit 1
fi

echo "✅ Found ${UTXO_COUNT} real UTXO(s) on blockchain"
FIRST_UTXO=$(echo "$UTXOS" | jq -r '.[0] | "\(.txid):\(.vout)"')
FIRST_VALUE=$(echo "$UTXOS" | jq -r '.[0].value')

echo "   Using: ${FIRST_UTXO} (${FIRST_VALUE} sats)"
echo ""

# Get App ID
APP_ID=$(echo -n "${FIRST_UTXO}" | sha256sum | cut -d' ' -f1)

# Get App VK
APP_VK=$(cat .app_vk 2>/dev/null || echo "")

# Get previous transaction
UTXO_TXID=$(echo "$FIRST_UTXO" | cut -d: -f1)
PREV_TX_HEX=$(curl -s "https://mempool.space/testnet4/api/tx/${UTXO_TXID}/hex")

# Create .env file
cat > .env << ENVEOF
# CharmPay Environment Variables
# Generated automatically - do not commit to git

# Contract
CHARMS_APP_VK=${APP_VK}
CHARMS_APP_ID=${APP_ID}

# Testnet Address
TESTNET_ADDRESS=${YOUR_ADDRESS}

# First UTXO (for testing)
IN_UTXO_0=${FIRST_UTXO}
UTXO_VALUE=${FIRST_VALUE}

# Previous Transaction
PREV_TX_HEX=${PREV_TX_HEX}
PREV_TXS=${UTXO_TXID}:${PREV_TX_HEX}

# Prover API
CHARMS_PROVER_URL=https://v8.charms.dev/spells/prove

# Network
BITCOIN_NETWORK=testnet4
ENVEOF

echo "✅ .env file created!"
echo ""
echo "📋 Contents:"
cat .env
echo ""
echo "💡 To use these variables, run:"
echo "   source .env"
echo "   # or"
echo "   export \$(cat .env | xargs)"
