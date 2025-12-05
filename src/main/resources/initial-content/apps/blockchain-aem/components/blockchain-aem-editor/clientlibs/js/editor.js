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
 * Blockchain AEM - Unified Editor
 * Handles content editing, publishing, and unpublishing with MetaMask integration
 * 
 * Three-Address Architecture:
 * - Content Owner: Sling Author wallet (owns the content)
 * - Payer: MetaMask user (pays for transaction)
 * - Validators: Receive payment and replicate content
 */

// ============================================================================
// Configuration
// ============================================================================

let CONFIG = {
    VALIDATOR_URL: 'http://localhost:8090',
    POLL_INTERVAL: 2000,
    POLL_TIMEOUT: 120000,
    
    // Mode-specific config (loaded from validator API)
    mode: 'sepolia',
    requiresMetaMask: true,
    displayName: '✅ SEPOLIA TESTNET',
    badgeColor: '#10b981',
};

// State
let currentAccount = null;
let contentOwnerAddress = null;  // Sling Author's wallet
let isSubmitting = false;
let currentContentPath = null;
let isPublished = false;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Blockchain AEM Editor Initialized');
    
    // Load blockchain configuration
    await loadBlockchainConfig();
    
    // Load content owner address (Sling Author's wallet)
    await loadContentOwnerAddress();
    
    // Update UI with mode information
    updateModeDisplay();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize wallet based on mode
    await initializeWallet();
    
    // Load content path from URL parameter
    loadContentFromURL();
    
    // Set default date to today
    document.getElementById('date').valueAsDate = new Date();
});

// ============================================================================
// Configuration Loading
// ============================================================================

async function loadBlockchainConfig() {
    try {
        // Fetch from LOCAL Sling servlet (no CORS issues)
        const response = await fetch('/bin/blockchain/config');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const config = await response.json();
        console.log('✅ Blockchain config loaded:', config.mode.toUpperCase());
        
        CONFIG.mode = config.mode;
        CONFIG.VALIDATOR_URL = config.validatorUrl;
        CONFIG.requiresMetaMask = config.requiresMetaMask;
        CONFIG.displayName = config.displayName;
        CONFIG.badgeColor = config.badgeColor;
        CONFIG.contractAddress = config.contractAddress;
        
    } catch (error) {
        console.error('❌ Failed to load blockchain config:', error);
        console.warn('⚠️  Falling back to MOCK MODE defaults');
        
        CONFIG.mode = 'mock';
        CONFIG.VALIDATOR_URL = 'http://localhost:8090';
        CONFIG.requiresMetaMask = false;
        CONFIG.displayName = '🎭 MOCK MODE';
        CONFIG.badgeColor = '#f59e0b';
    }
}

async function loadContentOwnerAddress() {
    try {
        const response = await fetch('/bin/blockchain/content-owner');
        
        if (response.ok) {
            const data = await response.json();
            contentOwnerAddress = data.address;
            console.log('📦 Content Owner (Sling Author):', contentOwnerAddress);
            console.log('   This is the REAL Sling Author wallet from keystore');
        } else {
            console.error('❌ Failed to load content owner address:', response.status);
            contentOwnerAddress = null;
        }
        
        updateContentOwnerDisplay();
        
    } catch (error) {
        console.error('❌ Failed to load content owner:', error);
        contentOwnerAddress = null;
        updateContentOwnerDisplay();
    }
}

function updateContentOwnerDisplay() {
    const storagePath = document.getElementById('storage-path');
    if (contentOwnerAddress) {
        const shard = contentOwnerAddress.slice(2, 4);  // First 2 hex chars for sharding
        const org = document.getElementById('organization').value || '{organization}';
        storagePath.textContent = `/oak-chain/${shard}/${contentOwnerAddress}/content/${org}`;
    } else {
        storagePath.textContent = '/oak-chain/... (loading Sling Author wallet)';
    }
}

function updateModeDisplay() {
    const modeBadge = document.getElementById('mode-badge');
    const networkName = document.getElementById('network-name');
    const validatorUrl = document.getElementById('validator-url');
    
    modeBadge.textContent = CONFIG.displayName;
    modeBadge.style.background = CONFIG.badgeColor;
    networkName.textContent = CONFIG.displayName;
    validatorUrl.textContent = CONFIG.VALIDATOR_URL;
}

// ============================================================================
// Wallet Initialization
// ============================================================================

async function initializeWallet() {
    if (CONFIG.mode === 'mock') {
        // MOCK MODE - Simulate MetaMask connection
        console.log('🎭 MOCK MODE: You can simulate MetaMask by clicking wallet status');
        updateWalletDisplay('Not Connected (Click to Simulate)');
        enablePublishButton();
        
        showInfo('🎭 MOCK MODE Active', 'Using simulated blockchain - no real MetaMask required');
        
    } else if (typeof window.ethereum === 'undefined') {
        showError('MetaMask not detected! Please install MetaMask to continue.');
        disablePublishButton('MetaMask Required');
        
    } else {
        // DO NOT auto-connect - require explicit user action
        // Even if MetaMask was previously connected, show as disconnected
        updateWalletDisplay('Not Connected');
        disablePublishButton('Connect Wallet');
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
        
        console.log('🦊 MetaMask detected. Click "Not Connected" to connect.');
    }
}

async function connectWallet() {
    if (CONFIG.mode === 'mock') {
        // MOCK MODE - Simulate connection
        if (!currentAccount) {
            currentAccount = '0xMOCK' + Date.now().toString(16).padStart(36, '0');
            updateWalletDisplay(currentAccount.slice(0, 10) + '... (Simulated)');
            showInfo('🎭 MOCK MODE', 'Simulated MetaMask connection (no real wallet)');
        }
        return;
    }
    
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
        currentAccount = null;
        updateWalletDisplay('Not Connected');
        disablePublishButton('Connect Wallet');
    } else {
        currentAccount = accounts[0];
        const shortAddress = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
        updateWalletDisplay(shortAddress);
        enablePublishButton();
    }
}

function updateWalletDisplay(text) {
    const walletAddress = document.getElementById('wallet-address');
    const walletStatus = document.getElementById('wallet-status');
    
    if (walletAddress) {
        walletAddress.textContent = text;
    }
    
    // Make wallet status clickable if not connected
    if (walletStatus && text.includes('Not Connected')) {
        walletStatus.style.cursor = 'pointer';
        walletStatus.title = 'Click to connect MetaMask';
        walletStatus.onclick = connectWallet;
    } else if (walletStatus) {
        walletStatus.style.cursor = 'default';
        walletStatus.title = 'Connected wallet';
        walletStatus.onclick = null;
    }
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
    // Publish button
    document.getElementById('publish-btn').addEventListener('click', handlePublish);
    
    // Unpublish button
    document.getElementById('unpublish-btn').addEventListener('click', handleUnpublish);
    
    // Save draft button
    document.getElementById('save-draft-btn').addEventListener('click', handleSaveDraft);
    
    // Wallet status click to connect
    document.getElementById('wallet-status').addEventListener('click', connectWallet);
    
    // Organization field change updates storage path
    document.getElementById('organization').addEventListener('input', updateContentOwnerDisplay);
}

// ============================================================================
// URL Parameter Handling
// ============================================================================

function loadContentFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const contentPath = urlParams.get('path');
    
    if (contentPath) {
        currentContentPath = contentPath;
        document.getElementById('current-path').textContent = contentPath;
        document.getElementById('editor-title-text').textContent = `Editing: ${contentPath}`;
        
        // Try to load existing content
        loadExistingContent(contentPath);
    } else {
        document.getElementById('current-path').textContent = 'New Content';
    }
}

async function loadExistingContent(path) {
    try {
        const response = await fetch(`${path}.json`);
        
        if (response.ok) {
            const content = await response.json();
            populateForm(content);
            isPublished = true;
            updateStatusBadge('Published');
            document.getElementById('unpublish-btn').style.display = 'inline-block';
        }
    } catch (error) {
        console.warn('Content not found or not yet published:', path);
    }
}

function populateForm(content) {
    document.getElementById('title').value = content['jcr:title'] || content.title || '';
    document.getElementById('date').value = content.date || '';
    document.getElementById('author').value = content.author || '';
    document.getElementById('abstract').value = content.abstract || '';
    document.getElementById('content-body').value = content.contentBody || '';
    document.getElementById('organization').value = content.organization || '';
}

// ============================================================================
// Form Handling
// ============================================================================

function getFormData() {
    const form = document.getElementById('content-form');
    const tierInputs = form.querySelectorAll('input[name="tier"]');
    let selectedTier = 'standard';
    tierInputs.forEach(input => {
        if (input.checked) {
            const tierMap = { 0: 'standard', 1: 'express', 2: 'priority' };
            selectedTier = tierMap[input.value];
        }
    });
    
    return {
        organization: form.organization.value,
        title: form.title.value,
        date: form.date.value,
        author: form.author.value,
        abstract: form.abstract.value,
        contentBody: form.contentBody.value,
        tier: selectedTier,
        contentOwner: contentOwnerAddress,
        publisher: currentAccount,
        created: new Date().toISOString(),
    };
}

function validateForm() {
    const form = document.getElementById('content-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return false;
    }
    
    if (!currentAccount && CONFIG.mode !== 'mock') {
        showError('Please connect your MetaMask wallet first');
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
    
    // Save to localStorage
    const draftKey = `blockchain-aem-draft-${content.organization}`;
    localStorage.setItem(draftKey, JSON.stringify(content));
    
    showSuccess('💾 Draft saved locally!', 'Your draft has been saved to browser storage');
}

// ============================================================================
// Publish to oak-chain
// ============================================================================

async function handlePublish(e) {
    e.preventDefault();
    
    if (isSubmitting || !validateForm()) {
        return;
    }
    
    isSubmitting = true;
    const publishBtn = document.getElementById('publish-btn');
    publishBtn.disabled = true;
    
    try {
        const content = getFormData();
        
        showInfo(`📤 Preparing write proposal (${content.tier.toUpperCase()} tier)...`);
        
        // Mode-specific checks
        if (CONFIG.mode !== 'mock' && !window.ethereum) {
            throw new Error('MetaMask not detected');
        }
        
        // Get wallet address
        const payerAddress = await getWalletAddress();
        console.log('💳 Payer (MetaMask):', payerAddress);
        console.log('📦 Content Owner (Sling):', contentOwnerAddress);
        
        // Get Ethereum transaction hash
        showInfo(`💰 Processing payment tier: ${content.tier.toUpperCase()}`);
        const ethereumTxHash = await getEthereumTxHash(content.tier);
        console.log('💎 Ethereum tx:', ethereumTxHash);
        
        // Sign content with Sling Author's wallet
        showInfo('📝 Signing proposal with Sling Author wallet...');
        const signedProposal = await signProposal(content);
        showSuccess(`✅ Proposal signed by ${signedProposal.contentOwner.substring(0, 10)}...`);
        
        // Submit to validator
        showInfo('📤 Submitting to validator cluster...');
        const result = await submitToValidator(payerAddress, ethereumTxHash, signedProposal, content);
        showSuccess(`✅ Proposal queued! ID: ${signedProposal.proposal.proposalId}`);
        
        // Wait for finality
        const finalityResult = await waitForFinality(signedProposal.proposal.proposalId, ethereumTxHash);
        
        // Success!
        showSuccess(
            `✅ Content published to oak-chain! 🎉`,
            `Path: ${finalityResult.storagePath || 'N/A'}<br>` +
            `Transaction: ${ethereumTxHash}`
        );
        
        isPublished = true;
        updateStatusBadge('Published');
        document.getElementById('unpublish-btn').style.display = 'inline-block';
        
    } catch (error) {
        console.error('❌ Publish failed:', error);
        showError(`❌ Publish failed: ${error.message}`);
    } finally {
        isSubmitting = false;
        publishBtn.disabled = false;
    }
}

// ============================================================================
// Unpublish from oak-chain
// ============================================================================

async function handleUnpublish(e) {
    e.preventDefault();
    
    if (isSubmitting || !isPublished) {
        return;
    }
    
    const confirmed = confirm(
        '⚠️ Unpublish Content?\n\n' +
        'This will remove the content from the global oak-chain store.\n' +
        'This action requires validator consensus and will cost gas.'
    );
    
    if (!confirmed) {
        return;
    }
    
    isSubmitting = true;
    const unpublishBtn = document.getElementById('unpublish-btn');
    unpublishBtn.disabled = true;
    
    try {
        const content = getFormData();
        
        showInfo('📤 Preparing unpublish proposal...');
        
        // Get wallet address
        const payerAddress = await getWalletAddress();
        
        // Get Ethereum transaction hash for unpublish
        showInfo('💰 Processing unpublish payment...');
        const ethereumTxHash = await getEthereumTxHash('standard');
        
        // Sign unpublish request
        showInfo('📝 Signing unpublish request...');
        const signature = await signProposal({ action: 'unpublish', ...content });
        
        // Submit unpublish to validator
        showInfo('📤 Submitting unpublish to validator cluster...');
        const result = await submitUnpublishToValidator(payerAddress, contentOwnerAddress, ethereumTxHash, signature, content);
        showSuccess(`✅ Unpublish proposal queued! ID: ${result.proposalId}`);
        
        // Wait for finality
        await waitForFinality(result.proposalId, ethereumTxHash);
        
        // Success!
        showSuccess(
            `✅ Content unpublished from oak-chain! 🎉`,
            `The content has been removed from the global store`
        );
        
        isPublished = false;
        updateStatusBadge('Draft');
        unpublishBtn.style.display = 'none';
        
    } catch (error) {
        console.error('❌ Unpublish failed:', error);
        showError(`❌ Unpublish failed: ${error.message}`);
    } finally {
        isSubmitting = false;
        unpublishBtn.disabled = false;
    }
}

// ============================================================================
// Blockchain Operations
// ============================================================================

async function getWalletAddress() {
    if (CONFIG.mode === 'mock') {
        return currentAccount || ('0xMOCK' + Date.now().toString(16).padStart(36, '0'));
    }
    return currentAccount;
}

async function getEthereumTxHash(paymentTier) {
    if (CONFIG.mode === 'mock') {
        const mockTxHash = '0xMOCK' + Date.now() + Math.random().toString(16).substring(2, 10);
        console.warn('🎭 MOCK MODE: Generated mock tx hash:', mockTxHash);
        await sleep(500);
        return mockTxHash;
    }
    
    // Real Ethereum transaction would happen here
    showError('Real Ethereum transactions not yet implemented. Please use MOCK mode for demo.');
    throw new Error('Real Ethereum tx not implemented');
}

async function signProposal(content) {
    // Generate proposal ID
    const proposalId = generateUUID();
    
    // Build storage path
    const storagePath = `/oak-chain/${contentOwnerAddress.substring(2, 4)}/${contentOwnerAddress}/content/${content.organization}`;
    
    // Call SignProposalServlet to sign with Sling Author's wallet
    const formData = new URLSearchParams({
        proposalId: proposalId,
        path: storagePath,
        title: content.title,
        content: JSON.stringify(content),
        organization: content.organization,
        tier: content.tier === 'standard' ? '0' : content.tier === 'express' ? '1' : '2'
    });
    
    const response = await fetch('/bin/blockchain/sign-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sign proposal');
    }
    
    const signedProposal = await response.json();
    console.log('✅ Proposal signed by Sling Author:', signedProposal.contentOwner);
    console.log('   Signature:', signedProposal.signature.substring(0, 20) + '...');
    
    // Return the full signed proposal (needed for validator submission)
    return signedProposal;
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function submitToValidator(payerAddress, ethereumTxHash, signedProposal, content) {
    // Parse the proposal JSON string back to object
    const proposal = typeof signedProposal.proposal === 'string' 
        ? JSON.parse(signedProposal.proposal) 
        : signedProposal.proposal;
    
    const formData = new URLSearchParams({
        walletAddress: payerAddress,
        contentOwnerAddress: signedProposal.contentOwner,
        ethereumTxHash: ethereumTxHash,
        contentType: 'page',
        message: JSON.stringify(proposal),
        signature: signedProposal.signature,
        publicKey: signedProposal.publicKey,
        paymentTier: content.tier,
        proposalId: proposal.proposalId
    });
    
    const response = await fetch(`${CONFIG.VALIDATOR_URL}/v1/propose-write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Validator rejected (${response.status}): ${errorText}`);
    }
    
    return await response.json();
}

async function submitUnpublishToValidator(payerAddress, contentOwnerAddress, ethereumTxHash, signature, content) {
    const formData = new URLSearchParams({
        walletAddress: payerAddress,
        contentOwnerAddress: contentOwnerAddress,
        ethereumTxHash: ethereumTxHash,
        contentType: 'delete',
        message: JSON.stringify(content),
        signature: signature,
        paymentTier: 'standard'
    });
    
    const response = await fetch(`${CONFIG.VALIDATOR_URL}/v1/propose-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Validator rejected (${response.status}): ${errorText}`);
    }
    
    return await response.json();
}

async function waitForFinality(proposalId, ethereumTxHash) {
    const startTime = Date.now();
    
    showInfo(`⏳ Waiting for proposal finality...`);
    
    while (Date.now() - startTime < CONFIG.POLL_TIMEOUT) {
        try {
            const response = await fetch(`${CONFIG.VALIDATOR_URL}/v1/proposals/${proposalId}/status`);
            
            if (response.ok) {
                const status = await response.json();
                console.log('📊 Proposal status:', status.state);
                
                if (status.state === 'FINALIZED') {
                    return status;
                }
                
                if (status.state === 'REJECTED') {
                    throw new Error(`Proposal rejected: ${status.message || 'Unknown reason'}`);
                }
                
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                updateStatusDetails(`Status: ${status.state} (${elapsed}s elapsed)`);
            }
        } catch (error) {
            if (error.message && error.message.includes('rejected')) {
                throw error;
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
    
    container.className = 'status-container';
    container.classList.add(`status-${type}`);
    
    messageEl.innerHTML = message;
    detailsEl.innerHTML = details;
    
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showInfo(message, details = '') {
    showStatus('info', message, details);
}

function showSuccess(message, details = '') {
    showStatus('success', message, details);
}

function showError(message, details = '') {
    showStatus('error', message, details);
}

function updateStatusDetails(details) {
    document.getElementById('status-details').textContent = details;
}

function updateStatusBadge(status) {
    const badge = document.getElementById('status-badge');
    badge.textContent = status;
    badge.className = 'status-badge';
    
    if (status === 'Published') {
        badge.classList.add('status-published');
    } else if (status === 'Draft') {
        badge.classList.add('status-draft');
    }
}

function enablePublishButton() {
    document.getElementById('publish-btn').disabled = false;
}

function disablePublishButton(reason) {
    const btn = document.getElementById('publish-btn');
    btn.disabled = true;
    btn.querySelector('.editor-button-label').textContent = `🔒 ${reason}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

