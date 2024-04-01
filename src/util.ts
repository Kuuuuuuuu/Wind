import {pool} from './server';
import {RowDataPacket} from 'mysql2';

export function randomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export async function findUnusedUrlCode(): Promise<string> {
    const connection = await pool.getConnection();
    let urlCode: string;

    try {
        do {
            urlCode = randomString(Math.floor(Math.random() * (10 - 4 + 1)) + 4);
            const [rows]: [RowDataPacket[], unknown] = await connection.query('SELECT * FROM urls WHERE urlCode = ?', [
                [urlCode],
            ]);
            if (rows.length === 0) {
                return urlCode;
            }
        } while (!urlCode);
    } finally {
        connection.release();
    }
}
