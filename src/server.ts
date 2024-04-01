import {findUnusedUrlCode} from './util';
import dotenv from 'dotenv';
import express, {Request, Response} from 'express';
import helmet from 'helmet';
import {createPool, RowDataPacket} from 'mysql2';
import path from 'node:path';
import {isURL} from 'validator';

console.clear();
dotenv.config();

const app = express();

app.use(helmet());
app.use(helmet.xssFilter());
app.use(helmet.noSniff());
app.use(helmet.hidePoweredBy());
app.use(helmet.frameguard({action: 'deny'}));
app.use(helmet.referrerPolicy({policy: 'same-origin'}));
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        },
    })
);

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const pool = createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
}).promise();

try {
    pool.getConnection().then(async connection => {
        const queries = [
            `
            CREATE TABLE IF NOT EXISTS urls (
                id INT AUTO_INCREMENT PRIMARY KEY,
                url VARCHAR(255) NOT NULL,
                urlCode VARCHAR(10) NOT NULL
            )
        `,
        ];

        const promises = queries.map(query => connection.query(query));
        await Promise.all(promises);

        connection.release();
    });
} catch (error) {
    console.error('Error connecting to database or creating table: ', error);
}

app.get('/', async (req: Request, res: Response) => {
    try {
        // count the number of rows in the urls table
        const [rows]: [RowDataPacket[], unknown] = await pool.query('SELECT COUNT(*) as count FROM urls');
        const count = rows[0].count;
        res.render('index', {count});
    } catch (error) {
        console.error('Error getting URL count:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

app.post('/', async (req: Request, res: Response) => {
    const {url} = req.body;

    if (!url) {
        return res.status(400).json({success: false, message: 'URL is required'});
    }

    if (!isURL(url) || url.includes(process.env.BASE_URL)) {
        return res.status(400).json({success: false, message: 'Invalid URL'});
    }

    try {
        const urlCode = await findUnusedUrlCode();
        console.log('New URL:', url);
        await pool.query('INSERT INTO urls (url, urlCode) VALUES (?, ?)', [url, urlCode]);
        res.json({success: true, shortUrl: `${process.env.BASE_URL}/${urlCode}`});
    } catch (error) {
        console.error('Error inserting URL:', error);
        res.status(500).json({success: false, message: 'Internal server error'});
    }
});

app.get('/:code', async (req: Request, res: Response) => {
    const {code} = req.params;

    if (!code) {
        return res.redirect('/');
    }

    try {
        const [rows]: [RowDataPacket[], unknown] = await pool.query('SELECT * FROM urls WHERE urlCode = ?', [code]);

        if (rows.length === 0) {
            return res.status(404).json({message: 'URL not found'});
        }

        res.redirect(rows[0].url);
    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Internal server error'});
    }
});

app.use((req: Request, res: Response) => {
    res.status(404).json({message: 'Not found'});
});

app.use((err: Error, req: Request, res: Response) => {
    console.error(err);
    res.status(500).json({message: 'Internal server error'});
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});

export {pool};
