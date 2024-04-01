import {pool} from './server';
import {RowDataPacket} from 'mysql2';
import {randomBytes} from 'node:crypto';

export async function findUnusedUrlCode(): Promise<string> {
    const connection = await pool.getConnection();
    let urlCode: string;

    try {
        do {
            urlCode = randomBytes(Math.floor(Math.random() * (4 - 2 + 1)) + 2).toString('hex');
            const [rows]: [RowDataPacket[], unknown] = await connection.query('SELECT urlCode FROM urls');
            const usedCodes = rows.map(r => r.urlCode);
            // idk this might be better
            if (!usedCodes.includes(urlCode)) {
                return urlCode;
            }
        } while (!urlCode);
    } finally {
        connection.release();
    }
}
