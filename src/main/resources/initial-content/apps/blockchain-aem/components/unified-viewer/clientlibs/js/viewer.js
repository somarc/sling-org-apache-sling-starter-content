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
 * Blockchain AEM - Unified Viewer
 * Public-facing viewer for blockchain-stored content
 */

// Configuration
let CONFIG = {
    VALIDATOR_URL: 'http://localhost:8090',
    mode: 'sepolia',
    displayName: '✅ SEPOLIA TESTNET',
};

// State
let contentPath = null;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🌐 Blockchain AEM Viewer Initialized');
    
    // Load blockchain configuration
    await loadBlockchainConfig();
    
    // Update UI with mode information
    updateModeDisplay();
    
    // Load content path from URL parameter
    loadContentFromURL();
});

// ============================================================================
// Configuration Loading
// ============================================================================

async function loadBlockchainConfig() {
    try {
        const response = await fetch(`${CONFIG.VALIDATOR_URL}/v1/blockchain/config`);
        
        if (response.ok) {
            const config = await response.json();
            CONFIG.mode = config.mode;
            CONFIG.displayName = config.displayName;
            console.log('✅ Config loaded:', CONFIG.mode.toUpperCase());
        }
    } catch (error) {
        console.warn('⚠️  Using default config');
    }
}

function updateModeDisplay() {
    const modeBadge = document.getElementById('mode-badge');
    const networkName = document.getElementById('network-name');
    
    if (modeBadge) modeBadge.textContent = CONFIG.displayName;
    if (networkName) networkName.textContent = CONFIG.displayName;
}

// ============================================================================
// Content Loading
// ============================================================================

function loadContentFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    contentPath = urlParams.get('path');
    
    if (!contentPath) {
        // Default path for demo
        contentPath = '/oak-chain/content/garage-week-demo';
    }
    
    console.log('📄 Loading content from:', contentPath);
    document.getElementById('loading-info').textContent = `Reading from: ${contentPath}`;
    document.getElementById('error-path').textContent = `Path: ${contentPath}`;
    
    // Load content
    loadContent();
}

async function loadContent() {
    try {
        console.log('Fetching content from:', contentPath);
        
        // Try to fetch JSON representation
        const response = await fetch(`${contentPath}.json`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const content = await response.json();
        console.log('Content loaded:', content);
        
        displayContent(content);
        
    } catch (error) {
        console.error('Failed to load content:', error);
        showError();
    }
}

function displayContent(content) {
    // Hide loading, show content
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('content-body').style.display = 'block';
    
    // Populate fields
    const title = content['jcr:title'] || content.title || 'Untitled';
    const date = content.date || new Date().toISOString().split('T')[0];
    const author = content.author || 'Unknown';
    const abstract = content.abstract || '';
    const contentBody = content.contentBody || '';
    
    document.getElementById('content-title').textContent = title;
    document.getElementById('content-date').textContent = formatDate(date);
    document.getElementById('content-author').textContent = `By ${author}`;
    document.getElementById('content-abstract').textContent = abstract;
    
    // Show content body if available
    if (contentBody) {
        const contentMain = document.getElementById('content-main');
        contentMain.textContent = contentBody;
        contentMain.style.display = 'block';
    }
    
    // Update verification details
    if (content.contentOwner) {
        document.getElementById('content-owner').textContent = truncateAddress(content.contentOwner);
    }
    
    if (content.publisher) {
        document.getElementById('publisher').textContent = truncateAddress(content.publisher);
    }
    
    document.getElementById('storage-path').textContent = contentPath;
    
    // Ethereum transaction link (if available)
    if (content.ethTxHash) {
        const txHashItem = document.getElementById('tx-hash-item');
        const etherscanLink = document.getElementById('etherscan-link');
        
        if (CONFIG.mode === 'mainnet') {
            etherscanLink.href = `https://etherscan.io/tx/${content.ethTxHash}`;
        } else {
            etherscanLink.href = `https://sepolia.etherscan.io/tx/${content.ethTxHash}`;
        }
        
        txHashItem.style.display = 'flex';
    }
    
    // Update last updated time
    document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
}

function showError() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
    document.getElementById('last-updated').textContent = 'Error';
}

// ============================================================================
// Utilities
// ============================================================================

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

function truncateAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

