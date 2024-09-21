import {pool} from './server';
import {RowDataPacket} from 'mysql2';
import {randomBytes} from 'node:crypto';

export async function findUnusedUrlCode(): Promise<string> {
    const connection = await pool.getConnection();

    try {
        const usedCodes = await queryDatabase('SELECT urlCode FROM urls');
        const usedCodeSet = new Set(usedCodes.map(r => r.urlCode));

        let urlCode: string;
        do {
            const length = Math.floor(Math.random() * 7) + 6;
            urlCode = randomBytes(Math.ceil(length / 2))
                .toString('hex')
                .slice(0, length);
        } while (usedCodeSet.has(urlCode));

        return urlCode;
    } finally {
        connection.release();
    }
}

export async function queryDatabase(query: string, params: unknown[] = []) {
    try {
        const [rows]: [RowDataPacket[], unknown] = await pool.query(query, params);
        return rows;
    } catch (error) {
        console.error('Database query error:', error);
        throw new Error('Database error');
    }
}
