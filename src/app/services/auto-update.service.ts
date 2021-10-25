import { ChangeDetectorRef, Injectable } from '@angular/core';
import { ElectronService } from 'ngx-electron';
import { UserPreferenceService } from './user-preference.service';


@Injectable({
    providedIn: 'root',
})
export class AutoUpdateService {
    public isUpdateAvailable;
    public isUpdateInProgress;

    constructor(private _electronService: ElectronService,
                private _userPreferenceService: UserPreferenceService) {
    }

    public update() {
        this.isUpdateAvailable = true;
        this.isUpdateInProgress = true;

        this._userPreferenceService.skipUpdate = false;

        this._electronService.ipcRenderer.send('install-update', '');
    }

    public skipUpdate() {
        this._userPreferenceService.skipUpdate = true;
    }

    public checkForUpdates(): Promise<void> {
        return new Promise<void>((resolve) => {
            this._electronService.ipcRenderer.on('check-for-updates-result', (event, result) => {
                if (result) {
                    this.isUpdateAvailable = true;
                } else {
                    this._userPreferenceService.skipUpdate = false;
                }

                resolve();
            });

            this._electronService.ipcRenderer.send('check-for-updates');
        });
    }
}
