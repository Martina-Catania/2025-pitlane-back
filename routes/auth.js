const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

async function verifySupabaseToken(token) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return null;
    }

    const userEndpoint = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`;
    const response = await fetch(userEndpoint, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        return null;
    }

    return response.json();
}

async function authenticateJWT(req, res, next) {
    // Skip authentication for OPTIONS requests (preflight)
    if (req.method === 'OPTIONS') {
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('Auth error - No authorization header provided');
        return res.status(401).json({ error: 'No autorizado, token requerido' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'undefined' || token === 'null') {
        console.error('Auth error - Invalid bearer token payload');
        return res.status(403).json({ error: 'Token inválido' });
    }

    try {
        const supabaseUser = await verifySupabaseToken(token);
        if (supabaseUser) {
            req.user = {
                id: supabaseUser.id,
                email: supabaseUser.email,
                role: supabaseUser.role,
                source: 'supabase',
            };
            return next();
        }
    } catch (error) {
        console.error('Auth error - Supabase validation failed:', error.message);
    }

    if (!JWT_SECRET) {
        console.error('Auth error - JWT_SECRET is not configured');
        return res.status(500).json({ error: 'Configuración de autenticación inválida' });
    }

    jwt.verify(token, JWT_SECRET.trim(), (err, user) => {
        if (err) {
            console.error('Auth error - Invalid token:', err.message);
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        return next();
    });
}

module.exports = authenticateJWT;
