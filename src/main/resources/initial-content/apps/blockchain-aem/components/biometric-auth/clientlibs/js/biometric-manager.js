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
 * Biometric Authentication Manager for Blockchain AEM
 * 
 * Handles WebAuthn/FIDO2 biometric authentication:
 * - Registration: Link passkey to Ethereum wallet
 * - Authentication: Sign write proposals with Face ID/Touch ID
 * 
 * @requires Web Authentication API (WebAuthn Level 2)
 * @see https://w3c.github.io/webauthn/
 */

(function(window) {
    'use strict';
    
    const BiometricManager = {
        
        /**
         * Check if biometric authentication is available
         */
        isAvailable: async function() {
            if (!window.PublicKeyCredential) {
                console.warn('❌ WebAuthn not supported in this browser');
                return false;
            }
            
            try {
                const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                if (!available) {
                    console.warn('⚠️ No biometric authenticator available (Face ID, Touch ID, Windows Hello)');
                }
                return available;
            } catch (error) {
                console.error('Error checking biometric availability:', error);
                return false;
            }
        },
        
        /**
         * Register a new biometric passkey for the current wallet
         * 
         * @param {string} walletAddress - Ethereum wallet address (0x...)
         * @param {string} deviceName - Optional device identifier
         * @returns {Promise<Object>} Registration result
         */
        register: async function(walletAddress, deviceName) {
            console.log('🔐 Starting biometric registration for wallet:', walletAddress);
            
            if (!await this.isAvailable()) {
                throw new Error('Biometric authentication not available');
            }
            
            // Step 1: Generate WebAuthn credential creation options
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            
            const publicKeyCredentialCreationOptions = {
                challenge: challenge,
                rp: {
                    name: "Blockchain AEM",
                    id: window.location.hostname
                },
                user: {
                    id: this._stringToArrayBuffer(walletAddress),
                    name: walletAddress,
                    displayName: `Wallet ${walletAddress.substring(0, 10)}...`
                },
                pubKeyCredParams: [
                    {
                        type: "public-key",
                        alg: -7  // ES256 (P-256)
                    }
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",  // Device biometric (not USB)
                    userVerification: "required",          // Force biometric
                    residentKey: "preferred"               // Store on device
                },
                timeout: 60000,  // 60 seconds
                attestation: "none"  // No attestation needed for our use case
            };
            
            // Step 2: Trigger biometric prompt (Face ID/Touch ID)
            console.log('👤 Please scan biometric to register passkey...');
            
            let credential;
            try {
                credential = await navigator.credentials.create({
                    publicKey: publicKeyCredentialCreationOptions
                });
            } catch (error) {
                if (error.name === 'NotAllowedError') {
                    throw new Error('User cancelled biometric registration');
                }
                throw new Error('Biometric registration failed: ' + error.message);
            }
            
            console.log('✅ Passkey created successfully:', credential.id);
            
            // Step 3: Extract public key from attestation
            const publicKeyBytes = this._extractPublicKey(credential.response);
            const publicKeyBase64 = this._arrayBufferToBase64(publicKeyBytes);
            
            // Step 4: Sign registration message with wallet (secp256k1)
            // This proves the user owns the wallet
            const registrationMessage = `Register biometric:${walletAddress}:${credential.id}:${publicKeyBase64}`;
            
            let walletSignature;
            if (window.ethereum) {
                try {
                    walletSignature = await window.ethereum.request({
                        method: 'personal_sign',
                        params: [registrationMessage, walletAddress]
                    });
                } catch (error) {
                    throw new Error('Wallet signature failed: ' + error.message);
                }
            } else {
                throw new Error('MetaMask not available for wallet signature');
            }
            
            // Step 5: Submit to backend
            const response = await fetch('/bin/blockchain-aem/register-biometric', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: walletAddress,
                    credentialId: credential.id,
                    publicKey: publicKeyBase64,
                    deviceName: deviceName || navigator.userAgent,
                    walletSignature: walletSignature
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Registration failed');
            }
            
            const result = await response.json();
            console.log('✅ Biometric registration complete:', result);
            
            // Step 6: Store credentialId in localStorage
            this._storeCredentialId(walletAddress, credential.id);
            
            return {
                success: true,
                credentialId: credential.id,
                walletAddress: walletAddress,
                deviceName: deviceName
            };
        },
        
        /**
         * Sign a write proposal with biometric authentication
         * 
         * @param {string} path - JCR path to write to
         * @param {string} content - Content to write
         * @param {number} tier - Payment tier (0=STANDARD, 1=PRIORITY, 2=FINALIZED)
         * @returns {Promise<Object>} Write proposal result
         */
        signWriteProposal: async function(path, content, tier) {
            console.log('✍️ Starting biometric write proposal:', path);
            
            if (!await this.isAvailable()) {
                throw new Error('Biometric authentication not available');
            }
            
            // Get current wallet address (from Oak-Auth-Web3 session)
            const walletAddress = await this._getCurrentWalletAddress();
            if (!walletAddress) {
                throw new Error('Not authenticated with wallet');
            }
            
            // Get stored credentialId
            const credentialId = this._getStoredCredentialId(walletAddress);
            if (!credentialId) {
                throw new Error('No passkey registered for this wallet. Please register first.');
            }
            
            // Step 1: Get challenge from backend
            const challengeResponse = await fetch(
                `/bin/blockchain-aem/propose-write-biometric?path=${encodeURIComponent(path)}&content=${encodeURIComponent(content)}`,
                {
                    method: 'GET'
                }
            );
            
            if (!challengeResponse.ok) {
                const error = await challengeResponse.json();
                throw new Error(error.error || 'Challenge generation failed');
            }
            
            const challengeData = await challengeResponse.json();
            const challengeBytes = this._base64ToArrayBuffer(challengeData.challenge);
            
            console.log('📝 Challenge received, proposalId:', challengeData.proposalId);
            
            // Step 2: Trigger biometric prompt for signing
            console.log('👤 Please scan biometric to approve write...');
            
            // Note: credentialId from WebAuthn is base64url-encoded
            const publicKeyCredentialRequestOptions = {
                challenge: challengeBytes,
                allowCredentials: [{
                    id: this._base64UrlToArrayBuffer(credentialId),  // credential IDs are base64url
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
                    throw new Error('User cancelled biometric authentication');
                }
                throw new Error('Biometric authentication failed: ' + error.message);
            }
            
            console.log('✅ Biometric signature obtained');
            
            // Step 3: Extract signature
            const signature = new Uint8Array(assertion.response.signature);
            const signatureBase64 = this._arrayBufferToBase64(signature);
            
            // Extract public key (from authenticator data)
            const publicKey = this._extractPublicKeyFromAssertion(assertion.response);
            const publicKeyBase64 = this._arrayBufferToBase64(publicKey);
            
            // Step 4: Submit signed proposal
            const proposalResponse = await fetch('/bin/blockchain-aem/propose-write-biometric', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    proposalId: challengeData.proposalId,
                    walletAddress: walletAddress,
                    credentialId: credentialId,
                    signature: signatureBase64,
                    publicKey: publicKeyBase64,
                    challenge: challengeData.challenge,
                    path: path,
                    content: content,
                    tier: tier || 0
                })
            });
            
            if (!proposalResponse.ok) {
                const error = await proposalResponse.json();
                throw new Error(error.error || 'Proposal submission failed');
            }
            
            const result = await proposalResponse.json();
            console.log('✅ Write proposal submitted successfully:', result);
            
            return result;
        },
        
        // ============ Helper Methods ============
        
        _getCurrentWalletAddress: async function() {
            // Try to get from session
            try {
                const response = await fetch('/system/sling/info.sessionInfo.json');
                if (response.ok) {
                    const data = await response.json();
                    const userId = data.userID;
                    if (userId && userId.startsWith('0x')) {
                        return userId;
                    }
                }
            } catch (error) {
                console.warn('Could not get wallet from session:', error);
            }
            
            // Fallback to MetaMask
            if (window.ethereum) {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                return accounts[0];
            }
            
            return null;
        },
        
        _extractPublicKey: function(attestationResponse) {
            // Parse CBOR attestation object to extract public key
            // For simplicity, we'll use a hardcoded extraction
            // In production, use @github/webauthn-json or similar library
            
            const attestationObject = new Uint8Array(attestationResponse.attestationObject);
            // This is simplified - real implementation should properly parse CBOR
            // For now, return the raw response (will be handled server-side)
            return attestationResponse.getPublicKey ? 
                   new Uint8Array(attestationResponse.getPublicKey()) :
                   new Uint8Array(65); // Placeholder
        },
        
        _extractPublicKeyFromAssertion: function(assertionResponse) {
            // For assertions, public key isn't included
            // We need to retrieve it from storage or re-use from registration
            // For now, return a placeholder (real impl would fetch from backend)
            return new Uint8Array(65);
        },
        
        _storeCredentialId: function(walletAddress, credentialId) {
            const key = `biometric_credential_${walletAddress}`;
            localStorage.setItem(key, credentialId);
        },
        
        _getStoredCredentialId: function(walletAddress) {
            const key = `biometric_credential_${walletAddress}`;
            return localStorage.getItem(key);
        },
        
        _stringToArrayBuffer: function(str) {
            return new TextEncoder().encode(str);
        },
        
        _arrayBufferToBase64: function(buffer) {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        },
        
        _base64ToArrayBuffer: function(base64) {
            const binary = window.atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes.buffer;
        },
        
        /**
         * Convert base64url to standard base64
         * WebAuthn credential.id is base64url-encoded, but atob() expects standard base64.
         */
        _base64UrlToBase64: function(base64url) {
            let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
            const pad = base64.length % 4;
            if (pad) {
                base64 += '='.repeat(4 - pad);
            }
            return base64;
        },
        
        /**
         * Base64url to ArrayBuffer (for WebAuthn credential IDs)
         */
        _base64UrlToArrayBuffer: function(base64url) {
            return this._base64ToArrayBuffer(this._base64UrlToBase64(base64url));
        }
    };
    
    // Export to global scope
    window.BiometricManager = BiometricManager;
    
    // Auto-check availability on load
    BiometricManager.isAvailable().then(available => {
        if (available) {
            console.log('✅ Biometric authentication available');
        } else {
            console.warn('⚠️ Biometric authentication not available');
        }
    });
    
})(window);

