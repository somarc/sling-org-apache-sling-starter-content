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
 * Server-Sent Events (SSE) Manager for Real-Time Blockchain Updates
 * 
 * Pure HTTP, zero dependencies, works everywhere! 🔥
 * 
 * Architecture:
 * Browser EventSource → GET /api/blockchain/events → SSE stream
 * ↓
 * HttpSegmentStoreSync detects validator changes → OSGi event
 * JcrEventBridge detects /oak-chain changes → OSGi event
 * ↓
 * BlockchainEventStreamServlet receives events → formats as SSE
 * ↓
 * All connected browsers receive updates INSTANTLY!
 */

class BlockchainSSEManager {
    constructor() {
        this.eventSource = null;
        this.reconnectDelay = 1000; // Start at 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.isConnecting = false;
        this.listeners = {
            connected: [],
            epoch: [],
            validator: [],
            proposal: [],
            sync: [],
            content: [],
            status: [],
            heartbeat: [],
            disconnect: []
        };
        
        console.log('🔥 Blockchain SSE Manager initialized');
    }
    
    /**
     * Connect to the SSE endpoint
     */
    connect() {
        if (this.eventSource || this.isConnecting) {
            console.log('SSE: Already connected or connecting');
            return;
        }
        
        this.isConnecting = true;
        const url = '/api/blockchain/events';
        
        console.log(`📡 Connecting to SSE stream: ${url}`);
        
        try {
            this.eventSource = new EventSource(url);
            
            // Connection opened
            this.eventSource.onopen = () => {
                console.log('✅ SSE connection established');
                this.reconnectDelay = 1000; // Reset backoff
                this.isConnecting = false;
                this.trigger('connected', { timestamp: Date.now() });
            };
            
            // Generic message handler (for 'message' events without type)
            this.eventSource.onmessage = (event) => {
                console.log('📥 SSE message:', event.data);
                this.handleGenericMessage(event.data);
            };
            
            // Connection error
            this.eventSource.onerror = (error) => {
                console.error('❌ SSE connection error:', error);
                this.isConnecting = false;
                this.handleDisconnect();
            };
            
            // Typed event handlers
            this.registerEventHandlers();
            
        } catch (error) {
            console.error('Failed to create EventSource:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }
    
    /**
     * Register handlers for typed SSE events
     */
    registerEventHandlers() {
        const eventTypes = ['connected', 'epoch', 'validator', 'proposal', 'sync', 'content', 'status', 'heartbeat'];
        
        eventTypes.forEach(type => {
            this.eventSource.addEventListener(type, (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log(`📨 SSE event [${type}]:`, data);
                    this.trigger(type, data);
                } catch (error) {
                    console.error(`Failed to parse ${type} event:`, error);
                }
            });
        });
    }
    
    /**
     * Handle generic messages (backwards compatibility)
     */
    handleGenericMessage(data) {
        try {
            const parsed = JSON.parse(data);
            this.trigger('content', parsed);
        } catch (error) {
            console.warn('Received non-JSON SSE message:', data);
        }
    }
    
    /**
     * Disconnect from SSE stream
     */
    disconnect() {
        if (this.eventSource) {
            console.log('📴 Disconnecting from SSE stream');
            this.eventSource.close();
            this.eventSource = null;
        }
        this.isConnecting = false;
    }
    
    /**
     * Handle disconnect and schedule reconnect
     */
    handleDisconnect() {
        this.disconnect();
        this.trigger('disconnect', { timestamp: Date.now() });
        this.scheduleReconnect();
    }
    
    /**
     * Schedule automatic reconnection with exponential backoff
     */
    scheduleReconnect() {
        console.log(`🔄 Reconnecting in ${this.reconnectDelay}ms...`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
        
        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }
    
    /**
     * Register event listener
     */
    on(eventType, callback) {
        if (this.listeners[eventType]) {
            this.listeners[eventType].push(callback);
        } else {
            console.warn(`Unknown event type: ${eventType}`);
        }
    }
    
    /**
     * Trigger event to all registered listeners
     */
    trigger(eventType, data) {
        if (this.listeners[eventType]) {
            this.listeners[eventType].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${eventType} listener:`, error);
                }
            });
        }
    }
    
    /**
     * Get connection status
     */
    isConnected() {
        return this.eventSource && this.eventSource.readyState === EventSource.OPEN;
    }
}

// Export for use in other scripts
window.BlockchainSSEManager = BlockchainSSEManager;

