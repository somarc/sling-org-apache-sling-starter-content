/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Web3 Configuration
 * Contract address, ABI, and blockchain settings
 * 
 * Update CONTRACT_ADDRESS when deploying new contract versions
 */

// ═══════════════════════════════════════════════════════════════════════
// ⚙️ MAIN CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

window.OakChainConfig = {
    // Deployed Contract Address (Sepolia Testnet)
    CONTRACT_ADDRESS: '0x7fcEc350268F5482D04eb4B229A0679374906732',
    
    // Network: Sepolia = 11155111, Mainnet = 1
    EXPECTED_CHAIN_ID: 11155111,
    
    // Deployment Info (for reference)
    DEPLOYMENT_DATE: '2025-11-22',
    DEPLOYMENT_VERSION: 'v3.1',
    DEPLOYED_BY: 'somarc',
    
    // Verification (for reference)
    VERIFIED_ON: 'Sourcify + Routescan',
    VERIFICATION_URL: 'https://repo.sourcify.dev/11155111/0x7fcEc350268F5482D04eb4B229A0679374906732/',
    
    // Three-Address Model
    // CRITICAL: Sling Author's wallet address (content owner)
    // In production, this would be configured per AEM instance
    SLING_AUTHOR_ADDRESS: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'
};

// ═══════════════════════════════════════════════════════════════════════
// Contract ABI (no need to change unless contract interface changes)
// ═══════════════════════════════════════════════════════════════════════

window.OakChainConfig.CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "proposalId", "type": "bytes32"},
            {"internalType": "uint8", "name": "tier", "type": "uint8"}
        ],
        "name": "payForProposal",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "proposalId", "type": "bytes32"},
            {"indexed": true, "internalType": "address", "name": "payer", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
            {"indexed": false, "internalType": "uint8", "name": "tier", "type": "uint8"},
            {"indexed": true, "internalType": "uint8", "name": "paymentToken", "type": "uint8"},
            {"indexed": false, "internalType": "address", "name": "preferredValidator", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
        ],
        "name": "ProposalPaid",
        "type": "event"
    }
];

// ═══════════════════════════════════════════════════════════════════════
// Tier Pricing & Configuration
// ═══════════════════════════════════════════════════════════════════════

window.OakChainConfig.TIER_PRICES = {
    0: '1000000000000000',      // 0.001 ETH (Standard)
    1: '2000000000000000',      // 0.002 ETH (Express)
    2: '10000000000000000'      // 0.01 ETH (Priority)
};

window.OakChainConfig.TIER_NAMES = ['Standard', 'Express', 'Priority'];

console.log('✅ Web3 Config loaded:', {
    contract: window.OakChainConfig.CONTRACT_ADDRESS,
    network: window.OakChainConfig.EXPECTED_CHAIN_ID === 11155111 ? 'Sepolia' : 'Mainnet',
    version: window.OakChainConfig.DEPLOYMENT_VERSION
});

