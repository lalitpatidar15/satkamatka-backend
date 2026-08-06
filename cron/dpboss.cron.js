const cron = require('node-cron');
const {scrapeAll, scrapeHomeAndSave} = require('../services/dpboss.scraper');

let lastHomeScrape = 0;
const HOME_SCRAPE_COOLDOWN = 5 * 60 * 1000;

function canRunHomeScrape() {
  return Date.now() - lastHomeScrape > HOME_SCRAPE_COOLDOWN;
}

const gameTimes = [
  {name: 'Raja-Rani Morning', closeIST: '10:40', closeUTC: '05:10'},
  {name: 'Karnataka Day', closeIST: '11:00', closeUTC: '05:30'},
  {name: 'Kalyan Morning', closeIST: '12:40', closeUTC: '07:10'},
  {name: 'Star Morning', closeIST: '12:45', closeUTC: '07:15'},
  {name: 'KBC Bombay', closeIST: '14:30', closeUTC: '09:00'},
  {name: 'Morning Syndicate', closeIST: '15:20', closeUTC: '09:50'},
  {name: 'Maharani Day', closeIST: '19:15', closeUTC: '13:45'},
  {name: 'Dabra Night', closeIST: '21:05', closeUTC: '15:35'},
  {name: 'Night Bazar', closeIST: '23:35', closeUTC: '18:05'},
];

gameTimes.forEach(game => {
  const [hour, minute] = game.closeUTC.split(':');
  const cronExpr = `${parseInt(minute) + 2} ${hour} * * *`;

  cron.schedule(cronExpr, async () => {
    if (!canRunHomeScrape()) {
      console.log(`[CRON] Skipping ${game.name} (cooldown)`);
      return;
    }
    console.log(`[CRON] Scraping for ${game.name} (close: ${game.closeIST} IST)`);
    lastHomeScrape = Date.now();
    try {
      const results = await scrapeHomeAndSave();
      console.log(`[CRON] ${game.name}: ${results.length} results saved`);
    } catch (error) {
      console.error(`[CRON] ${game.name} error:`, error.message);
    }
  });
});

cron.schedule('0 4 * * *', async () => {
  console.log('[CRON] Running full DPBoss scrape (charts + results)...');
  try {
    const data = await scrapeAll();
    console.log(
      `[CRON] Full scrape: ${data.results.length} results, ${data.charts.length} charts`,
    );
  } catch (error) {
    console.error('[CRON] Full scrape error:', error.message);
  }
});

console.log('[CRON] DPBoss scraper jobs scheduled for game close times');
console.log('[CRON] Games:', gameTimes.map(g => `${g.name} (${g.closeIST} IST)`).join(', '));
