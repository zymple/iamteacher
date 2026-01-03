import pkg from "pg";
import bcrypt from "bcrypt";
import crypto from "crypto";

const { Pool } = pkg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export async function initDB() {
    const client = await pool.connect();
    try {
        const info = await client.query(`
        SELECT
            current_database() AS db,
            current_schema() AS schema,
            current_user AS user;
        `);
        console.log("Database Information:", info.rows[0]);

        await client.query("BEGIN");

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGSERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id UUID PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT UNIQUE NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now(),
                expires_at TIMESTAMPTZ,
                ip_address INET,
                user_agent TEXT,
                revoked BOOLEAN DEFAULT false
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS voice_sessions (
                id UUID PRIMARY KEY,
                session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                started_at TIMESTAMPTZ,
                ended_at TIMESTAMPTZ,
                duration_sec INTEGER,
                ip_address INET,
                user_agent TEXT
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS conversation_messages (
                id BIGSERIAL PRIMARY KEY,
                voice_session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role TEXT CHECK (role IN ('SYSTEM', 'USER', 'INFO')),
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS access_logs (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        `);

    // fix fk constraint to set user_id to NULL on user deletion
    await client.query(`
        ALTER TABLE access_logs
        DROP CONSTRAINT IF EXISTS access_logs_user_id_fkey
    `);

    await client.query(`
        ALTER TABLE access_logs
        ADD CONSTRAINT access_logs_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
    `);


        const users = await client.query(
            `SELECT id FROM users LIMIT 1`
        );

        if (users.rowCount === 0) {
            const passwordHash = await bcrypt.hash("demopassword", 12);

            await client.query(
                `
                INSERT INTO users (email, password_hash)
                VALUES ($1, $2)
                `,
                ["demo@demo.com", passwordHash]
            );

             console.log("Demo user (id=1) has been created! (email: demo@demo.com / password: demopassword)");
        }

        await client.query("COMMIT");
        console.log("Database schema init successfully!");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("There was an error when initting database schema: ", err);
        throw err;
    } finally {
        client.release();
    }
}

export async function logAccessDB({ userId = null, action, ip, ua }) {
    try {
        await pool.query(
            `
            INSERT INTO access_logs (user_id, action, ip_address, user_agent)
            VALUES ($1, $2, $3, $4)
            `,
            [userId, action, ip, ua]
        );
    } catch (err) {
        console.error("Database logging failed: ", err.message);
    }
}