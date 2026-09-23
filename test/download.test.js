const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { test } = require('node:test');
const vm = require('node:vm');
const puppeteer = require('puppeteer-core');

const source = fs.readFileSync(path.join(__dirname, '..', 'download.js'), 'utf8');
const script = new vm.Script(source, { filename: 'download.js' });

test('CommonJS loads the actual Puppeteer module and the APIs used by the downloader', () => {
    assert.equal(typeof puppeteer.launch, 'function');
    for (const method of ['goto', 'evaluate', 'url', 'cookies', 'setDefaultTimeout']) {
        assert.equal(typeof puppeteer.CdpPage.prototype[method], 'function', method);
    }
    for (const method of ['newPage', 'close']) {
        assert.equal(typeof puppeteer.CdpBrowser.prototype[method], 'function', method);
    }
});

test('actual Puppeteer rejects a missing executable without starting a browser', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elektor-launch-test-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    await assert.rejects(puppeteer.launch({
        executablePath: path.join(directory, 'missing-browser'),
        headless: false,
    }), /Browser was not found at the configured executablePath/);
});

async function runDownloader(t, { args = [], env = {}, failPage = false, existing = false } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elektor-offline-test-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const calls = { visits: [], requests: [], errors: [], logs: [], closes: 0, exits: [] };
    const responses = [];
    let currentUrl;
    const page = {
        setDefaultTimeout(value) { assert.equal(value, 120000); },
        url() { return currentUrl; },
        async goto(url, options) {
            assert.equal(options.waitUntil, 'networkidle2');
            assert.equal(options.timeout, 60000);
            calls.visits.push(url);
            currentUrl = url;
            const parsed = new URL(url);
            if (parsed.pathname === '/account/login') {
                responses.push(undefined, 'synthetic-csrf', { ok: true, status: 200 });
            } else if (parsed.pathname === '/magazine-archive') {
                responses.push([2026, 2025]);
            } else if (/^\/magazine-archive\/\d{4}$/.test(parsed.pathname)) {
                const year = parsed.pathname.split('/').pop();
                responses.push([1, 3].map(issue => ({
                    title: `e ${year}-${issue}`,
                    url: `${parsed.origin}/magazine/${year}/${issue}`,
                })));
            } else if (parsed.pathname.startsWith('/magazine/')) {
                responses.push({ url: 'https://downloads.invalid/synthetic.pdf' });
            } else {
                assert.equal(parsed.pathname, '/account');
            }
        },
        async evaluate(callback, ...values) {
            assert.equal(typeof callback, 'function');
            if (values.length) {
                assert.deepEqual(values, ['test@example.invalid', 'test', 'synthetic-csrf']);
            }
            assert.ok(responses.length, 'unexpected evaluate call');
            return responses.shift();
        },
        async cookies() {
            return [{ name: 'session', value: 'synthetic' }];
        },
    };
    const browser = {
        async newPage() {
            if (failPage) throw new Error('synthetic page failure');
            return page;
        },
        async close() { calls.closes++; },
    };
    const transport = {
        get(url, options, callback) {
            assert.equal(url, 'https://downloads.invalid/synthetic.pdf');
            assert.equal(options.headers.Cookie, 'session=synthetic');
            calls.requests.push(url);
            const response = Readable.from(['%PDF-synthetic-test-data']);
            response.statusCode = 200;
            response.headers = {};
            queueMicrotask(() => callback(response));
            return new EventEmitter();
        },
    };
    const modules = {
        dotenv: { config() {} },
        'puppeteer-core': {
            async launch(options) {
                calls.launch = options;
                assert.equal(options.executablePath, 'synthetic-browser');
                assert.equal(options.headless, false);
                assert.equal(options.protocolTimeout, 300000);
                assert.equal(options.defaultViewport.width, 1200);
                assert.equal(options.defaultViewport.height, 900);
                const browserArgs = await puppeteer.defaultArgs(options);
                assert.ok(browserArgs.includes('--no-sandbox'));
                assert.ok(browserArgs.includes('--window-size=1200,900'));
                assert.ok(!browserArgs.some(arg => arg.startsWith('--headless')));
                return browser;
            },
        },
        fs, path, http: transport, https: transport,
    };
    if (existing) {
        const yearDir = path.join(directory, 'nl', '2026');
        fs.mkdirSync(yearDir, { recursive: true });
        fs.writeFileSync(path.join(yearDir, 'Elektor 01.pdf'), Buffer.alloc(50001));
    }
    const exit = new Error('synthetic process exit');
    try {
        await script.runInNewContext({
            require(name) {
                assert.ok(Object.hasOwn(modules, name), `unexpected module: ${name}`);
                return modules[name];
            },
            process: {
                env: {
                    ELEKTOR_EMAIL: 'test@example.invalid',
                    ELEKTOR_PASSWORD: 'test',
                    BROWSER_PATH: 'synthetic-browser',
                    OUTPUT_DIR: directory,
                    ...env,
                },
                argv: ['node', 'download.js', ...args],
                on(event, callback) {
                    assert.equal(event, 'SIGINT');
                    calls.interrupt = callback;
                },
                exit(code) { calls.exits.push(code); throw exit; },
            },
            console: {
                log(...values) { calls.logs.push(values.join(' ')); },
                error(...values) { calls.errors.push(values.join(' ')); },
            },
            URL,
            setTimeout(callback) { queueMicrotask(callback); },
        });
    } catch (error) {
        if (error !== exit) throw error;
    }
    assert.equal(responses.length, 0);
    if (!failPage && !Object.values(env).includes('')) {
        assert.deepEqual(calls.errors, []);
        assert.deepEqual(calls.exits, []);
    }
    return { calls, directory };
}

test('downloads synthetic editions for both sites and years, then closes the browser', async t => {
    const { calls, directory } = await runDownloader(t);
    assert.equal(calls.requests.length, 8);
    assert.equal(calls.closes, 1);
    assert.deepEqual(calls.errors, []);
    assert.deepEqual(calls.exits, []);
    for (const site of ['en', 'nl']) {
        for (const year of ['2026', '2025']) {
            for (const issue of ['01', '03']) {
                assert.equal(fs.readFileSync(path.join(directory, site, year, `Elektor ${issue}.pdf`), 'utf8'),
                    '%PDF-synthetic-test-data');
            }
        }
    }
});

for (const language of ['en', 'nl']) {
    test(`--latest --${language} selects one edition and the correct site`, async t => {
        const { calls } = await runDownloader(t, { args: ['--latest', `--${language}`] });
        assert.equal(calls.requests.length, 1);
        const hostname = language === 'en' ? 'www.elektormagazine.com' : 'www.elektormagazine.nl';
        assert.ok(calls.visits.every(url => new URL(url).hostname === hostname));
        assert.ok(!calls.visits.some(url => url.includes('2025')));
        assert.equal(calls.closes, 1);
        assert.deepEqual(calls.errors, []);
    });
}

test('existing editions are skipped without a download', async t => {
    const { calls } = await runDownloader(t, { args: ['--latest', '--nl'], existing: true });
    assert.equal(calls.requests.length, 0);
    assert.ok(calls.logs.some(line => line.includes('SKIP')));
    assert.equal(calls.closes, 1);
});

for (const key of ['ELEKTOR_EMAIL', 'ELEKTOR_PASSWORD', 'BROWSER_PATH']) {
    test(`missing ${key} fails before launching or downloading`, async t => {
        const { calls } = await runDownloader(t, { env: { [key]: '' } });
        assert.deepEqual(calls.exits, [1]);
        assert.equal(calls.launch, undefined);
        assert.equal(calls.requests.length, 0);
        assert.ok(calls.errors.some(line => line.includes(key)));
    });
}

test('a page failure is reported and the launched browser is closed', async t => {
    const { calls } = await runDownloader(t, { failPage: true });
    assert.deepEqual(calls.exits, [1]);
    assert.equal(calls.closes, 1);
    assert.ok(calls.errors.some(line => line.includes('synthetic page failure')));
});
