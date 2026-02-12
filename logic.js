// ==========================================
// 1. KONEKSI SERVER (SUPABASE)
// ==========================================
const PROJECT_URL = 'https://fbfvhcwisvlyodwvmpqg.supabase.co';
const PROJECT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnZoY3dpc3ZseW9kd3ZtcHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ2MzQsImV4cCI6MjA3MjM5MDYzNH0.mbn9B1xEr_8kmC2LOP5Jv5O7AEIK7Fa1gxrqJ91WNx4';

let db; 

try {
    db = window.supabase.createClient(PROJECT_URL, PROJECT_KEY);
    console.log("Database Connected");
    const statusEl = document.getElementById('login-status');
    if(statusEl) {
        statusEl.innerText = "Server Connected ✅";
        statusEl.classList.add('text-green-500');
    }
} catch (e) {
    console.error("Error init supabase:", e);
}

// ==========================================
// 2. GLOBAL VARIABLES
// ==========================================
let currentUser = null;
let locations = [];
let html5QrcodeScanner = null;
let dashboardInterval = null;

// ==========================================
// 3. MAIN EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setInterval(updateClock, 1000);
    updateClock();
    checkSession(); // Auto Login

    const loginForm = document.getElementById('form-login');
    if(loginForm) loginForm.addEventListener('submit', handleLogin);

    const btnLogoutSide = document.getElementById('btn-logout-sidebar');
    if(btnLogoutSide) btnLogoutSide.addEventListener('click', logout);
    
    const btnLogoutMob = document.getElementById('btn-logout-mobile');
    if(btnLogoutMob) btnLogoutMob.addEventListener('click', logout);
});

// Auto Login Logic
function checkSession() {
    const savedUser = localStorage.getItem('genbaUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        enterApplication(currentUser);
    }
}

// ==========================================
// 4. LOGIC LOGIN
// ==========================================
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const input = document.getElementById('username-input');
    const username = input.value.trim().toLowerCase();

    if (!username) return;

    btn.innerHTML = 'Checking...';
    btn.disabled = true;

    try {
        const { data, error } = await db
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) throw new Error('User not found');

        localStorage.setItem('genbaUser', JSON.stringify(data));
        currentUser = data;
        enterApplication(currentUser);
        
        Swal.fire({
            icon: 'success', title: `Halo, ${currentUser.full_name}`,
            toast: true, position: 'top-end', showConfirmButton: false, timer: 2000
        });

    } catch (err) {
        Swal.fire('Gagal', 'Username salah / Koneksi error.', 'error');
    } finally {
        btn.innerText = 'MASUK SISTEM';
        btn.disabled = false;
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
    if (user.role === 'dept_head') initDeptHeadMode();
    if (user.role === 'admin') initAdminMode();
}

function logout() {
    localStorage.removeItem('genbaUser');
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => html5QrcodeScanner.clear()).catch(err => console.log(err));
    }
    if (dashboardInterval) clearInterval(dashboardInterval);
    location.reload();
}

// ==========================================
// 5. NAVIGASI UI
// ==========================================
function showSection(sectionId) {
    document.querySelectorAll('main section').forEach(el => el.classList.add('hidden-section'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.remove('hidden-section');
    
    // Matikan scanner jika pindah dari halaman chief
    if(sectionId !== 'page-chief' && html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => html5QrcodeScanner.clear());
        // Reset tampilan scanner
        document.getElementById('reader').innerHTML = ''; 
        document.getElementById('btn-start-scan').classList.remove('hidden-section');
    }
}

function updateMenu(role) {
    const nav = document.getElementById('nav-container');
    if(!nav) return;
    nav.innerHTML = ''; 

    let menuItems = [];
    if (role === 'admin') menuItems.push({ id: 'page-admin', icon: 'fa-qrcode', text: 'Manajemen QR' });
    if (role === 'chief') menuItems.push({ id: 'page-chief', icon: 'fa-camera', text: 'Scan Barcode' });
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
// 6. UTILITIES
// ==========================================
function getShift() {
    const h = new Date().getHours();
    if (h >= 7 && h < 15) return 'SHIFT 1';
    if (h >= 15 && h < 23) return 'SHIFT 2';
    return 'SHIFT 3';
}

function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    const elClock = document.getElementById('clock');
    if (elClock) elClock.innerText = time;
    const elShift = document.getElementById('monitor-shift');
    if (elShift) elShift.innerText = getShift();
    const elBadge = document.getElementById('chief-shift-badge');
    if (elBadge) elBadge.innerText = getShift();
}

// ==========================================
// 7. MODE CHIEF (SCANNER - VERSI AMAN)
// ==========================================
async function initChiefMode() {
    const { data } = await db.from('locations').select('*');
    if (data) locations = data;
    loadChiefLogs();

    // RESET SCANNER AREA (Inject Tombol Manual)
    const readerDiv = document.getElementById('reader');
    readerDiv.innerHTML = `
        <div class="flex flex-col items-center justify-center h-48 bg-slate-800 text-white" id="scan-placeholder">
            <i class="fa-solid fa-camera text-4xl mb-4 text-slate-500"></i>
            <button id="btn-start-scan" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition transform active:scale-95">
                <i class="fa-solid fa-power-off mr-2"></i> MULAI KAMERA
            </button>
            <p class="text-xs text-slate-400 mt-2">Klik tombol untuk scan</p>
        </div>
    `;

    // Pasang listener ke tombol yang baru dibuat
    document.getElementById('btn-start-scan').onclick = startScanner;
}

function startScanner() {
    // Bersihkan placeholder
    document.getElementById('reader').innerHTML = '';

    html5QrcodeScanner = new Html5Qrcode("reader");
    
    // Config RINGAN (FPS Rendah biar ga panas/crash)
    const config = { 
        fps: 5, // Turunkan dari 10 ke 5 biar enteng
        qrbox: { width: 200, height: 200 },
        aspectRatio: 1.0
    };
    
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        config, 
        onScanSuccess
    ).catch(err => {
        console.error(err);
        Swal.fire("Kamera Gagal", "Pastikan izin kamera aktif & buka via HTTPS (bukan http).", "error");
        // Kembalikan tombol jika gagal
        initChiefMode();
    });
}

async function onScanSuccess(decodedText) {
    // Pause kamera biar ga scan berkali2
    html5QrcodeScanner.pause();
    
    const loc = locations.find(l => l.code === decodedText);

    if (loc) {
        Swal.fire({
            title: 'Menyimpan...',
            text: loc.name,
            didOpen: () => Swal.showLoading()
        });

        const { error } = await db.from('genba_logs').insert([{
            user_name: currentUser.full_name,
            location_id: loc.id,
            shift: getShift()
        }]);

        if (!error) {
            await Swal.fire({
                icon: 'success', title: 'OK', text: 'Data masuk', 
                timer: 1000, showConfirmButton: false
            });
            loadChiefLogs();
        } else {
            Swal.fire('Gagal', 'Koneksi database error.', 'error');
        }
    } else {
        await Swal.fire('QR Salah', 'Bukan QR Line Painting.', 'warning');
    }
    
    // Resume kamera setelah 1 detik
    setTimeout(() => {
        try { html5QrcodeScanner.resume(); } catch(e){}
    }, 1000);
}

async function loadChiefLogs() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await db
        .from('genba_logs')
        .select('*, locations(name)')
        .gte('scan_time', today)
        .eq('user_name', currentUser.full_name)
        .order('scan_time', { ascending: false })
        .limit(5);

    const ul = document.getElementById('chief-logs');
    if(ul) {
        ul.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(log => {
                const li = document.createElement('li');
                li.className = "bg-white p-3 rounded border border-slate-200 flex justify-between items-center";
                li.innerHTML = `
                    <span class="font-bold text-sm text-slate-700">${log.locations.name}</span>
                    <span class="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">${new Date(log.scan_time).toLocaleTimeString()}</span>
                `;
                ul.appendChild(li);
            });
        } else {
            ul.innerHTML = '<li class="text-center text-sm text-slate-400 py-2">Belum ada scan.</li>';
        }
    }
}

// ==========================================
// 8. MODE DEPT HEAD (MONITORING)
// ==========================================
async function initDeptHeadMode() {
    renderDashboard();
    dashboardInterval = setInterval(renderDashboard, 10000);
}

async function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const shiftNow = getShift();

    const { data: locs } = await db.from('locations').select('*').order('id');
    const { data: logs } = await db.from('genba_logs')
        .select('*')
        .eq('shift', shiftNow)
        .gte('scan_time', today);

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

    const { data: recent } = await db
        .from('genba_logs')
        .select('*, locations(name)')
        .order('scan_time', { ascending: false })
        .limit(10);
    
    const tbody = document.getElementById('all-logs-table');
    if(tbody) {
        tbody.innerHTML = '';
        if (recent) {
            recent.forEach(r => {
                const tr = document.createElement('tr');
                tr.className = "border-b border-slate-100 hover:bg-slate-50";
                tr.innerHTML = `<td class="p-3 text-slate-500 text-xs">${new Date(r.scan_time).toLocaleString()}</td><td class="p-3 font-bold text-slate-700">${r.user_name}</td><td class="p-3 text-slate-600">${r.locations.name}</td>`;
                tbody.appendChild(tr);
            });
        }
    }
}

// ==========================================
// 9. MODE ADMIN (QR GENERATOR)
// ==========================================
async function initAdminMode() {
    const { data: locs } = await db.from('locations').select('*').order('id');
    const container = document.getElementById('admin-qr-container');
    if(!container) return;
    container.innerHTML = '';
    if (locs) {
        locs.forEach(loc => {
            const div = document.createElement('div');
            div.className = "bg-white border border-slate-200 p-4 rounded-lg flex flex-col items-center text-center";
            div.innerHTML = `<h4 class="font-bold text-sm mb-2 text-slate-700">${loc.name}</h4><div id="qr-${loc.id}" class="mb-3 p-2 border rounded"></div><button class="btn-print bg-slate-800 text-white text-xs px-4 py-2 rounded hover:bg-black transition">Print</button>`;
            setTimeout(() => { new QRCode(div.querySelector(`#qr-${loc.id}`), { text: loc.code, width: 100, height: 100 }); }, 100);
            div.querySelector('.btn-print').onclick = () => {
                const html = div.querySelector(`#qr-${loc.id}`).innerHTML;
                const win = window.open('', '', 'width=400,height=400');
                win.document.write(`<html><body style="text-align:center;font-family:sans-serif;padding-top:50px;"><h2>${loc.name}</h2><div style="display:flex;justify-content:center;margin:20px;">${html}</div></body></html>`);
                win.document.close(); win.print();
            };
            container.appendChild(div);
        });
    }
}