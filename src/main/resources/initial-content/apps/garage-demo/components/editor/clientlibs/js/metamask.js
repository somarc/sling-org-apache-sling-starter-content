/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Blockchain AEM - MetaMask Integration
 * Handles wallet connection, write proposals, and Ethereum transactions
 * 
 * Supports three modes:
 * - MOCK: Simulated blockchain (no MetaMask required)
 * - SEPOLIA: Sepolia testnet (real MetaMask, test ETH)
 * - MAINNET: Ethereum mainnet (real MetaMask, real ETH)
 */

// Configuration (will be updated from validator API)
let CONFIG = {
    VALIDATOR_URL: 'http://localhost:8090',
    ETHEREUM_NETWORK: 'sepolia',
    ETHEREUM_CHAIN_ID: 11155111, // Sepolia testnet
    CONTENT_PATH: '/oak-chain/content/garage-week-demo',
    POLL_INTERVAL: 2000, // 2 seconds
    POLL_TIMEOUT: 120000, // 2 minutes
    
    // Mode-specific config (loaded from API)
    mode: 'sepolia', // 'mock', 'sepolia', 'mainnet'
    requiresMetaMask: true,
    displayName: '✅ SEPOLIA TESTNET',
    badgeColor: '#10b981',
};

// Tier configuration
const TIERS = {
    0: { name: 'STANDARD', maxDelay: '13 minutes' },
    1: { name: 'EXPRESS', maxDelay: '6.5 minutes' },
    2: { name: 'PRIORITY', maxDelay: '45 seconds' },
};

// State
let currentAccount = null;
let isSubmitting = false;

// ============================================================================
// Configuration Loading
// ============================================================================

async function loadBlockchainConfig() {
    try {
        console.log('📡 Loading blockchain configuration from validator:', CONFIG.VALIDATOR_URL);
        const response = await fetch(`${CONFIG.VALIDATOR_URL}/v1/blockchain/config`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const config = await response.json();
        console.log('✅ Blockchain config loaded from validator:', config);
        console.log('🎭 Detected Mode:', config.mode.toUpperCase());
        console.log('🌐 Network:', config.network);
        console.log('🔗 Chain ID:', config.chainId);
        
        // Update global CONFIG
        CONFIG.mode = config.mode;
        CONFIG.ETHEREUM_NETWORK = config.network;
        CONFIG.ETHEREUM_CHAIN_ID = config.chainId;
        CONFIG.requiresMetaMask = config.requiresMetaMask;
        CONFIG.displayName = config.displayName;
        CONFIG.badgeColor = config.badgeColor;
        CONFIG.bannerClass = config.bannerClass;
        CONFIG.tiers = config.tiers;
        
        return config;
    } catch (error) {
        console.error('❌ Failed to load blockchain config from validator:', error);
        console.error('❌ Validator URL:', CONFIG.VALIDATOR_URL);
        console.warn('⚠️  Falling back to SEPOLIA defaults (validator may be offline)');
        
        // Fallback to SEPOLIA
        CONFIG.mode = 'sepolia';
        CONFIG.requiresMetaMask = true;
        CONFIG.displayName = '✅ SEPOLIA TESTNET';
        CONFIG.badgeColor = '#10b981';
        CONFIG.ETHEREUM_NETWORK = 'Sepolia Testnet';
        CONFIG.ETHEREUM_CHAIN_ID = 11155111;
    }
}

function updateModeDisplay() {
    // Update network name badge
    const networkNameEl = document.getElementById('network-name');
    if (networkNameEl) {
        networkNameEl.textContent = CONFIG.displayName;
        networkNameEl.style.color = CONFIG.badgeColor;
    }
    
    // Update mode badge in header
    const headerModeEl = document.querySelector('.demo-badge');
    if (headerModeEl) {
        headerModeEl.textContent = CONFIG.displayName;
        headerModeEl.style.background = CONFIG.badgeColor;
        headerModeEl.style.color = 'white';
    }
    
    console.log(`🎭 Running in ${CONFIG.mode.toUpperCase()} mode`);
}

async function initializeWallet() {
    if (CONFIG.mode === 'mock') {
        // MOCK MODE - No MetaMask required
        console.log('🎭 MOCK MODE: Simulating wallet connection');
        currentAccount = '0xMOCK1234567890abcdef1234567890abcdef1234';
        updateWalletDisplay('0xMOCK...1234 (Simulated)');
        enablePublishButton();
        
        showInfo(
            '🎭 MOCK MODE Active',
            'Using simulated blockchain - no MetaMask required. All transactions are fake.'
        );
        
    } else if (typeof window.ethereum === 'undefined') {
        // SEPOLIA/MAINNET but no MetaMask
        showError('MetaMask not detected! Please install MetaMask to continue.');
        disablePublishButton('MetaMask Required');
        return;
        
    } else {
        // SEPOLIA/MAINNET with MetaMask
        // Auto-connect wallet if previously connected
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await handleAccountsChanged(accounts);
        }
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
    }
}

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Blockchain AEM Author UI Initialized');
    
    // Load blockchain configuration from validator
    await loadBlockchainConfig();
    
    // Update UI with mode information
    updateModeDisplay();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize wallet based on mode
    await initializeWallet();
});

function setupEventListeners() {
    // Publish button
    const publishBtn = document.getElementById('publish-btn');
    publishBtn.addEventListener('click', handlePublish);
    
    // Save draft button
    const saveDraftBtn = document.getElementById('save-draft-btn');
    saveDraftBtn.addEventListener('click', handleSaveDraft);
    
    // Wallet status click to connect
    const walletStatus = document.getElementById('wallet-status');
    walletStatus.style.cursor = 'pointer';
    walletStatus.addEventListener('click', connectWallet);
}

// ============================================================================
// Wallet Connection
// ============================================================================

async function connectWallet() {
    try {
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts',
        });
        await handleAccountsChanged(accounts);
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        showError(`Failed to connect wallet: ${error.message}`);
    }
}

async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // Disconnected
        currentAccount = null;
        updateWalletDisplay('Not Connected');
        disablePublishButton('Connect Wallet');
    } else {
        currentAccount = accounts[0];
        const shortAddress = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
        updateWalletDisplay(shortAddress);
        enablePublishButton();
        
        // Check network
        await checkNetwork();
    }
}

async function checkNetwork() {
    try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const chainIdDecimal = parseInt(chainId, 16);
        
        if (chainIdDecimal !== CONFIG.ETHEREUM_CHAIN_ID) {
            showWarning(`Wrong network! Please switch to ${CONFIG.ETHEREUM_NETWORK}.`);
            disablePublishButton('Wrong Network');
            return false;
        } else {
            document.getElementById('network-name').textContent = `${CONFIG.ETHEREUM_NETWORK} ✓`;
            return true;
        }
    } catch (error) {
        console.error('Failed to check network:', error);
        return false;
    }
}

function updateWalletDisplay(text) {
    document.getElementById('wallet-address').textContent = text;
}

// ============================================================================
// Form Handling
// ============================================================================

function getFormData() {
    const form = document.getElementById('cf-form');
    const formData = new FormData(form);
    
    return {
        'jcr:primaryType': 'nt:unstructured',
        'jcr:title': formData.get('title'),
        'date': formData.get('date'),
        'author': formData.get('author'),
        'abstract': formData.get('abstract'),
        'sling:resourceType': 'blockchain-aem/components/contentfragment',
        'created': new Date().toISOString(),
        'createdBy': currentAccount,
    };
}

function getSelectedTier() {
    const tierInputs = document.getElementsByName('tier');
    for (const input of tierInputs) {
        if (input.checked) {
            return parseInt(input.value);
        }
    }
    return 0; // Default to STANDARD
}

function validateForm() {
    const form = document.getElementById('cf-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return false;
    }
    return true;
}

// ============================================================================
// Save Draft
// ============================================================================

async function handleSaveDraft(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    const content = getFormData();
    
    // Save to localStorage as draft
    localStorage.setItem('garage-week-demo-draft', JSON.stringify(content));
    
    showSuccess('💾 Draft saved locally!');
}

// ============================================================================
// Publish to oak-chain
// ============================================================================

/**
 * Main publish flow (unified for all modes)
 * 
 * Flow:
 * 1. Get wallet address (mock or MetaMask)
 * 2. Get Ethereum tx hash (mock or smart contract call)
 * 3. Sign content (mock or MetaMask)
 * 4. Submit to /v1/propose-write (same for all modes)
 * 5. Poll /v1/proposals/{id}/status until finalized
 */
async function handlePublish(e) {
    e.preventDefault();
    
    if (isSubmitting) {
        return;
    }
    
    if (!validateForm()) {
        return;
    }
    
    // In MOCK mode, currentAccount might not be set yet
    if (CONFIG.mode !== 'mock' && !currentAccount) {
        showError('Please connect your wallet first!');
        return;
    }
    
    isSubmitting = true;
    const publishBtn = document.getElementById('publish-btn');
    const originalText = publishBtn.textContent;
    
    try {
        // Disable button and show loading
        publishBtn.disabled = true;
        publishBtn.classList.add('is-loading');
        
        // Get form data and payment tier
        const content = getFormData();
        const tier = getSelectedTier();
        const tierName = TIERS[tier].name.toLowerCase(); // 'standard', 'express', 'priority'
        
        showInfo(`📤 Preparing write proposal (${tierName.toUpperCase()} tier)...`);
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // MODE-SPECIFIC CHECKS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        if (CONFIG.mode !== 'mock') {
            // Real blockchain mode: Check MetaMask
            if (!window.ethereum) {
                throw new Error('MetaMask not detected. Please install MetaMask extension.');
            }
            
            // Check network
            const correctNetwork = await checkNetwork();
            if (!correctNetwork) {
                throw new Error(`Please switch to ${CONFIG.ETHEREUM_NETWORK} network in MetaMask`);
            }
            
            // Mainnet warning
            if (CONFIG.mode === 'mainnet') {
                const confirmed = confirm(
                    '⚠️ WARNING: You are about to submit a REAL MAINNET transaction!\n\n' +
                    'This will cost REAL ETH. Are you sure you want to proceed?'
                );
                if (!confirmed) {
                    throw new Error('Transaction cancelled by user');
                }
            }
        } else {
            // Mock mode: Show banner
            showInfo('🎭 MOCK MODE: Simulating blockchain transaction (no cost)', 
                     'All signatures and transactions are simulated');
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // UNIFIED FLOW (Same for All Modes)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        // Step 1: Get wallet address
        const walletAddress = await getWalletAddress();
        console.log('💳 Wallet:', walletAddress);
        
        // Step 2: Get Ethereum transaction hash (authorizeWrite call)
        showInfo(`💰 Processing payment tier: ${tierName.toUpperCase()}`);
        const ethereumTxHash = await getEthereumTxHash(tierName);
        console.log('💎 Ethereum tx:', ethereumTxHash);
        
        // Step 3: Sign content
        showInfo('📝 Signing content...');
        const signature = await signProposal(content);
        showSuccess('✅ Content signed');
        
        // Step 4: Submit to validator
        showInfo('📤 Submitting to validator cluster...');
        const result = await submitToValidator(walletAddress, ethereumTxHash, signature, content, tierName);
        showSuccess(`✅ Proposal queued! ID: ${result.proposalId}`);
        
        // Step 5: Wait for finality
        const finalityResult = await waitForFinality(result.proposalId, ethereumTxHash);
        
        // Success! (mode-specific messages)
        if (CONFIG.mode === 'mock') {
            showSuccess(
                `✅ Content published to oak-chain! 🎉`,
                `🎭 MOCK MODE: Simulated transaction ${ethereumTxHash}<br>` +
                `Path: ${finalityResult.storagePath || 'N/A'}<br>` +
                `In real mode, this would be on the blockchain.`
            );
        } else if (CONFIG.mode === 'sepolia') {
            showSuccess(
                `✅ Content published to oak-chain! 🎉`,
                `<a href="https://sepolia.etherscan.io/tx/${ethereumTxHash}" target="_blank">View on Sepolia Etherscan →</a><br>` +
                `Path: ${finalityResult.storagePath || 'N/A'}`
            );
        } else if (CONFIG.mode === 'mainnet') {
            showSuccess(
                `✅ Content published to oak-chain! 🎉`,
                `<a href="https://etherscan.io/tx/${ethereumTxHash}" target="_blank">View on Etherscan →</a><br>` +
                `Path: ${finalityResult.storagePath || 'N/A'}`
            );
        }
        
        // Update status badge
        const statusBadge = document.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.textContent = 'Published';
            statusBadge.classList.remove('status-draft');
            statusBadge.classList.add('status-published');
        }
        
        console.log('🎉 Final result:', finalityResult);
        
    } catch (error) {
        console.error('❌ Publish failed:', error);
        showError(`❌ Publish failed: ${error.message}`);
    } finally {
        isSubmitting = false;
        publishBtn.disabled = false;
        publishBtn.classList.remove('is-loading');
        publishBtn.textContent = originalText;
    }
}

// ============================================================================
// Cryptographic Operations
// ============================================================================

async function hashContent(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sign write proposal (mode-aware)
 * - MOCK: Generate mock signature (0xMOCK{timestamp})
 * - SEPOLIA/MAINNET: Real MetaMask signature
 */
async function signProposal(content) {
    try {
        // MOCK MODE - Simulate signature
        if (CONFIG.mode === 'mock') {
            console.log('🎭 MOCK MODE: Simulating signature');
            const mockSignature = '0xMOCK' + Date.now();
            await sleep(500); // Simulate signing delay
            console.warn('🎭 Generated mock signature:', mockSignature);
            return mockSignature;
        }
        
        // MAINNET MODE - Show extra warning
        if (CONFIG.mode === 'mainnet') {
            const confirmed = confirm(
                '⚠️ MAINNET MODE\n\n' +
                'You are about to sign a transaction on ETHEREUM MAINNET with REAL ETH.\n\n' +
                'Are you sure you want to proceed?'
            );
            if (!confirmed) {
                throw new Error('User cancelled mainnet transaction');
            }
        }
        
        // SEPOLIA/MAINNET - Real MetaMask signature
        const message = JSON.stringify(content, null, 2);
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, currentAccount],
        });
        console.log('✍️ Signature:', signature.substring(0, 20) + '...');
        return signature;
    } catch (error) {
        if (error.code === 4001) {
            throw new Error('User rejected signature request');
        }
        throw error;
    }
}

// ============================================================================
// Validator Communication (Unified for All Modes)
// ============================================================================

/**
 * Get wallet address (mode-aware)
 * - MOCK: Generate persistent mock wallet
 * - SEPOLIA/MAINNET: Use MetaMask wallet
 */
async function getWalletAddress() {
    if (CONFIG.mode === 'mock') {
        // Generate persistent mock wallet for session
        let mockWallet = sessionStorage.getItem('mockWallet');
        if (!mockWallet) {
            mockWallet = '0xMOCK' + crypto.randomUUID().replace(/-/g, '').substring(0, 36);
            sessionStorage.setItem('mockWallet', mockWallet);
            console.log('🎭 MOCK MODE: Generated wallet:', mockWallet);
        }
        return mockWallet;
    }
    
    // Real MetaMask wallet
    return currentAccount;
}

/**
 * Get Ethereum transaction hash (mode-aware)
 * - MOCK: Generate mock tx hash
 * - SEPOLIA/MAINNET: Call smart contract authorizeWrite()
 */
async function getEthereumTxHash(paymentTier) {
    if (CONFIG.mode === 'mock') {
        // Mock Ethereum tx hash (format only)
        const mockTxHash = '0xMOCK' + Date.now() + Math.random().toString(16).substring(2, 10);
        console.warn('🎭 MOCK MODE: Generated mock tx hash:', mockTxHash);
        return mockTxHash;
    }
    
    // Real Ethereum transaction (call smart contract's authorizeWrite)
    // TODO: Implement Web3.js call to ValidatorPaymentV3_2.authorizeWrite()
    // For now, return placeholder
    showError('Real Ethereum transactions not yet implemented. Please use MOCK mode for demo.');
    throw new Error('Real Ethereum tx not implemented');
}

/**
 * Submit write proposal to validator
 * Uses /v1/propose-write with form-encoded data (same protocol as 30min test)
 * This function is IDENTICAL for all modes (MOCK, SEPOLIA, MAINNET)
 */
async function submitToValidator(walletAddress, ethereumTxHash, signature, content, paymentTier) {
    try {
        console.log(`📤 Submitting to validator (mode: ${CONFIG.mode}, tier: ${paymentTier})`);
        
        const formData = new URLSearchParams({
            walletAddress: walletAddress,
            ethereumTxHash: ethereumTxHash,
            contentType: 'page',
            message: JSON.stringify(content),
            signature: signature,
            paymentTier: paymentTier
        });
        
        const response = await fetch(`${CONFIG.VALIDATOR_URL}/v1/propose-write`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Validator rejected (${response.status}): ${errorText}`);
        }
        
        const result = await response.json();
        console.log('✅ Validator accepted proposal:', result.proposalId);
        return result; // { proposalId, state: 'PENDING', ethereumTxHash, ... }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to validator. Is it running on port 8090?');
        }
        throw error;
    }
}

/**
 * Wait for proposal finality by polling /v1/proposals/{id}/status
 * Unified for all modes - validator handles mode-specific behavior
 */
async function waitForFinality(proposalId, ethereumTxHash) {
    const startTime = Date.now();
    
    // Mode-specific messaging
    let finalityTarget = CONFIG.mode === 'mock' ? '~5s (simulated)' : 
                         CONFIG.mode === 'sepolia' ? '~13 min (2 epochs)' : 
                         '~13 min (2 epochs)';
    
    showInfo(`⏳ Waiting for proposal finality (${finalityTarget})...`);
    
    while (Date.now() - startTime < CONFIG.POLL_TIMEOUT) {
        try {
            const response = await fetch(`${CONFIG.VALIDATOR_URL}/v1/proposals/${proposalId}/status`);
            
            if (response.ok) {
                const status = await response.json();
                console.log('📊 Proposal status:', status.state, status);
                
                if (status.state === 'FINALIZED') {
                    showSuccess(`✅ Content finalized! Path: ${status.storagePath || 'N/A'}`);
                    return status;
                }
                
                if (status.state === 'REJECTED') {
                    throw new Error(`Proposal rejected: ${status.message || 'Unknown reason'}`);
                }
                
                // Update progress
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                updateStatusDetails(`Status: ${status.state} (${elapsed}s elapsed)`);
            }
        } catch (error) {
            if (error.message && error.message.includes('rejected')) {
                throw error; // Re-throw rejection errors
            }
            console.warn('Poll error:', error);
        }
        
        await sleep(CONFIG.POLL_INTERVAL);
    }
    
    throw new Error('Proposal timeout - not finalized within expected time');
}

// ============================================================================
// UI Helpers
// ============================================================================

function showStatus(type, message, details = '') {
    const container = document.getElementById('status-container');
    const messageEl = document.getElementById('status-message');
    const detailsEl = document.getElementById('status-details');
    
    // Remove all status classes
    container.className = 'status-container';
    container.classList.add(`status-${type}`);
    
    messageEl.innerHTML = message;
    detailsEl.innerHTML = details;
    
    container.style.display = 'block';
    
    // Scroll into view
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showInfo(message, details = '') {
    showStatus('info', message, details);
}

function showSuccess(message, details = '') {
    showStatus('success', message, details);
}

function showWarning(message, details = '') {
    showStatus('warning', message, details);
}

function showError(message, details = '') {
    showStatus('error', message, details);
}

function updateStatusDetails(details) {
    const detailsEl = document.getElementById('status-details');
    detailsEl.textContent = details;
}

function enablePublishButton() {
    const publishBtn = document.getElementById('publish-btn');
    publishBtn.disabled = false;
    publishBtn.querySelector('.coral-Button-label').textContent = '🚀 Publish to oak-chain';
}

function disablePublishButton(reason) {
    const publishBtn = document.getElementById('publish-btn');
    publishBtn.disabled = true;
    publishBtn.querySelector('.coral-Button-label').textContent = `🔒 ${reason}`;
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function truncateAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ============================================================================
// Error Handling
// ============================================================================

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// ============================================================================
// Development Helpers
// ============================================================================

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🔧 Development mode');
    console.log('Config:', CONFIG);
    
    // Expose useful functions for debugging
    window.BlockchainAEM = {
        getFormData,
        hashContent,
        connectWallet,
        currentAccount: () => currentAccount,
    };
}

