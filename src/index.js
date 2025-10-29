#!/usr/bin/env node

import { program } from 'commander';
import { botCommand } from './commands/bot.js';
import http from 'http';
import { setShuttingDown } from './lib/utils.js';

program
  .name('us-visa-bot')
  .description('Automated US visa appointment rescheduling bot')
  .version('0.0.1');

program
  .command('bot')
  .description('Monitor and reschedule visa appointments')
  .requiredOption('-c, --current <date>', 'current booked date')
  .option('-t, --target <date>', 'target date to stop at')
  .option('-m, --min <date>', 'minimum date acceptable')
  .option('--dry-run', 'only log what would be booked without actually booking')
  .action(botCommand);

// Default command for backward compatibility
program
  .requiredOption('-c, --current <date>', 'current booked date')
  .option('-t, --target <date>', 'target date to stop at')
  .option('-m, --min <date>', 'minimum date acceptable')
  .option('--dry-run', 'only log what would be booked without actually booking')
  .action(botCommand);

// If running as a web service (platforms like Render set PORT), skip
// parsing commander default required options so the process doesn't exit
// immediately due to missing CLI args. When running in web/service mode the
// `bot` functionality can be invoked via a separate process/cron or by
// starting the app with CLI args.
if (!process.env.PORT) {
  program.parse();
} else {
  // Log basic startup info when running as a service
  console.log('Starting in web service mode (PORT set). Skipping CLI parsing.');
}

// Global error handlers: log unhandled rejections and uncaught exceptions.
// Note: in many production systems it's preferable to crash and let the
// orchestrator restart the process; however, to avoid abrupt exits on
// platforms like Render (where a short crash may cause missed work), we
// log the error and keep the process alive. If you prefer stricter
// behavior, change these handlers to rethrow / process.exit as needed.
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection] Reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Error:', err && err.stack ? err.stack : err);
});

// Lightweight HTTP health endpoint so platforms (like Fly/Render) can probe the app.
// If PORT is set in the environment we'll listen on it and return 200 OK.
const port = process.env.PORT || process.env.FLY_PORT;
let server;
if (port) {
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  });

  server.listen(Number(port), () => {
    // Use console.log here (utils.log may require config) to ensure startup logs appear.
    console.log(`Health endpoint listening on port ${port}`);
  });

  // Graceful shutdown for common signals. Set shutdown flag so background
  // bot loop can finish its current iteration and persist state. Then wait
  // up to SHUTDOWN_TIMEOUT (seconds) before forcing the server closed.
  const graceful = () => {
    const timeoutSec = Number(process.env.SHUTDOWN_TIMEOUT || 25);
    console.log(`Received shutdown signal, initiating graceful shutdown (waiting up to ${timeoutSec}s)...`);

    // Tell other modules to stop starting new work
    setShuttingDown(true);

    // Wait a short time for the bot loop to notice the flag and persist state.
    setTimeout(() => {
      console.log('Closing server now.');
      if (server && typeof server.close === 'function') {
        server.close(() => {
          console.log('Server closed, exiting.');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    }, timeoutSec * 1000).unref();
  };

  process.on('SIGTERM', graceful);
  process.on('SIGINT', graceful);
}
