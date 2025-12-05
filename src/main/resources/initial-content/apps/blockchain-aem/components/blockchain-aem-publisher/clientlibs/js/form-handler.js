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
 * Form Handler
 * Manages tier selection, form submission, and blockchain transaction flow
 */

(function() {
    'use strict';

    // Selected tier (0 = Standard, 1 = Express, 2 = Priority)
    let selectedTier = 0;

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * Initialize form handlers
     * Called after DOM is ready and wallet manager is initialized
     */
    window.OakChainForm = {
        init: function() {
            console.log('📋 Initializing Form Handler...');
            
            // Setup form submission handler
            const form = document.getElementById('publishForm');
            if (form) {
                form.addEventListener('submit', handlePublish);
                console.log('✅ Form submission handler registered');
            }

            // Initialize tier selection (select first tier by default)
            selectTier(0);
            
            console.log('✅ Form Handler initialized');
        }
    };

    // ============================================================================
    // TIER SELECTION
    // ============================================================================

    /**
     * Select a publishing tier
     * Exposed globally for onclick attributes
     */
    window.selectTier = function(tier) {
        console.log('📊 Tier selected:', tier);
        selectedTier = tier;
        
        // Update UI
        document.querySelectorAll('.tier-option').forEach((el, index) => {
            el.classList.toggle('selected', index === tier);
        });

        // Update cost summary
        updateCostSummary(tier);
    };

    function selectTier(tier) {
        window.selectTier(tier);
    }

    /**
     * Update the cost summary display
     */
    function updateCostSummary(tier) {
        const config = window.OakChainConfig;
        const web3 = window.OakChainWallet.web3;
        
        const tierName = config.TIER_NAMES[tier];
        
        // Safe check for web3 before using it
        if (web3 && web3.utils) {
            const ethPrice = web3.utils.fromWei(config.TIER_PRICES[tier], 'ether');
            
            const costTierName = document.getElementById('costTierName');
            const costPayment = document.getElementById('costPayment');
            const costTotal = document.getElementById('costTotal');
            
            if (costTierName) costTierName.textContent = tierName;
            if (costPayment) costPayment.textContent = `${ethPrice} ETH`;
            
            // Estimate total with gas
            const totalEstimate = parseFloat(ethPrice) + 0.0005;
            if (costTotal) costTotal.textContent = `~${totalEstimate.toFixed(4)} ETH`;
        }
    }

    // ============================================================================
    // FORM SUBMISSION & BLOCKCHAIN TRANSACTION
    // ============================================================================

    /**
     * Handle publish form submission
     * 1. Validate wallet connection
     * 2. Get form data
     * 3. Call smart contract (payForProposal)
     * 4. Submit content to Oak via Sling servlet
     */
    async function handlePublish(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('🚀 Publish button clicked');

        const wallet = window.OakChainWallet;
        const config = window.OakChainConfig;

        // Validate wallet connection
        if (!wallet.userAccount) {
            showAlert('error', 'Please connect your MetaMask wallet first');
            return false;
        }

        if (!wallet.web3 || !wallet.web3.utils) {
            showAlert('error', 'Web3 not initialized. Please refresh the page and connect MetaMask.');
            return false;
        }

        if (!wallet.contract) {
            console.error('Contract not initialized!', { 
                contract: wallet.contract, 
                address: config.CONTRACT_ADDRESS 
            });
            showAlert('error', 'Contract not initialized. Please refresh the page and reconnect MetaMask.');
            return false;
        }

        // Get form data
        const path = document.getElementById('contentPath').value;
        const title = document.getElementById('contentTitle').value;
        const content = document.getElementById('contentBody').value;

        if (!path || !title || !content) {
            showAlert('error', 'Please fill in all required fields.');
            return false;
        }

        // Generate proposal ID (hash of content path + timestamp)
        const proposalData = path + Date.now();
        const proposalId = wallet.web3.utils.soliditySha3(proposalData);

        console.log('📝 Transaction details:', {
            path,
            proposalId,
            tier: selectedTier,
            price: config.TIER_PRICES[selectedTier]
        });

        try {
            showAlert('info', '⏳ Waiting for MetaMask confirmation...');
            document.getElementById('publishBtn').disabled = true;

            // Call contract payForProposal function
            console.log('⛓️ Calling smart contract...');
            const tx = await wallet.contract.methods.payForProposal(proposalId, selectedTier).send({
                from: wallet.userAccount,
                value: config.TIER_PRICES[selectedTier]
            });
            
            const txHash = tx.transactionHash;
            console.log('✅ Transaction successful:', txHash);
            showAlert('success', `✅ Transaction successful!<div class="tx-hash">Tx: ${txHash}</div>`);

            // Submit content to Oak validators via Sling servlet
            await submitContentToOak(path, title, content, proposalId, txHash);

            // Reset form
            document.getElementById('publishForm').reset();
            selectTier(0);

        } catch (error) {
            console.error('❌ Transaction error:', error);
            
            if (error.code === 4001) {
                showAlert('error', '❌ Transaction rejected by user');
            } else if (error.message) {
                showAlert('error', `❌ Transaction failed: ${error.message}`);
            } else {
                showAlert('error', `❌ Transaction failed: ${JSON.stringify(error)}`);
            }
        } finally {
            document.getElementById('publishBtn').disabled = false;
        }
        
        return false;
    }

    /**
     * Submit content to Oak Chain via Sling servlet
     * This notifies validators about the paid proposal
     */
    async function submitContentToOak(path, title, content, proposalId, txHash) {
        try {
            const config = window.OakChainConfig;
            const wallet = window.OakChainWallet;

            console.log('📤 Submitting content to Oak validators...');

            const response = await fetch('/bin/blockchain/oak-chain-publish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    path: path,
                    title: title,
                    content: content,
                    proposalId: proposalId,
                    txHash: txHash,
                    tier: selectedTier,
                    // Three-address model
                    contentOwner: config.SLING_AUTHOR_ADDRESS,  // Sling Author (content owner)
                    paidBy: wallet.userAccount,                 // MetaMask user (payer)
                    wallet: wallet.userAccount                  // Legacy field for compatibility
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ Content submitted to Oak');
            } else {
                console.warn('⚠️ Content submission warning:', result.message);
            }
        } catch (error) {
            console.error('❌ Failed to submit content to Oak:', error);
        }
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

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

    console.log('✅ Form Handler module loaded');

})();

