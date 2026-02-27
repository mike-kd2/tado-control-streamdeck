import streamDeck from "@elgato/streamdeck";

import { TadoManager } from "./tado-manager";
import { PollingService } from "./polling-service";

import { CurrentTemperature } from "./actions/current-temperature";
import { Power } from "./actions/power";
import { Boost } from "./actions/boost";
import { PowerAllOff } from "./actions/off";
import { ZoneControl } from "./actions/zone-control";
import { QuickPreset } from "./actions/quick-preset";
import { PresenceStatus } from "./actions/presence-status";
import { HumidityDisplay } from "./actions/humidity-display";
import { ScheduleStatus } from "./actions/schedule-status";

streamDeck.logger.setLevel("debug");

const tadoManager = TadoManager.getInstance();
const pollingService = PollingService.getInstance();

streamDeck.actions.registerAction(new CurrentTemperature(tadoManager, pollingService));
streamDeck.actions.registerAction(new Power(tadoManager, pollingService));
streamDeck.actions.registerAction(new Boost(tadoManager, pollingService));
streamDeck.actions.registerAction(new PowerAllOff(tadoManager, pollingService));
streamDeck.actions.registerAction(new ZoneControl(tadoManager, pollingService));
streamDeck.actions.registerAction(new QuickPreset(tadoManager, pollingService));
streamDeck.actions.registerAction(new PresenceStatus(tadoManager));
streamDeck.actions.registerAction(new HumidityDisplay(tadoManager, pollingService));
streamDeck.actions.registerAction(new ScheduleStatus(tadoManager));

(async () => {
  try {
    await tadoManager.ensureAuthenticated();
    streamDeck.logger.info("Tado Control plugin ready");
  } catch (error) {
    streamDeck.logger.error(`Failed to authenticate: ${error}`);
  }
})();

streamDeck.connect();
