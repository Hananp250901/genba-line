// ==========================================
// 1. CONFIG
// ==========================================
const PROJECT_URL = 'https://fbfvhcwisvlyodwvmpqg.supabase.co';
const PROJECT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnZoY3dpc3ZseW9kd3ZtcHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ2MzQsImV4cCI6MjA3MjM5MDYzNH0.mbn9B1xEr_8kmC2LOP5Jv5O7AEIK7Fa1gxrqJ91WNx4';

// GANTI DENGAN LINK GITHUB ANDA
const APP_BASE_URL = 'https://hananp250901.github.io/genba-line/?'; 

let db;
try {
    db = window.supabase.createClient(PROJECT_URL, PROJECT_KEY);
} catch (e) { console.error(e); }

let currentUser = null;
let locations = [];
let dashboardInterval = null;

// ==========================================
// 2. FORMAT WAKTU (VERSI SIMPLE/NETRAL)
// ==========================================
function formatWaktu(isoString) {
    if (!isoString) return '-';
    // Kita paksa konversi ke Asia/Jakarta biar ga ngikutin jam browser/device user yang aneh-aneh
    return new Date(isoString).toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta', 
        hour: '2-digit', minute: '2-digit', hour12: false
    });
}

function formatTanggal(isoString) {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric', month: 'short'
    });
}
function getShift() {
    // Ambil jam dari HP Chief saat ini
    const h = new Date().getHours();
    if (h >= 7 && h < 15) return 'SHIFT 1';
    if (h >= 15 && h < 23) return 'SHIFT 2';
    return 'SHIFT 3';
}

function updateClock() {
    // Jam Realtime di Dashboard
    const elClock = document.getElementById('clock'); 
    if (elClock) {
        elClock.innerText = new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).replace(/\./g, ':');
    }

    const shift = getShift();
    const elShift = document.getElementById('monitor-shift'); 
    if (elShift) elShift.innerText = shift;
    
    const elBadge = document.getElementById('chief-shift-badge'); 
    if (elBadge) elBadge.innerText = shift;
}

// ==========================================
// 3. MAIN INIT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    setInterval(updateClock, 1000);
    updateClock();

    const { data } = await db.from('locations').select('*');
    if (data) locations = data;

    checkSession();

    const loginForm = document.getElementById('form-login');
    if(loginForm) loginForm.addEventListener('submit', handleLogin);
    document.getElementById('btn-logout-sidebar').addEventListener('click', logout);
    document.getElementById('btn-logout-mobile').addEventListener('click', logout);
});

// ==========================================
// 4. SCANNING LOGIC (URL)
// ==========================================
async function checkUrlScan() {
    const urlParams = new URLSearchParams(window.location.search);
    const scanCode = urlParams.get('scan');

    if (scanCode && currentUser && currentUser.role === 'chief') {
        window.history.replaceState({}, document.title, window.location.pathname);
        await processScan(scanCode);
    }
}

async function processScan(code) {
    if (locations.length === 0) {
        const { data } = await db.from('locations').select('*');
        if (data) locations = data;
    }
    const loc = locations.find(l => l.code === code);

    if (loc) {
        Swal.fire({ title: 'Menyimpan...', text: loc.name, didOpen: () => Swal.showLoading() });
        
        // PENTING: Biarkan Supabase mencatat waktu servernya sendiri
        // Kita tidak kirim 'scan_time' dari sini agar konsisten
        const { error } = await db.from('genba_logs').insert([{
            user_name: currentUser.full_name,
            location_id: loc.id,
            shift: getShift(),
            scan_time: new Date().toISOString() // <--- INI TAMBAHANNYA
        }]);

        if (!error) {
            // Tampilkan jam HP saat ini untuk konfirmasi visual
            const jamSekarang = new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
            
            await Swal.fire({ 
                icon: 'success', title: 'BERHASIL', 
                text: `${loc.name} - ${jamSekarang}`, 
                timer: 2000, showConfirmButton: false 
            });
            loadChiefLogs();
        } else {
            Swal.fire('Error', 'Gagal simpan data', 'error');
        }
    } else {
        Swal.fire('Gagal', 'QR Code Salah', 'error');
    }
}

// ==========================================
// 5. SESSION & LOGIN
// ==========================================
function checkSession() {
    const savedUser = localStorage.getItem('genbaUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        enterApplication(currentUser);
        setTimeout(checkUrlScan, 500); 
    } else {
        showSection('page-login');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const input = document.getElementById('username-input');
    const username = input.value.trim().toLowerCase();
    
    btn.innerText = 'Loading...'; btn.disabled = true;

    try {
        const { data, error } = await db.from('users').select('*').eq('username', username).single();
        if (error || !data) throw new Error('User not found');

        localStorage.setItem('genbaUser', JSON.stringify(data));
        currentUser = data;
        enterApplication(currentUser);
        checkUrlScan();

        const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 2000});
        Toast.fire({icon: 'success', title: `Halo, ${currentUser.full_name}`});
    } catch (err) {
        Swal.fire('Error', 'Username salah.', 'error');
    } finally {
        btn.innerText = 'MASUK SISTEM'; btn.disabled = false;
    }
}

function enterApplication(user) {
    document.getElementById('page-login').classList.add('hidden-section');
    document.getElementById('sidebar-panel').classList.remove('md:hidden');
    document.getElementById('sidebar-panel').classList.add('md:flex');
    document.getElementById('mobile-header').classList.remove('hidden-section');
    
    document.getElementById('sidebar-username').innerText = user.full_name;
    document.getElementById('sidebar-role').innerText = user.role.toUpperCase();
    document.getElementById('user-initial').innerText = user.full_name.charAt(0);

    // --- FITUR GANTI NAMA "HALO CHIEF" ---
    // Pastikan di index.html sudah ada id="welcome-chief"
    const welcomeEl = document.getElementById('welcome-chief');
    if (welcomeEl) {
        welcomeEl.innerText = `👋 Halo, ${user.full_name}!`;
    }

    updateMenu(user.role);

    if (user.role === 'chief') initChiefMode();
    else if (user.role === 'dept_head') initDeptHeadMode();
    else if (user.role === 'admin') initAdminMode();
}

function logout() {
    localStorage.removeItem('genbaUser');
    if (dashboardInterval) clearInterval(dashboardInterval);
    window.location.href = window.location.pathname; 
}

// ==========================================
// 6. NAVIGASI
// ==========================================
function showSection(sectionId) {
    document.querySelectorAll('main section').forEach(el => el.classList.add('hidden-section'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.remove('hidden-section');
}

function updateMenu(role) {
    const nav = document.getElementById('nav-container');
    if(!nav) return;
    nav.innerHTML = ''; 
    let menuItems = [];
    if (role === 'admin') menuItems.push({ id: 'page-admin', icon: 'fa-qrcode', text: 'Manajemen QR' });
    if (role === 'chief') menuItems.push({ id: 'page-chief', icon: 'fa-list', text: 'Riwayat Scan' });
    if (role === 'dept_head') menuItems.push({ id: 'page-depthead', icon: 'fa-chart-line', text: 'Dashboard' });

    menuItems.forEach(item => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left px-4 py-3 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center gap-3";
        btn.innerHTML = `<i class="fa-solid ${item.icon} w-6"></i> ${item.text}`;
        btn.onclick = () => showSection(item.id);
        nav.appendChild(btn);
    });
    if (menuItems.length > 0) showSection(menuItems[0].id);
}

// ==========================================
// 7. LOAD DATA (JAM NETRAL)
// ==========================================
async function initChiefMode() { loadChiefLogs(); }
async function initDeptHeadMode() { 
    // Set input tanggal ke hari ini (YYYY-MM-DD)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // Format: 2026-02-12
    const dateInput = document.getElementById('filter-date');
    if(dateInput) {
        dateInput.value = today;
        // Langsung panggil fungsi cari biar tabel keisi otomatis
        cariHistory(); 
    }
    
    renderDashboard(); 
    dashboardInterval = setInterval(renderDashboard, 10000); 
}
async function initAdminMode() { loadAdminQR(); }

async function loadChiefLogs() {
    // Filter hari ini (Format YYYY-MM-DD standar)
    const today = new Date().toISOString().split('T')[0];

    const { data } = await db.from('genba_logs').select('*, locations(name)')
        .gte('scan_time', today).eq('user_name', currentUser.full_name)
        .order('scan_time', { ascending: false }).limit(10);

    const ul = document.getElementById('chief-logs');
    if(ul) {
        ul.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(log => {
                const li = document.createElement('li');
                li.className = "bg-white p-3 rounded border border-slate-200 flex justify-between items-center";
                li.innerHTML = `
                    <span class="font-bold text-sm text-slate-700">${log.locations.name}</span>
                    <div class="text-right">
                        <span class="block text-xs font-bold text-slate-700">${formatWaktu(log.scan_time)}</span>
                        <span class="text-[10px] text-slate-400">${formatTanggal(log.scan_time)}</span>
                    </div>
                `;
                ul.appendChild(li);
            });
        } else {
            ul.innerHTML = '<li class="text-center text-sm text-slate-400 py-2">Belum ada scan hari ini.</li>';
        }
    }
}

async function renderDashboard() {
    // 1. Tentukan batas waktu HARI INI dan SHIFT SAAT INI
    const today = new Date().toISOString().split('T')[0];
    const shiftNow = getShift(); // Ini yang bikin reset otomatis (Shift 1/2/3)

    // Update Teks Shift di Pojok Kanan Atas
    const elShift = document.getElementById('monitor-shift');
    if (elShift) elShift.innerText = shiftNow; 

    // 2. Ambil Lokasi & Log HANYA untuk Shift Saat Ini
    const { data: locs } = await db.from('locations').select('*').order('id');
    
    // Kita filter: Hanya ambil data yang 'shift'-nya SAMA dengan shift sekarang
    // Jadi kalau sekarang Shift 2, data Shift 1 tadi pagi GAK AKAN KEAMBIL (Otomatis Reset/Merah)
    const { data: logs } = await db.from('genba_logs')
        .select('*')
        .eq('shift', shiftNow) 
        .gte('scan_time', today);

    const container = document.getElementById('line-status-container');
    if(!container) return;
    container.innerHTML = '';
    
    if(locs) {
        locs.forEach(loc => {
            // Cek apakah lokasi ini ada di daftar logs shift sekarang?
            const log = logs ? logs.find(l => l.location_id === loc.id) : null;
            const isDone = !!log;
            
            let html = '';
            if (isDone) {
                // STATUS: SUDAH (HIJAU)
                html = `
                <div class="bg-green-50 border border-green-200 p-4 rounded-xl shadow-sm relative overflow-hidden">
                    <div class="absolute right-0 top-0 bg-green-200 text-green-800 text-[10px] font-bold px-2 py-1 rounded-bl">
                        ${log.shift} </div>
                    <div class="flex justify-between mb-2 mt-2">
                        <h4 class="font-bold text-sm text-slate-800">${loc.name}</h4>
                        <i class="fa-solid fa-circle-check text-green-500 text-xl"></i>
                    </div>
                    <div class="mt-2 pt-2 border-t border-green-200">
                        <p class="text-xs text-slate-500">Oleh: <b class="text-slate-800">${log.user_name}</b></p>
                        <p class="text-xs text-slate-400">Scan: ${formatWaktu(log.scan_time)}</p>
                    </div>
                </div>`;
            } else {
                // STATUS: BELUM (MERAH)
                html = `
                <div class="bg-white border-l-4 border-red-500 p-4 rounded-xl shadow-sm relative">
                    <div class="absolute right-2 top-2 bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded">
                        ${shiftNow} </div>
                    <div class="flex justify-between mb-2">
                        <h4 class="font-bold text-sm text-slate-800 opacity-70">${loc.name}</h4>
                        <i class="fa-solid fa-clock text-red-300 text-xl"></i>
                    </div>
                    <div class="mt-2 pt-2 border-t border-slate-100">
                        <p class="text-xs text-red-500 font-bold animate-pulse">BELUM DIVISIT</p>
                        <p class="text-[10px] text-slate-400">Menunggu scan...</p>
                    </div>
                </div>`;
            }
            container.innerHTML += html;
        });
    }

    // Update Tabel Log Kecil di Bawah Dashboard (Realtime All Shift)
    const { data: recent } = await db.from('genba_logs').select('*, locations(name)')
        .gte('scan_time', today) // Tampilkan semua shift hari ini biar Dept Head tau progress seharian
        .order('scan_time', { ascending: false }).limit(5);
    
    const tbody = document.getElementById('all-logs-table');
    if(tbody) {
        tbody.innerHTML = '';
        if (recent) recent.forEach(r => { 
            tbody.innerHTML += `
            <tr class="border-b border-slate-100">
                <td class="p-3 text-slate-500 text-xs">${formatWaktu(r.scan_time)}</td>
                <td class="p-3 font-bold text-slate-700">${r.user_name} <br> <span class="text-[10px] text-blue-500">${r.shift}</span></td>
                <td class="p-3 text-slate-600 text-xs">${r.locations.name}</td>
            </tr>`; 
        });
    }
}
async function loadAdminQR() {
    const { data: locs } = await db.from('locations').select('*').order('id');
    const container = document.getElementById('admin-qr-container');
    if(!container) return;
    container.innerHTML = '';
    if (locs) {
        locs.forEach(loc => {
            const div = document.createElement('div');
            div.className = "bg-white border border-slate-200 p-4 rounded-lg flex flex-col items-center text-center";
            const fullLink = APP_BASE_URL + 'scan=' + loc.code;
            div.innerHTML = `<h4 class="font-bold text-sm mb-2 text-slate-700">${loc.name}</h4><div id="qr-${loc.id}" class="mb-3 p-2 border rounded"></div><p class="text-[10px] text-slate-400 break-all mb-2">${fullLink}</p><button class="btn-print bg-slate-800 text-white text-xs px-4 py-2 rounded hover:bg-black transition">Print</button>`;
            setTimeout(() => { new QRCode(div.querySelector(`#qr-${loc.id}`), { text: fullLink, width: 100, height: 100 }); }, 100);
            div.querySelector('.btn-print').onclick = () => {
                const html = div.querySelector(`#qr-${loc.id}`).innerHTML;
                const win = window.open('', '', 'width=400,height=500'); 
                win.document.write(`<html><body style="text-align:center;font-family:sans-serif;padding-top:20px;"><h2>${loc.name}</h2><div style="display:flex;justify-content:center;margin:20px;">${html}</div><p>Scan untuk Genba</p></body></html>`); 
                win.document.close(); win.print();
            };
            container.appendChild(div);
        });
    }
}
// ==========================================
// 8. FITUR HISTORY DEPT HEAD
// ==========================================
async function cariHistory() {
    const inputDate = document.getElementById('filter-date').value;
    if (!inputDate) return Swal.fire('Pilih Tanggal Dulu', '', 'warning');

    const tbody = document.getElementById('all-logs-table');
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Loading data...</td></tr>';

    // TRIK JAM: Supaya pas 24 Jam Waktu Indonesia Barat (WIB)
    // Kita set range dari jam 00:00:00 WIB s/d 23:59:59 WIB
    // Kode +07:00 memastikan browser mengubahnya ke UTC yang sesuai untuk Supabase
    const start = new Date(`${inputDate}T00:00:00+07:00`).toISOString();
    const end = new Date(`${inputDate}T23:59:59+07:00`).toISOString();

    const { data, error } = await db.from('genba_logs')
        .select('*, locations(name)')
        .gte('scan_time', start) // Lebih besar dari jam 00:00 WIB
        .lte('scan_time', end)   // Lebih kecil dari jam 23:59 WIB
        .order('scan_time', { ascending: true }); // Urut dari pagi ke malam

    tbody.innerHTML = '';

    if (error) {
        console.error(error);
        return Swal.fire('Error', 'Gagal ambil data', 'error');
    }

    if (data && data.length > 0) {
        data.forEach(r => {
            // Kita pakai formatWaktu() yang tadi sudah kita benerin (Paksa WIB)
            const html = `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="p-3 text-slate-500 text-xs">
                    <span class="font-bold text-slate-700 text-sm">${formatWaktu(r.scan_time)}</span><br>
                    ${formatTanggal(r.scan_time)}
                </td>
                <td class="p-3 font-bold text-slate-700">${r.user_name}</td>
                <td class="p-3 text-slate-600">${r.locations.name}</td>
                <td class="p-3">
                    <span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded border border-blue-200">
                        ${r.shift}
                    </span>
                </td>
            </tr>`;
            tbody.innerHTML += html;
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400">Tidak ada riwayat scan pada tanggal ini.</td></tr>';
    }
}