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
                <div class="user-avatar" id="user-avatar" title="Content Owner Wallet">?</div>
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
        
        // Sign out handler
        const avatar = document.getElementById('user-avatar');
        if (avatar) {
            avatar.addEventListener('click', handleSignOut);
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
        if (!avatar) return;
        
        try {
            const response = await fetch('http://localhost:4502/system/sling/info.sessionInfo.json');
            if (response.ok) {
                const data = await response.json();
                const userId = data.userID || 'anonymous';
                if (userId !== 'anonymous') {
                    avatar.textContent = userId.charAt(0).toUpperCase();
                    avatar.title = userId;
                }
            }
        } catch (error) {
            console.log('Could not load user info');
        }
    }
    
    function handleSignOut() {
        if (confirm('Sign out of Blockchain AEM?')) {
            window.location.href = '/system/sling/logout?resource=/starter.html';
        }
    }
    
})();

