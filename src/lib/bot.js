import { VisaHttpClient } from './client.js';
import { log } from './utils.js';

export class Bot {
  constructor(config, options = {}) {
    this.config = config;
    this.dryRun = options.dryRun || false;
    this.client = new VisaHttpClient(this.config.countryCode, this.config.email, this.config.password);
  }

  async initialize() {
    log('Initializing visa bot...');
    return await this.client.login();
  }

  async checkAvailableDate(sessionHeaders, currentBookedDate, minDate) {
    const facilityIds = Array.isArray(this.config.facilityId)
      ? this.config.facilityId
      : [this.config.facilityId];

    const allDates = [];
  log(`checking facilities: ${facilityIds.join(', ')}`);
    for (const fid of facilityIds) {
      log(`checking facility ${fid}...`);
      try {
        const dates = await this.client.checkAvailableDate(
          sessionHeaders,
          this.config.scheduleId,
          fid
        );

        if (dates && dates.length > 0) {
          log(`facility ${fid} returned ${dates.length} date(s)`);
          dates.forEach(d => allDates.push({ date: d, facilityId: fid }));
        } else {
          log(`facility ${fid} returned no dates`);
        }
      } catch (err) {
        try {
          log(`error fetching dates for facility ${fid}: ${err && err.message ? err.message : JSON.stringify(err)}`);
        } catch (e) {
          log(`error fetching dates for facility ${fid}: ${String(err)}`);
        }
      }
    }

    if (!allDates || allDates.length === 0) {
      log("no dates available");
      return null;
    }

    const goodDates = allDates.filter(entry => {
      const date = entry.date;

      if (date >= currentBookedDate) {
        log(`This date (${date}) is farther away from the currentdate (${currentBookedDate}) at facility (${entry.facilityId})`);
        return false;
      }

      // Changed the condition to find the appointments which are above the min date 
      // Earlier it was checking for below the min date just change the > to <
      if (minDate && date > minDate) {
        log(`date ${date} (facility ${entry.facilityId}) is after minimum date (${minDate})`);
        return false;
      }

      return true;
    });

    if (goodDates.length === 0) {
      log("no good dates found after filtering");
      return null;
    }

    // Sort by date (ascending) and return the earliest entry with facility info
    goodDates.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
    const earliest = goodDates[0];

    log(`found ${goodDates.length} good dates across facilities, using earliest: ${earliest.date} (facility ${earliest.facilityId})`);
    return earliest;
  }

  async bookAppointment(sessionHeaders, date) {
    // date may be a string or an object { date, facilityId }
    const facilityIds = Array.isArray(this.config.facilityId)
      ? this.config.facilityId
      : [this.config.facilityId];

    let targetDate;
    let targetFacility = null;

    if (typeof date === 'object' && date !== null && date.date) {
      targetDate = date.date;
      targetFacility = date.facilityId;
    } else {
      targetDate = date;
    }

    let time = null;

    if (targetFacility) {
      // We already know the facility that had the available date
      try {
        time = await this.client.checkAvailableTime(
          sessionHeaders,
          this.config.scheduleId,
          targetFacility,
          targetDate
        );
      } catch (err) {
        log(`error checking times for facility ${targetFacility} on ${targetDate}: ${err.message}`);
      }

      // If the facility that reported the date doesn't have times, try other facilities
      if (!time) {
        log(`no time found for date ${targetDate} at facility ${targetFacility}, trying other facilities...`);
        for (const fid of facilityIds) {
          if (String(fid) === String(targetFacility)) continue;
          try {
            time = await this.client.checkAvailableTime(
              sessionHeaders,
              this.config.scheduleId,
              fid,
              targetDate
            );

            if (time) {
              targetFacility = fid;
              log(`found time at facility ${fid} for date ${targetDate}`, "SUCCESS");
              break;
            }
          } catch (err) {
            log(`error checking times for facility ${fid} on ${targetDate}: ${err.message}`);
          }
        }
      }
    } else {
      // Try each configured facility to find an available time for the date
      for (const fid of facilityIds) {
        try {
          time = await this.client.checkAvailableTime(
            sessionHeaders,
            this.config.scheduleId,
            fid,
            targetDate
          );

          if (time) {
            targetFacility = fid;
            break;
          }
        } catch (err) {
          log(`error checking times for facility ${fid} on ${targetDate}: ${err.message}`);
        }
      }
    }

    if (!time) {
      log(`no available time slots for date ${targetDate}`);
      return { success: false };
    }

    if (this.dryRun) {
      log(`[DRY RUN] Would book appointment at ${targetDate} ${time} (facility ${targetFacility}) (not actually booking)`, 'SUCCESS');
      return { success: true, date: targetDate, facilityId: targetFacility, time: 'DRY_RUN' };
    }

    await this.client.book(
      sessionHeaders,
      this.config.scheduleId,
      targetFacility,
      targetDate,
      time
    );

    log(`booked time at ${targetDate} ${time} (facility ${targetFacility})`, 'SUCCESS');
    return { success: true, date: targetDate, facilityId: targetFacility, time };
  }

}
