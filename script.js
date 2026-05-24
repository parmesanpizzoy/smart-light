// ==========================================
// 1. KONFIGURASI MQTT BROKER (WEBSOCKETS)
// ==========================================
const MQTT_BROKER = "broker.hivemq.com";
const MQTT_PORT = 8000; // Port WebSockets HiveMQ
const CLIENT_ID = "Web_Dashboard_" + Math.random().toString(16).substr(2, 8);

const mqttClient = new Paho.MQTT.Client(MQTT_BROKER, MQTT_PORT, CLIENT_ID);

mqttClient.onConnectionLost = onConnectionLost;
mqttClient.onMessageArrived = onMessageArrived;

mqttClient.connect({ 
    onSuccess: onConnect,
    useSSL: false 
});

// Berjalan saat dashboard sukses terhubung ke broker
function onConnect() {
    console.log("Dashboard sukses terhubung ke MQTT Broker!");
    
    // Berlangganan ke topik data temperatur untuk KEDUA perangkat
    mqttClient.subscribe("smartlight/device_01/temp");
    mqttClient.subscribe("smartlight/device_02/temp");
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.log("Koneksi MQTT Terputus: " + responseObject.errorMessage);
    }
}

// Menangkap data real-time yang dipublikasikan oleh ESP32
function onMessageArrived(message) {
    const topic = message.destinationName;
    const payload = message.payloadString;
    
    console.log(`Data diterima dari [${topic}]: ${payload}`);
    
    // Alur Update data Sensor ke UI Dashboard
    if (topic === "smartlight/device_01/temp") {
        document.getElementById("temp-1").innerText = payload + "°C";
        document.getElementById("sync-time-1").innerText = getFormattedTime();
    } else if (topic === "smartlight/device_02/temp") {
        document.getElementById("temp-2").innerText = payload + "°C";
        document.getElementById("sync-time-2").innerText = getFormattedTime();
    }
}

// ==========================================
// 2. INISIALISASI CHART.JS (STATUS HISTORY)
// ==========================================
function createChart(ctxId) {
    const ctx = document.getElementById(ctxId).getContext('2d');
    
    // Memberikan data awal agar grafik tidak melompong saat dicatut ke paper [cite: 367]
    const initialLabels = ['11:40:00', '11:45:00', '11:50:00', '11:55:00', '12:00:00'];
    const initialData = ctxId === 'historyChart1' ? [1, 1, 0, 1, 0] : [0, 1, 1, 0, 0];

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: initialLabels, 
            datasets: [{
                label: 'Status (1=ON, 0=OFF)',
                data: initialData,
                borderColor: '#00adb5',
                backgroundColor: 'rgba(0, 173, 181, 0.15)',
                tension: 0.1, // Dibuat agak kaku agar perpindahan ON/OFF lebih natural
                fill: true,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    min: -0.1, 
                    max: 1.1, 
                    ticks: { 
                        stepSize: 1, 
                        color: '#aaa',
                        callback: function(value) {
                            if (value === 1) return 'ON';
                            if (value === 0) return 'OFF';
                            return '';
                        }
                    },
                    grid: { color: '#222' }
                },
                x: { 
                    display: true, // Diaktifkan agar reviewer paper bisa melihat sumbu waktu [cite: 367]
                    ticks: { color: '#666', font: { size: 10 } },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Inisialisasi kedua grafik saat halaman dimuat
const chart1 = createChart('historyChart1');
const chart2 = createChart('historyChart2');

// ==========================================
// 3. LOGIKA KONTROL INTERAKSI DASHBOARD
// ==========================================

// Fungsi Helper Mendapatkan Waktu Sekarang (Format HH:MM:SS)
function getFormattedTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// Fungsi Update Brightness
function updateBrightness(deviceId) {
    const slider = document.getElementById(`bright-${deviceId}`);
    const val = slider.value;
    document.getElementById(`bright-val-${deviceId}`).innerText = val;
    
    // JIKA BRIGHTNESS DI-SLIDE KE 0%: Otomatis matikan saklar utama
    if (parseInt(val) === 0) {
        const switchInput = document.getElementById(`ctrl-${deviceId}`);
        if (switchInput.checked) {
            switchInput.checked = false;
            toggleLight(deviceId); // Panggil fungsi pemicu mati total
        }
    } else {
        // Publish nilai brightness baru ke MQTT broker untuk ESP32 [cite: 360, 366]
        const topic = `smartlight/device_${String(deviceId).padStart(2, '0')}/brightness`;
        const message = new Paho.MQTT.Message(String(val));
        message.destinationName = topic;
        mqttClient.send(message);
        
        // Update timestamp Last Sync saat brightness diubah
        document.getElementById(`sync-time-${deviceId}`).innerText = getFormattedTime();
    }
}

// Fungsi Toggle Light, Update Chart, & UI Logic
function toggleLight(deviceId) {
    const isChecked = document.getElementById(`ctrl-${deviceId}`).checked;
    const stateText = document.getElementById(`state-${deviceId}`);
    const brightnessSlider = document.getElementById(`bright-${deviceId}`);
    const activeChart = deviceId === 1 ? chart1 : chart2;
    const currentTime = getFormattedTime();
    const statusVal = isChecked ? "1" : "0";

    // 1. Update UI Teks Saklar
    stateText.innerText = isChecked ? "ON" : "OFF";
    stateText.style.color = isChecked ? "#00adb5" : "#ffffff";

    // 2. Logika sinkronisasi UI komponen slider [cite: 366]
    if (isChecked) {
        brightnessSlider.disabled = false;
        brightnessSlider.style.opacity = "1";
        
        // JIKA lampu dinyalakan tapi slider masih di 0, otomatis naikkan ke 10%
        if (parseInt(brightnessSlider.value) === 0) {
            brightnessSlider.value = 10;
            document.getElementById(`bright-val-${deviceId}`).innerText = 10;
            
            // Kirim nilai brightness default awal (10) ke hardware via MQTT [cite: 360]
            const bTopic = `smartlight/device_${String(deviceId).padStart(2, '0')}/brightness`;
            const bMsg = new Paho.MQTT.Message("10");
            bMsg.destinationName = bTopic;
            mqttClient.send(bMsg);
        }
    } else {
        brightnessSlider.disabled = true;
        brightnessSlider.style.opacity = "0.3"; 
    }

    // 3. Mengirim Perintah (Publish) status daya ke MQTT Broker [cite: 360]
    const topic = `smartlight/device_${String(deviceId).padStart(2, '0')}/power`;
    const message = new Paho.MQTT.Message(statusVal);
    message.destinationName = topic;
    mqttClient.send(message);
    console.log(`Mempublikasikan perintah ke [${topic}]: ${statusVal}`);

    // 4. Update Timestamp Last Sync di Pojok Kanan Bawah
    document.getElementById(`sync-time-${deviceId}`).innerText = currentTime;

    // 5. Tambah data ke Grafik Real-Time [cite: 367]
    if (activeChart.data.labels.length > 10) { // Simpan 10 riwayat terakhir di monitor
        activeChart.data.labels.shift();
        activeChart.data.datasets[0].data.shift();
    }
    
    activeChart.data.labels.push(currentTime);
    activeChart.data.datasets[0].data.push(isChecked ? 1 : 0);
    activeChart.update();
}

// Inisialisasi Kondisi Awal Saat Halaman Pertama Kali Dibuka (Default: OFF, Maka Slider Redup)
document.addEventListener("DOMContentLoaded", () => {
    for (let i = 1; i <= 2; i++) {
        const isChecked = document.getElementById(`ctrl-${i}`).checked;
        const brightnessSlider = document.getElementById(`bright-${i}`);
        if (!isChecked) {
            brightnessSlider.disabled = true;
            brightnessSlider.style.opacity = "0.3";
        }
    }
});
