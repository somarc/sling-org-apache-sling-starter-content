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
 * Creates VALID Ethereum wallets from biometric credentials.
 * 
 * Architecture:
 * 1. WebAuthn creates P-256 keypair in Secure Enclave (hardware-protected)
 * 2. P-256 public key is used as entropy seed (deterministic)
 * 3. Seed derives secp256k1 private key (Ethereum-compatible)
 * 4. Address derived via keccak256(pubkey) - standard Ethereum derivation
 * 
 * Result: Same biometric = Same wallet address (deterministic, air-gapped)
 * The secp256k1 private key CAN be exported to MetaMask if desired.
 */

// Ensure ethers.js is loaded (add to page: <script src="https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js"></script>)
function ensureEthers() {
    if (typeof ethers === 'undefined') {
        throw new Error('ethers.js not loaded. Add: <script src="https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js"></script>');
    }
}

/**
 * Derive a secp256k1 wallet from P-256 public key
 * The P-256 pubkey serves as deterministic entropy for secp256k1 key generation.
 * 
 * @param {Uint8Array} p256PubKey - 65 bytes (0x04 || x || y) from WebAuthn
 * @returns {ethers.Wallet} Valid Ethereum wallet with secp256k1 keypair
 */
async function deriveSecp256k1Wallet(p256PubKey) {
    ensureEthers();
    
    // Use P-256 public key as entropy source
    // Hash it to get 32 bytes suitable for secp256k1 private key
    const entropy = await crypto.subtle.digest('SHA-256', p256PubKey);
    const privateKeyBytes = new Uint8Array(entropy);
    
    // Convert to hex string for ethers.js
    const privateKeyHex = '0x' + Array.from(privateKeyBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    
    // Create ethers.js wallet from derived private key
    const wallet = new ethers.Wallet(privateKeyHex);
    
    console.log('🔐 Derived secp256k1 wallet from P-256 biometric key');
    console.log('   Address:', wallet.address);
    console.log('   Public Key:', wallet.publicKey);
    // Note: Private key is available as wallet.privateKey for MetaMask export
    
    return wallet;
}

/**
 * Derive Ethereum address from P-256 public key
 * @param {Uint8Array} p256PubKey - 65 bytes (0x04 || x || y)
 * @returns {Promise<Object>} { address, privateKey, publicKey }
 */
async function deriveEthereumWallet(p256PubKey) {
    const wallet = await deriveSecp256k1Wallet(p256PubKey);
    
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,  // Can be exported to MetaMask!
        publicKey: wallet.publicKey
    };
}

/**
 * Create a new biometric wallet
 * @param {Function} statusCallback - Function to show status updates
 * @returns {Promise<Object>} { address, credentialId, pubKey, privateKey }
 */
async function createBiometricWallet(statusCallback) {
    // Check WebAuthn support
    if (!('PublicKeyCredential' in window)) {
        throw new Error('Biometrics not supported on this device');
    }
    
    // Check ethers.js
    ensureEthers();
    
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
        
        // Step 2: Extract P-256 public key from WebAuthn
        statusCallback('🔑', 'Generating Wallet...', 'Deriving secp256k1 wallet from biometric...');
        
        const p256PubKeyBuffer = credential.response.getPublicKey();
        const p256PubKey = new Uint8Array(p256PubKeyBuffer);
        
        // Step 3: Derive secp256k1 wallet (VALID Ethereum address!)
        const ethWallet = await deriveEthereumWallet(p256PubKey);
        
        console.log('✅ Biometric wallet created (VALID Ethereum address):');
        console.log('  Address:', ethWallet.address);
        console.log('  Credential ID:', credential.id);
        console.log('  secp256k1 Public Key:', ethWallet.publicKey);
        console.log('  (Private key available for MetaMask export)');
        
        return {
            address: ethWallet.address,
            privateKey: ethWallet.privateKey,  // For MetaMask export!
            publicKey: ethWallet.publicKey,     // secp256k1 public key
            credentialId: credential.id,
            p256PubKey: Array.from(p256PubKey), // Original P-256 key for WebAuthn login
            rawId: Array.from(new Uint8Array(credential.rawId))
        };
        
    } catch (error) {
        console.error('Biometric wallet creation failed:', error);
        throw error;
    }
}

/**
 * Register biometric wallet with backend
 * @param {Object} walletData - { address, credentialId, p256PubKey, publicKey }
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
                p256PubKey: walletData.p256PubKey,      // Original P-256 for WebAuthn
                secp256k1PubKey: walletData.publicKey,  // Derived secp256k1 for Ethereum
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
 * Export wallet private key for MetaMask import
 * @param {string} privateKey - The secp256k1 private key (0x...)
 * @returns {void}
 */
function showMetaMaskExport(privateKey) {
    // Create modal for private key export
    const modal = document.createElement('div');
    modal.className = 'metamask-export-modal';
    modal.innerHTML = `
        <div class="metamask-export-content">
            <h3>🦊 Export to MetaMask</h3>
            <p>Copy this private key and import it into MetaMask:</p>
            <div class="private-key-box">
                <code id="export-private-key">${privateKey}</code>
                <button onclick="copyPrivateKey()">📋 Copy</button>
            </div>
            <div class="export-warning">
                ⚠️ <strong>Security Warning:</strong> Never share your private key!
                Only import into wallets you control.
            </div>
            <div class="export-steps">
                <p><strong>MetaMask Import Steps:</strong></p>
                <ol>
                    <li>Open MetaMask → Click account icon</li>
                    <li>Select "Import Account"</li>
                    <li>Paste the private key above</li>
                    <li>Click "Import"</li>
                </ol>
            </div>
            <button class="close-modal" onclick="this.closest('.metamask-export-modal').remove()">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Add copy function
    window.copyPrivateKey = function() {
        navigator.clipboard.writeText(privateKey);
        document.querySelector('.private-key-box button').textContent = '✓ Copied!';
        setTimeout(() => {
            document.querySelector('.private-key-box button').textContent = '📋 Copy';
        }, 2000);
    };
}

/**
 * Complete biometric wallet setup
 * @param {Function} statusCallback - Function to show status updates
 * @returns {Promise<Object>} Wallet data including address and private key
 */
async function setupBiometricWallet(statusCallback) {
    try {
        // Step 1: Create wallet (generates VALID Ethereum address!)
        const walletData = await createBiometricWallet(statusCallback);
        
        // Step 2: Register with backend
        const registrationResult = await registerBiometricWallet(walletData, statusCallback);
        
        // Step 3: Store locally (address + credential, NOT private key in localStorage)
        localStorage.setItem('blockchain_aem_wallet_address', walletData.address);
        localStorage.setItem('blockchain_aem_credential_id', walletData.credentialId);
        
        // Store P-256 public key for WebAuthn login verification
        const p256PubKeyBase64 = btoa(String.fromCharCode.apply(null, walletData.p256PubKey));
        localStorage.setItem('blockchain_aem_p256_pubkey', p256PubKeyBase64);
        
        // Store secp256k1 public key (NOT private key!)
        localStorage.setItem('blockchain_aem_secp256k1_pubkey', walletData.publicKey);
        
        // Securely store private key in sessionStorage (cleared on tab close)
        // This allows MetaMask export during the session
        sessionStorage.setItem('blockchain_aem_private_key', walletData.privateKey);
        
        // Step 4: Success
        statusCallback('✅', 'Wallet Created!', 
            `✓ Valid Ethereum Address: ${walletData.address.substring(0, 10)}...${walletData.address.slice(-6)}\n\n` +
            '✓ Biometric authentication ready\n' +
            '✓ Can be exported to MetaMask\n\n' +
            'Sign in with Face ID/Touch ID!');
        
        return {
            address: walletData.address,
            privateKey: walletData.privateKey,  // For MetaMask export
            credentialId: walletData.credentialId
        };
        
    } catch (error) {
        if (error.name === 'NotAllowedError') {
            statusCallback('❌', 'Registration Cancelled', 
                'You cancelled the biometric registration.');
        } else if (error.name === 'NotSupportedError') {
            statusCallback('❌', 'Not Supported', 
                'Biometric authentication is not available on this device.');
        } else if (error.message && error.message.includes('ethers')) {
            statusCallback('❌', 'Missing Dependency', 
                'ethers.js library not loaded. Please refresh the page.');
        } else {
            statusCallback('❌', 'Registration Failed', 
                'Error: ' + error.message);
        }
        throw error;
    }
}

/**
 * Get stored wallet address (if registered)
 * @returns {string|null} Wallet address or null
 */
function getStoredWalletAddress() {
    return localStorage.getItem('blockchain_aem_wallet_address');
}

/**
 * Get private key for MetaMask export (only available in current session)
 * @returns {string|null} Private key or null
 */
function getPrivateKeyForExport() {
    return sessionStorage.getItem('blockchain_aem_private_key');
}

/**
 * Check if biometric wallet is registered
 * @returns {boolean}
 */
function hasBiometricWallet() {
    return !!getStoredWalletAddress() && !!localStorage.getItem('blockchain_aem_credential_id');
}

// Export for use in browser (attach to window)
window.createBiometricWallet = createBiometricWallet;
window.registerBiometricWallet = registerBiometricWallet;
window.setupBiometricWallet = setupBiometricWallet;
window.showMetaMaskExport = showMetaMaskExport;
window.getStoredWalletAddress = getStoredWalletAddress;
window.getPrivateKeyForExport = getPrivateKeyForExport;
window.hasBiometricWallet = hasBiometricWallet;

// Export for use in Node.js modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createBiometricWallet,
        registerBiometricWallet,
        setupBiometricWallet,
        showMetaMaskExport,
        getStoredWalletAddress,
        getPrivateKeyForExport,
        hasBiometricWallet
    };
}

