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
 * Biometric Wallet Creation for Blockchain AEM
 * 
 * Post-Fusaka (Dec 3, 2025) flow using EIP-7951's P-256 precompile.
 * Creates passkey-based Ethereum accounts where private keys live in hardware.
 * 
 * Flow:
 * 1. WebAuthn credential creation (P-256 keypair in Secure Enclave/Keystore)
 * 2. Derive Ethereum address from public key
 * 3. Register on-chain (optional, via verifier contract)
 * 4. Test signature
 * 5. Activate Oak-Auth-Web3 user
 */

/**
 * Simple keccak256 implementation (for demo - in production use web3.js)
 * @param {Uint8Array} data
 * @returns {string} hex hash
 */
async function keccak256(data) {
    // For demo: return mock address based on pubkey
    // In production, use: ethers.utils.keccak256(data)
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Derive Ethereum address from P-256 public key
 * @param {Uint8Array} pubKey - 65 bytes (0x04 || x || y)
 * @returns {Promise<string>} Ethereum address (0x...)
 */
async function deriveEthereumAddress(pubKey) {
    // Extract coordinates (skip 0x04 prefix)
    const qx = pubKey.slice(1, 33);
    const qy = pubKey.slice(33, 65);
    
    // Concatenate qx || qy
    const combined = new Uint8Array(64);
    combined.set(qx, 0);
    combined.set(qy, 32);
    
    // keccak256(qx || qy) and take last 20 bytes
    const hash = await keccak256(combined);
    
    // For demo: use hash directly as address
    // In production: return '0x' + hash.slice(-40)
    return '0x' + hash.slice(0, 40);
}

/**
 * Create a new biometric wallet
 * @param {Function} statusCallback - Function to show status updates
 * @returns {Promise<Object>} { address, credentialId, pubKey }
 */
async function createBiometricWallet(statusCallback) {
    // Check WebAuthn support
    if (!('PublicKeyCredential' in window)) {
        throw new Error('Biometrics not supported on this device');
    }
    
    statusCallback('🔐', 'Initializing...', 'Preparing biometric registration...');
    
    // Generate challenge (in production, get from server)
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    
    // WebAuthn credential options
    const publicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: {
            name: 'Blockchain AEM',
            id: window.location.hostname
        },
        user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: 'author@blockchain-aem.local',
            displayName: 'AEM Author'
        },
        pubKeyCredParams: [
            {
                alg: -7,  // ES256 (P-256)
                type: 'public-key'
            }
        ],
        authenticatorSelection: {
            authenticatorAttachment: 'platform',  // Prefer platform authenticator
            userVerification: 'required'           // Require biometrics
        },
        timeout: 60000,
        attestation: 'direct'
    };
    
    try {
        // Step 1: Create credential (triggers Face ID/Touch ID prompt)
        statusCallback('👆', 'Scan Biometric', 'Please scan your fingerprint or face...');
        
        const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions
        });
        
        // Step 2: Extract public key
        statusCallback('🔑', 'Generating Wallet...', 'Deriving Ethereum address from public key...');
        
        const pubKeyBuffer = credential.response.getPublicKey();
        const pubKey = new Uint8Array(pubKeyBuffer);
        
        // Step 3: Derive Ethereum address
        const address = await deriveEthereumAddress(pubKey);
        
        console.log('✅ Biometric wallet created:');
        console.log('  Address:', address);
        console.log('  Credential ID:', credential.id);
        console.log('  Public Key:', Array.from(pubKey).map(b => b.toString(16).padStart(2, '0')).join(''));
        
        return {
            address: address,
            credentialId: credential.id,
            pubKey: Array.from(pubKey),
            rawId: Array.from(new Uint8Array(credential.rawId))
        };
        
    } catch (error) {
        console.error('Biometric wallet creation failed:', error);
        throw error;
    }
}

/**
 * Register biometric wallet with backend
 * @param {Object} walletData - { address, credentialId, pubKey }
 * @param {Function} statusCallback - Function to show status updates
 * @returns {Promise<Object>} Registration result
 */
async function registerBiometricWallet(walletData, statusCallback) {
    statusCallback('📡', 'Registering...', 'Registering wallet with validators...');
    
    try {
        const response = await fetch('/bin/blockchain-aem/biometric-register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: walletData.address,
                credentialId: walletData.credentialId,
                pubKey: walletData.pubKey,
                rawId: walletData.rawId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Registration failed');
        }
        
        const result = await response.json();
        
        console.log('✅ Wallet registered:', result);
        
        return result;
        
    } catch (error) {
        console.error('Wallet registration failed:', error);
        throw error;
    }
}

/**
 * Complete biometric wallet setup
 * @param {Function} statusCallback - Function to show status updates
 * @returns {Promise<string>} Wallet address
 */
async function setupBiometricWallet(statusCallback) {
    try {
        // Step 1: Create wallet
        const walletData = await createBiometricWallet(statusCallback);
        
        // Step 2: Register with backend
        const registrationResult = await registerBiometricWallet(walletData, statusCallback);
        
        // Step 3: Store locally
        localStorage.setItem('blockchain_aem_biometric_wallet', walletData.address);
        localStorage.setItem('blockchain_aem_biometric_credential_id', walletData.credentialId);
        // Store public key as base64 for signature verification during login
        const pubKeyBase64 = btoa(String.fromCharCode.apply(null, walletData.pubKey));
        localStorage.setItem('blockchain_aem_biometric_pubkey', pubKeyBase64);
        
        // Step 4: Success
        statusCallback('✅', 'Wallet Created!', 
            'Address: ' + walletData.address.substring(0, 10) + '...' + '\n\n' +
            'Your biometric wallet is ready. You can now sign in with Face ID/Touch ID!');
        
        return walletData.address;
        
    } catch (error) {
        if (error.name === 'NotAllowedError') {
            statusCallback('❌', 'Registration Cancelled', 
                'You cancelled the biometric registration.');
        } else if (error.name === 'NotSupportedError') {
            statusCallback('❌', 'Not Supported', 
                'Biometric authentication is not available on this device. Please use MetaMask instead.');
        } else {
            statusCallback('❌', 'Registration Failed', 
                'Error: ' + error.message);
        }
        throw error;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createBiometricWallet,
        registerBiometricWallet,
        setupBiometricWallet
    };
}

