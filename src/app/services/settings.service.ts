import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GlobalSettings } from '../interfaces/global-settings';

const SettingsUlr = 'https://pastebin.com/raw/TXPz28JL';

@Injectable({
    providedIn: 'root',
})
export class SettingsService {
    public settings: GlobalSettings;

    constructor(private _http: HttpClient) {
    }

    async fetchSettings(): Promise<GlobalSettings> {
        return new Promise<GlobalSettings>((resolve, reject) => {
            this._http.get<GlobalSettings>(SettingsUlr).subscribe(result => {
                this.settings = result;

                resolve(result);
            }, error => {
                console.log(error);

                reject(error);
            });
        });
    }
}
