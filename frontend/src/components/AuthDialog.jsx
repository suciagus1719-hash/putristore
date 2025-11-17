// frontend/src/components/AuthDialog.jsx
import React, { useState } from 'react';
import { API, saveUser } from '../config';

export default function AuthDialog({ open, onClose }) {
  const [mode, setMode] = useState('register'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg('');
    try {
      const url = mode === 'register' ? '/api/register' : '/api/login';
      const payload = mode === 'register'
        ? { username, password, whatsapp }
        : { username, password };

      const res = await API(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res?.status) {
        saveUser(res.user);
        setMsg(res.msg || 'Sukses!');
        onClose?.(); // tutup modal
      } else {
        setMsg(res?.error || res?.data?.msg || 'Gagal, coba lagi.');
      }
    } catch (err) {
      setMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {mode === 'register' ? 'Daftar Akun' : 'Login'}
          </h2>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Username</label>
            <input
              className="w-full rounded-lg border px-3 py-2 outline-purple-500"
              value={username} onChange={e=>setUsername(e.target.value)} required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border px-3 py-2 outline-purple-500"
              value={password} onChange={e=>setPassword(e.target.value)} required
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm mb-1">Nomor WhatsApp</label>
              <input
                className="w-full rounded-lg border px-3 py-2 outline-purple-500"
                value={whatsapp} onChange={e=>setWhatsapp(e.target.value)}
                placeholder="08xxxxxxxxxx"
              />
            </div>
          )}

          {msg && <div className="text-sm text-red-600">{msg}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-500 py-2 font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Memproses...' : (mode === 'register' ? 'Daftar' : 'Login')}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          {mode === 'register' ? (
            <>
              Sudah punya akun?{' '}
              <button className="text-purple-600 underline" onClick={()=>setMode('login')}>Login</button>
            </>
          ) : (
            <>
              Belum punya akun?{' '}
              <button className="text-purple-600 underline" onClick={()=>setMode('register')}>Daftar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
