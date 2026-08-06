const cron = require('node-cron');
const {scrapeAll, scrapeHomeAndSave} = require('../services/dpboss.scraper');

let lastHomeScrape = 0;
let lastFullScrape = 0;

const HOME_SCRAPE_COOLDOWN = 10 * 60 * 1000;
const FULL_SCRAPE_COOLDOWN = 60 * 60 * 1000;

function canRunHomeScrape() {
  return Date.now() - lastHomeScrape > HOME_SCRAPE_COOLDOWN;
}

function canRunFullScrape() {
  return Date.now() - lastFullScrape > FULL_SCRAPE_COOLDOWN;
}

cron.schedule('*/15 10-23 * * *', async () => {
  if (!canRunHomeScrape()) {
    console.log('[CRON] Skipping peak scrape (cooldown)');
    return;
  }
  console.log('[CRON] Running peak hours live results scrape...');
  lastHomeScrape = Date.now();
  try {
    const results = await scrapeHomeAndSave();
    console.log(`[CRON] Peak scrape completed: ${results.length} markets`);
  } catch (error) {
    console.error('[CRON] Peak hours scrape error:', error.message);
  }
});

cron.schedule('0 0-9,23 * * *', async () => {
  if (!canRunHomeScrape()) {
    console.log('[CRON] Skipping off-peak scrape (cooldown)');
    return;
  }
  console.log('[CRON] Running off-peak live results scrape...');
  lastHomeScrape = Date.now();
  try {
    const results = await scrapeHomeAndSave();
    console.log(`[CRON] Off-peak scrape completed: ${results.length} markets`);
  } catch (error) {
    console.error('[CRON] Off-peak scrape error:', error.message);
  }
});

cron.schedule('0 3 * * *', async () => {
  if (!canRunFullScrape()) {
    console.log('[CRON] Skipping full scrape (cooldown)');
    return;
  }
  console.log('[CRON] Running full DPBoss scrape (homepage + charts)...');
  lastFullScrape = Date.now();
  try {
    const data = await scrapeAll();
    console.log(
      `[CRON] Full scrape completed: ${data.results.length} results, ${data.charts.length} charts`,
    );
  } catch (error) {
    console.error('[CRON] Full scrape error:', error.message);
  }
});

console.log('[CRON] DPBoss scraper jobs scheduled');
