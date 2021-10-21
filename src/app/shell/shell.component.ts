import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { ElectronService } from 'ngx-electron';
import { GameService, HashKey } from '../services/game.service';
import { ServerInfo } from '../interfaces/server-info';
import { HttpEventType } from '@angular/common/http';
import { DialogService } from '../services/dialog.service';
import { SettingsService } from '../services/settings.service';
import { Metrika } from 'ng-yandex-metrika';
import { VoteDialogComponent } from '../dialogs/vote/vote.dialog';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-shell',
    templateUrl: './shell.component.html',
    styleUrls: ['./shell.component.scss']
})
export class ShellComponent implements OnInit {

    public set selectedServer(value: ServerInfo) {
        this._selectedServer = value;
    }
    public get selectedServer(): ServerInfo {
        return this._selectedServer;
    }

    public isGameLoading = false;
    public stepProgress = 32;
    public globalProgress = 32;
    public stepProgressMessage = 'Загрузка файлов игры...';
    public globalProgressMessage = '0/218';

    public servers: ServerInfo[];

    private _selectedServer: ServerInfo;

    private _progressSubscription: Subscription;

    constructor(public gameService: GameService,
                public settingsService: SettingsService,
                private electronService: ElectronService,
                private _metrika: Metrika,
                private _dialogService: DialogService,
                private _changeDetectorRef: ChangeDetectorRef) {
    }

    ngOnInit(): void {
        this.servers = this.gameService.servers;

        this._progressSubscription = this.gameService.downloadProgressSubject.subscribe((progress) => {
            this.stepProgress = this.compilePercent(progress.progress.transferredBytes, progress.progress.totalBytes, progress.fileName);
        });

        if (this.gameService.servers.length > 0) {
            let lastConnectedServer = this.gameService.getLastConnectedServer();
            if (!lastConnectedServer) {
                lastConnectedServer = this.gameService.servers[0];
            }

            this.selectedServer = lastConnectedServer;

            this.gameService.serversListUpdated.subscribe((servers) => {
                this.servers.forEach(server => {
                   const newServerInfo = servers.find(serverInfo => serverInfo.Name === server.Name);
                   if (newServerInfo && newServerInfo.GameVersion != server.GameVersion) {
                       server.GameVersion = newServerInfo.GameVersion;
                   }
                });
            });
        }
    }

    public closeApp(): void {
        this.electronService.ipcRenderer.send('close');
    }

    async checkForUpdates(force?: false): Promise<void> {
        this.isGameLoading = true;

        this.resetLoadingProgress();

        this.stepProgressMessage = "Проверка целостности клиента";

        if (force) {
            await this.gameService.deleteAllFiles(this.selectedServer.Name);
        }

        const filesForDelete = [];
        const filesForUpdate = [];
        const hashTableUrl = `${this.settingsService.settings.Host}/client/${this.selectedServer.Name}/hash_table.txt`;

        try {
            const localHashTable = await this.gameService.getLocalHashTable(this.selectedServer.Name);
            const remoteHashTable = await this.gameService.getRemoteHashTable(hashTableUrl);

            remoteHashTable.forEach(remoteHashKey => { // New Files
                if (!localHashTable.find(localHashKey => localHashKey.hash === remoteHashKey.hash)) {
                    filesForUpdate.push(remoteHashKey.path);
                }
            });

            localHashTable.forEach(localHashKey => { // Old Files
                if (!remoteHashTable.find(remoteHashKey => remoteHashKey.hash === localHashKey.hash)) {
                    filesForDelete.push(localHashKey.path);
                }
            });

            if (filesForDelete.length || filesForUpdate.length) {
                await this.updateGame(this.selectedServer.Name, filesForDelete, filesForUpdate);
            } else {
                this.isGameLoading = false;
            }
        } catch (error) {
            this.isGameLoading = false;

            await this._dialogService.showErrorDialog(`Ошибка при проверке файлов игры.`, error.message);
        }
    }

    updateGame(serverName: string, filesForDelete: string[], filesForUpdate: string[]): Promise<boolean> {
        return new Promise((resolve) => {
            this.gameService.deleteFiles(serverName, filesForDelete).then(() => {
                const totalCount = filesForUpdate.length;

                const subscription = this.gameService.downloadFiles(serverName, `${this.settingsService.settings.Host}/client/${serverName}`, filesForUpdate)
                    .pipe(finalize(() => {
                        this.isGameLoading = false;
                        this.gameService.userPreference.ShouldVote = true;

                        this.resetLoadingProgress();
                        this.gameService.updateUserPreference();

                        subscription.unsubscribe();

                        resolve(true);
                    }))
                    .subscribe((loadedCount) => {
                        this.globalProgress = loadedCount / totalCount * 100;
                        this.globalProgressMessage = `${loadedCount}/${totalCount}`;
                    }, error => {
                        this.isGameLoading = false;

                        this.resetLoadingProgress();

                        subscription.unsubscribe();

                        this._dialogService.showErrorDialog(`Ошибка при загрузке файлов игры.`, error.message);

                        resolve(false);
                    });
            }, error => {
                this.isGameLoading = false;

                this._dialogService.showErrorDialog(`Ошибка при удалении устаревших файлов игры.`, error.message);

                resolve(false);
            });
        });
    }

    resetLoadingProgress() {
        this.globalProgress = 0;
        this.globalProgressMessage = '';
        this.stepProgress = 0;
        this.stepProgressMessage = '';
    }

    openExternal(url) {
        this._metrika.fireEvent("OPEN-LINK", {
           params: {
               "url": url
           }
        });

        this.electronService.shell.openExternal(url);
    }

    async startGame() {
        if (this.selectedServer.VoteUrl && this.gameService.userPreference.ShouldVote) {
            await this._dialogService.openDialog(VoteDialogComponent, this.selectedServer.VoteUrl);

            this.gameService.userPreference.ShouldVote = false;

            this.gameService.updateUserPreference();
        }

        const isSteamRunning = await this.gameService.isSteamEnabled();
        if (!isSteamRunning) {
            this._dialogService.showErrorDialog("Для игры на сервере, необходим запущенный стим с лицензионной игрой.");
        }

        await this.checkForUpdates();

        try {
            await this.gameService.startGame(this.selectedServer);
        } catch (error) {
            this._dialogService.showErrorDialog("Ошибка при запуске игры.", error.message);
        }
    }

    openGameFolder() {
        this.gameService.openGameFolder(this.selectedServer.Name);
    }

    openLogFolder() {
        this.gameService.openLogFolder();
    }

    compilePercent(loaded: number, total: number, fileName?: string): number {
        const loadedMb = Math.round( loaded / 1000000);
        const totalMb = Math.round(total / 1000000);

        let message = `(${loadedMb} мб / ${totalMb} мб)`;
        if (fileName) {
            message = `Файл: ${fileName} ${message}`;
        }

        this.stepProgressMessage = message;

        this._changeDetectorRef.detectChanges();

        return (loaded / total) * 100
    }
}
