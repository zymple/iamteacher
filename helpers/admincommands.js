import bcrypt from "bcrypt";
import { pool } from "./database.js";

export async function addUser(email, password) {
    const hash = await bcrypt.hash(password, 12);

    await pool.query(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)`,
        [email, hash]
    );

    return `✅ User created: ${email}`;
}

export async function deleteUser(email) {
    const res = await pool.query(
        `DELETE FROM users WHERE email = $1`,
        [email]
    );

    if (res.rowCount === 0) {
        return "❌ User not found";
    }

    return `🗑️ User deleted: ${email}`;
}

export async function resetPassword(email, newPassword) {
    const hash = await bcrypt.hash(newPassword, 12);

    const res = await pool.query(
        `UPDATE users SET password_hash = $1 WHERE email = $2`,
        [hash, email]
    );

    if (res.rowCount === 0) {
        return "❌ User not found";
    }

    return `🔑 Password reset for ${email}`;
}
