import { Bot } from '../lib/bot.js';
import { getConfig } from '../lib/config.js';
import { log, sleep, isSocketHangupError, isShuttingDown } from '../lib/utils.js';
import fs from 'fs/promises';

const COOLDOWN = 3600; // 1 hour in seconds

export async function botCommand(options) {
  const config = getConfig();
  const bot = new Bot(config, { dryRun: options.dryRun });
  let currentBookedDate = options.current;
  const targetDate = options.target;
  const minDate = options.min;

  log(`Initializing with current date ${currentBookedDate}`);

  if (options.dryRun) {
    log(`[DRY RUN MODE] Bot will only log what would be booked without actually booking`);
  }

  if (targetDate) {
    log(`Target date: ${targetDate}`);
  }

  if (minDate) {
    log(`Minimum date: ${minDate}`);
  }

  try {
    const sessionHeaders = await bot.initialize();

    while (true) {
      if (isShuttingDown()) {
        // Stop starting new work; persist current state so the process that
        // restarts can resume from the same `currentBookedDate`.
        try {
          const payload = { currentBookedDate };
          await fs.writeFile('booking_state.json', JSON.stringify(payload, null, 2));
          log('Shutting down: wrote booking_state.json');
        } catch (e) {
          log(`Failed to persist booking_state.json during shutdown: ${e && e.message ? e.message : String(e)}`);
        }

        log('Shutdown flag set, exiting bot loop cleanly.');
        return;
      }
      const availableDate = await bot.checkAvailableDate(
        sessionHeaders,
        currentBookedDate,
        minDate
      );

      if (availableDate) {
        // `availableDate` may be an object { date, facilityId } or a string
        const selectedDate = (typeof availableDate === 'object' && availableDate.date)
          ? availableDate.date
          : availableDate;

        const bookedResult = await bot.bookAppointment(sessionHeaders, availableDate);

        if (bookedResult && bookedResult.success) {
          // Write booking result for external workflows/notifications
          try {
            const payload = {
              date: bookedResult.date || selectedDate,
              facilityId: bookedResult.facilityId || (typeof availableDate === 'object' ? availableDate.facilityId : null),
              time: bookedResult.time || null,
              dryRun: options.dryRun || false
            };

            await fs.writeFile('booking_result.json', JSON.stringify(payload, null, 2));
            log(`Wrote booking_result.json: ${JSON.stringify(payload)}`);
          } catch (e) {
            log(`Failed to write booking_result.json: ${e.message}`);
          }

          // Update current date to the new available date
          currentBookedDate = selectedDate;

          options = {
            ...options,
            current: currentBookedDate
          };

          if (targetDate && selectedDate <= targetDate) {
            log(`Target date reached! Successfully booked appointment on ${selectedDate}`);
            process.exit(0);
          }

          // Exit after a booking only when running inside GitHub Actions (so Actions can pick up the result).
          // For long-running deployments (Render, Fly) we should keep the process alive.
          if (process.env.GITHUB_ACTIONS === 'true') {
            process.exit(0);
          } else {
            log('Booking completed; continuing to run (not exiting in deployed mode)');
          }
        }
      }

      await sleep(config.refreshDelay);
    }
  } catch (err) {
    if (isSocketHangupError(err)) {
      log(`Socket hangup error: ${err.message}. Trying again after ${COOLDOWN} seconds...`);
      await sleep(COOLDOWN);
    } else {
      log(`Session/authentication error: ${err.message}. Retrying immediately...`);
    }
    return botCommand(options);
  }
}
