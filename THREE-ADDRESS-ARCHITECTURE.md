# Three-Address Architecture for Blockchain AEM

## Overview

The Blockchain AEM system implements a **three-address model** that separates content ownership, transaction payment, and network operation. This creates a flexible, auditable system where multiple users can publish to a single organization's content space.

## The Three Addresses

### 1. **Sling Author Address** (Content Owner)
- **Role**: The AEM instance/organization that owns the content
- **Purpose**: Content ownership, storage sharding, access control
- **Storage Path**: `/oak-chain/content/{sling-author-address}/...`
- **Configuration**: Set per AEM instance (e.g., `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0`)

**Example**: Adobe's AEM Author instance has address `0x742d...bEb0`, all Adobe content is stored under `/oak-chain/content/0x742d...bEb0/`

### 2. **MetaMask User Address** (Payer)
- **Role**: The human/entity paying for the transaction
- **Purpose**: Transaction signing, payment source, audit trail
- **Storage**: Recorded in transaction metadata
- **Dynamic**: Changes based on who connects MetaMask

**Example**: Employee at `0x17d5...e29a` pays for transaction, but content belongs to `0x742d...bEb0`

### 3. **Validator Address** (Network Node)
- **Role**: Consensus participant, content replication
- **Purpose**: Network operation, receives portion of publishing fees
- **Multiple**: Many validators participate in consensus

**Example**: Validators at `0x1234...`, `0x5678...`, `0x9abc...` receive payment and replicate content

## Architecture Flow

```
┌─────────────────────┐
│  MetaMask User      │
│  (Payer)            │
│  0x17d5...e29a      │
└──────────┬──────────┘
           │ 1. Signs transaction
           │ 2. Pays validators
           ▼
┌─────────────────────┐
│  Smart Contract     │
│  ValidatorPayment   │
│  0x1fc9...b3c7      │
└──────────┬──────────┘
           │ 3. Distributes payment
           │ 4. Emits ProposalPaid event
           ▼
┌─────────────────────┐
│  Oak Validators     │
│  (Network Nodes)    │
│  0x1234..., 0x5678..│
└──────────┬──────────┘
           │ 5. Aeron consensus
           │ 6. Content replication
           ▼
┌─────────────────────┐
│  Oak Chain Storage  │
│  /oak-chain/content/│
│  {sling-author}/... │
└─────────────────────┘
```

## Transaction Record

Each publish transaction records all three addresses:

```json
{
  "proposalId": "0xabcd...",
  "txHash": "0x1234...",
  "contentOwner": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "paidBy": "0x17d5bf1a76f7611e00cea9be8f1022070a4ee29a",
  "validators": ["0x1234...", "0x5678...", "0x9abc..."],
  "expectedPath": "/oak-chain/content/0x742d.../my-page",
  "tier": "Priority",
  "amount": "0.01 ETH",
  "timestamp": 1732233600,
  "epochDelay": "Current epoch (immediate)"
}
```

## Publishing Tiers (Epoch-Based)

The publishing tiers use **Ethereum Beacon Chain epochs** for timing:

| Tier | Cost | Delay | Epochs | Description |
|------|------|-------|--------|-------------|
| **Standard** | 0.001 ETH | ~13 min | 2 epochs | Wait for finalization (most secure) |
| **Express** | 0.002 ETH | ~6.4 min | 1 epoch | Next epoch (faster) |
| **Priority** | 0.01 ETH | Immediate | Current | Immediate inclusion |

**Ethereum Epoch Timing:**
- 1 Epoch = 32 slots × 12 seconds = 384 seconds (~6.4 minutes)
- Finalization = 2 epochs (~12.8 minutes)
- This aligns with Ethereum's consensus mechanism for transaction finality

## Benefits

### 1. **Clear Ownership**
- Content belongs to the Sling Author (organization)
- No ambiguity about who owns what content

### 2. **Flexible Payment**
- Any authorized user can pay for publishing
- Employees, contractors, or automated systems can publish
- Payment audit trail preserved

### 3. **Authorization Tracking**
- Know who published content even if they're not the owner
- Useful for compliance, auditing, and access control

### 4. **Multi-User Support**
- Multiple people can publish to the same organization's space
- Each keeps their own payment history
- Organization maintains unified content namespace

### 5. **Sharding & Performance**
- Content naturally sharded by organization address
- Efficient storage and retrieval
- Clear namespace boundaries

## Implementation

### Frontend (MetaMask UI)

```javascript
const SLING_AUTHOR_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
let userAccount; // MetaMask connected address

await fetch('/bin/blockchain/oak-chain-publish', {
  method: 'POST',
  body: new URLSearchParams({
    contentOwner: SLING_AUTHOR_ADDRESS,  // Organization
    paidBy: userAccount,                  // Current user
    path: '/my-page',
    content: '...'
  })
});
```

### Backend (Servlet)

```java
String contentOwner = request.getParameter("contentOwner");
String paidBy = request.getParameter("paidBy");

String shardedPath = String.format(
  "/oak-chain/content/%s%s", 
  contentOwner,
  path
);

log.info("Content owned by: {}", contentOwner);
log.info("Paid by: {}", paidBy);
log.info("Storage path: {}", shardedPath);
```

### Smart Contract

```solidity
event ProposalPaid(
    bytes32 indexed proposalId,
    address indexed payer,        // MetaMask user
    address indexed contentOwner, // Sling Author  
    uint256 amount,
    uint8 tier
);
```

## Future Enhancements

1. **Multi-signature**: Require approval from multiple addresses before publishing
2. **Access Control**: Only authorized payer addresses can publish to specific content owners
3. **Payment Delegation**: Organization pre-pays, employees draw from pool
4. **Tiered Permissions**: Different users have different publishing limits
5. **Content Co-ownership**: Multiple organizations share content namespace

## Configuration

Set the Sling Author address in your AEM instance configuration:

```
# OSGi Configuration
com.adobe.aem.blockchain.config.WalletConfig
  - walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  - walletName: "Adobe AEM Production"
```

## Security Considerations

1. **Private Key Management**: Sling Author's private key must be secured
2. **Payer Authorization**: Validate that payer is authorized to publish
3. **Transaction Verification**: Verify blockchain transaction before accepting content
4. **Rate Limiting**: Prevent abuse by limiting publishes per payer
5. **Content Validation**: Sanitize and validate all content before storage

## POC vs Production

**POC Status** (Current):
- Addresses are hardcoded in UI
- No blockchain verification
- No authorization checks
- Mock responses

**Production Requirements**:
- Configure Sling Author address per instance
- Verify blockchain transactions via Web3 provider
- Implement authorization system (who can publish?)
- Rate limiting and abuse prevention
- Audit logging for all transactions
- Integration with Aeron consensus
- Real validator payment distribution

---

**Author**: Blockchain AEM Team  
**Date**: November 22, 2025  
**Version**: 1.0 (Garage Week POC)

