// frontend/src/config.js
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export async function API(path, opts = {}) {
  const res = await fetch(API_BASE + path, opts);
  // kalau backend balikin non-JSON, cegah crash
  try { return await res.json(); } catch { return { error: 'Non-JSON response' } }
}

export function saveUser(user){
  localStorage.setItem('user', JSON.stringify(user || null));
}
export function getUser(){
  const raw = localStorage.getItem('user');
  try { return raw ? JSON.parse(raw) : null } catch { return null }
}
export function logout(){
  localStorage.removeItem('user');
}
