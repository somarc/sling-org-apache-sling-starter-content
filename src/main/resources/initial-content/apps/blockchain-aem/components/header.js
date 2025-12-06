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
 * Shared Header Component
 * Injects navigation bar into all Blockchain AEM pages
 */
(function() {
    'use strict';
    
    const CURRENT_PAGE = window.location.pathname;
    
    function isActive(path) {
        return CURRENT_PAGE.includes(path) ? 'active' : '';
    }
    
    const headerHTML = `
        <nav class="top-bar">
            <div class="brand">
                <div class="brand-icon">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5L19 8l-7 3.5L5 8l7-3.5zM4 9.17l7 3.5v7.16l-7-3.5V9.17zm9 10.66v-7.16l7-3.5v7.16l-7 3.5z"/>
                    </svg>
                </div>
                <div class="brand-text">Blockchain <span>AEM</span></div>
            </div>
            
            <div class="nav-links">
                <a href="/content/blockchain-aem/dashboard.html" class="${isActive('dashboard')}">Dashboard</a>
                <a href="/content/blockchain-aem/editor.html" class="${isActive('editor')}">Editor</a>
                <a href="/content/blockchain-aem/viewer.html" class="${isActive('viewer')}">Viewer</a>
                <a href="/content/blockchain-aem/publish.html" class="${isActive('publish')}">Publish</a>
            </div>
            
            <div class="user-section">
                <div class="status-indicators">
                    <div class="status-dot" id="validator-status" title="Validator connection">
                        <span class="dot"></span>
                        <span>Validator</span>
                    </div>
                    <div class="status-dot" id="ipfs-status" title="IPFS connection" style="display: none;">
                        <span class="dot"></span>
                        <svg class="ipfs-logo" width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
                            <path d="M255.9 33L53 127.4v257.2L255.9 479l202.9-94.4V127.4L255.9 33zm0 30.2l165.4 77-165.4 77-165.4-77 165.4-77zM75.5 160l165.4 77v179.4L75.5 339.3V160zm361 0v179.3l-165.4 77.1V239l165.4-79z"/>
                        </svg>
                    </div>
                </div>
                <span class="mode-badge" id="mode-badge">MOCK</span>
                <div class="user-menu-container">
                    <div class="user-avatar" id="user-avatar" title="Click for account details">?</div>
                    <div class="user-dropdown" id="user-dropdown">
                        <div class="dropdown-header">
                            <div class="dropdown-avatar" id="dropdown-avatar">?</div>
                            <div class="dropdown-user-info">
                                <div class="dropdown-username" id="dropdown-username">Loading...</div>
                                <div class="dropdown-role" id="dropdown-role">Content Author</div>
                            </div>
                        </div>
                        <div class="dropdown-divider"></div>
                        <div class="dropdown-section">
                            <div class="dropdown-label">Content Owner Wallet</div>
                            <div class="dropdown-value wallet-value" id="dropdown-wallet">
                                <span id="wallet-display">Not connected</span>
                                <button class="copy-btn-small" id="copy-wallet-btn" title="Copy address">📋</button>
                            </div>
                        </div>
                        <div class="dropdown-section">
                            <div class="dropdown-label">Session</div>
                            <div class="dropdown-value" id="dropdown-session">Active</div>
                        </div>
                        <div class="dropdown-section">
                            <div class="dropdown-label">Mode</div>
                            <div class="dropdown-value">
                                <span class="dropdown-mode-badge" id="dropdown-mode">MOCK</span>
                            </div>
                        </div>
                        <div class="dropdown-divider"></div>
                        <a href="/content/blockchain-aem/register.html" class="dropdown-action">
                            <span>⚙️</span> Account Settings
                        </a>
                        <button class="dropdown-action sign-out" id="sign-out-btn">
                            <span>🚪</span> Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    `;
    
    // Inject header when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectHeader);
    } else {
        injectHeader();
    }
    
    function injectHeader() {
        const placeholder = document.getElementById('blockchain-aem-header');
        if (placeholder) {
            placeholder.outerHTML = headerHTML;
            initializeHeader();
        }
    }
    
    function initializeHeader() {
        // Check validator status
        checkValidatorStatus();
        
        // Load user info
        loadUserInfo();
        
        // Load wallet info
        loadWalletInfo();
        
        // Load mode info
        loadModeInfo();
        
        // Setup dropdown toggle
        const avatar = document.getElementById('user-avatar');
        const dropdown = document.getElementById('user-dropdown');
        if (avatar && dropdown) {
            avatar.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('show');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                dropdown.classList.remove('show');
            });
            
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Sign out handler
        const signOutBtn = document.getElementById('sign-out-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', handleSignOut);
        }
        
        // Copy wallet handler
        const copyBtn = document.getElementById('copy-wallet-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyWalletAddress);
        }
    }
    
    async function checkValidatorStatus() {
        const statusEl = document.getElementById('validator-status');
        if (!statusEl) return;
        
        try {
            const response = await fetch('http://localhost:8090/');
            if (response.ok) {
                statusEl.classList.add('online');
            }
        } catch (error) {
            console.log('Validator offline');
        }
    }
    
    async function loadUserInfo() {
        const avatar = document.getElementById('user-avatar');
        const dropdownAvatar = document.getElementById('dropdown-avatar');
        const dropdownUsername = document.getElementById('dropdown-username');
        const dropdownSession = document.getElementById('dropdown-session');
        
        try {
            const response = await fetch('/system/sling/info.sessionInfo.json');
            if (response.ok) {
                const data = await response.json();
                const userId = data.userID || 'anonymous';
                const initial = userId !== 'anonymous' ? userId.charAt(0).toUpperCase() : '?';
                
                if (avatar) {
                    avatar.textContent = initial;
                    avatar.title = userId;
                }
                if (dropdownAvatar) {
                    dropdownAvatar.textContent = initial;
                }
                if (dropdownUsername) {
                    dropdownUsername.textContent = userId !== 'anonymous' ? userId : 'Not signed in';
                }
                if (dropdownSession) {
                    dropdownSession.textContent = userId !== 'anonymous' ? '✓ Active' : 'No session';
                    dropdownSession.style.color = userId !== 'anonymous' ? '#10b981' : '#6b7280';
                }
            }
        } catch (error) {
            console.log('Could not load user info');
        }
    }
    
    async function loadWalletInfo() {
        const walletDisplay = document.getElementById('wallet-display');
        
        try {
            // Try to get wallet from session
            const response = await fetch('/bin/blockchain/session-info.json');
            if (response.ok) {
                const data = await response.json();
                if (data.contentOwnerWallet) {
                    const wallet = data.contentOwnerWallet;
                    const truncated = wallet.substring(0, 8) + '...' + wallet.substring(wallet.length - 6);
                    if (walletDisplay) {
                        walletDisplay.textContent = truncated;
                        walletDisplay.dataset.fullAddress = wallet;
                    }
                }
            }
        } catch (error) {
            // Wallet not available
            if (walletDisplay) {
                walletDisplay.textContent = 'Not connected';
            }
        }
    }
    
    async function loadModeInfo() {
        const modeBadge = document.getElementById('mode-badge');
        const dropdownMode = document.getElementById('dropdown-mode');
        
        try {
            const response = await fetch('http://localhost:8090/v1/config');
            if (response.ok) {
                const data = await response.json();
                const mode = data.mode || 'MOCK';
                
                if (modeBadge) {
                    modeBadge.textContent = mode;
                    modeBadge.className = 'mode-badge mode-' + mode.toLowerCase();
                }
                if (dropdownMode) {
                    dropdownMode.textContent = mode;
                    dropdownMode.className = 'dropdown-mode-badge mode-' + mode.toLowerCase();
                }
            }
        } catch (error) {
            console.log('Could not load mode info');
        }
    }
    
    function copyWalletAddress() {
        const walletDisplay = document.getElementById('wallet-display');
        const copyBtn = document.getElementById('copy-wallet-btn');
        
        if (walletDisplay && walletDisplay.dataset.fullAddress) {
            navigator.clipboard.writeText(walletDisplay.dataset.fullAddress);
            if (copyBtn) {
                copyBtn.textContent = '✓';
                setTimeout(() => {
                    copyBtn.textContent = '📋';
                }, 1500);
            }
        }
    }
    
    function handleSignOut() {
        window.location.href = '/system/sling/logout?resource=/content/blockchain-aem/register.html';
    }
    
})();

