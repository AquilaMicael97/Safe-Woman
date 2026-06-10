// Em produção (Vercel), define VITE_API_BASE com a URL do Railway.
// Em desenvolvimento, fica vazio e o proxy do Vite resolve /api/*.
export const API_BASE = import.meta.env.VITE_API_BASE || ''
