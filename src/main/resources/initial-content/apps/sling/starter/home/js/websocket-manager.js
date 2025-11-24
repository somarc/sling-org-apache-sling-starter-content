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
 * WebSocket Manager for Real-Time Blockchain Updates
 * 
 * Handles connection to the Sling WebSocket endpoint and provides
 * event-based interface for blockchain data updates.
 * 
 * Features:
 * - Auto-reconnect on disconnect
 * - Heartbeat/ping to keep connection alive
 * - Topic-based subscriptions
 * - Event emitter pattern for easy integration
 * 
 * Usage:
 * const wsManager = new BlockchainWebSocketManager();
 * wsManager.on('epoch', (data) => {
 *   console.log('New epoch:', data);
 *   updateEpochUI(data);
 * });
 * wsManager.connect();
 */

class BlockchainWebSocketManager {
    constructor(url = null) {
        // Auto-detect WebSocket URL (ws:// or wss:// based on current protocol)
        if (!url) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            url = `${protocol}//${host}/ws/blockchain`;
        }
        
        this.url = url;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 2000; // Start with 2 seconds
        this.pingInterval = null;
        this.eventHandlers = {};
        this.isConnecting = false;
        this.isConnected = false;
        
        // Bind methods
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.send = this.send.bind(this);
        this.on = this.on.bind(this);
        this.off = this.off.bind(this);
    }

    /**
     * Establish WebSocket connection
     */
    connect() {
        if (this.isConnecting || this.isConnected) {
            console.log('🔌 WebSocket already connected or connecting');
            return;
        }

        this.isConnecting = true;
        console.log('🔌 Connecting to WebSocket:', this.url);

        try {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = (event) => {
                console.log('✅ WebSocket connected');
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 2000;
                
                // Start heartbeat
                this.startPing();
                
                // Emit connection event
                this.emit('connected', {});
                
                // Update UI status
                this.updateConnectionStatus(true);
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('📨 WebSocket message:', message);
                    
                    // Emit event based on message type
                    this.emit(message.type, message.data || message);
                    
                    // Special handling for welcome message
                    if (message.type === 'welcome') {
                        console.log('🎉 Welcome message:', message.message);
                        console.log('📡 Available topics:', message.topics);
                    }
                    
                    // Special handling for epoch updates
                    if (message.type === 'epoch') {
                        this.handleEpochUpdate(message.data);
                    }
                    
                    // Special handling for validator updates
                    if (message.type === 'validator') {
                        this.handleValidatorUpdate(message.data);
                    }
                    
                } catch (error) {
                    console.error('❌ Error parsing WebSocket message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.emit('error', { error });
                this.isConnected = false;
                this.isConnecting = false;
                this.updateConnectionStatus(false);
            };

            this.ws.onclose = (event) => {
                console.log('🔌 WebSocket closed:', event.code, event.reason);
                this.isConnected = false;
                this.isConnecting = false;
                this.stopPing();
                this.emit('disconnected', { code: event.code, reason: event.reason });
                this.updateConnectionStatus(false);
                
                // Auto-reconnect
                this.scheduleReconnect();
            };
            
        } catch (error) {
            console.error('❌ Error creating WebSocket:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    /**
     * Disconnect WebSocket
     */
    disconnect() {
        console.log('🔌 Disconnecting WebSocket');
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
        this.stopPing();
        
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        this.updateConnectionStatus(false);
    }

    /**
     * Send message to server
     */
    send(message) {
        if (!this.isConnected || !this.ws) {
            console.warn('⚠️  Cannot send message - not connected');
            return false;
        }

        try {
            const data = typeof message === 'string' ? message : JSON.stringify(message);
            this.ws.send(data);
            return true;
        } catch (error) {
            console.error('❌ Error sending message:', error);
            return false;
        }
    }

    /**
     * Subscribe to a specific topic
     */
    subscribe(topic) {
        console.log('📻 Subscribing to topic:', topic);
        this.send({ subscribe: true, topic: topic });
    }

    /**
     * Unsubscribe from a topic
     */
    unsubscribe(topic) {
        console.log('📻 Unsubscribing from topic:', topic);
        this.send({ unsubscribe: true, topic: topic });
    }

    /**
     * Register event handler
     */
    on(eventType, handler) {
        if (!this.eventHandlers[eventType]) {
            this.eventHandlers[eventType] = [];
        }
        this.eventHandlers[eventType].push(handler);
    }

    /**
     * Remove event handler
     */
    off(eventType, handler) {
        if (!this.eventHandlers[eventType]) return;
        
        const index = this.eventHandlers[eventType].indexOf(handler);
        if (index > -1) {
            this.eventHandlers[eventType].splice(index, 1);
        }
    }

    /**
     * Emit event to all registered handlers
     */
    emit(eventType, data) {
        const handlers = this.eventHandlers[eventType] || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`❌ Error in ${eventType} handler:`, error);
            }
        });
    }

    /**
     * Start ping/pong heartbeat
     */
    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('ping');
            }
        }, 30000); // Ping every 30 seconds
    }

    /**
     * Stop ping/pong heartbeat
     */
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnect attempts reached - giving up');
            this.emit('reconnect-failed', {});
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        
        console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }

    /**
     * Handle epoch update
     */
    handleEpochUpdate(data) {
        console.log('⛓️  New epoch update:', data);
        
        // Show browser notification if supported and permitted
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Ethereum Epoch', {
                body: `Epoch ${data.epochNumber} detected`,
                icon: '/apps/sling/starter/home/images/blockchain-icon.png'
            });
        }
        
        // Play subtle sound (optional)
        this.playNotificationSound();
    }

    /**
     * Handle validator update
     */
    handleValidatorUpdate(data) {
        console.log('🔷 Validator update:', data);
    }

    /**
     * Play subtle notification sound
     */
    playNotificationSound() {
        // Create a subtle beep using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.value = 0.1; // Very quiet
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            // Silently fail if audio not supported
        }
    }

    /**
     * Update connection status indicator in UI
     */
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('ws-status');
        if (statusElement) {
            if (connected) {
                statusElement.textContent = '🟢 Live';
                statusElement.className = 'ws-status connected';
                statusElement.title = 'Connected to blockchain updates';
            } else {
                statusElement.textContent = '🔴 Offline';
                statusElement.className = 'ws-status disconnected';
                statusElement.title = 'Disconnected - attempting to reconnect...';
            }
        }
    }

    /**
     * Request browser notification permission
     */
    static requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('🔔 Notification permission:', permission);
            });
        }
    }
}

// Export for use in other scripts
window.BlockchainWebSocketManager = BlockchainWebSocketManager;

