import streamDeck from "@elgato/streamdeck";
import { Tado, type Token } from "node-tado-client";

import type { TadoGlobalSettings } from "./types";

export class TadoManager {
  private static instance: TadoManager;
  private tado: Tado;
  private initialized = false;
  private initializing: Promise<void> | null = null;

  private constructor() {
    this.tado = new Tado();
    this.tado.setTokenCallback(this.onTokenUpdate.bind(this));
  }

  static getInstance(): TadoManager {
    if (!TadoManager.instance) {
      TadoManager.instance = new TadoManager();
    }
    return TadoManager.instance;
  }

  get api(): Tado {
    return this.tado;
  }

  get isReady(): boolean {
    return this.initialized;
  }

  async ensureAuthenticated(): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) return this.initializing;

    this.initializing = this.doAuth();
    try {
      await this.initializing;
      this.initialized = true;
    } catch (error) {
      streamDeck.logger.error(`Authentication failed: ${error}`);
      throw error;
    } finally {
      this.initializing = null;
    }
  }

  resetAuth(): void {
    this.initialized = false;
    this.initializing = null;
  }

  private async doAuth(): Promise<void> {
    const settings = await streamDeck.settings.getGlobalSettings<TadoGlobalSettings>();
    const refreshToken = settings?.refresh_token;

    streamDeck.logger.info("Starting authentication...");

    const [verify, futureToken] = await this.tado.authenticate(refreshToken || undefined);

    if (verify) {
      streamDeck.logger.info(`Device authentication required: ${verify.verification_uri_complete}`);
      streamDeck.system.openUrl(verify.verification_uri_complete);
    } else {
      streamDeck.logger.info("Authenticating with existing refresh token...");
    }

    await futureToken;
    streamDeck.logger.info("Tado authenticated successfully");
  }

  private async onTokenUpdate(token: Token): Promise<void> {
    const settings = await streamDeck.settings.getGlobalSettings<TadoGlobalSettings>();
    await streamDeck.settings.setGlobalSettings<TadoGlobalSettings>({
      ...settings,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry: token.expiry.toISOString(),
    });
    streamDeck.logger.info("Token saved to global settings");
  }
}
