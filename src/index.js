import { program } from 'commander';
import { botCommand } from './commands/bot.js';
import http from 'http';
import https from 'https';
import { CronJob } from 'cron';
import { log } from './lib/utils.js';


// Fetch the command-line arguments from the server.
let argumentsCLI = program
    .name('us-visa-bot')
    .requiredOption('-c, --current <date>', 'current booked date')
    .option('-t, --target <date>', 'target date to stop at')
    .option('-m, --min <date>', 'minimum date acceptable')
    .option('-p, --port <number>', 'Port to run the server on')
    .option('--dry-run', 'only log what would be booked without actually booking')
    .parse();

const port = (argumentsCLI.opts().port || process.env.PORT);
let server;

// Create HTTP server for health checks and bot control
const cronScheduler = async (cronSchedule, renderDeploymentUrl) => {
    return  https.get(`${renderDeploymentUrl}`, (res) => {
      log('Pinging the server to keep it awake!', "SUCCESS");
      log(`Response code fromt the server :: ${res.statusCode}`, "SUCCESS");
    }).on('error', (e) => {
      log(`Error in running cron job :: ${e.message}`, "ERROR");
    });
}

if (port) {
  server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Bot health is okay ...');
    } 
  });

  const promise = new Promise((resolve, reject) => {
     server.listen(Number(port), async () => {
      log(`Server will start the cron on port ${port}`);      
        const cronSchedule = String(process.env.CRON_SCHEDULE || '*/14 * * * *');
        const renderDeploymentUrl = process.env.RENDER_DEPLOYMENT_URL;

        if (cronSchedule && renderDeploymentUrl) {
          log(`Cron will be starting now : ${cronSchedule}`);
          const job = new CronJob(cronSchedule, 
            () => {
              https.get(`${renderDeploymentUrl}`, (res) => {
                log('Pinging the server to keep it awake!', "SUCCESS");
                log(`Response code fromt the server :: ${res.statusCode}`, "SUCCESS");
                resolve(`Response code fromt the server :: ${res.statusCode}`);
              }).on('error', (e) => {
                reject(`Error in running cron job :: ${e.message}`);
                log(`Error in running cron job :: ${e.message}`, "ERROR");
              });
            }    
            , null, true)
        } else {
          log('Mention the cron schedule and render deployment url in env file to start the cron job!');
        }
    });
  });

  promise.then((message) => {
    log(`Cron Message: ${message}`, "SUCCESS");
    argumentsCLI.action(botCommand);
    argumentsCLI.parse();
  }).catch((error) => {
    log(`Failed to start cron job: ${error}`, "ERROR");
  });
 
} else {
  log('No port specified please mention the port number in env or cli!');
}

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection] Reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Error:', err && err.stack ? err.stack : err);
});