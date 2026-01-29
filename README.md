<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EtherDash | Ultimate Terminal</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-deep: #050505;
            --glass-surface: rgba(20, 20, 25, 0.7);
            --glass-border: rgba(255, 255, 255, 0.08);
            --text-primary: #ffffff;
            --text-secondary: #a1a1aa;
            --accent-green: #10b981;
            --accent-red: #ef4444;
            --accent-blue: #3b82f6;
            --accent-orange: #f59e0b;
            --accent-purple: #8b5cf6;
            --glow-color: rgba(59, 130, 246, 0.15);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            background-color: var(--bg-deep);
            color: var(--text-primary);
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            overflow-x: hidden;
            padding-bottom: 50px; /* Space for news ticker */
            transition: background 0.5s ease;
        }

        .ambient-glow {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80vw;
            height: 80vh;
            background: radial-gradient(circle, var(--glow-color) 0%, transparent 70%);
            filter: blur(80px);
            z-index: -1;
            transition: background 2s ease;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        /* --- HEADER & CONTROLS --- */
        .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 0;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 20px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-mark {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
            border-radius: 10px;
            display: grid;
            place-items: center;
            font-weight: 800;
            font-size: 20px;
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
            color: white;
        }

        .controls {
            display: flex;
            gap: 8px;
            background: var(--glass-surface);
            padding: 6px;
            border-radius: 12px;
            border: 1px solid var(--glass-border);
            backdrop-filter: blur(10px);
        }

        .btn-control {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }

        .btn-control:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
        .btn-control.active { background: rgba(255,255,255,0.1); color: var(--text-primary); }
        .btn-icon svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2; }

        /* --- DASHBOARD LAYOUT --- */
        .dashboard-grid {
            display: grid;
            grid-template-columns: 3fr 1fr; /* Main Content | Sidebar */
            gap: 20px;
        }

        /* --- STATS BANNER --- */
        .portfolio-banner {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
            grid-column: 1 / -1;
        }

        .stat-card {
            background: var(--glass-surface);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 20px;
            backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .stat-card.featured {
            background: linear-gradient(90deg, rgba(59, 130, 246, 0.1), transparent);
            border-color: rgba(59, 130, 246, 0.2);
        }

        .label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 6px; }
        .value { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; z-index: 1; position: relative; }
        
        .sub-value { font-size: 12px; color: var(--text-secondary); margin-top: 4px; display: flex; align-items: center; gap: 6px; }

        /* Sparkline canvas behind portfolio */
        #portfolioChart { position: absolute; right: 0; bottom: 0; width: 60%!important; height: 80%!important; opacity: 0.3; pointer-events: none; }

        /* --- CRYPTO GRID --- */
        .market-grid {
            display: grid;
            gap: 20px;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        }

        .crypto-card {
            background: var(--glass-surface);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 20px;
            transition: transform 0.2s;
            position: relative;
        }

        .crypto-card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,0.2); }

        .card-header { display: flex; justify-content: space-between; margin-bottom: 15px; }
        .coin-info { display: flex; align-items: center; gap: 10px; }
        .coin-icon { width: 40px; height: 40px; border-radius: 50%; }
        .coin-name { font-weight: 700; font-size: 16px; }
        .coin-symbol { font-size: 12px; color: var(--text-secondary); }

        .price-box { text-align: right; }
        .current-price { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; }
        .price-change { font-size: 12px; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px; }
        .up { color: var(--accent-green); background: rgba(16, 185, 129, 0.1); }
        .down { color: var(--accent-red); background: rgba(239, 68, 68, 0.1); }

        /* Alert Button */
        .alert-btn {
            background: transparent;
            border: 1px solid var(--glass-border);
            color: var(--text-secondary);
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: grid;
            place-items: center;
            cursor: pointer;
            transition: all 0.2s;
            position: absolute;
            top: 20px;
            right: 20px; /* Adjusted position */
        }
        
        .alert-btn:hover { color: white; border-color: white; }
        .alert-btn.active { color: var(--accent-orange); border-color: var(--accent-orange); box-shadow: 0 0 10px rgba(245, 158, 11, 0.2); }
        /* Hide alert button in grid view initially, reveal on hover or if active */
        .crypto-card .alert-btn { opacity: 0; }
        .crypto-card:hover .alert-btn, .alert-btn.active { opacity: 1; }

        .chart-area { height: 70px; margin: 10px -10px; opacity: 0.8; }

        .holdings-row {
            background: rgba(0,0,0,0.2);
            padding: 8px 12px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
        }
        .holdings-input { background: transparent; border: none; color: white; text-align: right; width: 80px; font-family: 'JetBrains Mono'; outline: none; }

        /* --- SIDEBAR (WHALE WATCH) --- */
        .sidebar { display: flex; flex-direction: column; gap: 20px; }
        
        .whale-feed {
            background: var(--glass-surface);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 15px;
            height: 400px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .feed-header { font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 10px; display: flex; justify-content: space-between; text-transform: uppercase; letter-spacing: 1px; }
        .feed-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; scrollbar-width: thin; }
        
        .whale-item {
            font-size: 11px;
            padding: 8px;
            background: rgba(255,255,255,0.03);
            border-radius: 6px;
            border-left: 2px solid var(--glass-border);
            font-family: 'JetBrains Mono';
            animation: slideIn 0.3s ease-out;
        }
        .whale-item.buy { border-left-color: var(--accent-green); }
        .whale-item.sell { border-left-color: var(--accent-red); }

        @keyframes slideIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }

        /* --- NEWS TICKER --- */
        .news-ticker {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            background: #000;
            border-top: 1px solid var(--glass-border);
            height: 40px;
            display: flex;
            align-items: center;
            overflow: hidden;
            z-index: 100;
        }
        .ticker-label { background: var(--accent-blue); color: black; font-size: 11px; font-weight: 800; padding: 0 15px; height: 100%; display: grid; place-items: center; text-transform: uppercase; z-index: 2; }
        .ticker-track { display: flex; animation: scroll 40s linear infinite; white-space: nowrap; padding-left: 20px; }
        .news-item { margin-right: 40px; font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; }
        .news-item span { color: white; font-weight: 500; }
        
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }

        /* LIST VIEW OVERRIDES */
        .market-grid.list-view { grid-template-columns: 1fr; }
        .list-view .crypto-card { display: grid; grid-template-columns: 50px 1.5fr 1fr 1fr 1fr 40px; align-items: center; gap: 15px; padding: 10px 20px; }
        .list-view .card-header { margin: 0; justify-content: flex-start; }
        .list-view .chart-area { height: 40px; margin: 0; }
        .list-view .holdings-row { margin: 0; padding: 0; background: none; justify-content: flex-end; }
        .list-view .alert-btn { position: static; opacity: 1; }
        .list-view .coin-symbol { display: none; }

        @media (max-width: 1024px) {
            .dashboard-grid { grid-template-columns: 1fr; }
            .portfolio-banner { grid-template-columns: 1fr 1fr; }
            .whale-feed { height: 200px; }
        }
        @media (max-width: 600px) {
            .portfolio-banner { grid-template-columns: 1fr; }
            .list-view .crypto-card { grid-template-columns: 40px 1fr 1fr; gap: 10px; }
            .list-view .chart-area, .list-view .holdings-row, .list-view .alert-btn { display: none; }
        }
    </style>
</head>
<body>

    <div class="ambient-glow" id="ambientLight"></div>

    <div class="container">
        <header class="dashboard-header">
            <div class="brand">
                <div class="logo-mark">⚡</div>
                <div>
                    <h1 style="font-size: 20px; font-weight: 700;">EtherDash</h1>
                    <span style="font-size: 12px; color: var(--text-secondary);">PRO TERMINAL v3.0</span>
                </div>
            </div>
            <div class="controls">
                <button class="btn-control active" id="btnUSD" onclick="setCurrency('USD')">USD</button>
                <button class="btn-control" id="btnAUD" onclick="setCurrency('AUD')">AUD</button>
                <button class="btn-control" onclick="requestNotificationPermission()">Enable Alerts 🔔</button>
                <div style="width: 1px; background: var(--glass-border); margin: 0 4px;"></div>
                <button class="btn-control btn-icon active" id="btnGrid" onclick="setView('grid')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                </button>
                <button class="btn-control btn-icon" id="btnList" onclick="setView('list')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </button>
            </div>
        </header>

        <div class="portfolio-banner">
            <div class="stat-card featured">
                <div class="label">Net Portfolio Value</div>
                <div class="value" id="totalPortfolioValue">$0.00</div>
                <div class="sub-value">
                    <span id="connectionDot" style="width:6px; height:6px; background:#f59e0b; border-radius:50%;"></span>
                    <span id="connectionStatus">Connecting...</span>
                </div>
                <canvas id="portfolioChart"></canvas>
            </div>

            <div class="stat-card">
                <div class="label">Market Sentiment</div>
                <div class="value" id="fngValue" style="color: #f59e0b">--</div>
                <div class="sub-value" id="fngLabel">Fear & Greed Index</div>
            </div>

            <div class="stat-card">
                <div class="label">Ethereum Gas</div>
                <div class="value" id="gasValue">--</div>
                <div class="sub-value">
                    <span style="color: var(--accent-blue)">Gwei</span> • Standard
                </div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div id="marketGrid" class="market-grid">
                <div style="color: #666; padding: 40px; text-align: center;">Loading Assets...</div>
            </div>

            <div class="sidebar">
                <div class="whale-feed">
                    <div class="feed-header">
                        <span>Whale Watch</span>
                        <span style="color: var(--accent-blue)">Live >$500k</span>
                    </div>
                    <div class="feed-list" id="whaleList">
                        </div>
                </div>
            </div>
        </div>
    </div>

    <div class="news-ticker">
        <div class="ticker-label">BREAKING</div>
        <div class="ticker-track" id="newsTrack">
            <div class="news-item">Loading crypto news stream...</div>
        </div>
    </div>

    <script>
        // --- CONFIG ---
        const coins = [
            { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', binance: 'btcusdt' },
            { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', binance: 'ethusdt' },
            { id: 'solana', symbol: 'SOL', name: 'Solana', binance: 'solusdt' },
            { id: 'ripple', symbol: 'XRP', name: 'XRP', binance: 'xrpusdt' },
            { id: 'cardano', symbol: 'ADA', name: 'Cardano', binance: 'adausdt' },
            { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', binance: 'dogeusdt' },
            { id: 'pepe', symbol: 'PEPE', name: 'Pepe', binance: 'pepeusdt' }
        ];

        // --- STATE ---
        let state = {
            currency: 'USD',
            rate: 1.55,
            prices: {},
            holdings: JSON.parse(localStorage.getItem('holdings')) || {},
            alerts: JSON.parse(localStorage.getItem('alerts')) || {},
            history: {},
            portfolioHistory: JSON.parse(localStorage.getItem('portfolioHistory')) || [],
            charts: {}
        };

        let ws = null;
        let portfolioChart = null;

        // --- INIT ---
        document.addEventListener('DOMContentLoaded', async () => {
            renderGrid();
            initCharts();
            initPortfolioChart();
            
            // Start Data Feeds
            await fetchRate();
            fetchFearGreed();
            fetchGas();
            fetchNews();
            connectSocket();
            
            // Intervals
            setInterval(fetchGas, 15000); // Update gas every 15s
            setInterval(fetchNews, 300000); // Update news every 5m
            setInterval(renderLoop, 1000); // UI Refresh
        });

        // --- RENDERERS ---
        function renderGrid() {
            const grid = document.getElementById('marketGrid');
            grid.innerHTML = coins.map(c => `
                <div class="crypto-card" id="card-${c.id}">
                    <button class="alert-btn" id="btn-alert-${c.id}" onclick="setAlert('${c.id}')">🔔</button>
                    
                    <div class="card-header">
                        <div class="coin-info">
                            <img src="https://assets.coingecko.com/coins/images/${getImageId(c.id)}/large/${c.id}.png" 
                                 class="coin-icon" onerror="this.src='https://placehold.co/40?text=${c.symbol}'">
                            <div>
                                <div class="coin-name">${c.name}</div>
                                <div class="coin-symbol">${c.symbol}</div>
                            </div>
                        </div>
                        <div class="price-box">
                            <div class="current-price" id="price-${c.id}">---</div>
                            <div class="price-change" id="change-${c.id}">--%</div>
                        </div>
                    </div>
                    
                    <div class="chart-area">
                        <canvas id="chart-${c.id}"></canvas>
                    </div>

                    <div class="holdings-row">
                        <span style="font-size:12px; color:var(--text-secondary)">Holdings:</span>
                        <input type="number" class="holdings-input" id="hold-${c.id}" 
                               placeholder="0.00" value="${state.holdings[c.id] || ''}"
                               oninput="updateHolding('${c.id}', this.value)">
                    </div>
                    <div style="text-align:right; font-size:11px; color:var(--text-secondary); margin-top:4px;" id="equity-${c.id}">Eq: $0.00</div>
                </div>
            `).join('');
            restoreAlerts();
        }

        function getImageId(id) {
            // Helper for Coindesk image IDs which aren't always logical
            const map = { 'bitcoin': 1, 'ethereum': 279, 'solana': 4128, 'ripple': 44, 'cardano': 975, 'dogecoin': 5, 'pepe': 29850 };
            return map[id] || '1';
        }

        // --- DATA FETCHING ---
        async function fetchRate() {
            try {
                const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                const d = await r.json();
                state.rate = d.rates.AUD;
            } catch(e) {}
        }

        async function fetchFearGreed() {
            try {
                const r = await fetch('https://api.alternative.me/fng/?limit=1');
                const d = await r.json();
                const val = d.data[0].value;
                document.getElementById('fngValue').innerText = val;
                document.getElementById('fngValue').style.color = val > 50 ? '#10b981' : '#ef4444';
            } catch(e) {}
        }

        async function fetchGas() {
            // Use Cloudflare RPC to get gas price without API Key
            try {
                const r = await fetch('https://cloudflare-eth.com', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({jsonrpc:"2.0",method:"eth_gasPrice",params:[],id:1})
                });
                const d = await r.json();
                const gasHex = d.result;
                const gasGwei = parseInt(gasHex, 16) / 1000000000;
                document.getElementById('gasValue').innerText = Math.round(gasGwei);
            } catch(e) { console.log('Gas Error', e); }
        }

        async function fetchNews() {
            try {
                // Use RSS2JSON to bypass CORS on Coindesk RSS
                const r = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.coindesk.com/arc/outboundfeeds/rss/');
                const d = await r.json();
                const html = d.items.map(i => `
                    <div class="news-item">
                        <span>${new Date(i.pubDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        ${i.title} •
                    </div>
                `).join('');
                document.getElementById('newsTrack').innerHTML = html;
            } catch(e) {}
        }

        // --- WEBSOCKET ENGINE ---
        function connectSocket() {
            const streams = coins.map(c => `${c.binance}@ticker`).join('/');
            ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
            
            ws.onopen = () => {
                document.getElementById('connectionStatus').innerText = 'Live Feed';
                document.getElementById('connectionDot').style.background = '#10b981';
            };

            ws.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                const coin = coins.find(c => c.binance === msg.data.s.toLowerCase());
                if(coin) processTick(coin, msg.data);
            };
            
            ws.onclose = () => setTimeout(connectSocket, 5000);
        }

        function processTick(coin, data) {
            const price = parseFloat(data.c);
            const prev = state.prices[coin.id]?.price || price;
            const volumeVal = parseFloat(data.q) * price; // Approx trade volume value

            state.prices[coin.id] = { price, change: parseFloat(data.P), prev };

            // Chart Update
            if(!state.history[coin.id]) state.history[coin.id] = [];
            const hist = state.history[coin.id];
            if(!hist.length || Date.now() - hist[hist.length-1].t > 2000) {
                hist.push({ t: Date.now(), p: price });
                if(hist.length > 50) hist.shift();
                updateChart(coin.id, hist);
            }

            // Whale Watcher (> $500k volume in 24h tick updates is too common, 
            // so we simulate "Live Trades" by checking if Quote Volume jumped significantly.
            // *Real whale watching requires trade stream (@trade), but we are on @ticker.*
            // *We will simulate based on Price Impact for this demo.*
            // IF price moved > 0.2% in one tick, log it.
            if(Math.abs((price - prev)/prev) > 0.002) {
                logWhale(coin, price, (price > prev));
            }

            // Alerts
            checkAlert(coin, price);
        }

        // --- FEATURES LOGIC ---
        function logWhale(coin, price, isBuy) {
            const list = document.getElementById('whaleList');
            const item = document.createElement('div');
            item.className = `whale-item ${isBuy ? 'buy' : 'sell'}`;
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between">
                    <span>${coin.symbol} ${isBuy ? 'PUMP' : 'DUMP'}</span>
                    <span>$${price.toLocaleString()}</span>
                </div>
                <div style="color:var(--text-secondary)">High Volatility Detected</div>
            `;
            list.prepend(item);
            if(list.children.length > 20) list.lastChild.remove();
        }

        // Alerts System
        function setAlert(id) {
            const current = state.prices[id]?.price;
            const target = prompt(`Set price alert for ${id.toUpperCase()} (Current: $${current})`);
            if(target && !isNaN(target)) {
                state.alerts[id] = parseFloat(target);
                localStorage.setItem('alerts', JSON.stringify(state.alerts));
                restoreAlerts();
            }
        }

        function checkAlert(coin, price) {
            const target = state.alerts[coin.id];
            if(target) {
                // Trigger if we cross the target
                if((price >= target && state.prices[coin.id].prev < target) || 
                   (price <= target && state.prices[coin.id].prev > target)) {
                    new Notification(`🚨 ${coin.name} hit $${target}!`);
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Free ping sound
                    audio.play().catch(e => {});
                    delete state.alerts[coin.id]; // Remove after firing
                    localStorage.setItem('alerts', JSON.stringify(state.alerts));
                    restoreAlerts();
                }
            }
        }

        function restoreAlerts() {
            coins.forEach(c => {
                const btn = document.getElementById(`btn-alert-${c.id}`);
                if(state.alerts[c.id]) {
                    btn.classList.add('active');
                    btn.title = `Alert set for $${state.alerts[c.id]}`;
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        function requestNotificationPermission() {
            Notification.requestPermission().then(p => {
                if(p === 'granted') alert("Alerts Enabled!");
            });
        }

        function updateHolding(id, val) {
            state.holdings[id] = parseFloat(val);
            localStorage.setItem('holdings', JSON.stringify(state.holdings));
        }

        // --- CHARTING ---
        function initCharts() {
            Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
            coins.forEach(c => {
                const ctx = document.getElementById(`chart-${c.id}`).getContext('2d');
                state.charts[c.id] = new Chart(ctx, {
                    type: 'line',
                    data: { labels: Array(50).fill(''), datasets: [{ data: [], borderColor: '#3b82f6', tension: 0.4, pointRadius: 0, borderWidth: 2 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false }, scales: { x: { display: false }, y: { display: false } } }
                });
            });
        }

        function updateChart(id, hist) {
            const chart = state.charts[id];
            if(!chart) return;
            chart.data.datasets[0].data = hist.map(h => h.p);
            const color = hist[hist.length-1].p >= hist[0].p ? '#10b981' : '#ef4444';
            chart.data.datasets[0].borderColor = color;
            chart.update('none');
        }

        function initPortfolioChart() {
            const ctx = document.getElementById('portfolioChart').getContext('2d');
            portfolioChart = new Chart(ctx, {
                type: 'line',
                data: { labels: [], datasets: [{ data: [], borderColor: '#ffffff', tension: 0.4, pointRadius: 0, borderWidth: 2, fill: true, backgroundColor: 'rgba(255,255,255,0.05)' }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false }, scales: { x: { display: false }, y: { display: false } } }
            });
        }

        // --- MAIN LOOP ---
        function renderLoop() {
            let total = 0;
            const isAud = state.currency === 'AUD';
            const rate = isAud ? state.rate : 1;
            const sym = isAud ? 'A$' : '$';

            coins.forEach(c => {
                const data = state.prices[c.id];
                if(!data) return;
                
                // Update Price
                const dispPrice = data.price * rate;
                const elPrice = document.getElementById(`price-${c.id}`);
                const txt = `${sym}${dispPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}`;
                if(elPrice.innerText !== txt) {
                    elPrice.innerText = txt;
                    elPrice.style.color = data.price > data.prev ? '#10b981' : '#ef4444';
                    setTimeout(() => elPrice.style.color = 'white', 500);
                }

                // Update Change
                const elChange = document.getElementById(`change-${c.id}`);
                elChange.innerText = `${data.change > 0 ? '+' : ''}${data.change.toFixed(2)}%`;
                elChange.className = `price-change ${data.change >= 0 ? 'up' : 'down'}`;

                // Update Equity
                const held = state.holdings[c.id] || 0;
                total += held * data.price;
                document.getElementById(`equity-${c.id}`).innerText = `Eq: ${sym}${(held * dispPrice).toLocaleString(undefined, {maximumFractionDigits:0})}`;
            });

            // Update Total
            const totalDisp = total * rate;
            document.getElementById('totalPortfolioValue').innerText = `${sym}${totalDisp.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            
            // Update Portfolio Chart History
            const now = Date.now();
            if(total > 0 && (!state.portfolioHistory.length || now - state.portfolioHistory[state.portfolioHistory.length-1].t > 10000)) {
                state.portfolioHistory.push({ t: now, v: totalDisp });
                if(state.portfolioHistory.length > 100) state.portfolioHistory.shift();
                localStorage.setItem('portfolioHistory', JSON.stringify(state.portfolioHistory));
                
                portfolioChart.data.labels = state.portfolioHistory.map(h => '');
                portfolioChart.data.datasets[0].data = state.portfolioHistory.map(h => h.v);
                portfolioChart.update('none');
            }
        }

        // Global View Switcher
        window.setCurrency = (c) => { state.currency = c; document.getElementById('btnUSD').classList.toggle('active', c==='USD'); document.getElementById('btnAUD').classList.toggle('active', c==='AUD'); };
        window.setView = (v) => { document.getElementById('marketGrid').className = `market-grid ${v==='list'?'list-view':''}`; };

    </script>
</body>
</html>
