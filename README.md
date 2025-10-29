# US Visa Bot 🤖

An automated bot that monitors and reschedules US visa interview appointments to get you an earlier date.

## Features

- 🔄 Continuously monitors available appointment slots
- 📅 Automatically books earlier dates when found
- 🔁 Supports multiple consulate facilities (tries all configured facilities)
- 🎯 Configurable target and minimum date constraints
- 🚨 Exits successfully when target date is reached
- 📊 Structured, timestamped logs with levels (INFO/WARN/ERROR/DEBUG)
- 🔐 Secure authentication with environment variables

## Highlights of recent changes

- `FACILITY_ID` now accepts multiple formats (comma/space/semicolon-separated lists or a JSON array). The bot normalizes these and checks every configured facility.
- When a facility reports an available date but has no time slots, the bot will automatically try the other facilities for the same date before giving up.
- Logging was improved: messages include an ISO timestamp and a level, and are colorized for readability. There are helper functions (`info`, `warn`, `error`, `debug`) in the codebase.
- `checkAvailableDate` now returns information that includes which facility a date came from (internally), so booking uses the correct facility ID.

## How It Works

The bot logs into your account on https://ais.usvisa-info.com/ and checks for available appointment dates every few seconds. When it finds a date earlier than your current booking (and within your specified constraints), it automatically reschedules your appointment. If multiple facilities are configured, it queries all of them and will attempt booking on the facility that actually has the available time.

## Prerequisites

- Node.js 16+
- A valid US visa interview appointment
- Access to https://ais.usvisa-info.com/

## Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/us-visa-bot.git
cd us-visa-bot
```

2. Install dependencies:

```bash
npm install
```

## Configuration

Create a `.env` file in the project root with your credentials and configuration.

```env
EMAIL=your.email@example.com
PASSWORD=your_password
COUNTRY_CODE=your_country_code
SCHEDULE_ID=your_schedule_id
# FACILITY_ID may be a single id or multiple ids in array formats (examples below)
FACILITY_ID=89,90,123
REFRESH_DELAY=3
```

### Supported `FACILITY_ID` formats

The bot accepts several common formats and normalizes them automatically:

- Single value: `FACILITY_ID=89`
- Comma-separated: `FACILITY_ID=89,90,123`
- Space-separated: `FACILITY_ID="89 90 123"`
- Semicolon-separated: `FACILITY_ID=89;90;123`
- JSON array: `FACILITY_ID=["89","90","123"]`

If multiple IDs are present the bot will iterate and query each facility for available dates.

### Other env variables

- `REFRESH_DELAY` — seconds between checks (default: 3)
- `COUNTRY_CODE`, `SCHEDULE_ID`, `EMAIL`, `PASSWORD` — required to authenticate and query the scheduling API

## Usage

Run the bot with your current appointment date:

```bash
node index.js -c <current_date> [-t <target_date>] [-m <min_date>] [--dry-run]
```

- `-c, --current` (required): Your current booked interview date (YYYY-MM-DD)
- `-t, --target` (optional): Target date to stop at — the bot exits successfully when reached
- `-m, --min` (optional): Minimum acceptable date — the bot skips dates prior to this
- `--dry-run` (optional): When set, the bot will not actually book but will log what it would do

### Examples

```bash
# Basic usage - reschedule to any earlier date
node index.js -c 2026-12-09

# With target date - stop when you get 2026-06-01 or earlier
node index.js -c 2026-12-09 -t 2026-06-01

# With minimum date - only accept dates after 2026-05-01
node index.js -c 2026-12-09 -m 2026-05-01

# With multiple facilities configured (via .env) and dry-run
FACILITY_ID=89,90,123 node index.js -c 2026-12-09 --dry-run
```

## Logging and Troubleshooting

The logger prints messages like:

```
[2025-10-29T06:01:50.672Z] [INFO] checking facilities: 89, 90, 123
[2025-10-29T06:01:50.672Z] [INFO] checking facility 89...
[2025-10-29T06:01:50.672Z] [INFO] facility 89 returned 5 date(s)
[2025-10-29T06:01:50.672Z] [INFO] date 2027-11-18 (facility 89) is further than already booked (2026-12-09)
[2025-10-29T06:01:50.672Z] [INFO] checking facility 90...
[2025-10-29T06:01:50.672Z] [INFO] facility 90 returned no dates
[2025-10-29T06:01:50.672Z] [INFO] found 3 good dates across facilities, using earliest: 2026-11-12 (facility 123)
```

If you see repeated errors for a specific facility (for example, `bad_request`), check:

- That the facility ID is correct for the selected schedule
- That the site hasn't changed (network requests return unexpected payloads)
- That your account has permission / visibility for the consulate in question

Paste full logs (including the `checking facilities:` and per-facility messages) when reporting issues — it makes diagnosis much faster.

## Safety Features

- ✅ **Dry-run** mode to preview booking actions
- ✅ **Respects constraints** - Won't book outside your specified date range
- ✅ **Fallback across facilities** - If the facility that reported a date has no times, the bot tries other configured facilities for the same date
- ✅ **Graceful retry** - Retries on transient network errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Disclaimer

This bot is for educational purposes. Use responsibly and in accordance with the terms of service of the visa appointment system. The authors are not responsible for any misuse or consequences.
