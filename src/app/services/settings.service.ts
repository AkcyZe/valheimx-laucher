import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ServerData, Settings } from '../interfaces/settings';
import { DomSanitizer } from '@angular/platform-browser';
import { Subject } from 'rxjs';

export const HOST_URL = 'http://185.189.255.227:9323';
const SETTINGS_URL = 'http://185.189.255.227:9323/Launcher/Settings.json';

const fs = (window as any).require('fs');

@Injectable({
    providedIn: 'root',
})
export class SettingsService {
    public settings: Settings;
    public servers: ServerData[];

    public serversListUpdated: Subject<ServerData[]> = new Subject<ServerData[]>();

    private refreshInterval: NodeJS.Timeout;

    constructor(private _http: HttpClient,
                private _sanitizer: DomSanitizer) {}

    async init(): Promise<void> {
        this.settings = await this.fetchSettings();

        this.handleServerList(this.settings);

        this.startFetchingInterval();
    }

    private async fetchSettings(): Promise<Settings> {
        return new Promise<Settings>((resolve, reject) => {
            this._http.get<Settings>(SETTINGS_URL).subscribe(result => {
                resolve(result);
            }, error => {
                reject(error);
            })
        });
    }

    startFetchingInterval() {
        if (!this.refreshInterval) {
            this.refreshInterval = setInterval(async () => {
                try {
                    const settings = await this.fetchSettings();
                    this.handleServerList(settings);
                } catch (error) {}
            }, 10000);
        }
    }

    private handleServerList(settings: Settings): void {
        this.servers = settings.Servers;
        this.servers.forEach(server => {
            server.TrustedTrackerUrl = this._sanitizer.bypassSecurityTrustResourceUrl(server.TrackerUrl);
        });

        this.serversListUpdated.next(this.servers);
    }
}
