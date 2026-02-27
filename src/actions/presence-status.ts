import streamDeck, { action, SingletonAction, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";

import type { TadoManager } from "../tado-manager";
import type { HomeActionSettings } from "../types";
import { createKeyImage } from "../utils/key-image";

@action({ UUID: "dev.klauserdesignscoaching.tado-control.presence" })
export class PresenceStatus extends SingletonAction<HomeActionSettings> {
  private pollInterval?: ReturnType<typeof setInterval>;
  private currentEv?: any;

  constructor(private manager: TadoManager) {
    super();
  }

  override async onWillAppear(ev: WillAppearEvent<HomeActionSettings>): Promise<void> {
    this.currentEv = ev;
    await this.updatePresence(ev);
    this.pollInterval = setInterval(() => this.currentEv && this.updatePresence(this.currentEv), 5 * 60 * 1000);
  }

  override onWillDisappear(_ev: WillDisappearEvent<HomeActionSettings>): void {
    this.currentEv = undefined;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  override async onDidReceiveSettings(ev: any): Promise<void> {
    const { homeId } = ev.payload.settings;
    if (homeId) {
      this.currentEv = ev;
      await this.updatePresence(ev);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<HomeActionSettings>): Promise<void> {
    const { homeId } = await ev.action.getSettings();
    if (!homeId) return;

    try {
      const hid = parseInt(homeId, 10);
      const homeState = await this.manager.api.getState(hid);
      const currentPresence = homeState.presence;
      const newPresence = currentPresence === "HOME" ? "AWAY" : "HOME";

      await this.manager.api.setPresence(hid, newPresence);
      ev.action.setState(newPresence === "HOME" ? 0 : 1);
      ev.action.setImage(createKeyImage([newPresence], { textColor: newPresence === "HOME" ? "#4CAF50" : "#9E9E9E" }));
      ev.action.showOk();
    } catch {
      ev.action.showAlert();
    }
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    await this.manager.ensureAuthenticated();
    if (ev.payload.event === "getHomes") {
      try {
        const { homes } = await this.manager.api.getMe();
        await streamDeck.ui.sendToPropertyInspector({
          event: "getHomes",
          items: homes.map((h: any) => ({ label: h.name, value: h.id })),
        });
      } catch (error) {
        streamDeck.logger.error(`[PresenceStatus] sendHomes failed: ${error}`);
      }
    }
  }

  private async updatePresence(ev: any): Promise<void> {
    const { homeId } = ev.payload.settings;
    if (!homeId) return;

    try {
      const homeState = await this.manager.api.getState(parseInt(homeId, 10));
      const presence = homeState.presence;

      if (ev.action.isKey()) {
        ev.action.setState(presence === "HOME" ? 0 : 1);
        ev.action.setImage(createKeyImage([presence], { textColor: presence === "HOME" ? "#4CAF50" : "#9E9E9E" }));
      }
      if (ev.action.isDial()) {
        ev.action.setFeedback({
          value: presence,
          title: "Presence",
        });
      }
    } catch {
    }
  }
}
