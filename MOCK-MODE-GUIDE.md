# Mock Mode Quick Start Guide

## Overview

Mock mode allows you to test the complete Oak Chain publishing workflow **without** requiring:
- ❌ Deployed smart contract
- ❌ MetaMask installation  
- ❌ Test ETH
- ❌ Network connectivity to blockchain

Perfect for Garage Week demos and POC testing!

## Enabling Mock Mode

Edit `oak-chain-publish.html` (line ~432):

```javascript
const MOCK_MODE = true;  // ← Set to true
```

## Using Mock Mode

### 1. Start Sling

```bash
cd /Users/mhess/aem/AEM\ Code/OAK/sling-org-apache-sling-starter
./scripts/run-sling-local.sh 4502 http://localhost:8090
```

### 2. Open the UI

Navigate to: http://localhost:4502/content/blockchain-aem/oak-chain-publish.html

You'll see a yellow banner: **🧪 MOCK MODE ENABLED**

### 3. Connect Wallet

Click **"Connect MetaMask"**

- If MetaMask is installed: Uses your real wallet address
- If MetaMask is NOT installed: Uses a simulated wallet address

Either way works in mock mode!

### 4. Fill the Form

```
Content Path: /content/demo/my-page
Title: Demo Content
Content: This is a test of the Oak Chain publishing system!
```

### 5. Select a Tier

Choose any tier (Standard/Express/Priority) - **no real ETH required**

### 6. Publish

Click **"Pay with MetaMask & Publish"**

**What happens:**
1. ⏱️ Simulates 1-2 second blockchain transaction delay
2. ✅ Generates a realistic transaction hash
3. 📤 Submits content to Oak servlet (just like real mode)
4. 📝 Logs appear in Sling logs

### 7. Check the Logs

```bash
tail -f launcher/logs/error.log
```

Expected output:

```
Oak Chain publish request received:
  Mode: 🧪 MOCK (simulated transaction)
  Path: /content/demo/my-page
  Title: Demo Content
  Proposal ID: 0xabc123...
  Tx Hash: 0xdef456...
  Tier: 0
  Content Owner (Sling Author): 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
  Paid By (MetaMask User): 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
✅ 🧪 Mock Mode: Content would be written to /oak-chain/content/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0/content/demo/my-page after validator processing
   Note: No real blockchain transaction occurred (mock mode for POC testing)
```

## Switching to Production Mode

When ready to test with real blockchain:

### 1. Deploy Smart Contract

```bash
cd blockchain-smart-contracts
npx hardhat run scripts/deploy-v3_1.js --network sepolia
```

### 2. Update Configuration

Edit `oak-chain-publish.html`:

```javascript
const MOCK_MODE = false;  // ← Disable mock mode
const CONTRACT_ADDRESS = '0x...';  // ← Add deployed contract address
```

### 3. Get Test ETH

Visit: https://sepoliafaucet.com/

### 4. Install MetaMask

- Add MetaMask extension
- Create/import wallet
- Switch to Sepolia network

### 5. Test Real Transactions

Now the flow will use actual blockchain transactions!

## Mock Mode Features

| Feature | Description |
|---------|-------------|
| **Realistic UX** | Same UI flow as production |
| **Transaction Hashes** | Generated using Web3 keccak256 (if available) |
| **Network Delay** | 1-2 second simulated delay |
| **Servlet Integration** | Real POST to `/bin/blockchain/oak-chain-publish` |
| **Three-Address Model** | Full support for content owner vs payer |
| **Cost Display** | Shows what the transaction WOULD cost |
| **Mode Detection** | Servlet automatically detects mock vs real |

## Comparison: Mock vs Production

| Aspect | Mock Mode | Production Mode |
|--------|-----------|-----------------|
| **Setup Time** | 0 seconds | 15-30 minutes |
| **Cost** | $0.00 | ~$0.50-$5 per tx |
| **Speed** | 1-2 seconds | 15-60 seconds |
| **Dependencies** | None | MetaMask, contract, ETH |
| **Demo-Ready** | ✅ Instant | ⏱️ After setup |
| **Full Flow** | ✅ Yes (except blockchain) | ✅ Yes |
| **Sling Servlet** | ✅ Called | ✅ Called |
| **Logs** | ✅ Generated | ✅ Generated |

## Garage Week Demo Tips

### For Live Demos:

1. **Always use mock mode** - No risk of transaction failures
2. **Pre-fill forms** - Save time during presentation
3. **Show logs** - Have terminal ready with `tail -f`
4. **Explain the flow** - Use the three-address diagram on screen

### For Documentation:

1. **Take screenshots** - Capture mock mode banner, transaction success
2. **Save log snippets** - Show servlet processing mock transactions
3. **Record video** - Full end-to-end flow takes ~10 seconds

### For Stakeholders:

> "This demo uses mock mode to simulate blockchain transactions. In production, this would require deploying a smart contract to Ethereum and paying ~$3-5 per transaction. Mock mode lets us prove the concept without burning test ETH during development."

## Troubleshooting

### Issue: "MetaMask not detected"

**Solution:** This is fine in mock mode! Click "Connect MetaMask" anyway - it will use a simulated wallet.

### Issue: Form won't submit

**Solution:** Check that `MOCK_MODE = true` is set, and reload the page.

### Issue: No logs in Sling

**Solution:** Check Sling is running on port 4502:

```bash
curl http://localhost:4502/system/console/bundles
```

### Issue: Want to test real blockchain

**Solution:** Set `MOCK_MODE = false` and follow the production setup steps above.

## Architecture

### Mock Mode Transaction Flow

```
User fills form
    ↓
Click "Pay with MetaMask"
    ↓
🧪 Simulate 1-2s delay
    ↓
🧪 Generate mock transaction hash
    ↓
POST to /bin/blockchain/oak-chain-publish
    ↓
Servlet receives:
  - proposalId (hash of content)
  - txHash (mock hash)
  - content data
  - three-address model fields
    ↓
Servlet logs:
  "🧪 MOCK MODE"
    ↓
Servlet returns success
    ↓
UI shows success message
```

### Production Mode Transaction Flow

```
User fills form
    ↓
Click "Pay with MetaMask"
    ↓
MetaMask popup appears
    ↓
User approves transaction
    ↓
⛓️ Real blockchain transaction submitted
    ↓
⏱️ Wait for confirmation (~15s)
    ↓
Receive transaction receipt
    ↓
POST to /bin/blockchain/oak-chain-publish
    ↓
Servlet receives:
  - proposalId (hash of content)
  - txHash (real blockchain hash)
  - content data
  - three-address model fields
    ↓
Servlet logs:
  "⛓️ PRODUCTION"
    ↓
[Future] Validators listen for ProposalPaid event
    ↓
[Future] Aeron consensus replicates content
```

## Key Files

| File | Purpose |
|------|---------|
| `oak-chain-publish.html` | Frontend UI with mock mode logic |
| `OakChainPublishServlet.java` | Backend servlet with mode detection |
| `README-METAMASK-INTEGRATION.md` | Full documentation |
| `MOCK-MODE-GUIDE.md` | This guide |

## Next Steps

1. ✅ Test mock mode (you are here!)
2. 📋 Create demo script for Garage Week
3. 🎥 Record demo video
4. 📊 Prepare presentation slides
5. ⛓️ Deploy to Sepolia for production testing
6. 🚀 Launch on Dec 15!

---

**Questions?** Check the main README or contact the team.

**Garage Week Deadline:** Dec 15, 2025

