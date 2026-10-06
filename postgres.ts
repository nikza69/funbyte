import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (error) => {
  console.error('[POSTGRES] Pool error:', error);
});

export async function testPostgres() {
  const result = await pool.query('SELECT NOW() AS time');

  console.log('[POSTGRES] Connected successfully');
  console.log('[POSTGRES] Database time:', result.rows[0].time);
}