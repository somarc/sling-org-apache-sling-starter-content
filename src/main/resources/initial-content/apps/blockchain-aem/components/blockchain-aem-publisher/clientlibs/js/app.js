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
 * Oak Chain Publisher - Main Application
 * Initializes all modules and coordinates startup
 */

(function() {
    'use strict';

    console.log('🚀 Oak Chain Publisher starting...');

    /**
     * Wait for Web3 library to load from CDN
     */
    function waitForWeb3(callback) {
        if (typeof Web3 !== 'undefined') {
            callback();
        } else {
            console.log('⏳ Waiting for Web3 library to load...');
            setTimeout(() => waitForWeb3(callback), 100);
        }
    }

    /**
     * Initialize the application
     * Called after DOM is ready and Web3 is loaded
     */
    function initializeApp() {
        console.log('✅ Web3 loaded, initializing dApp...');
        console.log('🔧 Initializing Oak Chain Publisher...');
        
        // Display content owner address
        const config = window.OakChainConfig;
        const contentOwnerDisplay = document.getElementById('contentOwnerDisplay');
        if (contentOwnerDisplay) {
            contentOwnerDisplay.textContent = config.SLING_AUTHOR_ADDRESS;
        }
        
        // Show production banner
        showProductionBanner();
        
        // Initialize wallet manager
        const walletInitialized = window.OakChainWallet.init();
        
        if (walletInitialized) {
            // Initialize form handler
            window.OakChainForm.init();
            
            console.log('✅ App initialized successfully');
        } else {
            console.error('❌ Failed to initialize wallet manager');
        }
    }

    /**
     * Show production mode banner with contract details
     */
    function showProductionBanner() {
        const config = window.OakChainConfig;
        
        const banner = document.createElement('div');
        banner.style.cssText = 'background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border: 2px solid #16a34a; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 0.9rem; color: #14532d;';
        banner.innerHTML = `
            ⛓️ <strong>PRODUCTION MODE</strong> - Connected to Sepolia Testnet<br>
            <div style="margin-top: 8px; font-family: monospace; font-size: 0.85rem;">
                Contract: <strong>${config.CONTRACT_ADDRESS}</strong><br>
                Version: ${config.DEPLOYMENT_VERSION} | Deployed: ${config.DEPLOYMENT_DATE}
            </div>
        `;
        
        const container = document.querySelector('.container');
        const header = document.querySelector('header');
        
        if (container && header) {
            container.insertBefore(banner, header.nextSibling);
        }
    }

    // ============================================================================
    // START APPLICATION
    // ============================================================================

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        // Wait for Web3 library to load, then initialize
        waitForWeb3(function() {
            initializeApp();
        });
    });

    console.log('✅ App module loaded');

})();

