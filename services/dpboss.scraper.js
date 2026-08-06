const axios = require('axios');
const cheerio = require('cheerio');
const DPBossResult = require('../models/DPBossResult');
const DPBossChart = require('../models/DPBossChart');

const BASE_URL = 'https://sattamatkadpboss.mobi';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
];

const CONFIG = {
  requestTimeout: 25000,
  maxRetries: 3,
  baseDelay: 1000,
  maxBackoff: 30000,
  scrapeDelay: 1500,
  chartDelay: 1500,
  minHtmlLength: 500,
  maxConsecutiveFailures: 5,
  circuitBreakerResetMs: 5 * 60 * 1000,
};

let scrapeInProgress = false;

const scrapeStatus = {
  lastRun: null,
  lastSuccess: null,
  lastError: null,
  consecutiveFailures: 0,
  totalScrapes: 0,
  totalErrors: 0,
  circuitOpen: false,
  circuitOpenedAt: null,
};

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function isCircuitOpen() {
  if (!scrapeStatus.circuitOpen) return false;
  const elapsed = Date.now() - scrapeStatus.circuitOpenedAt;
  if (elapsed > CONFIG.circuitBreakerResetMs) {
    scrapeStatus.circuitOpen = false;
    scrapeStatus.circuitOpenedAt = null;
    scrapeStatus.consecutiveFailures = 0;
    console.log('[SCRAPER] Circuit breaker reset after cooldown');
    return false;
  }
  return true;
}

function recordFailure(errorMsg) {
  scrapeStatus.consecutiveFailures++;
  scrapeStatus.totalErrors++;
  scrapeStatus.lastError = errorMsg;
  if (scrapeStatus.consecutiveFailures >= CONFIG.maxConsecutiveFailures) {
    scrapeStatus.circuitOpen = true;
    scrapeStatus.circuitOpenedAt = Date.now();
    console.error(
      `[SCRAPER] Circuit breaker OPEN after ${scrapeStatus.consecutiveFailures} consecutive failures`,
    );
  }
}

function recordSuccess() {
  scrapeStatus.consecutiveFailures = 0;
  scrapeStatus.circuitOpen = false;
  scrapeStatus.circuitOpenedAt = null;
  scrapeStatus.lastSuccess = new Date().toISOString();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeUrl(href) {
  if (!href) return null;
  return href.startsWith('http') ? href : `${BASE_URL}${href}`;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[{}]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validateResult(result) {
  if (!result) return false;
  if (!result.name || typeof result.name !== 'string') return false;
  if (result.name.length < 2 || result.name.length > 100) return false;
  if (result.result && !/^\d{3}-\d{2}-\d{3}$/.test(result.result)) return false;
  return true;
}

function validateChartData(data) {
  if (!data) return false;
  if (data.type === 'jodi') {
    return Array.isArray(data.jodiGrid) && data.jodiGrid.length > 0;
  }
  if (data.type === 'panel') {
    return Array.isArray(data.panelWeeks) && data.panelWeeks.length > 0;
  }
  return false;
}

function isBlockedPage(html) {
  if (!html || html.length < CONFIG.minHtmlLength) return true;
  if (/access denied|forbidden|403|captcha|cloudflare|rate.?limit/i.test(html)) return true;
  if (/<html[^>]*>\s*<head[\s\S]*?<\/head>\s*<body[^>]*>\s*<\/body>\s*<\/html>/i.test(html)) return true;
  return false;
}

async function fetchPage(url, retries = CONFIG.maxRetries) {
  const jitter = Math.random() * 1000;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUA(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
          Referer: BASE_URL,
        },
        timeout: CONFIG.requestTimeout,
        maxRedirects: 5,
        validateStatus: status => status === 200,
      });

      const html = response.data;
      if (isBlockedPage(html)) {
        console.warn(`[SCRAPER] Blocked/error page detected at ${url} (attempt ${attempt + 1})`);
        if (attempt < retries) {
          const backoff = Math.min(
            CONFIG.baseDelay * Math.pow(2, attempt) + jitter,
            CONFIG.maxBackoff,
          );
          await sleep(backoff);
          continue;
        }
        return null;
      }

      return html;
    } catch (error) {
      const status = error.response?.status;
      const isRetryable = !status || status === 429 || status === 503 || error.code === 'ECONNABORTED';
      const msg = `Error fetching ${url} (attempt ${attempt + 1}/${retries + 1}): status=${status || 'none'} code=${error.code || 'none'} ${error.message}`;
      console.error(msg);

      if (attempt < retries && isRetryable) {
        const backoff = Math.min(
          CONFIG.baseDelay * Math.pow(2, attempt) + jitter,
          CONFIG.maxBackoff,
        );
        console.log(`[SCRAPER] Retrying in ${Math.round(backoff)}ms...`);
        await sleep(backoff);
      } else if (!isRetryable) {
        return null;
      }
    }
  }
  return null;
}

/**
 * Parse the homepage "LIVE MATKA RESULT" section.
 */
function parseHomePage(html) {
  const $ = cheerio.load(html);
  const markets = [];

  const containers = $('.news-body > div, .result, .fix, .news2');
  containers.each((i, el) => {
    const cls = $(el).attr('class') || '';
    if (!/fix|news2|result/.test(cls)) return;

    const spans = $(el).find('span');
    let name = '';
    let result = null;

    spans.each((j, span) => {
      const text = $(span).text().trim().replace(/[{}]/g, '');
      if (!name && text.length > 1 && text.length < 80 && !/^\d/.test(text)) {
        name = text;
      }
      if (!result && /^\d{3}-\d{2}-\d{3}$/.test(text)) {
        result = text;
      }
    });

    if (!name && !result) return;

    const elText = $(el).text();
    const timeMatch = elText.match(/\((\d{1,2}:\d{2})\s*-?\s*(\d{1,2}:\d{2})(?:\s*[AP]M)?\)/i);

    const jodiUrl = normalizeUrl($(el).find('.jodichartleft a').attr('href'));
    const panelUrl = normalizeUrl($(el).find('.panelchartright a').attr('href'));

    if (name || result) {
      markets.push({
        name: name || 'UNKNOWN',
        result,
        openTime: timeMatch ? timeMatch[1] : null,
        closeTime: timeMatch ? timeMatch[2] : null,
        jodiUrl,
        panelUrl,
      });
    }
  });

  return markets;
}

/**
 * Parse an inner market page (jodi or panel chart page).
 */
function parseInnerPage(html, type) {
  const $ = cheerio.load(html);

  const market = $('.yom').first().text().trim();
  const result = $('.D1').first().text().trim() || null;

  const data = {market, result, type};

  if (type === 'jodi') {
    const rows = [];
    $('table.chat7 tr').each((i, tr) => {
      const cells = [];
      $(tr)
        .find('td')
        .each((j, td) => {
          const t = $(td).text().trim();
          if (t) cells.push(t);
        });
      if (cells.length) rows.push(cells);
    });
    data.jodiGrid = rows;
  } else if (type === 'panel') {
    const weeks = [];
    $('table.pchart tr').each((i, tr) => {
      const cells = [];
      $(tr)
        .find('th, td')
        .each((j, cell) => {
          const tag = $(cell).prop('tagName').toLowerCase();
          const text = $(cell)
            .text()
            .replace(/\s+/g, ' ')
            .trim();
          if (!text) return;
          cells.push({tag, text});
        });
      if (!cells.length) return;

      if (cells[0].tag === 'th' && !/to/i.test(cells[0].text)) return;

      if (cells[0] && cells[0].text && /to/i.test(cells[0].text)) {
        const days = [];
        let day = {panel: [], jodi: ''};
        for (let k = 1; k < cells.length; k++) {
          const c = cells[k];
          if (c.tag === 'th') {
            const nums = c.text.split(' ').filter(Boolean);
            day.panel.push(...nums);
          } else if (c.tag === 'td') {
            day.jodi = c.text.replace(/\*/g, '');
            days.push(day);
            day = {panel: [], jodi: ''};
          }
        }
        if (day.panel.length > 0 || day.jodi) {
          days.push(day);
        }
        weeks.push({
          range: cells[0].text,
          days: days.filter(d => d.jodi && d.panel.some(p => p !== '*')),
        });
      }
    });
    data.panelWeeks = weeks;
  }

  return data;
}

// ---------- Public scrape entry points ----------

async function scrapeHome() {
  if (isCircuitOpen()) {
    console.warn('[SCRAPER] Circuit breaker open, skipping homepage scrape');
    return [];
  }

  console.log('[SCRAPER] Fetching homepage...');
  const html = await fetchPage(`${BASE_URL}/`);
  if (!html) {
    recordFailure('Homepage fetch failed');
    return [];
  }

  const markets = parseHomePage(html);
  const validMarkets = markets.filter(validateResult);
  console.log(`[SCRAPER] Homepage parsed: ${validMarkets.length} valid / ${markets.length} total markets`);

  if (validMarkets.length === 0 && markets.length > 0) {
    console.warn('[SCRAPER] All parsed markets failed validation');
  }

  return validMarkets;
}

async function scrapeHomeAndSave() {
  if (scrapeInProgress) {
    console.warn('[SCRAPER] Scrape already in progress, skipping');
    return [];
  }

  scrapeInProgress = true;
  scrapeStatus.lastRun = new Date().toISOString();
  scrapeStatus.totalScrapes++;

  try {
    const markets = await scrapeHome();
    const saved = [];

    for (const market of markets) {
      if (!market.result) continue;
      const parts = market.result.split('-');
      if (parts.length !== 3) continue;

      const savedDoc = await DPBossResult.findOneAndUpdate(
        {marketSlug: slugify(market.name)},
        {
          market: market.name,
          marketSlug: slugify(market.name),
          result: market.result,
          open: parts[0],
          close: parts[2],
          jodi: parts[1],
          openTime: market.openTime,
          closeTime: market.closeTime,
          jodiUrl: market.jodiUrl,
          panelUrl: market.panelUrl,
          source: 'sattamatkadpboss',
          date: new Date().toISOString().split('T')[0],
        },
        {upsert: true, new: true},
      );
      saved.push(savedDoc);
    }

    recordSuccess();
    console.log(`[SCRAPER] Saved ${saved.length} live results`);
    return saved;
  } catch (error) {
    recordFailure(error.message);
    console.error('[SCRAPER] scrapeHomeAndSave error:', error.message);
    return [];
  } finally {
    scrapeInProgress = false;
  }
}

async function scrapeInnerPage(url, type, slug) {
  if (!url) return null;

  const html = await fetchPage(url);
  if (!html) return null;

  const data = parseInnerPage(html, type);
  if (!data.market && !data.result) return null;

  const chart = {
    marketSlug: slug,
    type,
    market: data.market || slug,
    result: data.result,
    jodiGrid: data.jodiGrid || [],
    panelWeeks: data.panelWeeks || [],
    sourceUrl: url,
    scrapedAt: new Date().toISOString(),
  };

  if (!validateChartData(chart)) {
    console.warn(`[SCRAPER] Chart data invalid for ${slug} (${type}), skipping save`);
    return null;
  }

  await DPBossChart.findOneAndUpdate(
    {marketSlug: slug, type},
    chart,
    {upsert: true, new: true},
  );
  return chart;
}

async function scrapeAll({includeCharts = true} = {}) {
  if (scrapeInProgress) {
    console.warn('[SCRAPER] Scrape already in progress, skipping full scrape');
    return {results: [], charts: []};
  }

  if (isCircuitOpen()) {
    console.warn('[SCRAPER] Circuit breaker open, skipping full scrape');
    return {results: [], charts: []};
  }

  scrapeInProgress = true;
  scrapeStatus.lastRun = new Date().toISOString();
  scrapeStatus.totalScrapes++;

  try {
    console.log('[SCRAPER] Starting full scrape of sattamatkadpboss.mobi...');

    const markets = await scrapeHome();
    const saved = [];
    const charts = [];
    const errors = [];

    for (const market of markets) {
      if (!market.result) continue;
      const parts = market.result.split('-');
      if (parts.length !== 3) continue;

      const slug = slugify(market.name);
      const result = {
        market: market.name,
        marketSlug: slug,
        result: market.result,
        open: parts[0],
        close: parts[2],
        jodi: parts[1],
        openTime: market.openTime,
        closeTime: market.closeTime,
        jodiUrl: market.jodiUrl,
        panelUrl: market.panelUrl,
        source: 'sattamatkadpboss',
        date: new Date().toISOString().split('T')[0],
      };

      const savedDoc = await DPBossResult.findOneAndUpdate(
        {marketSlug: slug},
        result,
        {upsert: true, new: true},
      );
      saved.push(savedDoc);

      if (includeCharts && market.jodiUrl) {
        try {
          const chart = await scrapeInnerPage(market.jodiUrl, 'jodi', slug);
          if (chart) charts.push(chart);
        } catch (err) {
          errors.push({market: slug, type: 'jodi', error: err.message});
        }
        await sleep(CONFIG.chartDelay);
      }

      if (includeCharts && market.panelUrl) {
        try {
          const chart = await scrapeInnerPage(market.panelUrl, 'panel', slug);
          if (chart) charts.push(chart);
        } catch (err) {
          errors.push({market: slug, type: 'panel', error: err.message});
        }
        await sleep(CONFIG.chartDelay);
      }

      await sleep(CONFIG.scrapeDelay);
    }

    recordSuccess();

    if (errors.length > 0) {
      console.warn(`[SCRAPER] ${errors.length} chart errors during full scrape`);
    }

    console.log(
      `[SCRAPER] Done: ${saved.length} markets saved, ${charts.length} charts saved, ${errors.length} errors`,
    );
    return {results: saved, charts, errors};
  } catch (error) {
    recordFailure(error.message);
    console.error('[SCRAPER] Full scrape error:', error.message);
    throw error;
  } finally {
    scrapeInProgress = false;
  }
}

async function scrapeAndSave() {
  const data = await scrapeAll();
  return data.results;
}

function getScrapeStatus() {
  return {
    ...scrapeStatus,
    scrapeInProgress,
    config: {
      circuitBreakerThreshold: CONFIG.maxConsecutiveFailures,
      circuitBreakerResetMs: CONFIG.circuitBreakerResetMs,
    },
  };
}

function getResults() {
  return DPBossResult.find({isActive: true}).sort({updatedAt: -1});
}

function getResultBySlug(slug) {
  return DPBossResult.findOne({marketSlug: slug, isActive: true});
}

function getResultsByMarket(market) {
  return DPBossResult.find({market, isActive: true}).sort({updatedAt: -1});
}

function getChart(slug, type) {
  return DPBossChart.findOne({marketSlug: slug, type});
}

module.exports = {
  scrapeAll,
  scrapeAndSave,
  scrapeHome,
  scrapeHomeAndSave,
  scrapeInnerPage,
  getResults,
  getResultBySlug,
  getResultsByMarket,
  getChart,
  getScrapeStatus,
  parseHomePage,
  slugify,
  BASE_URL,
  CONFIG,
};
