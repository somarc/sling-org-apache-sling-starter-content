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
 *
 * Blockchain AEM - Shared Header Component JavaScript
 * This file is the single source of truth for header functionality.
 * Include in all pages: <script src="/content/blockchain-aem/shared/header.js"></script>
 * 
 * Required HTML structure:
 * <nav class="top-bar">
 *   <div class="brand">...</div>
 *   <div class="nav-links">...</div>
 *   <div class="user-section">
 *     <div class="status-indicators">
 *       <div class="status-dot" id="validator-status"><span class="dot"></span><span>Validator</span></div>
 *       <div class="status-dot" id="ipfs-status"><span class="dot"></span><span>IPFS</span></div>
 *     </div>
 *     <span class="mode-badge" id="mode-badge">MOCK</span>
 *     <div class="user-avatar" id="user-avatar">?</div>
 *   </div>
 * </nav>
 * 
 * Required: Set window.VALIDATOR_URL before including this script
 */

(function() {
    'use strict';
    
    // Configuration - can be overridden by setting before script loads
    const VALIDATOR_URL = window.VALIDATOR_URL || 'http://localhost:8090';
    const LOCAL_IPFS_GATEWAY = window.LOCAL_IPFS_GATEWAY || 'http://localhost:8080/ipfs';
    
    // State
    let blockchainMode = 'MOCK';
    let slingAuthorWallet = null;
    
    // Export state for other scripts to access
    window.BlockchainAEM = window.BlockchainAEM || {};
    window.BlockchainAEM.getMode = () => blockchainMode;
    window.BlockchainAEM.getAuthorWallet = () => slingAuthorWallet;
    window.BlockchainAEM.VALIDATOR_URL = VALIDATOR_URL;
    window.BlockchainAEM.LOCAL_IPFS_GATEWAY = LOCAL_IPFS_GATEWAY;
    
    // Detect blockchain mode from validator
    async function detectBlockchainMode() {
        try {
            const response = await fetch(`${VALIDATOR_URL}/v1/blockchain/config`);
            if (response.ok) {
                const config = await response.json();
                blockchainMode = config.mode?.toUpperCase() || 'MOCK';
            }
        } catch (error) {
            console.warn('Failed to fetch blockchain config, defaulting to MOCK mode:', error);
        }
        console.log('🔗 Blockchain mode:', blockchainMode);
        return blockchainMode;
    }
    
    // Update mode badge display
    function updateModeBadge() {
        const modeBadge = document.getElementById('mode-badge');
        if (modeBadge) {
            modeBadge.textContent = blockchainMode;
            modeBadge.className = `mode-badge ${blockchainMode.toLowerCase()}`;
        }
    }
    
    // Check validator status
    async function checkValidatorStatus() {
        const statusEl = document.getElementById('validator-status');
        if (!statusEl) return false;
        
        try {
            const response = await fetch(`${VALIDATOR_URL}/health`, { 
                method: 'GET',
                mode: 'cors'
            });
            if (response.ok) {
                statusEl.classList.remove('error');
                statusEl.classList.add('connected');
                statusEl.title = 'Validator connected';
                return true;
            }
        } catch (error) {
            // Ignore - will mark as error
        }
        
        statusEl.classList.remove('connected');
        statusEl.classList.add('error');
        statusEl.title = 'Validator disconnected';
        return false;
    }
    
    // Check IPFS status
    async function checkIpfsStatus() {
        const statusEl = document.getElementById('ipfs-status');
        if (!statusEl) return false;
        
        try {
            // Try local IPFS API
            const response = await fetch('http://localhost:5001/api/v0/id', { 
                method: 'POST',
                mode: 'cors'
            });
            if (response.ok) {
                statusEl.classList.remove('error');
                statusEl.classList.add('connected');
                statusEl.title = 'IPFS daemon connected';
                return true;
            }
        } catch (error) {
            // Ignore - will mark as error
        }
        
        statusEl.classList.remove('connected');
        statusEl.classList.add('error');
        statusEl.title = 'IPFS daemon disconnected';
        return false;
    }
    
    // Check all services
    async function checkAllServices() {
        await Promise.all([
            checkValidatorStatus(),
            checkIpfsStatus()
        ]);
    }
    
    // Load user info and update avatar
    async function loadUserInfo() {
        try {
            const response = await fetch('/system/sling/info.sessionInfo.json', {
                credentials: 'same-origin'
            });
            if (response.ok) {
                const data = await response.json();
                const userID = data.userID;
                const avatar = document.getElementById('user-avatar');
                if (avatar) {
                    if (userID && userID !== 'anonymous') {
                        avatar.textContent = userID.charAt(0).toUpperCase();
                        avatar.title = userID;
                        avatar.style.background = 'linear-gradient(135deg, var(--accent-tertiary), var(--accent-secondary))';
                        avatar.style.color = 'var(--text-primary)';
                    } else {
                        avatar.textContent = '?';
                        avatar.title = 'Not Authenticated';
                        avatar.style.background = 'var(--bg-elevated)';
                        avatar.style.color = 'var(--text-muted)';
                    }
                }
                return userID;
            }
        } catch (error) {
            console.log('Could not load user info:', error);
        }
        return null;
    }
    
    // Load Sling Author wallet address
    async function loadAuthorWallet() {
        try {
            const response = await fetch('/bin/blockchain/content-owner', {
                credentials: 'same-origin'
            });
            if (response.ok) {
                const data = await response.json();
                slingAuthorWallet = data.address;
                console.log('📝 Sling Author wallet:', slingAuthorWallet);
                return slingAuthorWallet;
            }
        } catch (error) {
            console.log('Could not load author wallet:', error);
        }
        return null;
    }
    
    // Setup avatar click handler
    function setupAvatarClick() {
        const avatar = document.getElementById('user-avatar');
        if (avatar) {
            avatar.addEventListener('click', async () => {
                try {
                    const userInfoResponse = await fetch('/system/sling/info.sessionInfo.json', { credentials: 'same-origin' });
                    if (userInfoResponse.ok) {
                        const userInfo = await userInfoResponse.json();
                        let message = `Authenticated User: ${userInfo.userID}`;
                        if (slingAuthorWallet) {
                            message += `\nContent Owner Wallet: ${slingAuthorWallet}`;
                            navigator.clipboard.writeText(slingAuthorWallet).then(() => {
                                console.log('Wallet address copied to clipboard');
                            }).catch(() => {});
                        }
                        alert(message);
                    } else {
                        alert('User not authenticated.');
                    }
                } catch (error) {
                    alert('Could not fetch user info.');
                }
            });
        }
    }
    
    // Initialize header on DOM ready
    async function initHeader() {
        await detectBlockchainMode();
        updateModeBadge();
        await checkAllServices();
        await loadUserInfo();
        await loadAuthorWallet();
        setupAvatarClick();
        
        // Periodic service checks
        setInterval(checkAllServices, 30000);
    }
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeader);
    } else {
        initHeader();
    }
    
    // Export for manual use
    window.BlockchainAEM.initHeader = initHeader;
    window.BlockchainAEM.checkAllServices = checkAllServices;
    window.BlockchainAEM.loadUserInfo = loadUserInfo;
    window.BlockchainAEM.loadAuthorWallet = loadAuthorWallet;
})();

