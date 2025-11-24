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
 * Wallet Manager
 * Handles MetaMask connection, account management, and UI state
 * 
 * Follows standard MetaMask dApp integration patterns:
 * - eth_accounts (silent check for existing connection)
 * - eth_requestAccounts (trigger popup for new connection)
 * - Event listeners for accountsChanged, chainChanged, etc.
 */

(function() {
    'use strict';

    // Global state
    window.OakChainWallet = {
        web3: null,
        contract: null,
        userAccount: null,
        isConnected: false
    };

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * Initialize wallet manager
     * Called after Web3 library has loaded
     */
    window.OakChainWallet.init = function() {
        console.log('🦊 Initializing Wallet Manager...');

        // Check for MetaMask
        if (typeof window.ethereum === 'undefined') {
            console.error('⚠️ MetaMask not detected');
            showAlert('error', '🦊 MetaMask not detected. Please install MetaMask to continue.');
            disablePublish();
            return false;
        }

        // Check for Web3
        if (typeof Web3 === 'undefined') {
            console.error('⚠️ Web3 library not loaded');
            showAlert('error', 'Web3 library failed to load. Please refresh the page.');
            disablePublish();
            return false;
        }

        // Initialize Web3 instance
        window.OakChainWallet.web3 = new Web3(window.ethereum);
        console.log('✅ Web3 instance created');

        // Register MetaMask event listeners
        setupMetaMaskListeners();

        // Register page visibility listeners (re-check connection on tab focus)
        setupVisibilityListeners();

        // Check network
        checkNetwork();

        // Auto-detect existing connection (doesn't trigger popup)
        checkWalletConnection();

        console.log('✅ Wallet Manager initialized');
        return true;
    };

    // ============================================================================
    // METAMASK EVENT LISTENERS
    // ============================================================================

    function setupMetaMaskListeners() {
        // Account changes (user switches accounts in MetaMask)
        window.ethereum.on('accountsChanged', (accounts) => {
            console.log('🔄 Account changed:', accounts[0] || 'disconnected');
            handleAccountsChanged(accounts);
        });

        // Network changes (user switches networks in MetaMask)
        window.ethereum.on('chainChanged', (chainId) => {
            console.log('🔄 Network changed:', chainId);
            // Standard pattern: reload page on network change
            window.location.reload();
        });

        // Connection events (MetaMask connects/disconnects)
        window.ethereum.on('connect', (connectInfo) => {
            console.log('✅ MetaMask connected:', connectInfo);
            checkWalletConnection();
        });

        window.ethereum.on('disconnect', (error) => {
            console.log('❌ MetaMask disconnected:', error);
            handleAccountsChanged([]);
        });
    }

    function setupVisibilityListeners() {
        // Re-check connection when user returns to tab
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && window.ethereum) {
                console.log('👀 Tab visible again, checking connection...');
                checkWalletConnection();
            }
        });
        
        // Re-check connection when window regains focus
        window.addEventListener('focus', () => {
            if (window.ethereum) {
                console.log('👀 Window focused, checking connection...');
                checkWalletConnection();
            }
        });
    }

    // ============================================================================
    // WALLET CONNECTION
    // ============================================================================

    /**
     * Check if wallet is already connected (silent check, no popup)
     * Uses eth_accounts which returns authorized accounts without user interaction
     */
    async function checkWalletConnection() {
        try {
            if (!window.ethereum) {
                console.log('⚠️ MetaMask not found');
                updateUIDisconnected();
                return;
            }

            console.log('🔍 Checking for existing wallet connection...');
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            
            if (accounts && accounts.length > 0) {
                console.log('✅ Wallet already connected:', accounts[0]);
                updateUIConnected(accounts[0]);
            } else {
                console.log('ℹ️ No wallet connected');
                updateUIDisconnected();
            }
        } catch (error) {
            console.error('Error checking wallet connection:', error);
            updateUIDisconnected();
        }
    }

    /**
     * Request wallet connection (triggers MetaMask popup)
     * Uses eth_requestAccounts which prompts user to authorize
     * Exposed globally for onclick attribute
     */
    window.connectWallet = async function() {
        console.log('🦊 User clicked Connect MetaMask');
        
        if (!window.ethereum) {
            showAlert('error', '🦊 MetaMask not detected. Please install MetaMask extension.');
            return;
        }

        // Show loading state
        updateUIConnecting();

        try {
            console.log('📝 Requesting account access...');
            // This will open MetaMask popup
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            if (accounts && accounts.length > 0) {
                console.log('✅ User approved connection:', accounts[0]);
                updateUIConnected(accounts[0]);
                showAlert('success', '✅ MetaMask connected successfully!');
            } else {
                console.warn('⚠️ No accounts returned');
                updateUIDisconnected();
            }
        } catch (error) {
            console.error('❌ Connection failed:', error);
            updateUIDisconnected();
            
            if (error.code === 4001) {
                // User rejected the request
                showAlert('error', '❌ Connection rejected. Please approve the connection in MetaMask.');
            } else if (error.code === -32002) {
                // Request already pending
                showAlert('error', '⏳ Connection request already pending. Please check MetaMask.');
            } else {
                showAlert('error', `❌ Failed to connect: ${error.message}`);
            }
        }
    };

    /**
     * Handle account changes (from MetaMask events or manual checks)
     * This is the single source of truth for account state
     */
    function handleAccountsChanged(accounts) {
        if (accounts && accounts.length > 0) {
            updateUIConnected(accounts[0]);
        } else {
            updateUIDisconnected();
        }
    }

    // ============================================================================
    // NETWORK VALIDATION
    // ============================================================================

    async function checkNetwork() {
        try {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const currentChainId = parseInt(chainId, 16);
            const expectedChainId = window.OakChainConfig.EXPECTED_CHAIN_ID;
            
            if (currentChainId !== expectedChainId) {
                const networkName = expectedChainId === 11155111 ? 'Sepolia' : 'Mainnet';
                showAlert('error', 
                    `⚠️ Wrong Network! Please switch MetaMask to <strong>${networkName} Testnet</strong> (Chain ID: ${expectedChainId})`
                );
            } else {
                console.log('✅ On correct network:', currentChainId);
            }
        } catch (err) {
            console.warn('Failed to check network:', err);
        }
    }

    // ============================================================================
    // UI STATE MANAGEMENT
    // ============================================================================

    function updateUIConnecting() {
        console.log('🔄 UI: Connecting...');
        const statusEl = document.getElementById('walletStatus');
        const statusText = document.getElementById('walletStatusText');
        const addressDisplay = document.getElementById('walletAddressDisplay');
        const connectBtn = document.getElementById('connectWalletBtn');
        const publishBtn = document.getElementById('publishBtn');
        
        if (statusEl) statusEl.className = 'wallet-status connecting';
        if (statusText) statusText.textContent = 'Connecting...';
        if (addressDisplay) addressDisplay.style.display = 'none';
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting...';
        }
        if (publishBtn) publishBtn.disabled = true;
    }

    function updateUIConnected(account) {
        console.log('✅ UI: Connected to', account);
        
        // Update global state
        window.OakChainWallet.userAccount = account;
        window.OakChainWallet.isConnected = true;
        
        // Initialize contract
        const web3 = window.OakChainWallet.web3;
        const config = window.OakChainConfig;
        
        if (web3) {
            window.OakChainWallet.contract = new web3.eth.Contract(
                config.CONTRACT_ABI,
                config.CONTRACT_ADDRESS
            );
            console.log('✅ Contract initialized');
        }
        
        // Update UI elements
        const statusEl = document.getElementById('walletStatus');
        const statusText = document.getElementById('walletStatusText');
        const addressDisplay = document.getElementById('walletAddressDisplay');
        const connectBtn = document.getElementById('connectWalletBtn');
        const publishBtn = document.getElementById('publishBtn');
        const payerDisplay = document.getElementById('payerDisplay');
        
        if (statusEl) statusEl.className = 'wallet-status connected';
        if (statusText) statusText.textContent = 'Connected';
        if (addressDisplay) {
            addressDisplay.textContent = account;
            addressDisplay.style.display = 'block';
        }
        if (connectBtn) connectBtn.style.display = 'none';
        if (publishBtn) publishBtn.disabled = false;
        if (payerDisplay) payerDisplay.textContent = account;
    }

    function updateUIDisconnected() {
        console.log('ℹ️ UI: Disconnected');
        
        // Clear global state
        window.OakChainWallet.userAccount = null;
        window.OakChainWallet.contract = null;
        window.OakChainWallet.isConnected = false;
        
        // Update UI elements
        const statusEl = document.getElementById('walletStatus');
        const statusText = document.getElementById('walletStatusText');
        const addressDisplay = document.getElementById('walletAddressDisplay');
        const connectBtn = document.getElementById('connectWalletBtn');
        const publishBtn = document.getElementById('publishBtn');
        const payerDisplay = document.getElementById('payerDisplay');
        
        if (statusEl) statusEl.className = 'wallet-status disconnected';
        if (statusText) statusText.textContent = 'Not Connected';
        if (addressDisplay) addressDisplay.style.display = 'none';
        if (connectBtn) {
            connectBtn.style.display = 'block';
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect MetaMask';
        }
        if (publishBtn) publishBtn.disabled = true;
        if (payerDisplay) payerDisplay.textContent = 'Connect MetaMask to see your address';
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    function disablePublish() {
        const publishBtn = document.getElementById('publishBtn');
        if (publishBtn) {
            publishBtn.disabled = true;
        }
    }

    function showAlert(type, message) {
        const alertBox = document.getElementById('alertBox');
        if (alertBox) {
            alertBox.className = `alert ${type} show`;
            alertBox.innerHTML = message;
            
            if (type === 'success') {
                setTimeout(() => {
                    alertBox.classList.remove('show');
                }, 10000);
            }
        }
    }

    console.log('✅ Wallet Manager module loaded');

})();

