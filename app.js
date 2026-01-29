/**
 * NovaTerminal Pro Terminal v5.0
 * Improved cryptocurrency dashboard with better error handling,
 * modular structure, and enhanced UX.
 */

const NovaTerminal = (function () {
    'use strict';

    // ================================================
    // CONFIGURATION
    // ================================================
    const COINS = [
        { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', binance: 'btcusdt' },
        { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', binance: 'ethusdt' },
        { id: 'tether', symbol: 'USDT', name: 'Tether', binance: 'usdtusdt' },
        { id: 'binancecoin', symbol: 'BNB', name: 'BNB', binance: 'bnbusdt' },
        { id: 'ripple', symbol: 'XRP', name: 'XRP', binance: 'xrpusdt' },
        { id: 'usd-coin', symbol: 'USDC', name: 'USDC', binance: 'usdcusdt' },
        { id: 'solana', symbol: 'SOL', name: 'Solana', binance: 'solusdt' },
        { id: 'tron', symbol: 'TRX', name: 'TRON', binance: 'trxusdt' },
        { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', binance: 'dogeusdt' },
        { id: 'cardano', symbol: 'ADA', name: 'Cardano', binance: 'adausdt' },
        { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', binance: 'bchusdt' },
        { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', binance: 'linkusdt' },
        { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', binance: 'avaxusdt' },
        { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', binance: 'dotusdt' },
        { id: 'stellar', symbol: 'XLM', name: 'Stellar', binance: 'xlmusdt' },
        { id: 'sui', symbol: 'SUI', name: 'Sui', binance: 'suiusdt' },
        { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', binance: 'ltcusdt' },
        { id: 'pepe', symbol: 'PEPE', name: 'Pepe', binance: 'pepeusdt' }
    ];

    const CONFIG = {
        WEBSOCKET_URL: 'wss://stream.binance.com:9443/stream',
        MAX_RECONNECT_DELAY: 30000,
        CHART_UPDATE_INTERVAL: 1000,
        PORTFOLIO_UPDATE_INTERVAL: 10000,

        NEWS_UPDATE_INTERVAL: 300000,
        UI_REFRESH_INTERVAL: 1000,
        WHALE_THRESHOLD_PERCENT: 1.0,
        MAX_PRICE_HISTORY: 50,
        MAX_PORTFOLIO_HISTORY: 100,
        MAX_VOLATILITY_ITEMS: 20,
        VOLATILITY_THRESHOLD_PERCENT: 3.0,
        VOLATILITY_WINDOW_MS: 300000, // 5 minutes
        SMA_PERIOD: 10,
        RSI_PERIOD: 14
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
        dominanceChart: null,
        initialPortfolioValue: null,
        reconnectAttempts: 0,
        websocket: null,
        currentAlertCoin: null,
        theme: loadFromStorage('theme', 'dark'),
        pendingImportData: null,
        sortBy: 'default',
        coinOrder: loadFromStorage('coinOrder', COINS.map(c => c.id)),
        alertHistory: loadFromStorage('alertHistory', []),
        timeframe: '24h',
        marketData: {},
        dominance: { btc: 0, eth: 0, other: 0 },
        showTA: loadFromStorage('showTA', false),
        lastVolatilityAlert: {},
        coinMetadata: {}
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

    function getCoinImage(coinId) {
        return state.coinMetadata[coinId]?.image || `https://assets.coingecko.com/coins/images/1/large/${coinId}.png`;
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

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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

        const sortedCoins = getSortedCoins();
        grid.innerHTML = sortedCoins.map(coin => `
            <div class="crypto-card" id="card-${coin.id}">
                <button class="alert-btn" id="btn-alert-${coin.id}" 
                        onclick="NovaTerminal.openAlertModal('${coin.id}')" 
                        title="Set Price Alert">🔔</button>
                
                <div class="card-header">
                    <div class="coin-info">
                        <img src="${getCoinImage(coin.id)}" 
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
                
                <div class="market-stats" id="stats-${coin.id}">
                    <span class="stat-pill" id="mcap-${coin.id}">MCap: --</span>
                    <span class="stat-pill" id="vol-${coin.id}">Vol: --</span>
                    <span class="rsi-badge" id="rsi-${coin.id}">RSI: --</span>
                </div>
                
                <div class="range-bar" id="range-bar-${coin.id}">
                    <div class="range-indicator" id="range-ind-${coin.id}" style="left: 50%"></div>
                </div>
                <div class="range-labels">
                    <span id="low-${coin.id}">L: --</span>
                    <span id="high-${coin.id}">H: --</span>
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
                           oninput="NovaTerminal.updateHolding('${coin.id}', this.value)">
                </div>
                <div class="equity-display" id="equity-${coin.id}">Eq: $0.00</div>
            </div>
        `).join('');

        updateAlertButtons();
        initCharts();
        COINS.forEach(coin => setupSparklineTooltips(coin.id));
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
                        ${escapeHTML(item.title)}
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

    async function fetchCoinMetadata() {
        try {
            const ids = COINS.map(c => c.id).join(',');
            const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=100&page=1&sparkline=false`);
            const data = await response.json();

            if (Array.isArray(data)) {
                data.forEach(coin => {
                    state.coinMetadata[coin.id] = {
                        image: coin.image,
                        name: coin.name,
                        symbol: coin.symbol.toUpperCase(),
                        marketCap: coin.market_cap
                    };
                });
                renderGrid(); // Re-render with new images
            }
        } catch (e) {
            console.error('Metadata fetch failed:', e);
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
                    // Reset heartbeat on any message
                    resetHeartbeat();

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

        // Store market data (from Binance 24hr ticker)
        state.marketData[coin.id] = {
            high: parseFloat(data.h) || 0,
            low: parseFloat(data.l) || 0,
            volume: parseFloat(data.v) || 0,
            quoteVolume: parseFloat(data.q) || 0
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

        checkPriceAlert(coin, price);
        checkVolatility(coin, price);
        updateMarketDataDisplay(coin.id);
    }

    function updateMarketDataDisplay(coinId) {
        const data = state.marketData[coinId];
        const price = state.prices[coinId]?.price;
        if (!data || !price) return;

        // Update volume
        const volEl = safeGetElement(`vol-${coinId}`);
        if (volEl) {
            const vol = data.quoteVolume;
            volEl.textContent = `Vol: ${formatVolume(vol)}`;
        }

        // Update high/low labels
        const highEl = safeGetElement(`high-${coinId}`);
        const lowEl = safeGetElement(`low-${coinId}`);
        if (highEl) highEl.textContent = `H: ${formatPrice(data.high)}`;
        if (lowEl) lowEl.textContent = `L: ${formatPrice(data.low)}`;

        // Update range indicator position
        const rangeInd = safeGetElement(`range-ind-${coinId}`);
        if (rangeInd && data.high > data.low) {
            const range = data.high - data.low;
            const position = ((price - data.low) / range) * 100;
            rangeInd.style.left = `${Math.max(0, Math.min(100, position))}%`;
        }

        // Update RSI
        const rsiEl = safeGetElement(`rsi-${coinId}`);
        if (rsiEl) {
            if (state.showTA) {
                const rsi = calculateRSI(state.priceHistory[coinId], CONFIG.RSI_PERIOD);
                if (rsi !== null) {
                    rsiEl.textContent = `RSI: ${rsi.toFixed(1)}`;
                    rsiEl.style.display = 'inline-block';

                    // Color coding
                    rsiEl.classList.remove('overbought', 'oversold');
                    if (rsi >= 70) rsiEl.classList.add('overbought');
                    else if (rsi <= 30) rsiEl.classList.add('oversold');
                } else {
                    rsiEl.textContent = 'RSI: --';
                    rsiEl.style.display = 'inline-block';
                }
            } else {
                rsiEl.style.display = 'none';
            }
        }
    }

    function formatVolume(vol) {
        if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
        if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
        if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
        return `$${vol.toFixed(0)}`;
    }

    // ================================================
    // VOLATILITY DETECTION
    // ================================================
    function checkVolatility(coin, currentPrice) {
        const history = state.priceHistory[coin.id];
        if (!history || history.length < 2) return;

        const now = Date.now();
        const windowStart = now - CONFIG.VOLATILITY_WINDOW_MS;

        // Find the oldest price within the window
        const basePoint = history.find(p => p.t >= windowStart);
        if (!basePoint) return;

        const basePrice = basePoint.p;
        const changePercent = ((currentPrice - basePrice) / basePrice) * 100;

        if (Math.abs(changePercent) >= CONFIG.VOLATILITY_THRESHOLD_PERCENT) {
            // Check if we already alerted for this burst recently
            const lastAlert = state.lastVolatilityAlert?.[coin.id];
            if (!lastAlert || now - lastAlert > 60000) { // Max one alert per minute per coin
                logVolatility(coin, currentPrice, changePercent);
                if (!state.lastVolatilityAlert) state.lastVolatilityAlert = {};
                state.lastVolatilityAlert[coin.id] = now;
            }
        }
    }

    function logVolatility(coin, price, changePercent) {
        const list = safeGetElement('volatilityList');
        if (!list) return;

        // Remove placeholder if exists
        const placeholder = list.querySelector('.volatility-placeholder');
        if (placeholder) placeholder.remove();

        const item = document.createElement('div');
        const isPump = changePercent > 0;
        item.className = `volatility-item ${isPump ? 'buy' : 'sell'}`;
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between">
                <span>${coin.symbol} ${isPump ? '🚀 SPIKE' : '📉 CRASH'}</span>
                <span>${formatPrice(price)}</span>
            </div>
            <div style="color:var(--text-secondary)">${Math.abs(changePercent).toFixed(2)}% move in 5m</div>
        `;

        list.prepend(item);

        // Toast for major volatility
        showToast(`${coin.symbol} is moving fast: ${changePercent.toFixed(2)}%!`, 'info');

        // Play subtle alert sound if over 5%
        if (Math.abs(changePercent) > 5) {
            playAlertSound(getSelectedAlertSound());
        }

        // Limit items
        while (list.children.length > CONFIG.MAX_VOLATILITY_ITEMS) {
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
        playAlertSound(getSelectedAlertSound());

        // Show toast
        showToast(`${coin.name} hit ${formatPrice(targetPrice)}!`, 'info');

        // Add to alert history
        addToAlertHistory(coin, currentPrice, targetPrice);

        // Remove alert after triggering
        delete state.alerts[coin.id];
        saveToStorage('alerts', state.alerts);
        updateAlertButtons();
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
                new Notification('NovaTerminal', {
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
        a.download = `novaterminal-portfolio-${new Date().toISOString().split('T')[0]}.json`;
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

            // Destroy existing chart if it exists
            if (state.charts[coin.id]) {
                state.charts[coin.id].destroy();
            }

            const ctx = canvas.getContext('2d');
            const datasets = [{
                label: 'Price',
                data: [],
                borderColor: '#3b82f6',
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 2
            }];

            if (state.showTA) {
                datasets.push({
                    label: `SMA ${CONFIG.SMA_PERIOD}`,
                    data: [],
                    borderColor: 'rgba(245, 158, 11, 0.5)',
                    borderDash: [5, 5],
                    tension: 0.4,
                    pointRadius: 0,
                    borderWidth: 1.5
                });
            }

            state.charts[coin.id] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array(CONFIG.MAX_PRICE_HISTORY).fill(''),
                    datasets: datasets
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

        const prices = history.map(h => h.p);
        chart.data.datasets[0].data = prices;

        const isUp = prices[prices.length - 1] >= prices[0];
        chart.data.datasets[0].borderColor = isUp ? '#10b981' : '#ef4444';

        if (state.showTA && chart.data.datasets[1]) {
            chart.data.datasets[1].data = calculateSMA(prices, CONFIG.SMA_PERIOD);
        }

        chart.update('none');
    }

    // ================================================
    // TA CALCULATIONS
    // ================================================
    function calculateSMA(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push(null);
            } else {
                const slice = data.slice(i - period + 1, i + 1);
                const sum = slice.reduce((a, b) => a + b, 0);
                result.push(sum / period);
            }
        }
        return result;
    }

    function calculateRSI(history, period = 14) {
        if (!history || history.length <= period) return null;
        const prices = history.map(h => h.p);

        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        for (let i = period + 1; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            const gain = diff >= 0 ? diff : 0;
            const loss = diff < 0 ? -diff : 0;

            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
        }

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    function toggleTA() {
        state.showTA = !state.showTA;
        saveToStorage('showTA', state.showTA);

        // Update UI button state
        const btn = safeGetElement('btnTA');
        if (btn) {
            btn.classList.toggle('active-ta', state.showTA);
        }

        // Re-init all charts to add/remove SMA dataset
        initCharts();

        // Update RSI displays
        COINS.forEach(c => updateMarketDataDisplay(c.id));

        showToast(`TA Overlays ${state.showTA ? 'Enabled' : 'Disabled'}`, 'info');
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
                const equityValue = `Eq: ${symbol}${(held * displayPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                if (elEquity.textContent !== equityValue) {
                    elEquity.textContent = equityValue;
                }
            }
        });

        // Update total portfolio value
        const totalDisplay = totalUSD * rate;
        const elTotal = safeGetElement('totalPortfolioValue');
        if (elTotal) {
            const totalText = `${symbol}${totalDisplay.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            if (elTotal.textContent !== totalText) {
                elTotal.textContent = totalText;
            }
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

    // ================================================
    // TIMEFRAME SELECTOR
    // ================================================
    function setTimeframe(tf) {
        state.timeframe = tf;

        // Update button states
        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tf === tf);
        });

        // The change display will update in renderLoop based on timeframe
        showToast(`Showing ${tf} change`, 'success');
    }

    // ================================================
    // DOMINANCE CHART
    // ================================================
    async function fetchDominance() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/global');
            const data = await response.json();

            if (data?.data?.market_cap_percentage) {
                const btc = data.data.market_cap_percentage.btc || 0;
                const eth = data.data.market_cap_percentage.eth || 0;
                const other = 100 - btc - eth;

                state.dominance = { btc, eth, other };
                updateDominanceChart();
                updateDominanceLegend();
            }
        } catch (e) {
            console.error('Dominance fetch failed:', e);
        }
    }

    function initDominanceChart() {
        const canvas = safeGetElement('dominanceChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        state.dominanceChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['BTC', 'ETH', 'Other'],
                datasets: [{
                    data: [50, 20, 30],
                    backgroundColor: ['#f7931a', '#627eea', '#6b7280'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                cutout: '60%'
            }
        });
    }

    function updateDominanceChart() {
        if (!state.dominanceChart) return;

        state.dominanceChart.data.datasets[0].data = [
            state.dominance.btc,
            state.dominance.eth,
            state.dominance.other
        ];
        state.dominanceChart.update('none');
    }

    function updateDominanceLegend() {
        const legend = safeGetElement('dominanceLegend');
        if (!legend) return;

        legend.innerHTML = `
            <div class="dominance-legend-item">
                <span class="dot" style="background: #f7931a"></span>
                BTC ${state.dominance.btc.toFixed(1)}%
            </div>
            <div class="dominance-legend-item">
                <span class="dot" style="background: #627eea"></span>
                ETH ${state.dominance.eth.toFixed(1)}%
            </div>
            <div class="dominance-legend-item">
                <span class="dot" style="background: #6b7280"></span>
                Other ${state.dominance.other.toFixed(1)}%
            </div>
        `;
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
    // SORTING
    // ================================================
    function sortCoins(sortBy) {
        state.sortBy = sortBy;
        renderGrid();
    }

    function getSortedCoins() {
        let coins = [...COINS];

        if (state.sortBy === 'default') {
            // Use custom order if available
            coins.sort((a, b) => {
                const orderA = state.coinOrder.indexOf(a.id);
                const orderB = state.coinOrder.indexOf(b.id);
                return orderA - orderB;
            });
        } else {
            coins.sort((a, b) => {
                const priceA = state.prices[a.id]?.price || 0;
                const priceB = state.prices[b.id]?.price || 0;
                const changeA = state.prices[a.id]?.change || 0;
                const changeB = state.prices[b.id]?.change || 0;
                const valueA = (state.holdings[a.id] || 0) * priceA;
                const valueB = (state.holdings[b.id] || 0) * priceB;

                switch (state.sortBy) {
                    case 'price-desc': return priceB - priceA;
                    case 'price-asc': return priceA - priceB;
                    case 'change-desc': return changeB - changeA;
                    case 'change-asc': return changeA - changeB;
                    case 'value-desc': return valueB - valueA;
                    case 'name-asc': return a.name.localeCompare(b.name);
                    default: return 0;
                }
            });
        }

        return coins;
    }

    // ================================================
    // DRAG & DROP
    // ================================================
    function setupDragDrop() {
        const cards = document.querySelectorAll('.crypto-card');

        cards.forEach(card => {
            card.setAttribute('draggable', 'true');

            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', card.id);
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                document.querySelectorAll('.crypto-card').forEach(c => c.classList.remove('drag-over'));
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = document.querySelector('.dragging');
                if (dragging && dragging !== card) {
                    card.classList.add('drag-over');
                }
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');

                const draggedId = e.dataTransfer.getData('text/plain');
                const draggedCard = document.getElementById(draggedId);

                if (draggedCard && draggedCard !== card) {
                    const grid = safeGetElement('marketGrid');
                    const cards = Array.from(grid.children);
                    const draggedIndex = cards.indexOf(draggedCard);
                    const targetIndex = cards.indexOf(card);

                    if (draggedIndex < targetIndex) {
                        card.after(draggedCard);
                    } else {
                        card.before(draggedCard);
                    }

                    // Update order in state
                    const newOrder = Array.from(grid.children).map(c => c.id.replace('card-', ''));
                    state.coinOrder = newOrder;
                    saveToStorage('coinOrder', newOrder);

                    // Reset sort to default to respect custom order
                    state.sortBy = 'default';
                    const sortSelect = safeGetElement('sortSelect');
                    if (sortSelect) sortSelect.value = 'default';

                    showToast('Card order updated', 'success');
                }
            });
        });
    }

    // ================================================
    // ALERT HISTORY
    // ================================================
    function addToAlertHistory(coin, price, targetPrice) {
        const entry = {
            coinId: coin.id,
            coinName: coin.name,
            coinSymbol: coin.symbol,
            price: price,
            targetPrice: targetPrice,
            timestamp: Date.now()
        };

        state.alertHistory.unshift(entry);

        // Limit history to 20 items
        if (state.alertHistory.length > 20) {
            state.alertHistory.pop();
        }

        saveToStorage('alertHistory', state.alertHistory);
        renderAlertHistory();
    }

    function renderAlertHistory() {
        const list = safeGetElement('alertHistoryList');
        if (!list) return;

        if (state.alertHistory.length === 0) {
            list.innerHTML = '<div class="empty-state">No alerts triggered yet</div>';
            return;
        }

        list.innerHTML = state.alertHistory.map(entry => {
            const time = new Date(entry.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
            const date = new Date(entry.timestamp).toLocaleDateString([], {
                month: 'short',
                day: 'numeric'
            });

            return `
                <div class="alert-history-item">
                    <div class="time">${date} ${time}</div>
                    <div>${entry.coinSymbol} hit ${formatPrice(entry.targetPrice)}</div>
                </div>
            `;
        }).join('');
    }

    function clearAlertHistory() {
        state.alertHistory = [];
        saveToStorage('alertHistory', []);
        renderAlertHistory();
        showToast('Alert history cleared', 'success');
    }

    // ================================================
    // THEME TOGGLE
    // ================================================
    function toggleTheme() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme();
        saveToStorage('theme', state.theme);
        showToast(`Switched to ${state.theme} mode`, 'success');
    }

    function applyTheme() {
        const root = document.documentElement;
        const darkIcon = safeGetElement('themeIconDark');
        const lightIcon = safeGetElement('themeIconLight');

        if (state.theme === 'light') {
            root.classList.add('light');
            if (darkIcon) darkIcon.style.display = 'none';
            if (lightIcon) lightIcon.style.display = 'block';
        } else {
            root.classList.remove('light');
            if (darkIcon) darkIcon.style.display = 'block';
            if (lightIcon) lightIcon.style.display = 'none';
        }
    }

    // ================================================
    // IMPORT PORTFOLIO
    // ================================================
    function openImportModal() {
        const modal = safeGetElement('importModal');
        if (modal) {
            modal.classList.add('visible');
            setupDropZone();
        }
    }

    function closeImportModal() {
        const modal = safeGetElement('importModal');
        const preview = safeGetElement('importPreview');
        const confirmBtn = safeGetElement('confirmImportBtn');

        if (modal) modal.classList.remove('visible');
        if (preview) preview.style.display = 'none';
        if (confirmBtn) confirmBtn.disabled = true;

        state.pendingImportData = null;
    }

    function setupDropZone() {
        const dropZone = safeGetElement('fileDropZone');
        if (!dropZone) return;

        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        };

        dropZone.ondragleave = () => {
            dropZone.classList.remove('drag-over');
        };

        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) handleImportFile(file);
        };
    }

    function handleImportFile(file) {
        if (!file || !file.name.endsWith('.json')) {
            showToast('Please select a valid JSON file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                validateAndPreviewImport(data);
            } catch (err) {
                showToast('Invalid JSON file', 'error');
            }
        };
        reader.readAsText(file);
    }

    function validateAndPreviewImport(data) {
        const preview = safeGetElement('importPreview');
        const previewContent = safeGetElement('importPreviewContent');
        const confirmBtn = safeGetElement('confirmImportBtn');

        if (!data.holdings && !data.alerts && !data.portfolioHistory) {
            showToast('No valid portfolio data found', 'error');
            return;
        }

        state.pendingImportData = data;

        if (previewContent) {
            previewContent.innerHTML = '';
            const ul = document.createElement('ul');
            ul.style.fontSize = '12px';
            ul.style.color = 'var(--text-secondary)';
            ul.style.listStyle = 'none';

            if (data.holdings && Object.keys(data.holdings).length > 0) {
                const li = document.createElement('li');
                li.textContent = `✓ Holdings: ${Object.keys(data.holdings).length} coins`;
                ul.appendChild(li);
            }
            if (data.alerts && Object.keys(data.alerts).length > 0) {
                const li = document.createElement('li');
                li.textContent = `✓ Alerts: ${Object.keys(data.alerts).length} active`;
                ul.appendChild(li);
            }
            if (data.portfolioHistory && data.portfolioHistory.length > 0) {
                const li = document.createElement('li');
                li.textContent = `✓ History: ${data.portfolioHistory.length} data points`;
                ul.appendChild(li);
            }
            if (data.exportDate) {
                const li = document.createElement('li');
                li.style.marginTop = '8px';
                li.style.color = 'var(--text-muted)';
                li.textContent = `Exported: ${new Date(data.exportDate).toLocaleString()}`;
                ul.appendChild(li);
            }
            previewContent.appendChild(ul);
        }

        if (preview) preview.style.display = 'block';
        if (confirmBtn) confirmBtn.disabled = false;
    }

    function confirmImport() {
        if (!state.pendingImportData) return;

        const data = state.pendingImportData;

        // Merge holdings
        if (data.holdings) {
            state.holdings = { ...state.holdings, ...data.holdings };
            saveToStorage('holdings', state.holdings);
        }

        // Merge alerts
        if (data.alerts) {
            state.alerts = { ...state.alerts, ...data.alerts };
            saveToStorage('alerts', state.alerts);
        }

        // Replace portfolio history if newer
        if (data.portfolioHistory && data.portfolioHistory.length > 0) {
            state.portfolioHistory = data.portfolioHistory;
            saveToStorage('portfolioHistory', state.portfolioHistory);
        }

        // Re-render UI
        renderGrid();
        updateAlertButtons();

        showToast('Portfolio imported successfully!', 'success');
        closeImportModal();
    }

    // ================================================
    // KEYBOARD SHORTCUTS
    // ================================================
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key.toLowerCase()) {
                case '?':
                    toggleShortcutsModal();
                    break;
                case 't':
                    toggleTheme();
                    break;
                case 'escape':
                    closeAllModals();
                    break;
                case 'g':
                    setView('grid');
                    break;
                case 'l':
                    setView('list');
                    break;
                case 'u':
                    setCurrency('USD');
                    break;
                case 'm': // M for Money (AUD)
                    setCurrency('AUD');
                    break;
                case '1':
                    setTimeframe('1h');
                    break;
                case '2':
                    setTimeframe('24h');
                    break;
                case '3':
                    setTimeframe('7d');
                    break;
                case '4':
                    setTimeframe('30d');
                    break;
                case 'a':
                    toggleTA();
                    break;
                case 'e':
                    exportPortfolio();
                    break;
                case 'i':
                    openImportModal();
                    break;
                case 'r':
                    connectWebSocket();
                    break;
            }
        });
    }

    function toggleShortcutsModal() {
        const modal = safeGetElement('helpModal');
        if (modal) {
            modal.classList.toggle('visible');
        }
    }

    function closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('visible');
        });
    }

    // ================================================
    // WEBSOCKET HEARTBEAT
    // ================================================
    let heartbeatTimer = null;
    let lastHeartbeat = Date.now();

    function startHeartbeat() {
        if (heartbeatTimer) clearInterval(heartbeatTimer);

        heartbeatTimer = setInterval(() => {
            const now = Date.now();
            if (now - lastHeartbeat > 30000) { // 30 seconds without data
                console.warn('WebSocket heartbeat timeout, reconnecting...');
                showToast('Connection stale, reconnecting...', 'info');
                if (state.websocket) {
                    state.websocket.close();
                }
                connectWebSocket();
            }
        }, 10000); // Check every 10 seconds
    }

    function resetHeartbeat() {
        lastHeartbeat = Date.now();
    }



    // ================================================
    // SPARKLINE TOOLTIPS
    // ================================================
    function setupSparklineTooltips(coinId) {
        const canvas = safeGetElement(`chart-${coinId}`);
        if (!canvas) return;

        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltip.id = `tooltip-${coinId}`;
        canvas.parentElement.appendChild(tooltip);

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const history = state.priceHistory[coinId];

            if (!history || history.length === 0) return;

            const index = Math.floor((x / rect.width) * history.length);
            if (index >= 0 && index < history.length) {
                const point = history[index];
                tooltip.textContent = formatPrice(point.p);
                tooltip.style.display = 'block';
                tooltip.style.left = `${x}px`;
                tooltip.style.top = `-20px`;
            }
        });

        canvas.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    }

    // ================================================
    // CUSTOM ALERT SOUNDS
    // ================================================
    const ALERT_SOUNDS = {
        'default': { freq: 880, type: 'sine' },
        'bell': { freq: 1200, type: 'sine' },
        'chime': { freq: 660, type: 'triangle' },
        'beep': { freq: 1000, type: 'square' }
    };

    function playAlertSound(soundName = 'default') {
        if (soundName === 'none') return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;

            const sound = ALERT_SOUNDS[soundName] || ALERT_SOUNDS['default'];
            const audioContext = new AudioContextClass();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = sound.freq;
            oscillator.type = sound.type;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.warn('Alert sound failed:', e);
        }
    }

    function getSelectedAlertSound() {
        const select = safeGetElement('alertSoundSelect');
        return select ? select.value : 'default';
    }

    // ================================================
    // INITIALIZATION
    // ================================================
    async function init() {
        // Apply saved theme
        applyTheme();

        renderGrid();
        initCharts();
        initPortfolioChart();
        initDominanceChart();
        setupDragDrop();
        renderAlertHistory();
        setupKeyboardShortcuts();

        // Update TA button state
        const btnTA = safeGetElement('btnTA');
        if (btnTA) {
            btnTA.classList.toggle('active-ta', state.showTA);
        }

        // Setup sparkline tooltips for each coin
        COINS.forEach(coin => setupSparklineTooltips(coin.id));

        // Set up modal keyboard handlers
        const alertInput = safeGetElement('alertPriceInput');
        if (alertInput) {
            alertInput.addEventListener('keydown', handleModalKeydown);
        }

        // Close modal on overlay click
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('visible');
                }
            });
        });

        // Fetch initial data
        await fetchExchangeRate();
        fetchFearGreed();
        await fetchCoinMetadata();

        fetchNews();
        fetchDominance();
        connectWebSocket();

        // Set up intervals

        setInterval(fetchNews, CONFIG.NEWS_UPDATE_INTERVAL);
        setInterval(fetchDominance, 300000); // Every 5 minutes
        setInterval(renderLoop, CONFIG.UI_REFRESH_INTERVAL);

        // Start WebSocket heartbeat monitor
        startHeartbeat();
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
        requestNotificationPermission,
        toggleTheme,
        openImportModal,
        closeImportModal,
        handleImportFile,
        confirmImport,
        sortCoins,
        clearAlertHistory,
        setTimeframe,
        toggleShortcutsModal,
        toggleTA,
        reconnect: connectWebSocket,
        retryFearGreed: fetchFearGreed,
        previewSound: playAlertSound,
        retryWebSocket: connectWebSocket
    };

})();
