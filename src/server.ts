import {findUnusedUrlCode, queryDatabase} from './util';
import dotenv from 'dotenv';
import express, {Request, Response} from 'express';
import helmet from 'helmet';
import {createPool} from 'mysql2';
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

export const pool = createPool({
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
        await queryDatabase(
            'CREATE TABLE IF NOT EXISTS urls (id INT AUTO_INCREMENT PRIMARY KEY, url VARCHAR(255) NOT NULL, urlCode VARCHAR(20) NOT NULL)'
        );

        connection.release();
    });
} catch (error) {
    console.error('Error connecting to database or creating table: ', error);
}

app.get('/', async (_req: Request, res: Response) => {
    try {
        const rows = await queryDatabase('SELECT COUNT(*) as count FROM urls');
        const count = rows[0]?.count || 0;

        res.render('index', {count});
    } catch (error) {
        console.error(error);
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
        await queryDatabase('INSERT INTO urls (url, urlCode) VALUES (?, ?)', [url, urlCode]);

        const shortUrl = `${process.env.BASE_URL}/${urlCode}`;

        res.json({success: true, shortUrl});
    } catch (error) {
        console.error(error);
        res.status(500).json({success: false, message: 'Internal server error'});
    }
});

app.get('/:code', async (req: Request, res: Response) => {
    const {code} = req.params;

    if (!code) {
        return res.redirect('/');
    }

    try {
        const rows = await queryDatabase('SELECT * FROM urls WHERE urlCode = ?', [code]);

        if (rows.length === 0) {
            return res.status(404).json({message: 'URL not found'});
        }

        res.redirect(rows[0].url);
    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Internal server error'});
    }
});

app.use((_req: Request, res: Response) => {
    res.status(404).json({message: 'Not found'});
});

app.use((err: Error, _req: Request, res: Response) => {
    console.error(err);
    res.status(500).json({message: 'Internal server error'});
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
