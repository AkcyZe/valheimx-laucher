import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {  GameService } from './services/game.service';
import { SettingsService } from './services/settings.service';
import { DialogService } from './services/dialog.service';
import { ElectronService } from 'ngx-electron';
import { SteamNotFoundDialog } from './dialogs/steam-not-found/steam-not-found.dialog';
import { Metrika } from 'ng-yandex-metrika';
import { UserPreferenceService } from './services/user-preference.service';
import { AutoUpdateService } from './services/auto-update.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
    public isDataReceived = false;
    public version: string;

    public get isUpdatePageVisible(): boolean {
        return this._autoUpdateService.isUpdateAvailable && !this._userPreferenceService.skipUpdate;
    }

    public get isUpdateButtonVisible(): boolean {
        return this._autoUpdateService.isUpdateAvailable && this._userPreferenceService.skipUpdate;
    }

    public get isSettingsReceived(): boolean {
        return this._settingsService.settings != null;
    }

    constructor(
        private _settingsService: SettingsService,
        private _gameService: GameService,
        private _dialogService: DialogService,
        private _electronService: ElectronService,
        private _changeDetectorRef: ChangeDetectorRef,
        private _userPreferenceService: UserPreferenceService,
        private _autoUpdateService: AutoUpdateService,
        private _metrics: Metrika) {
    }

    async ngOnInit() {
        this._autoUpdateService.checkForUpdates().then(() => {

        });

        this.subscribeOnLogs();
        this.subscribeOnVersion();

        this._settingsService.init().then(() => {

        }, error => {
            this._dialogService.showErrorDialog("Ошибка при загрузке настроек", error.message).then(() => {});
        });

        this.isDataReceived = true;

        this._metrics.hit("Ragnarok", { title: "Ragnarok" });
    }

    public updateLauncher() {
        this._autoUpdateService.update();
    }

    public closeApp(): void {
        this._electronService.ipcRenderer.send('close');
    }

    private subscribeOnVersion() {
        this._electronService.ipcRenderer.send('get-version');

        this._electronService.ipcRenderer.on('version', (event, data) => {
            this.version = data.version;

            console.log(`Version: ${JSON.stringify(this.version)}`);
        });
    }

    private subscribeOnLogs() {
        this._electronService.ipcRenderer.on('log', (event, data) => {
            console.log(data);
        });

        this._electronService.ipcRenderer.on('error', (event, data) => {
            console.error(data);
        });
    }
}
