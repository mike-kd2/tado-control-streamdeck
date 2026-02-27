import streamDeck, { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";

import type { TadoManager } from "../tado-manager";
import type { ZoneActionSettings } from "../types";
import { readTemperature } from "../utils/temperature";

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function parseTimeToMinutes(time: string): number {
  const parts = time.split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

@action({ UUID: "dev.klauserdesignscoaching.tado-control.schedule" })
export class ScheduleStatus extends SingletonAction<ZoneActionSettings> {
  private pollInterval?: ReturnType<typeof setInterval>;

  constructor(private manager: TadoManager) {
    super();
  }

  override async onWillAppear(ev: WillAppearEvent<ZoneActionSettings>): Promise<void> {
    await this.updateSchedule(ev);
    this.pollInterval = setInterval(() => this.updateSchedule(ev), 15 * 60 * 1000);
  }

  override onWillDisappear(_ev: WillDisappearEvent<ZoneActionSettings>): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    await this.manager.ensureAuthenticated();
    const settings = await ev.action.getSettings();
    if (ev.payload.event === "getHomes") {
      try {
        const { homes } = await this.manager.api.getMe();
        await streamDeck.ui.sendToPropertyInspector({
          event: "getHomes",
          items: homes.map((h: any) => ({ label: h.name, value: h.id })),
        });
      } catch (error) {
        streamDeck.logger.error(`[ScheduleStatus] sendHomes failed: ${error}`);
      }
    }
    if (ev.payload.event === "getZones" && settings.homeId) {
      try {
        const zones = await this.manager.api.getZones(parseInt(settings.homeId, 10));
        await streamDeck.ui.sendToPropertyInspector({
          event: "getZones",
          items: zones.map((z: any) => ({ label: z.name, value: z.id })),
        });
      } catch (error) {
        streamDeck.logger.error(`[ScheduleStatus] sendZones failed: ${error}`);
      }
    }
  }

  private async updateSchedule(ev: any): Promise<void> {
    const { homeId, zoneId, unit } = ev.payload.settings;
    if (!homeId || !zoneId) return;

    try {
      const hid = parseInt(homeId, 10);
      const zid = parseInt(zoneId, 10);

      const activeTable = await this.manager.api.getTimeTables(hid, zid);
      if (!activeTable) return;

      const blocks = await this.manager.api.getTimeTable(hid, zid, activeTable.id);

      const now = new Date();
      const today = DAY_NAMES[now.getDay()];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const todayBlocks = (blocks as any[])
        .filter((b: any) => b.dayType === today || b.dayType === "MONDAY_TO_FRIDAY" || b.dayType === "MONDAY_TO_SUNDAY")
        .sort((a: any, b: any) => parseTimeToMinutes(a.start || "00:00") - parseTimeToMinutes(b.start || "00:00"));

      let currentBlock = todayBlocks[0];
      let nextBlock = todayBlocks[1];

      for (let i = 0; i < todayBlocks.length; i++) {
        const blockMinutes = parseTimeToMinutes(todayBlocks[i].start || "00:00");
        if (blockMinutes <= currentMinutes) {
          currentBlock = todayBlocks[i];
          nextBlock = todayBlocks[i + 1];
        }
      }

      if (!currentBlock) return;

      const effectiveUnit = unit || "celsius";
      const temp = readTemperature(currentBlock.setting?.temperature, effectiveUnit);
      const symbol = effectiveUnit === "fahrenheit" ? "°F" : "°C";
      const tempDisplay = temp ? `${temp}${symbol}` : `—${symbol}`;
      const nextTime = nextBlock?.start || "—";

      if (ev.action.isKey()) {
        ev.action.setTitle(`${tempDisplay}\nbis ${nextTime}`);
      }
      if (ev.action.isDial()) {
        ev.action.setFeedback({
          value: tempDisplay,
          title: `bis ${nextTime}`,
        });
      }
    } catch {
    }
  }
}
