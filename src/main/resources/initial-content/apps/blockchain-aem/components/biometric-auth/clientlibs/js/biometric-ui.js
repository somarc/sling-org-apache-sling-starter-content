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
 * Biometric Authentication UI Integration
 * 
 * Adds biometric authentication buttons and workflows to existing components
 */

(function($, BiometricManager) {
    'use strict';
    
    $(document).ready(function() {
        
        // Add biometric registration button to oak-chain publisher
        if ($('#oak-chain-publisher-form').length > 0) {
            addBiometricFeatures();
        }
        
        // Add biometric authentication indicator to header
        addBiometricIndicator();
    });
    
    /**
     * Add biometric features to oak-chain publisher component
     */
    function addBiometricFeatures() {
        // Add registration button
        const registerButton = $('<button>')
            .attr('type', 'button')
            .attr('id', 'register-biometric-btn')
            .addClass('biometric-register-btn')
            .html('🔐 Register Biometric Auth')
            .css({
                'background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                'color': 'white',
                'border': 'none',
                'padding': '12px 24px',
                'border-radius': '8px',
                'cursor': 'pointer',
                'font-size': '14px',
                'font-weight': '600',
                'margin': '10px 0',
                'width': '100%',
                'transition': 'all 0.3s ease'
            })
            .hover(
                function() { $(this).css('transform', 'translateY(-2px)'); },
                function() { $(this).css('transform', 'translateY(0)'); }
            );
        
        // Add biometric publish button (as alternative to regular publish)
        const biometricPublishButton = $('<button>')
            .attr('type', 'button')
            .attr('id', 'publish-biometric-btn')
            .addClass('biometric-publish-btn')
            .html('👤 Publish with Face ID')
            .css({
                'background': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                'color': 'white',
                'border': 'none',
                'padding': '16px 32px',
                'border-radius': '12px',
                'cursor': 'pointer',
                'font-size': '16px',
                'font-weight': '700',
                'margin': '20px 0 10px 0',
                'width': '100%',
                'transition': 'all 0.3s ease',
                'box-shadow': '0 4px 15px rgba(245, 87, 108, 0.4)'
            })
            .hover(
                function() { 
                    $(this).css({
                        'transform': 'translateY(-3px)',
                        'box-shadow': '0 6px 20px rgba(245, 87, 108, 0.6)'
                    }); 
                },
                function() { 
                    $(this).css({
                        'transform': 'translateY(0)',
                        'box-shadow': '0 4px 15px rgba(245, 87, 108, 0.4)'
                    }); 
                }
            );
        
        // Insert buttons
        $('#oak-chain-publisher-form').prepend(registerButton);
        $('#publish-btn').after(biometricPublishButton);
        
        // Wire up event handlers
        registerButton.on('click', handleBiometricRegistration);
        biometricPublishButton.on('click', handleBiometricPublish);
        
        // Check if already registered
        checkBiometricStatus();
    }
    
    /**
     * Handle biometric registration
     */
    async function handleBiometricRegistration() {
        const button = $('#register-biometric-btn');
        const originalText = button.html();
        
        try {
            button.prop('disabled', true).html('⏳ Initializing...');
            
            // Get wallet address
            const walletAddress = await getWalletAddress();
            if (!walletAddress) {
                showNotification('❌ No wallet connected', 'error');
                return;
            }
            
            button.html('👤 Please scan biometric...');
            
            // Register
            const result = await BiometricManager.register(
                walletAddress,
                navigator.platform
            );
            
            showNotification('✅ Biometric registered successfully!', 'success');
            button.html('✅ Biometric Registered');
            button.removeClass('biometric-register-btn').addClass('biometric-registered-btn');
            
            // Enable biometric publish button
            $('#publish-biometric-btn').prop('disabled', false);
            
        } catch (error) {
            console.error('Registration error:', error);
            showNotification('❌ ' + error.message, 'error');
            button.html(originalText);
        } finally {
            button.prop('disabled', false);
        }
    }
    
    /**
     * Handle biometric publish (THE WOW MOMENT!)
     */
    async function handleBiometricPublish() {
        const button = $('#publish-biometric-btn');
        const originalText = button.html();
        
        try {
            button.prop('disabled', true).html('⏳ Preparing...');
            
            // Get form data
            const path = $('#path').val();
            const content = $('#content').val();
            const tier = parseInt($('#tier').val() || '0');
            
            if (!path || !content) {
                showNotification('❌ Please fill in path and content', 'error');
                return;
            }
            
            button.html('👤 Please scan biometric to confirm...');
            
            // Sign with biometric
            const result = await BiometricManager.signWriteProposal(path, content, tier);
            
            button.html('⏳ Submitting to consensus...');
            
            // Show success
            showNotification(
                `✅ Write proposal submitted!\n` +
                `Proposal ID: ${result.proposalId || 'N/A'}\n` +
                `Waiting for consensus...`,
                'success'
            );
            
            // Poll for confirmation
            if (result.proposalId) {
                pollForConfirmation(result.proposalId);
            }
            
            button.html('✅ Published!');
            setTimeout(() => {
                button.html(originalText).prop('disabled', false);
            }, 3000);
            
        } catch (error) {
            console.error('Biometric publish error:', error);
            showNotification('❌ ' + error.message, 'error');
            button.html(originalText).prop('disabled', false);
        }
    }
    
    /**
     * Check biometric registration status
     */
    async function checkBiometricStatus() {
        try {
            const walletAddress = await getWalletAddress();
            if (!walletAddress) return;
            
            const credentialId = localStorage.getItem(`biometric_credential_${walletAddress}`);
            
            if (credentialId) {
                $('#register-biometric-btn')
                    .html('✅ Biometric Registered')
                    .removeClass('biometric-register-btn')
                    .addClass('biometric-registered-btn')
                    .css('background', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)');
                
                $('#publish-biometric-btn').prop('disabled', false);
            } else {
                $('#publish-biometric-btn')
                    .prop('disabled', true)
                    .attr('title', 'Register biometric first');
            }
        } catch (error) {
            console.warn('Could not check biometric status:', error);
        }
    }
    
    /**
     * Add biometric indicator to header
     */
    function addBiometricIndicator() {
        const indicator = $('<div>')
            .attr('id', 'biometric-indicator')
            .css({
                'position': 'fixed',
                'top': '20px',
                'right': '20px',
                'background': 'rgba(255, 255, 255, 0.95)',
                'border': '2px solid #667eea',
                'border-radius': '12px',
                'padding': '12px 20px',
                'font-size': '14px',
                'font-weight': '600',
                'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.15)',
                'z-index': '9999',
                'display': 'none'
            });
        
        $('body').append(indicator);
        
        // Check biometric availability
        BiometricManager.isAvailable().then(available => {
            if (available) {
                indicator
                    .html('👤 Biometric Auth Available')
                    .css('color', '#667eea')
                    .fadeIn();
            }
        });
    }
    
    /**
     * Poll for write confirmation
     */
    async function pollForConfirmation(proposalId, maxAttempts = 20) {
        let attempts = 0;
        
        const poll = async () => {
            try {
                const response = await fetch(`/bin/blockchain-aem/proposal-status?id=${proposalId}`);
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.confirmed) {
                        showNotification('✅ Write confirmed on oak-chain!', 'success');
                        return;
                    }
                }
            } catch (error) {
                console.warn('Polling error:', error);
            }
            
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(poll, 2000); // Poll every 2 seconds
            } else {
                showNotification('⏰ Confirmation timeout. Check validator dashboard.', 'warning');
            }
        };
        
        poll();
    }
    
    /**
     * Get current wallet address
     */
    async function getWalletAddress() {
        // Try session first (Oak-Auth-Web3)
        try {
            const response = await fetch('/system/sling/info.sessionInfo.json');
            if (response.ok) {
                const data = await response.json();
                if (data.userID && data.userID.startsWith('0x')) {
                    return data.userID;
                }
            }
        } catch (error) {
            console.warn('Session check failed:', error);
        }
        
        // Fallback to MetaMask
        if (window.ethereum) {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            return accounts[0];
        }
        
        return null;
    }
    
    /**
     * Show notification
     */
    function showNotification(message, type) {
        const colors = {
            'success': '#38ef7d',
            'error': '#f5576c',
            'warning': '#f093fb',
            'info': '#667eea'
        };
        
        const notification = $('<div>')
            .css({
                'position': 'fixed',
                'top': '80px',
                'right': '20px',
                'background': 'white',
                'border-left': `4px solid ${colors[type] || colors.info}`,
                'border-radius': '8px',
                'padding': '16px 24px',
                'font-size': '14px',
                'font-weight': '500',
                'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.15)',
                'z-index': '10000',
                'max-width': '400px',
                'white-space': 'pre-line'
            })
            .html(message);
        
        $('body').append(notification);
        
        notification.fadeIn();
        
        setTimeout(() => {
            notification.fadeOut(() => notification.remove());
        }, 5000);
    }
    
})(jQuery, window.BiometricManager);

