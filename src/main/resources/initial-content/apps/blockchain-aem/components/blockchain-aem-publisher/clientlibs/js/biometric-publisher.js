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
 * Biometric Publisher Integration
 * Adds Face ID/Touch ID support to oak-chain publisher
 */

(function() {
    'use strict';
    
    // Wait for DOM and BiometricManager to be ready
    function init() {
        if (typeof BiometricManager === 'undefined') {
            console.log('⏳ Waiting for BiometricManager...');
            setTimeout(init, 100);
            return;
        }
        
        console.log('✅ BiometricManager loaded, initializing biometric publisher');
        initBiometricPublisher();
    }
    
    function initBiometricPublisher() {
        // Check if we're on the oak-chain publisher page
        const publishForm = document.getElementById('blockchain-aem-publisher-form') || 
                           document.querySelector('form[data-component="blockchain-aem-publisher"]');
        
        if (!publishForm) {
            console.log('Not on oak-chain publisher page, skipping biometric integration');
            return;
        }
        
        console.log('🔐 Adding biometric features to publisher');
        
        // Add biometric registration section
        addBiometricRegistration(publishForm);
        
        // Add biometric publish button
        addBiometricPublishButton(publishForm);
        
        // Check registration status
        checkBiometricStatus();
    }
    
    function addBiometricRegistration(form) {
        // Create registration container
        const container = document.createElement('div');
        container.className = 'biometric-registration-section';
        container.style.cssText = `
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
            border: 2px dashed #667eea;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
        `;
        
        container.innerHTML = `
            <h3 style="margin-top: 0; color: #667eea;">
                🔐 Biometric Authentication
            </h3>
            <p style="color: #666; margin: 10px 0;">
                Register your device's biometric (Face ID, Touch ID, Windows Hello) to sign write proposals
                without needing MetaMask popups.
            </p>
            <button type="button" id="register-biometric-btn" class="biometric-register-btn"
                    style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                           color: white;
                           border: none;
                           padding: 12px 24px;
                           border-radius: 8px;
                           cursor: pointer;
                           font-size: 14px;
                           font-weight: 600;
                           width: 100%;
                           transition: all 0.3s ease;
                           box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                👤 Register Biometric
            </button>
            <div id="biometric-status" style="margin-top: 12px; font-size: 13px; color: #666;"></div>
        `;
        
        // Insert before form
        form.parentElement.insertBefore(container, form);
        
        // Wire up click handler
        document.getElementById('register-biometric-btn').addEventListener('click', handleRegistration);
    }
    
    function addBiometricPublishButton(form) {
        const publishButton = form.querySelector('button[type="submit"]') || 
                             form.querySelector('#publish-btn');
        
        if (!publishButton) {
            console.warn('Could not find existing publish button');
            return;
        }
        
        // Create biometric publish button
        const biometricButton = document.createElement('button');
        biometricButton.type = 'button';
        biometricButton.id = 'publish-biometric-btn';
        biometricButton.className = 'biometric-publish-btn';
        biometricButton.innerHTML = '👤 Publish with Face ID';
        biometricButton.disabled = true;  // Enabled after registration
        biometricButton.style.cssText = `
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            border: none;
            padding: 16px 32px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 700;
            margin: 10px 0;
            width: 100%;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
        `;
        
        // Insert after regular publish button
        publishButton.parentElement.insertBefore(biometricButton, publishButton.nextSibling);
        
        // Wire up click handler
        biometricButton.addEventListener('click', handleBiometricPublish);
    }
    
    async function handleRegistration() {
        const button = document.getElementById('register-biometric-btn');
        const statusDiv = document.getElementById('biometric-status');
        const originalText = button.innerHTML;
        
        try {
            button.disabled = true;
            button.innerHTML = '⏳ Initializing...';
            statusDiv.textContent = '';
            
            // Get wallet address
            let walletAddress;
            
            // Try Oak-Auth-Web3 session first
            try {
                const sessionResponse = await fetch('/system/sling/info.sessionInfo.json');
                if (sessionResponse.ok) {
                    const sessionData = await sessionResponse.json();
                    if (sessionData.userID && sessionData.userID.startsWith('0x')) {
                        walletAddress = sessionData.userID;
                    }
                }
            } catch (error) {
                console.warn('Could not get wallet from session:', error);
            }
            
            // Fallback to MetaMask
            if (!walletAddress && window.ethereum) {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                walletAddress = accounts[0];
            }
            
            if (!walletAddress) {
                throw new Error('No wallet found. Please connect MetaMask or authenticate with Oak-Auth-Web3.');
            }
            
            statusDiv.innerHTML = `<span style="color: #667eea;">Wallet: ${walletAddress.substring(0, 10)}...</span>`;
            button.innerHTML = '👤 Please scan biometric...';
            
            // Register
            const result = await BiometricManager.register(walletAddress, navigator.platform);
            
            statusDiv.innerHTML = `
                <span style="color: #38ef7d; font-weight: 600;">✅ Registered Successfully!</span><br/>
                <span style="font-size: 12px;">Credential ID: ${result.credentialId.substring(0, 20)}...</span>
            `;
            
            button.innerHTML = '✅ Biometric Registered';
            button.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
            
            // Enable biometric publish button
            const publishBtn = document.getElementById('publish-biometric-btn');
            if (publishBtn) {
                publishBtn.disabled = false;
                publishBtn.title = '';
            }
            
            showToast('✅ Biometric registration successful! You can now publish with Face ID.', 'success');
            
        } catch (error) {
            console.error('Registration error:', error);
            statusDiv.innerHTML = `<span style="color: #f5576c;">❌ ${error.message}</span>`;
            button.innerHTML = originalText;
            showToast('❌ Registration failed: ' + error.message, 'error');
        } finally {
            setTimeout(() => {
                button.disabled = false;
            }, 1000);
        }
    }
    
    async function handleBiometricPublish() {
        const button = document.getElementById('publish-biometric-btn');
        const originalText = button.innerHTML;
        
        try {
            button.disabled = true;
            button.innerHTML = '⏳ Preparing...';
            
            // Get form values
            const path = document.getElementById('path')?.value || 
                        document.querySelector('input[name="path"]')?.value;
            const content = document.getElementById('content')?.value || 
                           document.querySelector('textarea[name="content"]')?.value;
            const tier = parseInt(document.getElementById('tier')?.value || '0');
            
            if (!path || !content) {
                throw new Error('Please fill in path and content fields');
            }
            
            button.innerHTML = '👤 Scan biometric to confirm...';
            
            // Sign with biometric (THE WOW MOMENT!)
            const result = await BiometricManager.signWriteProposal(path, content, tier);
            
            button.innerHTML = '⏳ Submitting to consensus...';
            
            // Show success
            showToast(
                `✅ Write proposal submitted!\n` +
                `Proposal ID: ${result.proposalId || 'N/A'}\n` +
                `Waiting for Aeron consensus...`,
                'success',
                8000
            );
            
            button.innerHTML = '✅ Published!';
            
            // Reset form
            setTimeout(() => {
                document.getElementById('path').value = '';
                document.getElementById('content').value = '';
                button.innerHTML = originalText;
                button.disabled = false;
            }, 3000);
            
        } catch (error) {
            console.error('Biometric publish error:', error);
            showToast('❌ ' + error.message, 'error');
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }
    
    async function checkBiometricStatus() {
        // Get wallet address
        let walletAddress;
        try {
            const sessionResponse = await fetch('/system/sling/info.sessionInfo.json');
            if (sessionResponse.ok) {
                const data = await sessionResponse.json();
                walletAddress = data.userID;
            }
        } catch (error) {
            console.warn('Could not check session:', error);
        }
        
        if (!walletAddress || !walletAddress.startsWith('0x')) {
            return;
        }
        
        // Check if credentialId stored
        const credentialId = localStorage.getItem(`biometric_credential_${walletAddress}`);
        
        if (credentialId) {
            const registerBtn = document.getElementById('register-biometric-btn');
            const publishBtn = document.getElementById('publish-biometric-btn');
            const statusDiv = document.getElementById('biometric-status');
            
            if (registerBtn) {
                registerBtn.innerHTML = '✅ Biometric Registered';
                registerBtn.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
            }
            
            if (publishBtn) {
                publishBtn.disabled = false;
                publishBtn.title = '';
            }
            
            if (statusDiv) {
                statusDiv.innerHTML = `<span style="color: #38ef7d;">✅ Biometric active for wallet</span>`;
            }
        }
    }
    
    function showToast(message, type, duration) {
        const colors = {
            'success': '#38ef7d',
            'error': '#f5576c',
            'warning': '#f093fb',
            'info': '#667eea'
        };
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: white;
            border-left: 4px solid ${colors[type] || colors.info};
            border-radius: 8px;
            padding: 16px 24px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            max-width: 400px;
            white-space: pre-line;
            animation: slideInRight 0.3s ease-out;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, duration || 5000);
    }
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);

