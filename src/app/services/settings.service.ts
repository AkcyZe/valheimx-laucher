import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ServerData, Settings } from '../interfaces/settings';
import { DomSanitizer } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { ElectronService } from 'ngx-electron';

export const HOST_URL = 'https://cdn.valheim-ragnarok-static.space/valheim-ragnarok';
const SETTINGS_URL = `${HOST_URL}/Settings.json`;

const fs = (window as any).require('fs');

@Injectable({
    providedIn: 'root',
})
export class SettingsService {
    public settings: Settings;
    public servers: ServerData[];

    public serversListUpdated: Subject<ServerData[]> = new Subject<ServerData[]>();

    constructor(private _http: HttpClient,
                private _sanitizer: DomSanitizer,
                private _electronService: ElectronService) {}

    async init(): Promise<void> {
        this.settings = await this.fetchSettings();

        this.handleServerList(this.settings);
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

    public async reloadSettings(): Promise<void> {
        const settings = await this.fetchSettings();
        this.handleServerList(settings);
    }

    private handleServerList(settings: Settings): void {
        this.servers = settings.Servers;
        this.servers.forEach(server => {
            server.TrustedTrackerUrl = this._sanitizer.bypassSecurityTrustResourceUrl(server.TrackerUrl);
        });

        this.serversListUpdated.next(this.servers);
    }
}
