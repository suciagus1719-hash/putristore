// backend/index.js — PusatPanel API (POST, api_key/secret_key)

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const crypto = require('crypto') // tidak wajib, sedia kalau nanti provider minta signature
const fetch = require('node-fetch') // v2 (CommonJS)
const fs = require('fs')
const path = require('path')


dotenv.config()

const app = express()
app.use(cors())
app.use(bodyParser.json())

// ENV
const PORT = process.env.PORT || 3001
const BASE_URL = process.env.SMMPANEL_BASE_URL || 'https://pusatpanelsmm.com/api/json.php'
const API_KEY = process.env.SMMPANEL_API_KEY
const SECRET_KEY = process.env.SMMPANEL_SECRET // WAJIB ada menurut docs

if (!API_KEY || !SECRET_KEY) {
  console.warn('[WARN] Isi SMMPANEL_API_KEY dan SMMPANEL_SECRET di .env')
}

// ============== Helper panggil API ==============
async function providerCall(params) {
  const form = new URLSearchParams()
  form.append('api_key', API_KEY)
  form.append('secret_key', SECRET_KEY)
  // tambah param lain (action, service, dll)
  Object.entries(params || {}).forEach(([k, v]) => form.append(k, String(v ?? '')))

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { status:false, data:{ msg:'Non-JSON', raw:text } } }
}

// Normalisasi layanan (dari data[])
function normalizeServices(resp) {
  const cfg = loadConfig();
  const markup = Number(cfg.PRICE_MARKUP_PERCENT || 0);

  const arr = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
  return arr.map(s => {
    const name = s.name || '';
    const lower = name.toLowerCase();

    // platform (pakai category/tipe_logo jika ada)
    let platform = 'Other';
    const cat = String(s.category || '').toLowerCase();
    const logo = String(s.tipe_logo || '').toLowerCase();
    if (logo.includes('tiktok')) platform = 'TikTok';
    else if (logo.includes('instagram') || /instagram|ig/.test(lower)) platform = 'Instagram';
    else if (logo.includes('youtube') || /youtube|yt/.test(lower)) platform = 'YouTube';
    else if (logo.includes('facebook') || /facebook|fb/.test(lower)) platform = 'Facebook';
    else if (logo.includes('twitter') || /\btwitter\b|\bx\b/.test(lower)) platform = 'Twitter/X';
    else if (logo.includes('telegram') || /telegram/.test(lower)) platform = 'Telegram';

    // action
    let action = 'Other';
    const ref = `${cat} ${lower}`;
    if (/view|watch/.test(ref)) action = 'Views';
    else if (/like|heart/.test(ref)) action = 'Likes';
    else if (/follow|subs(criber)?/.test(ref)) action = 'Followers';
    else if (/comment/.test(ref)) action = 'Comments';
    else if (/share/.test(ref)) action = 'Shares';

    const base = Number(s.price || 0);              // dari provider
    const sell = Math.round(base * (1 + markup/100) * 100) / 100; // harga jual

    return {
      provider_service_id: s.id,
      name: s.name,
      platform,
      action,
      min: Number(s.min || 1),
      max: Number(s.max || 100000),
      rate_per_1k_provider: base, // info internal
      rate_per_1k: sell,          // harga tampil ke user
      description: s.note || '',
      category: s.category || ''
    };
  });
}


// Harga = rate/1000 * qty
function calcPrice(rate_per_1k, quantity) {
  return Math.round((Number(rate_per_1k) * Number(quantity) / 1000) * 100) / 100
}
// ---- simple JSON storage ----
const DATA_DIR = __dirname;
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadOrders() { return loadJSON(ORDERS_FILE, []); }
function saveOrders(v) { saveJSON(ORDERS_FILE, v); }

function loadConfig() {
  const cfg = loadJSON(CONFIG_FILE, {});
  if (cfg.PRICE_MARKUP_PERCENT == null) {
    cfg.PRICE_MARKUP_PERCENT = Number(process.env.PRICE_MARKUP_PERCENT || 0);
  }
  return cfg;
}
function saveConfig(cfg) { saveJSON(CONFIG_FILE, cfg); }


// ================== ROUTES ==================

// Banner dummy
app.get('/api/banners', (req, res) => {
  res.json([
    { id: 1, image_url: 'https://picsum.photos/1200/200?1', href: '#', is_active: true },
    { id: 2, image_url: 'https://picsum.photos/1200/200?2', href: '#', is_active: true }
  ])
})

// Cek profil/saldo
app.get('/api/profile', async (req, res) => {
  const out = await providerCall({ action: 'profile' })
  res.json(out)
})

// Platform list
app.get('/api/platforms', async (req, res) => {
  const out = await providerCall({ action: 'services' }) // POST + api_key + secret_key
  if (!out?.status) return res.status(502).json(out)
  const norm = normalizeServices(out)
  const platforms = [...new Set(norm.map(s => s.platform))].filter(Boolean)
  res.json(platforms)
})

// Actions by platform
app.get('/api/actions', async (req, res) => {
  const { platform } = req.query
  const out = await providerCall({ action: 'services' })
  if (!out?.status) return res.status(502).json(out)
  const norm = normalizeServices(out).filter(s => !platform || s.platform === platform)
  const actions = [...new Set(norm.map(s => s.action))]
  res.json(actions)
})

// Services filter
app.get('/api/services', async (req, res) => {
  const { platform, action } = req.query
  const out = await providerCall({ action: 'services' })
  if (!out?.status) return res.status(502).json(out)
  const norm = normalizeServices(out)
    .filter(s => !platform || s.platform === platform)
    .filter(s => !action || s.action === action)
  res.json(norm)
})

// Preview harga
app.post('/api/order/preview', async (req, res) => {
  const { provider_service_id, quantity = 100 } = req.body || {}
  if (!provider_service_id) return res.status(400).json({ error: 'provider_service_id required' })
  const out = await providerCall({ action: 'services' })
  if (!out?.status) return res.status(502).json(out)
  const svc = normalizeServices(out).find(s => String(s.provider_service_id) === String(provider_service_id))
  if (!svc) return res.status(404).json({ error: 'service not found' })
  const price = calcPrice(svc.rate_per_1k, quantity)
  res.json({ service: svc, price })
})

// Checkout (buat order → sesuai dokumen: action=order, service, data, quantity, komen/username opsional)
app.post('/api/order/checkout', async (req, res) => {
  const { provider_service_id, link, quantity = 100, komen = '', username = '' } = req.body || {}
  if (!provider_service_id || !link) return res.status(400).json({ error: 'provider_service_id & link required' })

  const orderRes = await providerCall({
    action: 'order',
    service: provider_service_id,
    data: link,       // docs: field 'data' = target/link/username
    quantity,
    komen,
    username
  })
  // contoh sukses: { status:true, data:{ id: "123" } } (sesuai docs)
  res.json(orderRes)
})

// Cek status order
app.get('/api/order/status', async (req, res) => {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id required' })
  const out = await providerCall({ action: 'status', id })
  res.json(out)
})
// Buat invoice (stub) & simpan pesanan PENDING
app.post('/api/order/checkout', async (req, res) => {
  try {
    const { provider_service_id, link, quantity = 100, nama = '' } = req.body || {};
    if (!provider_service_id || !link) return res.status(400).json({ error: 'provider_service_id & link required' });

    // ambil layanan untuk hitung harga jual
    const out = await providerCall({ action: 'services' });
    if (!out?.status) return res.status(502).json(out);
    const svc = normalizeServices(out).find(s => String(s.provider_service_id) === String(provider_service_id));
    if (!svc) return res.status(404).json({ error: 'service not found' });

    // hitung harga total
    const price = Math.round((svc.rate_per_1k * Number(quantity) / 1000) * 100) / 100;

    // simpan pesanan PENDING
    const orders = loadOrders();
    const order_id = 'ord_' + Date.now();
    const record = {
      order_id,
      created_at: new Date().toISOString(),
      customer_name: nama,
      link, quantity,
      service_id: svc.provider_service_id,
      service_name: svc.name,
      platform: svc.platform,
      action: svc.action,
      price,
      status: 'PENDING',
      provider_order_id: null
    };
    orders.push(record);
    saveOrders(orders);

    // invoice stub (ganti ke Xendit asli nanti)
    const invoice = {
      id: 'inv_' + Date.now(),
      invoice_url: (process.env.PUBLIC_BASE_URL || 'http://localhost:3000') + '/invoice/' + order_id,
      amount: price,
      status: 'PENDING'
    };

    res.json({ order_id, invoice, service: svc, price });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Tandai sudah bayar (demo)
app.post('/api/order/mark-paid', (req, res) => {
  const { order_id } = req.body || {};
  if (!order_id) return res.status(400).json({ error: 'order_id required' });

  const orders = loadOrders();
  const o = orders.find(x => x.order_id === order_id);
  if (!o) return res.status(404).json({ error: 'order not found' });

  o.status = 'PAID';
  saveOrders(orders);
  res.json({ status: true, order: o });
});

// Kirim ke provider setelah bayar
app.post('/api/order/execute', async (req, res) => {
  try {
    const { order_id } = req.body || {};
    if (!order_id) return res.status(400).json({ error: 'order_id required' });

    const orders = loadOrders();
    const o = orders.find(x => x.order_id === order_id);
    if (!o) return res.status(404).json({ error: 'order not found' });
    if (o.status !== 'PAID') return res.status(400).json({ error: 'order not paid' });

    // submit ke provider (sesuai dokumentasi)
    const r = await providerCall({
      action: 'order',
      service: o.service_id,
      data: o.link,
      quantity: o.quantity
    });

    if (!r?.status) return res.status(502).json(r);

    o.status = 'PROCESSING';
    o.provider_order_id = r?.data?.id || r?.data?.order_id || null;
    saveOrders(orders);

    res.json({ status: true, provider_order_id: o.provider_order_id, order: o });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
// Lookup order: by order_id ATAU by nama/whatsapp (parsial)
app.get('/api/orders/lookup', (req, res) => {
  const { order_id, q } = req.query;
  const orders = loadOrders();

  if (order_id) {
    const o = orders.find(x => x.order_id === order_id);
    return res.json(o ? [o] : []);
  }
  if (q) {
    const qq = String(q).toLowerCase();
    const list = orders.filter(x =>
      String(x.customer_name || '').toLowerCase().includes(qq) ||
      String(x.link || '').toLowerCase().includes(qq)
    ).slice(-50).reverse();
    return res.json(list);
  }
  res.json([]);
});
// Admin token sederhana (hash dari ADMIN_SECRET)
function adminToken() {
  const secret = process.env.ADMIN_SECRET || 'changeme';
  return require('crypto').createHash('sha256').update(secret).digest('hex');
}
function adminAuth(req, res, next) {
  const t = req.headers['x-admin-token'];
  if (t && t === adminToken()) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Admin login → balikan token
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });
  if (password === (process.env.ADMIN_SECRET || 'changeme')) {
    return res.json({ status: true, token: adminToken() });
  }
  res.status(401).json({ error: 'Wrong password' });
});

// Admin: lihat semua pesanan
app.get('/api/admin/orders', adminAuth, (req, res) => {
  const orders = loadOrders().slice().reverse();
  res.json(orders);
});

// Admin: get/set markup
app.get('/api/admin/config', adminAuth, (req, res) => {
  res.json(loadConfig());
});
app.post('/api/admin/config', adminAuth, (req, res) => {
  const cfg = loadConfig();
  const { PRICE_MARKUP_PERCENT } = req.body || {};
  if (PRICE_MARKUP_PERCENT != null) cfg.PRICE_MARKUP_PERCENT = Number(PRICE_MARKUP_PERCENT);
  saveConfig(cfg);
  res.json({ status: true, config: cfg });
});



// Debug mentahan services
app.get('/api/debug/services', async (req, res) => {
  const out = await providerCall({ action: 'services' })
  res.type('application/json').send(JSON.stringify(out, null, 2))
})


// Lokasi database sederhana (JSON)
const USERS_FILE = path.join(__dirname, 'users.json')

// Helper load & save
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
  } catch {
    return []
  }
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

// Endpoint Register
app.post('/api/register', (req, res) => {
  const { username, password, whatsapp } = req.body || {}
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' })

  const users = loadUsers()
  if (users.find(u => u.username === username))
    return res.status(400).json({ error: 'Username sudah digunakan' })

  const newUser = {
    id: Date.now(),
    username,
    password, // bisa diganti bcrypt kalau mau aman
    whatsapp: whatsapp || '',
    created_at: new Date().toISOString()
  }
  users.push(newUser)
  saveUsers(users)
  res.json({ status: true, msg: 'Registrasi berhasil', user: { username, whatsapp } })
})

// Endpoint Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {}
  const users = loadUsers()
  const user = users.find(u => u.username === username && u.password === password)
  if (!user) return res.status(401).json({ error: 'Username atau password salah' })

  res.json({ status: true, msg: 'Login berhasil', user: { username: user.username, whatsapp: user.whatsapp } })
})


app.listen(PORT, () => {
  console.log('Backend running on http://localhost:' + PORT)
})
