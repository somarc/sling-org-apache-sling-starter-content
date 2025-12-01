<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Blockchain AEM Content Structure - Consolidation

This document describes the consolidated Sling content structure for the Blockchain AEM project.

## Overview

The content structure has been consolidated from multiple overlapping components into a clean, cohesive architecture with two primary components:

1. **Unified Editor** - Content editing with publish/unpublish via MetaMask
2. **Unified Viewer** - Public-facing content display

## Component Structure

### `/apps/blockchain-aem/components/unified-editor/`

**Purpose**: Universal content editor with blockchain integration

**Features**:
- AEM Content Fragments-style UI
- MetaMask integration for publish/unpublish
- Three-address architecture support:
  - Content Owner (Sling Author wallet)
  - Payer (MetaMask user)
  - Validators (receive payment)
- Payment tier selection (Standard, Express, Priority)
- Wallet-scoped content paths: `/oak-chain/{shard}/{address}/content/{org}/`
- Draft save to localStorage
- Real-time proposal status tracking

**Files**:
```
unified-editor/
├── unified-editor.html          # Main editor UI
└── clientlibs/
    ├── css/
    │   └── editor.css           # Modern AEM-style editor CSS
    ├── js/
    │   └── editor.js            # Editor logic with MetaMask integration
    ├── css.txt
    └── js.txt
```

**Access**: Via `/content/blockchain-aem/editor.html?path=/content/{org}/...`

---

### `/apps/blockchain-aem/components/unified-viewer/`

**Purpose**: Public-facing content viewer

**Features**:
- Clean, magazine-style content display
- Blockchain verification badges
- Auto-refresh (10s) for live updates
- Content owner and publisher display
- Ethereum transaction links (Sepolia/Mainnet)
- Responsive design

**Files**:
```
unified-viewer/
├── unified-viewer.html          # Main viewer UI
└── clientlibs/
    ├── css/
    │   └── viewer.css           # Public-facing viewer CSS
    ├── js/
    │   └── viewer.js            # Viewer logic
    ├── css.txt
    └── js.txt
```

**Access**: Via `/content/blockchain-aem/viewer.html?path=/oak-chain/...`

---

## Content Pages

### `/content/blockchain-aem/editor.html`

Main editor entry point. Use with query parameter:
```
/content/blockchain-aem/editor.html?path=/content/my-organization/
```

### `/content/blockchain-aem/viewer.html`

Public viewer entry point. Use with query parameter:
```
/content/blockchain-aem/viewer.html?path=/oak-chain/ab/0xabc123.../content/my-organization/
```

---

## Removed Components (Consolidated)

The following components have been **removed** as they were redundant or overlapping:

### From `garage-demo`:
- ❌ `/apps/garage-demo/components/editor/` → Merged into `unified-editor`
- ❌ `/apps/garage-demo/components/viewer/` → Merged into `unified-viewer`

### From `blockchain-aem`:
- ❌ `/apps/blockchain-aem/components/blockchain-viewer/` → Merged into `unified-viewer`
- ❌ `/apps/blockchain-aem/components/oak-chain-publisher/` → Merged into `unified-editor`

### Content Pages:
- ❌ `/content/blockchain-aem/blockchain.html` → Replaced by `editor.html` and `viewer.html`

---

## Architecture Principles

### Three-Address Model

The unified editor implements the three-address architecture:

1. **Content Owner** (Sling Author)
   - Ethereum wallet stored in Sling Author keystore
   - Content stored at: `/oak-chain/{shard}/{owner-address}/content/{org}/`
   - Has modification rights to their content

2. **Payer** (MetaMask User)
   - Connects via MetaMask
   - Signs and pays for Ethereum transactions
   - Recorded as publisher in content metadata

3. **Validators**
   - Receive payment via smart contract
   - Replicate content across the network
   - Enforce consensus rules

### Content Path Abstraction

**User-facing path**: `/content/{organization}/my-page`

**Actual storage path**: `/oak-chain/{shard}/{wallet-address}/content/{organization}/my-page`

Where:
- `{shard}` = First 2 hex chars of wallet address (for horizontal scaling)
- `{wallet-address}` = Sling Author's Ethereum wallet address
- `{organization}` = User-specified organization path

---

## Usage Examples

### Editing Content

1. Navigate to `/content/blockchain-aem/editor.html`
2. Connect MetaMask wallet (payer)
3. Fill in organization field (e.g., "adobe")
4. Enter content details
5. Select payment tier
6. Click "🚀 Publish to oak-chain"
7. Approve MetaMask transaction
8. Wait for validator finality

### Viewing Published Content

1. Navigate to `/content/blockchain-aem/viewer.html?path=/oak-chain/.../content/adobe/`
2. Content auto-loads from global store
3. Page auto-refreshes every 10s

### Unpublishing Content

1. Open content in editor (with `?path=` parameter)
2. Click "🗑️ Unpublish from oak-chain"
3. Confirm action
4. Approve MetaMask transaction
5. Wait for validator consensus

---

## Mode Support

Both components support three modes:

- **MOCK**: Simulated blockchain (no MetaMask, instant)
- **SEPOLIA**: Sepolia testnet (real MetaMask, test ETH)
- **MAINNET**: Ethereum mainnet (real MetaMask, real ETH)

Mode is auto-detected from validator API: `/v1/blockchain/config`

---

## Developer Notes

### Building

The consolidated components are part of the `sling-org-apache-sling-starter-content` bundle:

```bash
cd sling-org-apache-sling-starter-content
mvn clean install -DskipTests
```

### Integration with Sling Starter

The parent Sling Starter project includes this content bundle and deploys it to the Sling instance:

```bash
cd sling-org-apache-sling-starter
mvn clean package -DskipTests
```

### Docker Deployment

For Docker-based deployments, rebuild the Sling image after building the content bundle:

```bash
docker build -t apache/sling:blockchain-poc .
```

---

## Future Enhancements

- [ ] Real Web3.js integration for smart contract calls
- [ ] Content versioning and revision history
- [ ] Multi-user collaboration
- [ ] Rich text editor (WYSIWYG)
- [ ] Media asset support (images, videos)
- [ ] Content preview before publish
- [ ] Batch operations (publish multiple items)
- [ ] Search and filtering
- [ ] Analytics and usage tracking

---

## Questions or Issues?

See main project documentation:
- `THREE-ADDRESS-ARCHITECTURE.md`
- `SLING-CONTENT-PATTERNS.md`
- `README-METAMASK-INTEGRATION.md`

