# How to Update Contract Address

## Quick Update

When you deploy a new version of the smart contract, update this **one place**:

**File**: `src/main/resources/initial-content/content/blockchain-aem/oak-chain-publish.html`

**Lines ~429-445** - Look for the CONFIG section:

```javascript
const CONFIG = {
    // Mock Mode: Set to true for demo without real blockchain
    MOCK_MODE: false,  // ← Set to false for real blockchain
    
    // Deployed Contract Address (Sepolia Testnet)
    CONTRACT_ADDRESS: '0xYOUR_NEW_CONTRACT_ADDRESS',  // ← Update this!
    
    // Network: Sepolia = 11155111, Mainnet = 1
    EXPECTED_CHAIN_ID: 11155111,
    
    // Deployment Info (for reference - optional but helpful)
    DEPLOYMENT_DATE: '2024-11-22',  // ← Update this
    DEPLOYMENT_VERSION: 'v3.2',     // ← Update this
    DEPLOYED_BY: 'Your Name'        // ← Update this
};
```

## Step-by-Step

### 1. Deploy New Contract in Remix

Follow the [REMIX-DEPLOYMENT.md](REMIX-DEPLOYMENT.md) guide to deploy to Sepolia.

Copy the deployed contract address (e.g., `0x1234567890abcdef...`)

### 2. Update Configuration

Edit `oak-chain-publish.html`:

```javascript
const CONFIG = {
    MOCK_MODE: false,
    CONTRACT_ADDRESS: '0x1234567890abcdef...',  // ← Paste your address here
    EXPECTED_CHAIN_ID: 11155111,
    DEPLOYMENT_DATE: '2024-11-23',
    DEPLOYMENT_VERSION: 'v3.2',
    DEPLOYED_BY: 'Marcy'
};
```

### 3. Rebuild Sling Bundle

```bash
cd /Users/mhess/aem/AEM\ Code/OAK/sling-org-apache-sling-starter-content
mvn clean install
```

### 4. Deploy to Sling

If Sling is already running, it should hot-reload the content.

Or restart Sling:
```bash
cd /Users/mhess/aem/AEM\ Code/OAK/sling-org-apache-sling-starter
./scripts/run-sling-local.sh 4502 http://localhost:8090
```

### 5. Verify

Open: http://localhost:4502/content/blockchain-aem/oak-chain-publish.html

You should see a green banner:
```
⛓️ PRODUCTION MODE - Connected to Sepolia Testnet
Contract: 0x1234567890abcdef...
Version: v3.2 | Deployed: 2024-11-23
```

### 6. Add Validators to New Contract

Don't forget to add validators to your new contract!

In Remix, call `addValidator` for each validator address.

## Testing

1. Open the UI
2. Connect MetaMask (should auto-connect to Sepolia)
3. Fill in content form
4. Select "Standard" tier
5. Click "Pay with MetaMask & Publish"
6. MetaMask will pop up asking for ~0.001 ETH + gas
7. Confirm transaction
8. Wait 15-30 seconds
9. ✅ Success!

## Switching Back to Mock Mode

For demos or when you run out of test ETH:

```javascript
const CONFIG = {
    MOCK_MODE: true,  // ← Just set this to true
    // ... rest stays the same
};
```

Rebuild and redeploy Sling.

## Contract History Tracking

Keep a log of deployed contracts for reference:

**Example**:
```
v3.1 - 2024-11-22 - 0xabc123... - Initial Garage Week deployment
v3.2 - 2024-11-25 - 0xdef456... - Added batch discount feature
v3.3 - 2024-12-01 - 0x789abc... - Gas optimization
```

You can add this to the `DEPLOYED_BY` field or create a separate `CONTRACT-HISTORY.md` file.

## Troubleshooting

### "Wrong Network" error

Make sure:
- MetaMask is on Sepolia (Chain ID: 11155111)
- `EXPECTED_CHAIN_ID: 11155111` in CONFIG

### Contract address shows "0x..."

You forgot to update `CONTRACT_ADDRESS` in the CONFIG object.

### "Transaction failed" in MetaMask

Possible causes:
- Out of Sepolia ETH (get more from faucet)
- Wrong network selected
- Contract address is invalid
- Proposal already paid (try different content path)

### Changes not appearing

Did you rebuild Sling after editing the HTML file?

```bash
cd sling-org-apache-sling-starter-content
mvn clean install
```

Then refresh browser with hard reload (Cmd+Shift+R or Ctrl+Shift+R).

## Network Configuration

### Sepolia Testnet (Current)
```javascript
EXPECTED_CHAIN_ID: 11155111
CONTRACT_ADDRESS: '0x...'  // Your Sepolia contract
```

### Ethereum Mainnet (Future Production)
```javascript
EXPECTED_CHAIN_ID: 1
CONTRACT_ADDRESS: '0x...'  // Your mainnet contract
```

⚠️ **NEVER test with mainnet - costs real money!**

## See Also

- [REMIX-DEPLOYMENT.md](REMIX-DEPLOYMENT.md) - How to deploy contracts
- [MOCK-MODE-GUIDE.md](MOCK-MODE-GUIDE.md) - Testing without blockchain
- [README-METAMASK-INTEGRATION.md](README-METAMASK-INTEGRATION.md) - Full architecture

---

**Questions?** Check the main documentation or ask the team!

