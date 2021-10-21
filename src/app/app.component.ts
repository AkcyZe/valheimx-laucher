import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {  GameService } from './services/game.service';
import { SettingsService } from './services/settings.service';
import { DialogService } from './services/dialog.service';
import { ElectronService } from 'ngx-electron';
import { OldLauncherDialogComponent } from './dialogs/old-launcher/old-launcher.dialog';
import { Metrika } from 'ng-yandex-metrika';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
    public isDataReceived = false;
    public version: string;

    constructor(
        private _settingsService: SettingsService,
        private _gameService: GameService,
        private _dialogService: DialogService,
        private _electronService: ElectronService,
        private _changeDetectorRef: ChangeDetectorRef,
        private _metrika: Metrika) {
    }

    async ngOnInit() {
        this._electronService.ipcRenderer.send('get-version');

        this._electronService.ipcRenderer.on('log', (event, data) => {
            console.log(data);
        });

        this._electronService.ipcRenderer.on('error', (event, data) => {
            console.error(data);
        });

        this._electronService.ipcRenderer.on('version', (event, data) => {
            this.version = data.version;

            console.log(`Version: ${JSON.stringify(this.version)}`);
        });

        try {
            this._gameService.checkAdminRights().then((result) => {
                if (!result) {
                    this._dialogService.showErrorDialog("Запустите лаунчер от имени администратора").then(() => {
                        this._electronService.ipcRenderer.send('close');
                    });
                }
            });
        } catch (error) {
            this._dialogService.showErrorDialog("Ошибка при загрузке настроек", error.message).then(() => {
                this._electronService.ipcRenderer.send('close');
            });
        }

        await this._settingsService.fetchSettings();
        await this._gameService.fetchServerList();

        this._metrika.hit("ValheimX", { title: "ValheimX" });

        this.isDataReceived = true;
    }
}
