
import { pool } from "./database.js";

export async function getUserIdByEmail(email) {
    if (!email) return null;
    const res = await pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
    );
    return res.rows[0]?.id ?? null;
}

