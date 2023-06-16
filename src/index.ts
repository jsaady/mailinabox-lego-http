import axios from 'axios';
import express from 'express';

export interface ACMEPayload {
    fqdn: string;
    value: string;
    type?: string;
}

export function validateBody (body: ACMEPayload) {
    if (!('fqdn' in body)) throw new Error('Missing fqdn');
    if (!('value' in body)) throw new Error('Missing value');
}

export function sanitizeBody (body: ACMEPayload) {
    const type = body.type ?? 'txt';
    let fqdn = body.fqdn;
    if (!fqdn.endsWith(process.env.MIAB_DOMAIN!) && !fqdn.endsWith(process.env.MIAB_DOMAIN! + '.')) {
        if (!fqdn.endsWith('.')) fqdn += '.';
        fqdn = fqdn + process.env.MIAB_DOMAIN!;
    }

    if (fqdn.endsWith('.')) {
        fqdn = fqdn.slice(0, -1);
    }

    return {
        ...body,
        type,
        fqdn,
    };
}


export function buildUrl ({ fqdn, type }: Omit<ACMEPayload, 'value'>): string {
    return `/admin/dns/custom/${fqdn}${type ? '/' + type.toLowerCase() : ''}`;
}

const {
    post,
    put,
    delete: del,
} = axios.create({
    baseURL: process.env.MIAB_URL,
    auth: {
        username: process.env.MIAB_USER!,
        password: process.env.MIAB_PASS!
    }
})

const app = express();

app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${res.statusCode} ${req.url} ${JSON.stringify(req.body)}`);
    });

    // check if basic auth is present and matches environment variables
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).send('Unauthorized');

    const [username, password] = Buffer.from(auth.split(' ')[1], 'base64').toString('ascii').split(':');

    if (username !== process.env.AUTH_USER || password !== process.env.AUTH_PASS) {
        return res.status(401).send('Unauthorized');
    }


    next();
});


app.use(express.json());

app.use((req, res, next) => {
    try {
        validateBody(req.body);
    } catch (err: any) {
        return res.status(400).send(err.message);
    }

    next();
});

app.use((req, res, next) => {
    next();
});

app.post('/present', async (req, res) => {
    const body: ACMEPayload = sanitizeBody(req.body);

    const { data } = await post(buildUrl(body), body.value);

    res.json(data);
});

app.post('/cleanup', async (req, res) => {
    const body: ACMEPayload = sanitizeBody(req.body);

    const { data } = await del(buildUrl(body));

    res.json(data);
});

app.post('/sync', async (req, res) => {
    const body: ACMEPayload = sanitizeBody(req.body);

    const { data } = await put(buildUrl({ fqdn: body.fqdn }));

    res.json(data);
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`Listening on port ${process.env.PORT || 3000}`);
});
