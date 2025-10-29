import { Bot } from '../lib/bot.js';
import { getConfig } from '../lib/config.js';
import { log, sleep, isSocketHangupError } from '../lib/utils.js';

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

        const booked = await bot.bookAppointment(sessionHeaders, availableDate);

        if (booked) {
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
