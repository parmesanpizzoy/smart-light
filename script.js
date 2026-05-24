// Fungsi Helper untuk Inisialisasi Chart
function createChart(ctxId) {
    const ctx = document.getElementById(ctxId).getContext('2d');
    
    // Memberikan data awal (mock data) supaya grafik tidak kosong saat di-screenshot untuk paper
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
                tension: 0.1, // Dibuat agak kaku (0.1) agar perpindahan ON/OFF (square wave) lebih natural untuk IoT
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
                    display: true, // Diaktifkan agar reviewer paper bisa melihat sumbu waktu real-time
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

// Fungsi Helper untuk Mendapatkan Waktu Sekarang (Format HH:MM:SS)
function getFormattedTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// Fungsi Update Brightness
function updateBrightness(deviceId) {
    const val = document.getElementById(`bright-${deviceId}`).value;
    document.getElementById(`bright-val-${deviceId}`).innerText = val;
    
    // Update timestamp Last Sync saat brightness diubah
    document.getElementById(`sync-time-${deviceId}`).innerText = getFormattedTime();
}

// Fungsi Toggle Light, Update Chart, & UI Logic
function toggleLight(deviceId) {
    const isChecked = document.getElementById(`ctrl-${deviceId}`).checked;
    const stateText = document.getElementById(`state-${deviceId}`);
    const brightnessSlider = document.getElementById(`bright-${deviceId}`);
    const statusVal = isChecked ? 1 : 0;
    const activeChart = deviceId === 1 ? chart1 : chart2;
    const currentTime = getFormattedTime();

    // 1. Update UI Teks Saklar
    stateText.innerText = isChecked ? "ON" : "OFF";
    stateText.style.color = isChecked ? "#00adb5" : "#ffffff";

    // Di dalam fungsi toggleLight(deviceId) bagian logika sinkronisasi UI:
    if (isChecked) {
        brightnessSlider.disabled = false;
        brightnessSlider.style.opacity = "1";
        
        // JIKA lampu dinyalakan tapi slider masih di 0, otomatis naikkan ke 10%
        if (parseInt(brightnessSlider.value) === 0) {
            brightnessSlider.value = 10;
            document.getElementById(`bright-val-${deviceId}`).innerText = 10;
        }
    } else {
        brightnessSlider.disabled = true;
        brightnessSlider.style.opacity = "0.3"; 
    }
    // 3. Update Timestamp Last Sync di Pojok Kanan Bawah
    document.getElementById(`sync-time-${deviceId}`).innerText = currentTime;

    // 4. Tambah data ke Grafik Real-Time
    if (activeChart.data.labels.length > 10) { // Simpan 10 riwayat terakhir di monitor
        activeChart.data.labels.shift();
        activeChart.data.datasets[0].data.shift();
    }
    
    activeChart.data.labels.push(currentTime);
    activeChart.data.datasets[0].data.push(statusVal);
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