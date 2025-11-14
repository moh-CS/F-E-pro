// ================================
// BREATHSAFE ADMIN DASHBOARD - SENSORS
// Real-time Sensor Monitoring & Charts
// ================================

console.log("🚀 BreathSafe Sensors Loading...");

// ========== FIREBASE CONFIG ==========
const realtimeConfig = {
    apiKey: "AIzaSyB_0eep9nbUIvPiCgtVDcBIbm3JemQTRKI",
    authDomain: "realtimeproject-defc1.firebaseapp.com",
    databaseURL: "https://realtimeproject-defc1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "realtimeproject-defc1",
    storageBucket: "realtimeproject-defc1.firebasestorage.app",
    messagingSenderId: "876644657827",
    appId: "1:876644657827:web:a45ece922213762bcd6d16",
    measurementId: "G-SH825GE2S8"
};

// ========== GLOBAL STATE ==========
let rtdb = null;
let sensorChart = null;
let chartPaused = false;
let previousSensorData = { 
    MQ6_Value: 0, 
    MQ7_Value: 0,
    Temperature: 0,
    Humidity: 0
};

const sensorHistory = {
    labels: [],
    mq6Data: [],
    mq7Data: [],
    maxPoints: 30
};

// ========== INITIALIZE REALTIME DB ==========
function initRealtimeDB() {
    try {
        const realtimeApp = firebase.initializeApp(realtimeConfig, "realtimeApp");
        rtdb = firebase.database(realtimeApp);
        console.log("✅ Realtime DB Ready");
        return true;
    } catch (error) {
        console.error("❌ Realtime DB Error:", error);
        return false;
    }
}

// ========== LISTEN TO SENSOR DATA ==========
function listenToSensorData() {
    if (!rtdb) return;
    
    rtdb.ref('Sensors').on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            updateSensorDisplay(data);
            updateAirQuality(data);
            if (!chartPaused) updateChart(data);
        }
    });
}

// ========== UPDATE SENSOR DISPLAY ==========
function updateSensorDisplay(data) {
    const mq6 = data.MQ6_Value || 0;
    const mq7 = data.MQ7_Value || 0;
    const temperature = data.Temperature || 0;
    const humidity = data.Humidity || 0;
    
    const mq6ValueEl = document.getElementById('mq6Value');
    const mq7ValueEl = document.getElementById('mq7Value');
    const mq6BarEl = document.getElementById('mq6Bar');
    const mq7BarEl = document.getElementById('mq7Bar');
    
    if (mq6ValueEl) mq6ValueEl.textContent = mq6;
    if (mq7ValueEl) mq7ValueEl.textContent = mq7;
    
    const mq6Progress = Math.min((mq6 / 2000) * 100, 100);
    const mq7Progress = Math.min((mq7 / 2000) * 100, 100);
    
    if (mq6BarEl) mq6BarEl.style.width = mq6Progress + '%';
    if (mq7BarEl) mq7BarEl.style.width = mq7Progress + '%';
    
    updateTrend('mq6Trend', mq6, previousSensorData.MQ6_Value);
    updateTrend('mq7Trend', mq7, previousSensorData.MQ7_Value);
    
    updateEnvironmentData(temperature, humidity);
    
    previousSensorData = { 
        MQ6_Value: mq6, 
        MQ7_Value: mq7,
        Temperature: temperature,
        Humidity: humidity
    };
}

// ========== UPDATE TREND ARROWS ==========
function updateTrend(id, current, previous) {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (current > previous) {
        el.innerHTML = '<i class="fas fa-arrow-up" style="color: var(--danger);"></i>';
    } else if (current < previous) {
        el.innerHTML = '<i class="fas fa-arrow-down" style="color: var(--primary);"></i>';
    } else {
        el.innerHTML = '<i class="fas fa-minus" style="color: var(--muted);"></i>';
    }
}

// ========== UPDATE TEMPERATURE & HUMIDITY ==========
function updateEnvironmentData(temperature, humidity) {
    const tempValueEl = document.getElementById('temperatureValue');
    const tempBarEl = document.getElementById('tempBar');
    
    if (tempValueEl) tempValueEl.textContent = temperature;
    
    const tempProgress = Math.min((temperature / 50) * 100, 100);
    if (tempBarEl) tempBarEl.style.width = tempProgress + '%';
    
    const humidityValueEl = document.getElementById('humidityValue');
    const humidityBarEl = document.getElementById('humidityBar');
    
    if (humidityValueEl) humidityValueEl.textContent = humidity;
    
    const humidityProgress = Math.min(humidity, 100);
    if (humidityBarEl) humidityBarEl.style.width = humidityProgress + '%';
}

// ========== UPDATE AIR QUALITY ==========
function updateAirQuality(data) {
    const status = (data.Status || 'Normal').toLowerCase();
    
    const orb = document.getElementById('airOrb');
    const statusText = document.getElementById('airStatusText');
    const statusDesc = document.getElementById('airStatusDesc');
    const statusIcon = document.getElementById('statusIcon');
    const statusPill = document.getElementById('statusPill');
    const airQualityStatus = document.getElementById('airQualityStatus');
    
    if (orb) orb.className = 'air-orb ' + status;
    
    const statusMap = {
        normal: { text: 'Normal', desc: 'Air quality is safe', icon: 'success' },
        warning: { text: 'Warning', desc: 'Elevated levels detected', icon: 'warning' },
        danger: { text: 'Danger', desc: 'Critical! Take action now', icon: 'warning' }
    };
    
    const info = statusMap[status] || statusMap.normal;
    
    if (statusText) statusText.textContent = info.text;
    if (statusDesc) statusDesc.textContent = info.desc;
    if (statusPill) statusPill.textContent = info.text;
    if (airQualityStatus) airQualityStatus.textContent = info.text;
    if (statusIcon) statusIcon.className = 'stat-icon ' + info.icon;
}

// ========== INITIALIZE CHART ==========
function initializeChart() {
    const ctx = document.getElementById('sensorChart');
    if (!ctx) return;
    
    sensorChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: sensorHistory.labels,
            datasets: [
                {
                    label: 'MQ6 (LPG)',
                    data: sensorHistory.mq6Data,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 5
                },
                {
                    label: 'MQ7 (CO)',
                    data: sensorHistory.mq7Data,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.08)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 12, weight: 600 }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// ========== UPDATE CHART ==========
function updateChart(data) {
    if (!sensorChart) return;
    
    const time = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    sensorHistory.labels.push(time);
    sensorHistory.mq6Data.push(data.MQ6_Value || 0);
    sensorHistory.mq7Data.push(data.MQ7_Value || 0);
    
    if (sensorHistory.labels.length > sensorHistory.maxPoints) {
        sensorHistory.labels.shift();
        sensorHistory.mq6Data.shift();
        sensorHistory.mq7Data.shift();
    }
    
    sensorChart.update('none');
}

// ========== TOGGLE CHART ==========
function toggleChart() {
    chartPaused = !chartPaused;
    const btn = document.getElementById('pauseChart');
    if (btn) {
        btn.innerHTML = chartPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
    }
}

// ========== CLEAR CHART ==========
function clearChart() {
    sensorHistory.labels = [];
    sensorHistory.mq6Data = [];
    sensorHistory.mq7Data = [];
    if (sensorChart) sensorChart.update();
}

// ========== EVENT LISTENERS (SENSORS) ==========
function setupSensorEventListeners() {
    const pauseChart = document.getElementById('pauseChart');
    const clearChartBtn = document.getElementById('clearChart');
    
    if (pauseChart) pauseChart.addEventListener('click', toggleChart);
    if (clearChartBtn) clearChartBtn.addEventListener('click', clearChart);
}

// ========== INITIALIZE SENSORS ==========
function initSensors() {
    console.log("✅ Sensors Initializing...");
    initRealtimeDB();
    setupSensorEventListeners();
    listenToSensorData();
    initializeChart();
    console.log("✅ Sensors Ready");
}

console.log("✅ BreathSafe Sensors Loaded");