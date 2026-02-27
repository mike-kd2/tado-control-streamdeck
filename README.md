# Tado Control - Stream Deck Plugin

Control your [Tado](https://www.tado.com/) smart heating system directly from your Elgato Stream Deck, including full **Stream Deck Plus** support with dials and touchscreen.

## Features

### 9 Actions

| Action | Type | Description |
|--------|------|-------------|
| **Current Temperature** | Key + Dial | Shows current temperature and humidity for a zone |
| **Power On/Off** | Key + Dial | Toggle heating on/off for a zone, dial adjusts temperature |
| **Boost All Rooms** | Key | Boost all zones to 25°C for 30 minutes |
| **Power Off All Rooms** | Key | Turn off heating in all zones |
| **Zone Control** | Dial | Main dial action: rotate to adjust target temp (0.5°C steps), press to toggle manual/schedule, touch to turn on/off |
| **Quick Preset** | Key | Apply a temperature preset to multiple zones at once |
| **Presence Status** | Key + Dial | Show and toggle Home/Away presence |
| **Humidity** | Key + Dial | Display humidity percentage for a zone |
| **Schedule Status** | Key + Dial | Show the current schedule block and next change time |

### Architecture Highlights

- **Centralized polling**: One API call per home (not per zone) using `getZoneStates()`
- **Visibility-aware**: Polling only runs when actions are visible on the current Stream Deck page — zero API calls when idle
- **Rate limit aware**: Automatically throttles polling when API quota is low
- **Singleton authentication**: Browser only opens once for OAuth device flow, refresh token is persisted
- **401 auto-recovery**: Transparent re-authentication on token expiry

## Requirements

- Elgato Stream Deck (any model, Stream Deck Plus recommended)
- Stream Deck software 6.8+
- Tado smart thermostat system (V2/V3, zone-based)
- Node.js 20+ (bundled by Stream Deck)

## Installation

### From Source

```bash
git clone https://github.com/mike-kd2/tado-control-streamdeck.git
cd tado-control-streamdeck
npm install
npm run build
streamdeck link dev.klauserdesignscoaching.tado-control.sdPlugin
```

Then restart the Stream Deck application.

## Configuration

1. Add any Tado Control action to your Stream Deck
2. On first use, a browser window will open for Tado OAuth authentication
3. Log in with your Tado account and authorize the plugin
4. In the Property Inspector, select your Home and Zone
5. Choose temperature unit (Celsius/Fahrenheit)

The refresh token is stored in the plugin's global settings and reused across restarts — no repeated logins needed.

## Development

```bash
npm run build          # Build the plugin
npm run watch          # Build + auto-restart on changes
npm test               # Run tests
npm run test:coverage  # Run tests with coverage report
```

## Testing

53 unit tests covering core modules:

- **Temperature utilities**: Conversion, formatting, clamping (30 tests, 100% coverage)
- **TadoManager**: Auth idempotency, token persistence, 401 recovery (13 tests, 95% coverage)
- **PollingService**: Zone lifecycle, visibility-aware polling, cache, error isolation (10 tests, 80% coverage)

## Credits

- Based on [aperezm85/streamdeck-tado-v2-plugin](https://github.com/aperezm85/streamdeck-tado-v2-plugin)
- Uses [mattdavis90/node-tado-client](https://github.com/mattdavis90/node-tado-client) for the Tado API
- Built with [@elgato/streamdeck](https://github.com/elgatosf/streamdeck) SDK v2

## License

MIT
