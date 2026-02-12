// ==========================================
// 1. CONFIG
// ==========================================
const PROJECT_URL = 'https://fbfvhcwisvlyodwvmpqg.supabase.co';
const PROJECT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnZoY3dpc3ZseW9kd3ZtcHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ2MzQsImV4cCI6MjA3MjM5MDYzNH0.mbn9B1xEr_8kmC2LOP5Jv5O7AEIK7Fa1gxrqJ91WNx4';

// !!! GANTI INI DENGAN LINK GITHUB ANDA !!!
// Contoh: 'https://hananp250901.github.io/genba-line/?'
const APP_BASE_URL = 'https://hananp250901.github.io/genba-line/?'; 

let db;
try {
    db = window.supabase.createClient(PROJECT_URL, PROJECT_KEY);
} catch (e) { console.error(e); }

let currentUser = null;
let locations = [];
let dashboardInterval = null;

// ==========================================
// 2. MAIN LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    setInterval(updateClock, 1000);
    updateClock();

    // 1. AMBIL LOKASI (WAJIB DULUAN)
    const { data, error } = await db.from('locations').select('*');
    if (data) {
        locations = data;
        console.log("Lokasi loaded:", locations.length);
    } else {
        alert("Gagal load data lokasi dari database!");
    }

    // 2. CEK LOGIN & SCAN
    checkSession();

    // Listener
    const loginForm = document.getElementById('form-login');
    if(loginForm) loginForm.addEventListener('submit', handleLogin);
    document.getElementById('btn-logout-sidebar').addEventListener('click', logout);
    document.getElementById('btn-logout-mobile').addEventListener('click', logout);
});

// ==========================================
// 3. SCANNING PROCESS (DEBUG MODE)
// ==========================================
async function checkUrlScan() {
    const urlParams = new URLSearchParams(window.location.search);
    const scanCode = urlParams.get('scan');

    // DEBUG: Cek apakah ada parameter scan?
    if (scanCode) {
        // Hapus parameter biar ga loop, tapi simpan di variabel
        window.history.replaceState({}, document.title, window.location.pathname);

        if (!currentUser) {
            Swal.fire('Login Dulu', 'Silakan login, lalu scan ulang.', 'warning');
            return;
        }

        if (currentUser.role !== 'chief') {
            Swal.fire('Akses Ditolak', 'Hanya Chief yang bisa scan.', 'error');
            return;
        }

        // PROSES SCAN
        await processScan(scanCode);
    }
}

async function processScan(code) {
    // Tampilkan loading biar user tau sistem bekerja
    Swal.fire({
        title: 'Mendeteksi Scan...',
        text: `Kode: ${code}`,
        didOpen: () => Swal.showLoading()
    });

    // Cek apakah lokasi ada di list yang sudah di-load
    // Kalau list kosong (karena internet lemot), kita fetch ulang paksa
    if (locations.length === 0) {
        const { data } = await db.from('locations').select('*');
        if (data) locations = data;
    }

    const loc = locations.find(l => l.code === code);

    if (loc) {
        // LOKASI KETEMU, COBA SIMPAN
        const { error } = await db.from('genba_logs').insert([{
            user_name: currentUser.full_name,
            location_id: loc.id,
            shift: getShift(),
            scan_time: new Date().toISOString() // Paksa waktu sekarang
        }]);

        if (!error) {
            await Swal.fire({
                icon: 'success',
                title: 'BERHASIL MASUK!',
                text: `${loc.name} tersimpan.`,
                timer: 2000,
                showConfirmButton: false
            });
            // Refresh List
            loadChiefLogs();
        } else {
            console.error(error);
            Swal.fire('Database Error', 'Gagal simpan: ' + error.message, 'error');
        }
    } else {
        Swal.fire('Lokasi Tidak Dikenal', `Kode ${code} tidak ada di database Locations.`, 'error');
    }
}

// ==========================================
// 4. SESSION & UTILS
// ==========================================
function checkSession() {
    const savedUser = localStorage.getItem('genbaUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        enterApplication(currentUser);
        // Cek scan SETELAH user dipastikan ada
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

function getShift() {
    const h = new Date().getHours();
    if (h >= 7 && h < 15) return 'SHIFT 1';
    if (h >= 15 && h < 23) return 'SHIFT 2';
    return 'SHIFT 3';
}
function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const elClock = document.getElementById('clock'); if (elClock) elClock.innerText = time;
    const elShift = document.getElementById('monitor-shift'); if (elShift) elShift.innerText = getShift();
    const elBadge = document.getElementById('chief-shift-badge'); if (elBadge) elBadge.innerText = getShift();
}

// ==========================================
// 5. DATA LOADING
// ==========================================
async function initChiefMode() { loadChiefLogs(); }
async function initDeptHeadMode() { renderDashboard(); dashboardInterval = setInterval(renderDashboard, 10000); }
async function initAdminMode() { loadAdminQR(); }

async function loadChiefLogs() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await db.from('genba_logs').select('*, locations(name)')
        .gte('scan_time', today).eq('user_name', currentUser.full_name)
        .order('scan_time', { ascending: false }).limit(5);

    const ul = document.getElementById('chief-logs');
    if(ul) {
        ul.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(log => {
                const li = document.createElement('li');
                li.className = "bg-white p-3 rounded border border-slate-200 flex justify-between items-center";
                li.innerHTML = `<span class="font-bold text-sm text-slate-700">${log.locations.name}</span><span class="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">${new Date(log.scan_time).toLocaleTimeString()}</span>`;
                ul.appendChild(li);
            });
        } else {
            ul.innerHTML = '<li class="text-center text-sm text-slate-400 py-2">Belum ada scan.</li>';
        }
    }
}

async function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const shiftNow = getShift();
    const { data: locs } = await db.from('locations').select('*').order('id');
    const { data: logs } = await db.from('genba_logs').select('*').eq('shift', shiftNow).gte('scan_time', today);

    const container = document.getElementById('line-status-container');
    if(!container) return;
    container.innerHTML = '';
    if(locs) {
        locs.forEach(loc => {
            const log = logs ? logs.find(l => l.location_id === loc.id) : null;
            const isDone = !!log;
            let html = isDone ? 
                `<div class="bg-green-50 border border-green-200 p-4 rounded-xl shadow-sm"><div class="flex justify-between mb-2"><h4 class="font-bold text-sm text-slate-800">${loc.name}</h4><i class="fa-solid fa-circle-check text-green-500 text-xl"></i></div><div class="mt-2 pt-2 border-t border-green-200"><p class="text-xs text-slate-500">Oleh: <b>${log.user_name}</b></p><p class="text-xs text-slate-400">Jam: ${new Date(log.scan_time).toLocaleTimeString()}</p></div></div>` : 
                `<div class="bg-white border-l-4 border-red-500 p-4 rounded-xl shadow-sm"><div class="flex justify-between mb-2"><h4 class="font-bold text-sm text-slate-800 opacity-70">${loc.name}</h4><i class="fa-solid fa-clock text-red-300 text-xl"></i></div><div class="mt-2 pt-2 border-t border-slate-100"><p class="text-xs text-red-500 font-bold">BELUM DIVISIT</p></div></div>`;
            container.innerHTML += html;
        });
    }
    const { data: recent } = await db.from('genba_logs').select('*, locations(name)').order('scan_time', { ascending: false }).limit(10);
    const tbody = document.getElementById('all-logs-table');
    if(tbody) {
        tbody.innerHTML = '';
        if (recent) recent.forEach(r => { tbody.innerHTML += `<tr class="border-b border-slate-100"><td class="p-3 text-slate-500 text-xs">${new Date(r.scan_time).toLocaleString()}</td><td class="p-3 font-bold text-slate-700">${r.user_name}</td><td class="p-3 text-slate-600">${r.locations.name}</td></tr>`; });
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