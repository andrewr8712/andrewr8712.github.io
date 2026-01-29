/**
 * EtherDash Pro Terminal v5.0
 * Improved cryptocurrency dashboard with better error handling,
 * modular structure, and enhanced UX.
 */

const EtherDash = (function() {
    'use strict';

    // ================================================
    // CONFIGURATION
    // ================================================
    const COINS = [
        { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', binance: 'btcusdt' },
        { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', binance: 'ethusdt' },
        { id: 'solana', symbol: 'SOL', name: 'Solana', binance: 'solusdt' },
        { id: 'ripple', symbol: 'XRP', name: 'XRP', binance: 'xrpusdt' },
        { id: 'cardano', symbol: 'ADA', name: 'Cardano', binance: 'adausdt' },
        { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', binance: 'dogeusdt' },
        { id: 'pepe', symbol: 'PEPE', name: 'Pepe', binance: 'pepeusdt' }
    ];

    const COIN_IMAGE_IDS = {
        'bitcoin': 1,
        'ethereum': 279,
        'solana': 4128,
        'ripple': 44,
        'cardano': 975,
        'dogecoin': 5,
        'pepe': 29850
    };

    const CONFIG = {
        WEBSOCKET_URL: 'wss://stream.binance.com:9443/stream',
        MAX_RECONNECT_DELAY: 30000,
        CHART_UPDATE_INTERVAL: 1000,
        PORTFOLIO_UPDATE_INTERVAL: 10000,
        GAS_UPDATE_INTERVAL: 15000,
        NEWS_UPDATE_INTERVAL: 300000,
        UI_REFRESH_INTERVAL: 1000,
        WHALE_THRESHOLD_PERCENT: 1.0,
        MAX_PRICE_HISTORY: 50,
        MAX_PORTFOLIO_HISTORY: 100,
        MAX_WHALE_ITEMS: 20
    };

    // ================================================
    // STATE MANAGEMENT
    // ================================================
    const state = {
        currency: 'USD',
        exchangeRate: 1.55,
        prices: {},
        holdings: loadFromStorage('holdings', {}),
        alerts: loadFromStorage('alerts', {}),
        priceHistory: {},
        portfolioHistory: loadFromStorage('portfolioHistory', []),
        charts: {},
        portfolioChart: null,
        initialPortfolioValue: null,
        reconnectAttempts: 0,
        websocket: null,
        currentAlertCoin: null
    };

    // ================================================
    // UTILITY FUNCTIONS
    // ================================================
    function loadFromStorage(key, defaultValue) {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (e) {
            console.warn(`Failed to load ${key} from storage:`, e);
            return defaultValue;
        }
    }

    function saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn(`Failed to save ${key} to storage:`, e);
        }
    }

    function formatPrice(price, currency = state.currency) {
        const rate = currency === 'AUD' ? state.exchangeRate : 1;
        const symbol = currency === 'AUD' ? 'A$' : '$';
        const displayPrice = price * rate;
        
        return `${symbol}${displayPrice.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: price < 1 ? 6 : 4
        })}`;
    }

    function getImageId(coinId) {
        return COIN_IMAGE_IDS[coinId] || 1;
    }

    function safeGetElement(id) {
        return document.getElementById(id);
    }

    // ================================================
    // TOAST NOTIFICATIONS
    // ================================================
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 3000);
    }

    // ================================================
    // MODAL SYSTEM (Replaces prompt())
    // ================================================
    function openAlertModal(coinId) {
        const coin = COINS.find(c => c.id === coinId);
        const priceData = state.prices[coinId];
        
        if (!priceData) {
            showToast('Price data not available yet', 'error');
            return;
        }

        state.currentAlertCoin = coinId;
        
        const modal = safeGetElement('alertModal');
        const title = safeGetElement('modalTitle');
        const currentPrice = safeGetElement('modalCurrentPrice');
        const input = safeGetElement('alertPriceInput');
        
        if (title) title.textContent = `Set Alert for ${coin.name}`;
        if (currentPrice) currentPrice.textContent = formatPrice(priceData.price);
        if (input) {
            input.value = state.alerts[coinId] || '';
            input.focus();
        }
        
        if (modal) {
            modal.classList.add('visible');
        }
    }

    function closeAlertModal() {
        const modal = safeGetElement('alertModal');
        if (modal) {
            modal.classList.remove('visible');
        }
        state.currentAlertCoin = null;
    }

    function confirmAlert() {
        const input = safeGetElement('alertPriceInput');
        const coinId = state.currentAlertCoin;
        
        if (!input || !coinId) return;
        
        const targetPrice = parseFloat(input.value);
        
        if (isNaN(targetPrice) || targetPrice <= 0) {
            showToast('Please enter a valid price', 'error');
            return;
        }
        
        const coin = COINS.find(c => c.id === coinId);
        state.alerts[coinId] = targetPrice;
        saveToStorage('alerts', state.alerts);
        updateAlertButtons();
        
        showToast(`Alert set for ${coin.name} at ${formatPrice(targetPrice)}`, 'success');
        closeAlertModal();
    }

    // Handle Enter key in modal
    function handleModalKeydown(event) {
        if (event.key === 'Enter') {
            confirmAlert();
        } else if (event.key === 'Escape') {
            closeAlertModal();
        }
    }

    // ================================================
    // RENDERING
    // ================================================
    function renderGrid() {
        const grid = safeGetElement('marketGrid');
        if (!grid) return;

        grid.innerHTML = COINS.map(coin => `
            <div class="crypto-card" id="card-${coin.id}">
                <button class="alert-btn" id="btn-alert-${coin.id}" 
                        onclick="EtherDash.openAlertModal('${coin.id}')" 
                        title="Set Price Alert">🔔</button>
                
                <div class="card-header">
                    <div class="coin-info">
                        <img src="https://assets.coingecko.com/coins/images/${getImageId(coin.id)}/large/${coin.id}.png" 
                             class="coin-icon" 
                             onerror="this.style.display='none'"
                             alt="${coin.name}"
                             loading="lazy">
                        <div>
                            <div class="coin-name">${coin.name}</div>
                            <div class="coin-symbol">${coin.symbol}</div>
                        </div>
                    </div>
                    <div class="price-box">
                        <div class="current-price" id="price-${coin.id}">---</div>
                        <div class="price-change" id="change-${coin.id}">--%</div>
                    </div>
                </div>
                
                <div class="chart-area">
                    <canvas id="chart-${coin.id}"></canvas>
                </div>

                <div class="holdings-row">
                    <span style="font-size:12px; color:var(--text-secondary)">Holdings:</span>
                    <input type="number" 
                           class="holdings-input" 
                           id="hold-${coin.id}" 
                           placeholder="0.00" 
                           value="${state.holdings[coin.id] || ''}"
                           step="0.00000001"
                           oninput="EtherDash.updateHolding('${coin.id}', this.value)">
                </div>
                <div class="equity-display" id="equity-${coin.id}">Eq: $0.00</div>
            </div>
        `).join('');
        
        updateAlertButtons();
    }

    function updateAlertButtons() {
        COINS.forEach(coin => {
            const btn = safeGetElement(`btn-alert-${coin.id}`);
            if (btn) {
                if (state.alerts[coin.id]) {
                    btn.classList.add('active');
                    btn.title = `Alert set for ${formatPrice(state.alerts[coin.id])}`;
                } else {
                    btn.classList.remove('active');
                    btn.title = 'Set Price Alert';
                }
            }
        });
    }

    // ================================================
    // DATA FETCHING
    // ================================================
    async function fetchExchangeRate() {
        try {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await response.json();
            state.exchangeRate = data.rates.AUD || 1.55;
        } catch (e) {
            console.error('Exchange rate fetch failed:', e);
        }
    }

    async function fetchFearGreed() {
        const card = safeGetElement('fngCard');
        const valueEl = safeGetElement('fngValue');
        const labelEl = safeGetElement('fngLabel');
        
        try {
            const response = await fetch('https://api.alternative.me/fng/?limit=1');
            const data = await response.json();
            
            if (data?.data?.[0]) {
                const val = parseInt(data.data[0].value);
                const classification = data.data[0].value_classification;
                
                if (valueEl) {
                    valueEl.textContent = val;
                    valueEl.style.color = val > 50 ? '#10b981' : '#ef4444';
                }
                if (labelEl) {
                    labelEl.textContent = `Fear & Greed Index • ${classification}`;
                    labelEl.style.color = '';
                }
                if (card) card.classList.remove('error');
            }
        } catch (e) {
            console.error('Fear & Greed fetch failed:', e);
            if (valueEl) valueEl.textContent = '--';
            if (labelEl) {
                labelEl.textContent = 'API Unavailable';
                labelEl.style.color = '#ef4444';
            }
            if (card) card.classList.add('error');
        }
    }

    async function fetchGas() {
        const card = safeGetElement('gasCard');
        const valueEl = safeGetElement('gasValue');
        
        try {
            // Try Etherscan API first
            let response = await fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle');
            let data = await response.json();
            
            let gasGwei;
            
            if (data?.status === "1" && data?.result?.ProposeGasPrice) {
                gasGwei = parseInt(data.result.ProposeGasPrice);
            } else {
                // Fallback to Cloudflare RPC
                response = await fetch('https://cloudflare-eth.com', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        method: "eth_gasPrice",
                        params: [],
                        id: 1
                    })
                });
                data = await response.json();
                
                if (data?.result) {
                    gasGwei = Math.round(parseInt(data.result, 16) / 1e9);
                } else {
                    throw new Error('Invalid response from RPC');
                }
            }
            
            if (isNaN(gasGwei) || gasGwei <= 0) {
                throw new Error('Invalid gas price value');
            }
            
            if (valueEl) {
                valueEl.textContent = gasGwei;
                
                // Color code by gas price
                if (gasGwei < 30) {
                    valueEl.style.color = '#10b981';
                } else if (gasGwei < 100) {
                    valueEl.style.color = '#f59e0b';
                } else {
                    valueEl.style.color = '#ef4444';
                }
            }
            
            if (card) card.classList.remove('error');
        } catch (e) {
            console.error('Gas fetch failed:', e);
            if (valueEl) {
                valueEl.textContent = '--';
                valueEl.style.color = '#ef4444';
            }
            if (card) card.classList.add('error');
        }
    }

    async function fetchNews() {
        const track = safeGetElement('newsTrack');
        if (!track) return;
        
        try {
            const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.coindesk.com/arc/outboundfeeds/rss/');
            const data = await response.json();
            
            if (data?.items?.length > 0) {
                // Duplicate items for seamless scrolling
                const items = data.items.slice(0, 10);
                const html = items.map(item => `
                    <div class="news-item">
                        <span>${new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        ${item.title}
                    </div>
                `).join('');
                
                // Duplicate for seamless loop
                track.innerHTML = html + html;
            }
        } catch (e) {
            console.error('News fetch failed:', e);
            track.innerHTML = `
                <div class="news-item">
                    <span style="color: var(--accent-red)">⚠</span>
                    News feed unavailable
                </div>
            `;
        }
    }

    // ================================================
    // WEBSOCKET ENGINE
    // ================================================
    function connectWebSocket() {
        // Clean up existing connection
        if (state.websocket) {
            try {
                state.websocket.close();
            } catch (e) {
                // Ignore close errors
            }
            state.websocket = null;
        }

        const streams = COINS.map(c => `${c.binance}@ticker`).join('/');
        
        try {
            state.websocket = new WebSocket(`${CONFIG.WEBSOCKET_URL}?streams=${streams}`);
            
            state.websocket.onopen = () => {
                updateConnectionStatus('connected', 'Live Feed');
                state.reconnectAttempts = 0;
                showToast('Connected to live market data', 'success');
            };

            state.websocket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    
                    // Null safety checks
                    if (!msg?.data?.s) return;
                    
                    const coin = COINS.find(c => c.binance === msg.data.s.toLowerCase());
                    if (coin) {
                        processTick(coin, msg.data);
                    }
                } catch (e) {
                    console.error('Error processing WebSocket message:', e);
                }
            };
            
            state.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                updateConnectionStatus('error', 'Connection Error');
            };
            
            state.websocket.onclose = () => {
                updateConnectionStatus('connecting', 'Reconnecting...');
                
                state.reconnectAttempts++;
                const delay = Math.min(
                    5000 * state.reconnectAttempts, 
                    CONFIG.MAX_RECONNECT_DELAY
                );
                
                setTimeout(connectWebSocket, delay);
            };
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            showToast('Failed to connect to market data', 'error');
            updateConnectionStatus('error', 'Connection Failed');
        }
    }

    function updateConnectionStatus(status, text) {
        const dot = safeGetElement('connectionDot');
        const label = safeGetElement('connectionStatus');
        
        if (dot) {
            dot.className = `connection-dot ${status}`;
        }
        if (label) {
            label.textContent = text;
        }
    }

    function processTick(coin, data) {
        const price = parseFloat(data.c);
        
        // Guard against invalid prices
        if (isNaN(price) || price <= 0) return;
        
        const prevPrice = state.prices[coin.id]?.price || price;

        state.prices[coin.id] = {
            price: price,
            change: parseFloat(data.P) || 0,
            prev: prevPrice
        };

        // Update price history for charts
        if (!state.priceHistory[coin.id]) {
            state.priceHistory[coin.id] = [];
        }
        
        const history = state.priceHistory[coin.id];
        const now = Date.now();
        
        if (!history.length || now - history[history.length - 1].t > CONFIG.CHART_UPDATE_INTERVAL) {
            history.push({ t: now, p: price });
            
            if (history.length > CONFIG.MAX_PRICE_HISTORY) {
                history.shift();
            }
            
            updateChart(coin.id, history);
        }

        // Whale detection
        if (prevPrice > 0) {
            const priceChangePercent = Math.abs((price - prevPrice) / prevPrice) * 100;
            if (priceChangePercent > CONFIG.WHALE_THRESHOLD_PERCENT) {
                logWhaleMovement(coin, price, price > prevPrice, priceChangePercent);
            }
        }
        
        checkPriceAlert(coin, price);
    }

    // ================================================
    // WHALE DETECTION
    // ================================================
    function logWhaleMovement(coin, price, isBuy, changePercent) {
        const list = safeGetElement('whaleList');
        if (!list) return;
        
        // Remove placeholder if exists
        const placeholder = list.querySelector('.whale-placeholder');
        if (placeholder) placeholder.remove();
        
        const item = document.createElement('div');
        item.className = `whale-item ${isBuy ? 'buy' : 'sell'}`;
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between">
                <span>${coin.symbol} ${isBuy ? '↑ PUMP' : '↓ DUMP'}</span>
                <span>${formatPrice(price)}</span>
            </div>
            <div style="color:var(--text-secondary)">${changePercent.toFixed(2)}% movement detected</div>
        `;
        
        list.prepend(item);
        
        // Limit items
        while (list.children.length > CONFIG.MAX_WHALE_ITEMS) {
            list.lastChild.remove();
        }
    }

    // ================================================
    // PRICE ALERTS
    // ================================================
    function checkPriceAlert(coin, price) {
        const targetPrice = state.alerts[coin.id];
        if (!targetPrice) return;
        
        const prevPrice = state.prices[coin.id]?.prev;
        if (!prevPrice) return;
        
        // Check if price crossed the threshold
        const crossedUp = price >= targetPrice && prevPrice < targetPrice;
        const crossedDown = price <= targetPrice && prevPrice > targetPrice;
        
        if (crossedUp || crossedDown) {
            triggerAlert(coin, price, targetPrice);
        }
    }

    function triggerAlert(coin, currentPrice, targetPrice) {
        // Send browser notification
        if (Notification.permission === 'granted') {
            try {
                new Notification(`🚨 ${coin.name} Alert!`, {
                    body: `Price hit ${formatPrice(targetPrice)} (now ${formatPrice(currentPrice)})`,
                    icon: `https://assets.coingecko.com/coins/images/${getImageId(coin.id)}/large/${coin.id}.png`
                });
            } catch (e) {
                console.warn('Notification failed:', e);
            }
        }
        
        // Play alert sound
        playAlertSound();
        
        // Show toast
        showToast(`${coin.name} hit ${formatPrice(targetPrice)}!`, 'info');
        
        // Remove alert after triggering
        delete state.alerts[coin.id];
        saveToStorage('alerts', state.alerts);
        updateAlertButtons();
    }

    function playAlertSound() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            
            const audioContext = new AudioContextClass();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.warn('Alert sound failed:', e);
        }
    }

    function requestNotificationPermission() {
        if (!('Notification' in window)) {
            showToast('Notifications not supported in this browser', 'error');
            return;
        }
        
        if (Notification.permission === 'granted') {
            showToast('Notifications already enabled!', 'success');
            return;
        }
        
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToast('Notifications enabled successfully!', 'success');
                new Notification('EtherDash', {
                    body: 'You will now receive price alerts',
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">⚡</text></svg>'
                });
            } else {
                showToast('Notification permission denied', 'error');
            }
        });
    }

    // ================================================
    // HOLDINGS & PORTFOLIO
    // ================================================
    function updateHolding(coinId, value) {
        const parsed = parseFloat(value);
        
        if (!isNaN(parsed) && parsed >= 0) {
            state.holdings[coinId] = parsed;
        } else if (value === '' || value === null) {
            delete state.holdings[coinId];
        }
        
        saveToStorage('holdings', state.holdings);
    }

    function exportPortfolio() {
        const data = {
            holdings: state.holdings,
            portfolioHistory: state.portfolioHistory,
            alerts: state.alerts,
            exportDate: new Date().toISOString(),
            totalValue: safeGetElement('totalPortfolioValue')?.textContent || '0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etherdash-portfolio-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Portfolio exported successfully!', 'success');
    }

    // ================================================
    // CHARTING
    // ================================================
    function initCharts() {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
            return;
        }
        
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
        
        COINS.forEach(coin => {
            const canvas = safeGetElement(`chart-${coin.id}`);
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            state.charts[coin.id] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array(CONFIG.MAX_PRICE_HISTORY).fill(''),
                    datasets: [{
                        data: [],
                        borderColor: '#3b82f6',
                        tension: 0.4,
                        pointRadius: 0,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { display: false }
                    },
                    animation: false
                }
            });
        });
    }

    function updateChart(coinId, history) {
        const chart = state.charts[coinId];
        if (!chart || !history.length) return;
        
        chart.data.datasets[0].data = history.map(h => h.p);
        
        const isUp = history[history.length - 1].p >= history[0].p;
        chart.data.datasets[0].borderColor = isUp ? '#10b981' : '#ef4444';
        
        chart.update('none');
    }

    function initPortfolioChart() {
        const canvas = safeGetElement('portfolioChart');
        if (!canvas || typeof Chart === 'undefined') return;
        
        const ctx = canvas.getContext('2d');
        state.portfolioChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    borderColor: '#ffffff',
                    tension: 0.4,
                    pointRadius: 0,
                    borderWidth: 2,
                    fill: true,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { display: false }
                },
                animation: false
            }
        });
        
        // Restore historical data
        if (state.portfolioHistory.length > 0) {
            state.portfolioChart.data.labels = state.portfolioHistory.map(() => '');
            state.portfolioChart.data.datasets[0].data = state.portfolioHistory.map(h => h.v);
            state.portfolioChart.update('none');
            state.initialPortfolioValue = state.portfolioHistory[0].v;
        }
    }

    // ================================================
    // MAIN RENDER LOOP
    // ================================================
    function renderLoop() {
        let totalUSD = 0;
        const isAUD = state.currency === 'AUD';
        const rate = isAUD ? state.exchangeRate : 1;
        const symbol = isAUD ? 'A$' : '$';

        COINS.forEach(coin => {
            const priceData = state.prices[coin.id];
            if (!priceData) return;
            
            const displayPrice = priceData.price * rate;
            
            // Update price display
            const elPrice = safeGetElement(`price-${coin.id}`);
            if (elPrice) {
                const formattedPrice = formatPrice(priceData.price);
                
                if (elPrice.textContent !== formattedPrice) {
                    elPrice.textContent = formattedPrice;
                    
                    // Flash effect
                    if (priceData.price > priceData.prev) {
                        elPrice.classList.add('flash-up');
                    } else if (priceData.price < priceData.prev) {
                        elPrice.classList.add('flash-down');
                    }
                    
                    setTimeout(() => {
                        elPrice.classList.remove('flash-up', 'flash-down');
                    }, 500);
                }
            }

            // Update change display
            const elChange = safeGetElement(`change-${coin.id}`);
            if (elChange) {
                const change = priceData.change;
                elChange.textContent = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
                elChange.className = `price-change ${change >= 0 ? 'up' : 'down'}`;
            }

            // Calculate holdings
            const held = state.holdings[coin.id] || 0;
            totalUSD += held * priceData.price;
            
            // Update equity display
            const elEquity = safeGetElement(`equity-${coin.id}`);
            if (elEquity) {
                elEquity.textContent = `Eq: ${symbol}${(held * displayPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            }
        });

        // Update total portfolio value
        const totalDisplay = totalUSD * rate;
        const elTotal = safeGetElement('totalPortfolioValue');
        if (elTotal) {
            elTotal.textContent = `${symbol}${totalDisplay.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        }
        
        // Portfolio change calculation
        updatePortfolioChange(totalUSD);
        
        // Update portfolio chart
        updatePortfolioHistory(totalDisplay);
    }

    function updatePortfolioChange(totalUSD) {
        if (state.portfolioHistory.length === 0 || totalUSD <= 0) return;
        
        const firstValue = state.portfolioHistory[0].v / (state.currency === 'AUD' ? state.exchangeRate : 1);
        if (firstValue <= 0) return;
        
        const changePercent = ((totalUSD - firstValue) / firstValue) * 100;
        
        const elChange = safeGetElement('portfolioChange');
        if (elChange) {
            elChange.style.display = 'block';
            elChange.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
            elChange.className = `portfolio-change ${changePercent >= 0 ? 'up' : 'down'}`;
        }
        
        // Update ambient glow
        const ambientLight = safeGetElement('ambientLight');
        if (ambientLight) {
            if (changePercent > 0) {
                ambientLight.className = 'ambient-glow portfolio-up';
            } else if (changePercent < 0) {
                ambientLight.className = 'ambient-glow portfolio-down';
            } else {
                ambientLight.className = 'ambient-glow';
            }
        }
    }

    function updatePortfolioHistory(totalDisplay) {
        if (totalDisplay <= 0) return;
        
        const now = Date.now();
        const lastEntry = state.portfolioHistory[state.portfolioHistory.length - 1];
        
        if (!lastEntry || now - lastEntry.t > CONFIG.PORTFOLIO_UPDATE_INTERVAL) {
            state.portfolioHistory.push({ t: now, v: totalDisplay });
            
            if (state.portfolioHistory.length > CONFIG.MAX_PORTFOLIO_HISTORY) {
                state.portfolioHistory.shift();
            }
            
            saveToStorage('portfolioHistory', state.portfolioHistory);
            
            if (state.portfolioChart) {
                state.portfolioChart.data.labels = state.portfolioHistory.map(() => '');
                state.portfolioChart.data.datasets[0].data = state.portfolioHistory.map(h => h.v);
                state.portfolioChart.update('none');
            }
            
            if (!state.initialPortfolioValue && state.portfolioHistory.length > 0) {
                state.initialPortfolioValue = state.portfolioHistory[0].v;
            }
        }
    }

    // ================================================
    // VIEW CONTROLS
    // ================================================
    function setCurrency(currency) {
        state.currency = currency;
        
        const btnUSD = safeGetElement('btnUSD');
        const btnAUD = safeGetElement('btnAUD');
        
        if (btnUSD) btnUSD.classList.toggle('active', currency === 'USD');
        if (btnAUD) btnAUD.classList.toggle('active', currency === 'AUD');
    }

    function setView(view) {
        const grid = safeGetElement('marketGrid');
        const btnGrid = safeGetElement('btnGrid');
        const btnList = safeGetElement('btnList');
        
        if (grid) {
            grid.className = `market-grid ${view === 'list' ? 'list-view' : ''}`;
        }
        if (btnGrid) btnGrid.classList.toggle('active', view === 'grid');
        if (btnList) btnList.classList.toggle('active', view === 'list');
    }

    // ================================================
    // INITIALIZATION
    // ================================================
    async function init() {
        renderGrid();
        initCharts();
        initPortfolioChart();
        
        // Set up modal keyboard handlers
        const alertInput = safeGetElement('alertPriceInput');
        if (alertInput) {
            alertInput.addEventListener('keydown', handleModalKeydown);
        }
        
        // Close modal on overlay click
        const modalOverlay = safeGetElement('alertModal');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    closeAlertModal();
                }
            });
        }
        
        // Fetch initial data
        await fetchExchangeRate();
        fetchFearGreed();
        fetchGas();
        fetchNews();
        connectWebSocket();
        
        // Set up intervals
        setInterval(fetchGas, CONFIG.GAS_UPDATE_INTERVAL);
        setInterval(fetchNews, CONFIG.NEWS_UPDATE_INTERVAL);
        setInterval(renderLoop, CONFIG.UI_REFRESH_INTERVAL);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ================================================
    // PUBLIC API
    // ================================================
    return {
        setCurrency,
        setView,
        openAlertModal,
        closeAlertModal,
        confirmAlert,
        updateHolding,
        exportPortfolio,
        requestNotificationPermission
    };

})();
