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
 * Blockchain AEM Login - Biometric & MetaMask Authentication
 */

(function() {
    'use strict';
    
    // Wait for DOM and BiometricManager
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        console.log('🔐 Blockchain AEM Login initializing...');
        
        // Wait for BiometricManager to be available
        if (typeof BiometricManager === 'undefined') {
            setTimeout(init, 100);
            return;
        }
        
        // Check biometric availability
        checkBiometricAvailability();
        
        // Wire up buttons
        document.getElementById('biometric-signin-btn').addEventListener('click', handleBiometricSignIn);
        document.getElementById('metamask-signin-btn').addEventListener('click', handleMetaMaskSignIn);
    }
    
    /**
     * Check if biometric authentication is available
     */
    async function checkBiometricAvailability() {
        const available = await BiometricManager.isAvailable();
        const biometricBtn = document.getElementById('biometric-signin-btn');
        
        if (!available) {
            biometricBtn.disabled = true;
            biometricBtn.innerHTML = `
                <svg class="button-icon" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                Biometrics Not Available
            `;
            showStatus('Your device doesn\'t support biometric authentication. Use MetaMask instead.', 'error');
        } else {
            console.log('✅ Biometric authentication available');
        }
    }
    
    /**
     * Handle biometric sign-in
     */
    async function handleBiometricSignIn() {
        const button = document.getElementById('biometric-signin-btn');
        const originalHTML = button.innerHTML;
        
        try {
            // Disable button and show loading
            button.disabled = true;
            button.classList.add('loading');
            button.innerHTML = '<span>Initializing...</span>';
            
            showStatus('Preparing biometric authentication...', 'info');
            
            // Get wallet address (from previous registration or MetaMask)
            const walletAddress = await getWalletAddress();
            
            if (!walletAddress) {
                throw new Error('No wallet address found. Please connect MetaMask first.');
            }
            
            // Check if biometric is registered
            const credentialId = localStorage.getItem(`biometric_credential_${walletAddress}`);
            
            if (!credentialId) {
                throw new Error('Biometric not registered for this wallet. Please register first.');
            }
            
            button.innerHTML = '<span>👤 Scan biometric to sign in...</span>';
            showStatus('Please scan your biometric to authenticate', 'info');
            
            // Create authentication challenge
            const challenge = await fetch('/j_security_check?biometric_challenge=true');
            const challengeData = await challenge.json();
            
            // Trigger biometric authentication
            // Note: credentialId from WebAuthn is base64url-encoded, challenge from server is standard base64
            const publicKeyCredentialRequestOptions = {
                challenge: base64ToArrayBuffer(challengeData.challenge),
                allowCredentials: [{
                    id: base64UrlToArrayBuffer(credentialId),  // credential IDs are base64url
                    type: 'public-key'
                }],
                userVerification: 'required',
                timeout: 60000
            };
            
            let assertion;
            try {
                assertion = await navigator.credentials.get({
                    publicKey: publicKeyCredentialRequestOptions
                });
            } catch (error) {
                if (error.name === 'NotAllowedError') {
                    throw new Error('Biometric authentication cancelled');
                }
                throw error;
            }
            
            console.log('✅ Biometric signature obtained');
            showStatus('Verifying signature...', 'info');
            
            // Extract signature
            const signature = arrayBufferToBase64(assertion.response.signature);
            const authenticatorData = arrayBufferToBase64(assertion.response.authenticatorData);
            const clientDataJSON = arrayBufferToBase64(assertion.response.clientDataJSON);
            
            // Submit to Oak-Auth-Web3 login endpoint
            const loginResponse = await fetch('/j_security_check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: walletAddress,
                    credentialId: credentialId,
                    signature: signature,
                    authenticatorData: authenticatorData,
                    clientDataJSON: clientDataJSON,
                    challenge: challengeData.challenge
                })
            });
            
            if (!loginResponse.ok) {
                const error = await loginResponse.json();
                throw new Error(error.message || 'Authentication failed');
            }
            
            // Success!
            showStatus('✅ Authentication successful! Redirecting...', 'success');
            button.innerHTML = '<span>✅ Signed In</span>';
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/content/blockchain-aem/dashboard.html';
            }, 1500);
            
        } catch (error) {
            console.error('❌ Biometric sign-in error:', error);
            showStatus('❌ ' + error.message, 'error');
            button.innerHTML = originalHTML;
            button.disabled = false;
            button.classList.remove('loading');
        }
    }
    
    /**
     * Handle MetaMask sign-in
     */
    async function handleMetaMaskSignIn() {
        const button = document.getElementById('metamask-signin-btn');
        const originalHTML = button.innerHTML;
        
        try {
            button.disabled = true;
            button.classList.add('loading');
            button.innerHTML = '<span>Connecting...</span>';
            
            showStatus('Connecting to MetaMask...', 'info');
            
            if (!window.ethereum) {
                throw new Error('MetaMask not installed. Please install MetaMask extension.');
            }
            
            // Request account access
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            const walletAddress = accounts[0];
            
            if (!walletAddress) {
                throw new Error('No wallet account found');
            }
            
            button.innerHTML = '<span>Sign message to authenticate...</span>';
            showStatus('Please sign the message in MetaMask', 'info');
            
            // Generate sign-in message
            const timestamp = Date.now();
            const message = `Sign in to Blockchain AEM\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\n\nThis signature proves you own this wallet.`;
            
            // Request signature
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, walletAddress]
            });
            
            showStatus('Verifying signature...', 'info');
            
            // Submit to Oak-Auth-Web3 login endpoint
            const loginResponse = await fetch('/j_security_check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: walletAddress,
                    signature: signature,
                    message: message,
                    timestamp: timestamp
                })
            });
            
            if (!loginResponse.ok) {
                const error = await loginResponse.json();
                throw new Error(error.message || 'Authentication failed');
            }
            
            // Success!
            showStatus('✅ Authentication successful! Redirecting...', 'success');
            button.innerHTML = '<span>✅ Signed In</span>';
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/content/blockchain-aem/dashboard.html';
            }, 1500);
            
        } catch (error) {
            console.error('❌ MetaMask sign-in error:', error);
            showStatus('❌ ' + error.message, 'error');
            button.innerHTML = originalHTML;
            button.disabled = false;
            button.classList.remove('loading');
        }
    }
    
    /**
     * Show status message
     */
    function showStatus(message, type) {
        const statusEl = document.getElementById('auth-status');
        const contentEl = statusEl.querySelector('.status-content');
        
        statusEl.className = `auth-status ${type}`;
        contentEl.textContent = message;
        statusEl.hidden = false;
        
        // Auto-hide success/info messages after 5 seconds
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusEl.hidden = true;
            }, 5000);
        }
    }
    
    /**
     * Get wallet address from localStorage or MetaMask
     */
    async function getWalletAddress() {
        // Try localStorage first (from previous registration)
        const storedWallet = localStorage.getItem('blockchain_aem_wallet');
        if (storedWallet) {
            return storedWallet;
        }
        
        // Try MetaMask
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                return accounts[0];
            } catch (error) {
                console.warn('Could not get MetaMask accounts:', error);
            }
        }
        
        return null;
    }
    
    /**
     * Convert base64url to standard base64
     * WebAuthn credential.id is base64url-encoded, but atob() expects standard base64.
     */
    function base64UrlToBase64(base64url) {
        let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        if (pad) {
            base64 += '='.repeat(4 - pad);
        }
        return base64;
    }
    
    /**
     * Base64 to ArrayBuffer
     */
    function base64ToArrayBuffer(base64) {
        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    /**
     * Base64url to ArrayBuffer (for WebAuthn credential IDs)
     */
    function base64UrlToArrayBuffer(base64url) {
        return base64ToArrayBuffer(base64UrlToBase64(base64url));
    }
    
    /**
     * ArrayBuffer to Base64
     */
    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
    
})();

