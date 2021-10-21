import {  Component, OnInit } from '@angular/core';
import {  GameService } from './services/game.service';
import { SettingsService } from './services/settings.service';
import { DialogService } from './services/dialog.service';
import { ElectronService } from 'ngx-electron';
import { OldLauncherDialogComponent } from './dialogs/old-launcher/old-launcher.dialog';
import { Metrika } from 'ng-yandex-metrika';

const LauncherVersion = 'ValheimXv5';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
    public isDataReceived = false;

    constructor(
        private _settingsService: SettingsService,
        private _gameService: GameService,
        private _dialogService: DialogService,
        private _electronService: ElectronService,
        private _metrika: Metrika) {
    }

    async ngOnInit() {
        this._electronService.ipcRenderer.on('update_available', (event) => {
            this._electronService.ipcRenderer.removeAllListeners('update_available');

            this._dialogService.showErrorDialog("Update available");
        });

        this._electronService.ipcRenderer.on('update_downloaded', (event) => {
            this._electronService.ipcRenderer.removeAllListeners("update_downloaded")

            this._dialogService.showErrorDialog("Update Downloaded").then(() => {
                this._electronService.ipcRenderer.send('restart_app');
            });
        });

        try {
            this._gameService.checkAdminRights().then((result) => {
                if (!result) {
                    this._dialogService.showErrorDialog("Запустите лаунчер от имени администратора").then(() => {
                        this._electronService.ipcRenderer.send('close');
                    });
                }
            });

            const settings = await this._settingsService.fetchSettings();
            if (settings.LauncherVersion != LauncherVersion) {
                this._dialogService.openDialog<OldLauncherDialogComponent>(OldLauncherDialogComponent, settings.LauncherUrl).then((() => {
                    this._electronService.ipcRenderer.send('close');
                }));
            }
        } catch (error) {
            this._dialogService.showErrorDialog("Ошибка при загрузке настроек", error.message).then(() => {
                this._electronService.ipcRenderer.send('close');
            });
        }

        await this._gameService.fetchServerList();

        this._metrika.hit("ValheimX", { title: "ValheimX" });

        this.isDataReceived = true;
    }
}
