require('dotenv').config();
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const EMAIL = process.env.ELEKTOR_EMAIL;
const PASSWORD = process.env.ELEKTOR_PASSWORD;
const BROWSER_PATH = process.env.BROWSER_PATH;
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || './output');
const LATEST_ONLY = process.argv.includes('--latest');
const EN_ONLY = process.argv.includes('--en');
const NL_ONLY = process.argv.includes('--nl');

const ALL_SITES = [
    { id: 'en', base: 'https://www.elektormagazine.com', label: 'Elektor (EN)' },
    { id: 'nl', base: 'https://www.elektormagazine.nl', label: 'Elektor (NL)' },
];
const SITES = ALL_SITES.filter(s => {
    if (EN_ONLY) return s.id === 'en';
    if (NL_ONLY) return s.id === 'nl';
    return true;
});

if (!EMAIL || !PASSWORD) {
    console.error('Missing ELEKTOR_EMAIL or ELEKTOR_PASSWORD. Copy .env.example to .env and fill in your credentials.');
    process.exit(1);
}
if (!BROWSER_PATH) {
    console.error('Missing BROWSER_PATH. Set the path to a Chromium-based browser in .env.');
    process.exit(1);
}

let browser;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function dismissCookies(page) {
    await sleep(2000);
    try {
        await page.evaluate(() => {
            document.querySelectorAll('button, a').forEach(el => {
                const text = el.textContent.toLowerCase();
                if (text.includes('accept') || text.includes('accepteer') ||
                    text.includes('alle cookies') || text.includes('agree') ||
                    text.includes('akkoord')) {
                    el.click();
                }
            });
        });
    } catch (e) {}
    await sleep(1000);
}

async function login(page, baseUrl) {
    await page.goto(`${baseUrl}/account/login`, {
        waitUntil: 'networkidle2', timeout: 60000,
    });
    await dismissCookies(page);

    if (!page.url().includes('/login')) return true;

    const csrf = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.content;
        const input = document.querySelector('input[name="_token"]');
        return input ? input.value : null;
    });

    if (!csrf) { console.error('Could not find CSRF token on login page'); return false; }

    const result = await page.evaluate(async (email, password, csrf) => {
        try {
            const res = await fetch('/account/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRF-TOKEN': csrf,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: new URLSearchParams({
                    _token: csrf,
                    email: email,
                    password: password,
                    remember: '1',
                }).toString(),
                redirect: 'follow',
            });
            const text = await res.text();
            let json = null;
            try { json = JSON.parse(text); } catch (e) {}
            return { status: res.status, ok: res.ok, success: json?.success };
        } catch (e) {
            return { error: e.message };
        }
    }, EMAIL, PASSWORD, csrf);

    if (result.error) { console.error(`Login error: ${result.error}`); return false; }

    // Refresh to apply session
    await page.goto(`${baseUrl}/account`, {
        waitUntil: 'networkidle2', timeout: 60000,
    });

    const loggedIn = !page.url().includes('/login');
    if (loggedIn) {
        console.log(`Logged in to ${new URL(baseUrl).hostname}`);
    } else {
        console.error('Login failed — check your credentials in .env');
    }
    return loggedIn;
}

async function getArchiveYears(page, baseUrl) {
    await page.goto(`${baseUrl}/magazine-archive`, {
        waitUntil: 'networkidle2', timeout: 60000,
    });

    return await page.evaluate(() => {
        const years = new Set();
        // Year dropdown (select#year)
        document.querySelectorAll('select#year option').forEach(opt => {
            const match = opt.value.match(/^(\d{4})$/);
            if (match) years.add(parseInt(match[1]));
        });
        // Fallback: year links
        if (years.size === 0) {
            document.querySelectorAll('a[href*="magazine-archive/"]').forEach(a => {
                const match = a.href.match(/magazine-archive\/(\d{4})/);
                if (match) years.add(parseInt(match[1]));
            });
        }
        return [...years].sort((a, b) => b - a);
    });
}

async function getIssuesForYear(page, baseUrl, year) {
    await page.goto(`${baseUrl}/magazine-archive/${year}`, {
        waitUntil: 'networkidle2', timeout: 60000,
    });

    return await page.evaluate(() => {
        // Collect all magazine links, deduplicating by URL.
        // Each issue appears twice: once as an image link (alt="elektor") and
        // once as a text link (e.g. "<b>e </b> 2025-3"). We prefer the text version.
        const issueMap = new Map();

        document.querySelectorAll('a[href*="/magazine/"]').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (href.includes('magazine-archive') || href.includes('/latest') ||
                href.includes('/elektor-')) return;
            if (!href.match(/\/magazine\/\d{4}\/\d+/)) return;

            const fullUrl = a.href;
            const text = a.textContent.replace(/\s+/g, ' ').trim();

            if (!issueMap.has(fullUrl)) {
                issueMap.set(fullUrl, { url: fullUrl, title: text || 'unknown' });
            } else if (text && text.length > 3 && text !== 'elektor') {
                // Text link has the real title like "e 2025-3"
                issueMap.get(fullUrl).title = text;
            }
        });

        return [...issueMap.values()];
    });
}

async function getDownloadUrl(page, issueUrl) {
    await page.goto(issueUrl, {
        waitUntil: 'networkidle2', timeout: 60000,
    });

    if (page.url().includes('/login')) return { needsLogin: true };

    return await page.evaluate(() => {
        // Priority 1: signed expose/magazine links ("Download magazine" button)
        const exposeLink = document.querySelector('a[href*="/expose/magazine/"]');
        if (exposeLink) {
            return { url: exposeLink.href };
        }

        // Priority 2: attachment links
        const attachLink = document.querySelector('a[href*="/files/attachment/"]');
        if (attachLink) {
            const href = attachLink.getAttribute('href');
            return { url: href.startsWith('http') ? href : location.origin + href };
        }

        // Priority 3: any link with "download" in text and PDF-related href
        for (const link of document.querySelectorAll('a')) {
            const text = link.textContent.toLowerCase();
            const href = link.getAttribute('href') || '';
            if (text.includes('download') &&
                (href.includes('.pdf') || href.includes('/expose/') || href.includes('/files/'))) {
                return { url: href.startsWith('http') ? href : location.origin + href };
            }
        }

        return { url: null };
    });
}

async function downloadFile(page, url, filepath) {
    const cookies = await page.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    return new Promise((resolve, reject) => {
        const get = (targetUrl, redirects = 0) => {
            if (redirects > 10) { reject(new Error('Too many redirects')); return; }

            const parsedUrl = new URL(targetUrl);
            const client = parsedUrl.protocol === 'https:' ? https : http;

            client.get(targetUrl, {
                headers: {
                    'Cookie': cookieStr,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    let redirect = res.headers.location;
                    if (redirect.startsWith('/')) {
                        redirect = `${parsedUrl.protocol}//${parsedUrl.host}${redirect}`;
                    }
                    res.resume();
                    get(redirect, redirects + 1);
                    return;
                }

                if (res.statusCode !== 200) {
                    res.resume();
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }

                const stream = fs.createWriteStream(filepath);
                res.pipe(stream);
                stream.on('finish', () => { stream.close(); resolve(true); });
                stream.on('error', (err) => {
                    try { fs.unlinkSync(filepath); } catch (e) {}
                    reject(err);
                });
            }).on('error', reject);
        };

        get(url);
    });
}

function parseIssueTitle(title) {
    // "e 2025-3" → { name: "Elektor", issue: "03", year: "2025" }
    // "e 2026-1" → { name: "Elektor", issue: "01", year: "2026" }
    const elektorMatch = title.match(/e\s+(\d{4})-(\d+)/i);
    if (elektorMatch) {
        return { name: 'Elektor', issue: elektorMatch[2].padStart(2, '0'), year: elektorMatch[1] };
    }

    // Older format: "Elektor 199001" or other patterns
    const legacyMatch = title.match(/(\d{4})(\d{2})/);
    if (legacyMatch) {
        return { name: 'Elektor', issue: legacyMatch[2], year: legacyMatch[1] };
    }

    return null;
}

function getPdfPath(siteId, issue) {
    const parsed = parseIssueTitle(issue.title);
    if (parsed) {
        const yearDir = path.join(OUTPUT_DIR, siteId, parsed.year);
        if (!fs.existsSync(yearDir)) fs.mkdirSync(yearDir, { recursive: true });
        return path.join(yearDir, `${parsed.name} ${parsed.issue}.pdf`);
    }

    // Extract year from URL
    const yearMatch = issue.url?.match(/\/magazine\/(\d{4})\//);
    const year = yearMatch ? yearMatch[1] : 'misc';
    const yearDir = path.join(OUTPUT_DIR, siteId, year);
    if (!fs.existsSync(yearDir)) fs.mkdirSync(yearDir, { recursive: true });

    // Fallback: use issue ID from URL
    const idMatch = issue.url?.match(/\/magazine\/\d{4}\/(\d+)/);
    const id = idMatch ? idMatch[1] : issue.title.replace(/[/\\?%*:|"<>]/g, '-');
    return path.join(yearDir, `Elektor ${id}.pdf`);
}

async function downloadIssue(page, site, issue, idx, total) {
    const pdfPath = getPdfPath(site.id, issue);
    const displayName = path.relative(OUTPUT_DIR, pdfPath).replace(/\\/g, '/');

    if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 50000) {
        console.log(`[${idx}/${total}] SKIP ${displayName}`);
        return;
    }

    console.log(`[${idx}/${total}] ${displayName}`);

    const result = await getDownloadUrl(page, issue.url);

    // Re-login if session expired
    if (result.needsLogin) {
        if (!(await login(page, site.base))) throw new Error('Re-login failed');
        const retry = await getDownloadUrl(page, issue.url);
        if (!retry.url) { console.log('  No download link found, skipping'); return; }
        result.url = retry.url;
    }

    if (!result.url) {
        console.log('  No download link found, skipping');
        return;
    }

    try {
        await downloadFile(page, result.url, pdfPath);
        const size = (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(1);
        console.log(`  -> ${size} MB`);
    } catch (e) {
        console.log(`  Download failed: ${e.message}`);
        try { fs.unlinkSync(pdfPath); } catch (err) {}
    }
}

async function downloadSite(page, site) {
    console.log(`\n--- ${site.label} ---\n`);

    if (!(await login(page, site.base))) return;

    const years = await getArchiveYears(page, site.base);
    if (!years.length) { console.log('No archive years found'); return; }
    console.log(`Archive: ${years[years.length - 1]}-${years[0]} (${years.length} years)\n`);

    const targetYears = LATEST_ONLY ? [years[0]] : years;
    const allIssues = [];

    for (const year of targetYears) {
        const issues = await getIssuesForYear(page, site.base, year);
        allIssues.push(...issues);
    }

    console.log(`${allIssues.length} issues found\n`);

    const toDownload = LATEST_ONLY ? allIssues.slice(0, 1) : allIssues;
    if (LATEST_ONLY && toDownload.length) {
        console.log(`Downloading latest only: ${toDownload[0].title}\n`);
    }

    for (let i = 0; i < toDownload.length; i++) {
        await downloadIssue(page, site, toDownload[i], i + 1, toDownload.length);
    }
}

async function main() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log(`Browser: ${BROWSER_PATH}`);
    console.log(`Output:  ${OUTPUT_DIR}\n`);

    browser = await puppeteer.launch({
        executablePath: BROWSER_PATH,
        headless: false,
        protocolTimeout: 300000,
        args: ['--no-sandbox', '--window-size=1200,900'],
        defaultViewport: { width: 1200, height: 900 },
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(120000);

    for (const site of SITES) {
        await downloadSite(page, site);
    }

    await browser.close();
    console.log('\nDone!');
}

process.on('SIGINT', async () => {
    console.log('\nInterrupted, closing browser...');
    if (browser) await browser.close().catch(() => {});
    process.exit(0);
});

main().catch(async err => {
    console.error(err);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
});
