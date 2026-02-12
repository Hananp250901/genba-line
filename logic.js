// ==========================================
// 1. KONEKSI SERVER (SUPABASE)
// ==========================================
// Saya sudah masukkan key punya lu di sini.
const PROJECT_URL = 'https://fbfvhcwisvlyodwvmpqg.supabase.co';
const PROJECT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnZoY3dpc3ZseW9kd3ZtcHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ2MzQsImV4cCI6MjA3MjM5MDYzNH0.mbn9B1xEr_8kmC2LOP5Jv5O7AEIK7Fa1gxrqJ91WNx4';

// KITA GANTI NAMA VARIABEL JADI 'db' SUPAYA TIDAK BENTROK
let db; 

try {
    // window.supabase adalah bawaan library
    // db adalah koneksi kita
    db = window.supabase.createClient(PROJECT_URL, PROJECT_KEY);
    
    console.log("Database Connected");
    // Cek elemen ada atau tidak sebelum ubah text (biar ga error null)
    const statusEl = document.getElementById('login-status');
    if(statusEl) {
        statusEl.innerText = "Server Connected ✅";
        statusEl.classList.add('text-green-500');
    }
} catch (e) {
    console.error("Error init supabase:", e);
    alert("Gagal konek Supabase. Cek internet.");
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
    // Jalankan jam
    setInterval(updateClock, 1000);
    updateClock();

    // Listener Tombol Login
    const loginForm = document.getElementById('form-login');
    if(loginForm) loginForm.addEventListener('submit', handleLogin);

    // Listener Logout
    const btnLogoutSide = document.getElementById('btn-logout-sidebar');
    if(btnLogoutSide) btnLogoutSide.addEventListener('click', logout);
    
    const btnLogoutMob = document.getElementById('btn-logout-mobile');
    if(btnLogoutMob) btnLogoutMob.addEventListener('click', logout);
});

// ==========================================
// 4. FUNGSI NAVIGASI
// ==========================================
function showSection(sectionId) {
    // Sembunyikan semua section
    document.querySelectorAll('main section').forEach(el => el.classList.add('hidden-section'));
    // Tampilkan yang dipilih
    const target = document.getElementById(sectionId);
    if(target) target.classList.remove('hidden-section');
}

function updateMenu(role) {
    const nav = document.getElementById('nav-container');
    if(!nav) return;
    
    nav.innerHTML = ''; // Reset

    let menuItems = [];

    if (role === 'admin') {
        menuItems.push({ id: 'page-admin', icon: 'fa-qrcode', text: 'Manajemen QR' });
    }
    if (role === 'chief') {
        menuItems.push({ id: 'page-chief', icon: 'fa-camera', text: 'Scan Barcode' });
    }
    if (role === 'dept_head') {
        menuItems.push({ id: 'page-depthead', icon: 'fa-chart-line', text: 'Dashboard' });
    }

    menuItems.forEach(item => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left px-4 py-3 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center gap-3";
        btn.innerHTML = `<i class="fa-solid ${item.icon} w-6"></i> ${item.text}`;
        btn.onclick = () => showSection(item.id);
        nav.appendChild(btn);
    });

    // Default open page
    if (menuItems.length > 0) showSection(menuItems[0].id);
}

// ==========================================
// 5. LOGIC LOGIN
// ==========================================
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const input = document.getElementById('username-input');
    const username = input.value.trim().toLowerCase();

    if (!username) return;

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
    btn.disabled = true;

    try {
        // GANTI 'supabase' JADI 'db' DISINI
        const { data, error } = await db
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) throw new Error('User not found');

        currentUser = data;
        
        // Setup UI
        document.getElementById('page-login').classList.add('hidden-section');
        document.getElementById('sidebar-panel').classList.remove('md:hidden');
        document.getElementById('sidebar-panel').classList.add('md:flex');
        document.getElementById('mobile-header').classList.remove('hidden-section');

        // Isi Info Sidebar
        document.getElementById('sidebar-username').innerText = currentUser.full_name;
        document.getElementById('sidebar-role').innerText = currentUser.role.toUpperCase();
        document.getElementById('user-initial').innerText = currentUser.full_name.charAt(0);

        // Buat Menu Sesuai Role
        updateMenu(currentUser.role);

        // Init Fitur Khusus
        if (currentUser.role === 'chief') initChiefMode();
        if (currentUser.role === 'dept_head') initDeptHeadMode();
        if (currentUser.role === 'admin') initAdminMode();

        Swal.fire({
            icon: 'success',
            title: `Selamat Datang, ${currentUser.full_name}`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });

    } catch (err) {
        console.error(err);
        Swal.fire('Gagal', 'Username tidak ditemukan. Coba: yanto / singgih / admin', 'error');
    } finally {
        btn.innerText = 'MASUK SISTEM';
        btn.disabled = false;
    }
}

function logout() {
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    if (dashboardInterval) clearInterval(dashboardInterval);
    location.reload();
}

// ==========================================
// 6. UTILITIES (WAKTU & SHIFT)
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
// 7. MODE CHIEF (SCANNER)
// ==========================================
async function initChiefMode() {
    // GANTI 'supabase' JADI 'db'
    const { data } = await db.from('locations').select('*');
    if (data) locations = data;
    
    loadChiefLogs();
    startScanner();
}

function startScanner() {
    // Pastikan elemen reader ada
    if(!document.getElementById('reader')) return;

    html5QrcodeScanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess)
        .catch(err => {
            console.error(err);
            Swal.fire("Camera Error", "Izin kamera diperlukan atau device tidak support.", "error");
        });
}

async function onScanSuccess(decodedText) {
    html5QrcodeScanner.pause();
    
    const loc = locations.find(l => l.code === decodedText);

    if (loc) {
        Swal.fire({
            title: 'Memproses...',
            text: `Menyimpan data ${loc.name}`,
            didOpen: () => Swal.showLoading()
        });

        // GANTI 'supabase' JADI 'db'
        const { error } = await db.from('genba_logs').insert([{
            user_name: currentUser.full_name,
            location_id: loc.id,
            shift: getShift()
        }]);

        if (!error) {
            await Swal.fire({
                icon: 'success',
                title: 'BERHASIL',
                text: `${loc.name} berhasil discan.`,
                timer: 1500,
                showConfirmButton: false
            });
            loadChiefLogs();
        } else {
            Swal.fire('Gagal', 'Koneksi database error.', 'error');
        }
    } else {
        await Swal.fire('QR Salah', 'Ini bukan QR Code Line Painting.', 'warning');
    }
    
    setTimeout(() => html5QrcodeScanner.resume(), 1500);
}

async function loadChiefLogs() {
    const today = new Date().toISOString().split('T')[0];
    
    // GANTI 'supabase' JADI 'db'
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
            ul.innerHTML = '<li class="text-center text-sm text-slate-400 py-2">Belum ada scan shift ini.</li>';
        }
    }
}

// ==========================================
// 8. MODE DEPT HEAD (MONITORING)
// ==========================================
async function initDeptHeadMode() {
    renderDashboard();
    // Auto refresh 10 detik
    dashboardInterval = setInterval(renderDashboard, 10000);
}

async function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const shiftNow = getShift();

    // GANTI 'supabase' JADI 'db'
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
    
            let html = '';
            if (isDone) {
                html = `
                <div class="bg-green-50 border border-green-200 p-4 rounded-xl shadow-sm">
                    <div class="flex justify-between mb-2">
                        <h4 class="font-bold text-sm text-slate-800">${loc.name}</h4>
                        <i class="fa-solid fa-circle-check text-green-500 text-xl"></i>
                    </div>
                    <div class="mt-2 pt-2 border-t border-green-200">
                        <p class="text-xs text-slate-500">Oleh: <b>${log.user_name}</b></p>
                        <p class="text-xs text-slate-400">Jam: ${new Date(log.scan_time).toLocaleTimeString()}</p>
                    </div>
                </div>`;
            } else {
                html = `
                <div class="bg-white border-l-4 border-red-500 p-4 rounded-xl shadow-sm">
                    <div class="flex justify-between mb-2">
                        <h4 class="font-bold text-sm text-slate-800 opacity-70">${loc.name}</h4>
                        <i class="fa-solid fa-clock text-red-300 text-xl"></i>
                    </div>
                    <div class="mt-2 pt-2 border-t border-slate-100">
                        <p class="text-xs text-red-500 font-bold">BELUM DIVISIT</p>
                    </div>
                </div>`;
            }
            container.innerHTML += html;
        });
    }

    // Tabel Log Bawah
    // GANTI 'supabase' JADI 'db'
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
                tr.innerHTML = `
                    <td class="p-3 text-slate-500 text-xs">${new Date(r.scan_time).toLocaleString()}</td>
                    <td class="p-3 font-bold text-slate-700">${r.user_name}</td>
                    <td class="p-3 text-slate-600">${r.locations.name}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
}

// ==========================================
// 9. MODE ADMIN (QR GENERATOR)
// ==========================================
async function initAdminMode() {
    // GANTI 'supabase' JADI 'db'
    const { data: locs } = await db.from('locations').select('*').order('id');
    const container = document.getElementById('admin-qr-container');
    if(!container) return;
    
    container.innerHTML = '';

    if (locs) {
        locs.forEach(loc => {
            const div = document.createElement('div');
            div.className = "bg-white border border-slate-200 p-4 rounded-lg flex flex-col items-center text-center";
            div.innerHTML = `
                <h4 class="font-bold text-sm mb-2 text-slate-700">${loc.name}</h4>
                <div id="qr-${loc.id}" class="mb-3 p-2 border rounded"></div>
                <button class="btn-print bg-slate-800 text-white text-xs px-4 py-2 rounded hover:bg-black transition">
                    Print QR
                </button>
            `;
            
            // Generate QR
            setTimeout(() => {
                new QRCode(div.querySelector(`#qr-${loc.id}`), {
                    text: loc.code,
                    width: 100,
                    height: 100
                });
            }, 100);

            // Print Action
            div.querySelector('.btn-print').onclick = () => {
                const html = div.querySelector(`#qr-${loc.id}`).innerHTML;
                const win = window.open('', '', 'width=400,height=400');
                win.document.write(`
                    <html>
                    <body style="text-align:center;font-family:sans-serif; padding-top: 50px;">
                        <h2>${loc.name}</h2>
                        <div style="display:flex;justify-content:center;margin:20px;">${html}</div>
                        <p style="font-size:12px;">GENBA POINT SCAN</p>
                    </body>
                    </html>
                `);
                win.document.close();
                win.print();
            };

            container.appendChild(div);
        });
    }
}