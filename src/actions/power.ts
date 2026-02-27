import streamDeck, {
  action,
  SingletonAction,
  type DialDownEvent,
  type DialRotateEvent,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { ZoneState } from "node-tado-client";

import type { TadoManager } from "../tado-manager";
import type { PollingService } from "../polling-service";
import type { PowerSettings, UnitTemperature } from "../types";
import { formatTemperature, getIndicatorPercent, clampTemperature, buildTemperature, readTemperature } from "../utils/temperature";

@action({ UUID: "dev.klauserdesignscoaching.tado-control.power" })
export class Power extends SingletonAction<PowerSettings> {
  private unsubscribe?: () => void;

  constructor(
    private manager: TadoManager,
    private polling: PollingService,
  ) {
    super();
  }

  override async onWillAppear(ev: WillAppearEvent<PowerSettings>): Promise<void> {
    const { homeId, zoneId } = ev.payload.settings;
    if (!homeId || !zoneId) return;

    const hid = parseInt(homeId, 10);
    const zid = parseInt(zoneId, 10);

    this.polling.registerZone(hid, zid);
    this.unsubscribe = this.polling.onUpdate((h, z, state) => {
      if (h === hid && z === zid) {
        this.updateDisplay(ev, state);
      }
    });

    const cached = this.polling.getCached(hid, zid);
    if (cached) this.updateDisplay(ev, cached);
  }

  override onWillDisappear(ev: WillDisappearEvent<PowerSettings>): void {
    this.unsubscribe?.();
    const { homeId, zoneId } = ev.payload.settings;
    if (homeId && zoneId) {
      this.polling.unregisterZone(parseInt(homeId, 10), parseInt(zoneId, 10));
    }
  }

  override async onKeyDown(ev: KeyDownEvent<PowerSettings>): Promise<void> {
    await this.handleToggle(ev);
  }

  override async onDialDown(ev: DialDownEvent<PowerSettings>): Promise<void> {
    await this.handleToggle(ev);
  }

  override async onDialRotate(ev: DialRotateEvent<PowerSettings>): Promise<void> {
    const settings = await ev.action.getSettings();
    const { unit } = settings;
    const currentTemp = (settings.temperature as number) || 20;
    const step = unit === "fahrenheit" ? 1 : 0.5;
    const newTemp = clampTemperature(currentTemp + ev.payload.ticks * step, unit);

    await ev.action.setSettings({ ...settings, temperature: newTemp });
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    await this.manager.ensureAuthenticated();
    const settings = await ev.action.getSettings();
    if (ev.payload.event === "getHomes") {
      await this.sendHomes(ev);
    }
    if (ev.payload.event === "getZones" && settings.homeId) {
      await this.sendZones(ev, settings.homeId);
    }
  }

  override async onDidReceiveSettings(ev: any): Promise<void> {
    const { homeId, zoneId } = ev.payload.settings;
    if (homeId && !zoneId) {
      await this.sendZones(ev, homeId);
    }
  }

  private async handleToggle(ev: { action: { getSettings: () => Promise<PowerSettings> } }): Promise<void> {
    const { homeId, zoneId, unit, temperature } = await ev.action.getSettings();
    if (!homeId || !zoneId) return;

    const hid = parseInt(homeId, 10);
    const zid = parseInt(zoneId, 10);
    await this.togglePower(hid, zid, unit, temperature);
    await this.polling.refreshZone(hid, zid);
  }

  private async togglePower(homeId: number, zoneId: number, unit: UnitTemperature, temperature: number): Promise<void> {
    try {
      let hasOverlay = false;
      try {
        await this.manager.api.getZoneOverlay(homeId, zoneId);
        hasOverlay = true;
      } catch {
        hasOverlay = false;
      }

      if (hasOverlay) {
        await this.manager.api.clearZoneOverlays(homeId, [zoneId]);
      } else {
        const temp = buildTemperature(temperature || 20, unit);
        await this.manager.api.setZoneOverlays(homeId, [{ power: "ON" as any, zone_id: zoneId, temperature: temp }], "MANUAL");
      }
    } catch {
    }
  }

  private updateDisplay(ev: any, state: ZoneState): void {
    const unit = ev.payload.settings.unit || "celsius";
    const tempValue = readTemperature(state.sensorDataPoints?.insideTemperature, unit);
    const overlay = (state as any).overlay;
    const power = overlay?.setting?.power;

    try {
      if (ev.action.isKey()) {
        ev.action.setTitle(formatTemperature(tempValue, unit));
        ev.action.setState(power === "ON" ? 0 : 1);
      }
      if (ev.action.isDial()) {
        ev.action.setFeedback({
          value: formatTemperature(tempValue, unit),
          status: power || "—",
          indicator: getIndicatorPercent(tempValue, unit),
        });
      }
    } catch {
    }
  }

  private async sendHomes(ev: any): Promise<void> {
    try {
      const { homes } = await this.manager.api.getMe();
      await streamDeck.ui.sendToPropertyInspector({
        event: "getHomes",
        items: homes.map((h: any) => ({ label: h.name, value: h.id })),
      });
    } catch (error) {
      streamDeck.logger.error(`[Power] sendHomes failed: ${error}`);
    }
  }

  private async sendZones(ev: any, homeId: string): Promise<void> {
    try {
      const zones = await this.manager.api.getZones(parseInt(homeId, 10));
      await streamDeck.ui.sendToPropertyInspector({
        event: "getZones",
        items: zones.map((z: any) => ({ label: z.name, value: z.id })),
      });
    } catch (error) {
      streamDeck.logger.error(`[Power] sendZones failed: ${error}`);
    }
  }
}
