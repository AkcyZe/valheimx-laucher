import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ElectronService } from 'ngx-electron';
import { GameService, HashKey } from '../services/game.service';
import { DialogService } from '../services/dialog.service';
import { HOST_URL, SettingsService } from '../services/settings.service';
import { Metrika } from 'ng-yandex-metrika';
import { VoteDialogComponent } from '../dialogs/vote/vote.dialog';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { SteamNotFoundDialog } from '../dialogs/steam-not-found/steam-not-found.dialog';
import { ServerData } from '../interfaces/settings';
import { UserPreferenceService } from '../services/user-preference.service';

@Component({
    selector: 'app-shell',
    templateUrl: './shell.component.html',
    styleUrls: ['./shell.component.scss']
})
export class ShellComponent implements OnInit {

    public set selectedServer(value: ServerData) {
        this._selectedServer = value;
    }
    public get selectedServer(): ServerData {
        return this._selectedServer;
    }

    public isGameLoading = false;
    public stepProgress = 32;
    public globalProgress = 32;
    public stepProgressMessage = 'Загрузка файлов игры...';
    public globalProgressMessage = '0/218';


    public get servers(): ServerData[] {
        return this._servers;
    }

    private _servers: ServerData[];
    private _selectedServer: ServerData;

    private _progressSubscription: Subscription;

    public isGameStarting: boolean;

    constructor(public gameService: GameService,
                public userPreferenceService: UserPreferenceService,
                public settingsService: SettingsService,
                private electronService: ElectronService,
                private _settingService: SettingsService,
                private _metrika: Metrika,
                private _dialogService: DialogService,
                private _changeDetectorRef: ChangeDetectorRef) {
    }

    ngOnInit(): void {
        this._progressSubscription = this.gameService.downloadProgressSubject.subscribe((progress) => {
            this.stepProgress = this.compilePercent(progress.progress.transferredBytes, progress.progress.totalBytes, progress.fileName);
        });

        this.setServers();
    }

    private setServers() {
        this._servers = this.settingsService.servers;
        this.settingsService.serversListUpdated.subscribe((servers) => {
            if (servers.length != this.servers.length) {
                this._servers = servers;
            }
        });

        if (this.servers.length > 0) {
            let lastConnectedServer = this.gameService.getLastConnectedServer();
            if (!lastConnectedServer) {
                lastConnectedServer = this.servers[0];
            }

            this.selectedServer = lastConnectedServer;
        }
    }

    async checkForUpdates(force?: boolean): Promise<void> {
        this.isGameLoading = true;

        await this.settingsService.reloadSettings();

        this.resetLoadingProgress();

        this.stepProgressMessage = "Проверка целостности клиента";

        if (force) {
            await this.gameService.deleteAllFiles(this.selectedServer.Name);
        }

        const hashKeysToDelete: HashKey[] = [];
        const hashKeysToDownload: HashKey[] = [];
        const hashTableUrl = `${HOST_URL}/client/${this.selectedServer.Name}/hash_table.txt`;

        try {
            const originalHashTable = await this.gameService.getRemoteHashTable(hashTableUrl);
            const localHashTable = await this.gameService.getLocalHashTable(this.selectedServer.Name);

            localHashTable.forEach(localHashKey => {
                const existedOriginalHashKey = originalHashTable.find(originalHashKey => this.isPathsEquals(originalHashKey, localHashKey));
                if (!existedOriginalHashKey) {
                    console.log(`Deleting not existed hash: ${localHashKey.hash}:${localHashKey.path}`);

                    hashKeysToDelete.push(localHashKey);

                    return;
                }

                if (!this.isHashedEquals(existedOriginalHashKey, localHashKey)) {
                    console.log(`Deleting invalid hash: ${localHashKey.hash}:${localHashKey.path}`);

                    hashKeysToDelete.push(localHashKey);
                }
            });

            originalHashTable.forEach(originalHashKey => {
               const existedLocalHashKey = localHashTable.find(localHashKey => this.isPathsEquals(originalHashKey, localHashKey));
                if (!existedLocalHashKey) {
                    console.log(`Downloading not existed hash: ${originalHashKey.hash}:${originalHashKey.path}`);

                    hashKeysToDownload.push(originalHashKey);

                    return;
                }

                if (!this.isHashedEquals(existedLocalHashKey, originalHashKey)) {
                    console.log(`Updating invalid hash: ${originalHashKey.hash}:${originalHashKey.path}`);

                    hashKeysToDownload.push(originalHashKey);
                }
            });

            if (hashKeysToDelete.length || hashKeysToDownload.length) {
                await this.updateGame(this.selectedServer.Name, hashKeysToDelete.map(hash => hash.path), hashKeysToDownload.map(hash => hash.path));
            } else {
                this.isGameLoading = false;
            }
        } catch (error) {
            this.isGameLoading = false;

            await this._dialogService.showErrorDialog(`Ошибка при проверке файлов игры.`, error.message);
        }
    }

    private isHashedEquals(original: HashKey, client: HashKey): boolean {
        return original.hash === client.hash;
    }

    private isPathsEquals(original: HashKey, client: HashKey) {
        const originalPath = original.path.replace(/\\/g, '/');
        const clientPath = client.path.replace(/\\/g, '/');

        return originalPath.trim() === clientPath.trim();
    }

    changeGameFolder() {
        this.userPreferenceService.changeGameFolder();
    }

    updateGame(serverName: string, filesForDelete: string[], filesForUpdate: string[]): Promise<boolean> {
        return new Promise((resolve) => {
            this.gameService.deleteFiles(serverName, filesForDelete).then(() => {
                const totalCount = filesForUpdate.length;

                const subscription = this.gameService.downloadFiles(serverName, `${HOST_URL}/client/${serverName}`, filesForUpdate)
                    .pipe(finalize(() => {
                        this.isGameLoading = false;
                        this.userPreferenceService.shouldVote = true;

                        this.resetLoadingProgress();

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
        this.isGameStarting = true;

        await this.showVoteDialog();

        this._changeDetectorRef.markForCheck();

        const isSteamRunning = await this.gameService.isSteamEnabled();
        if (!isSteamRunning) {
            const result = await this._dialogService.openDialog(SteamNotFoundDialog);
            if (!result) {
                this.isGameStarting = false;

                return;
            }
        }

        this._changeDetectorRef.markForCheck();

        try {
            await this.checkForUpdates();

            const hasAdminRight = await this.gameService.checkAdminRights();
            if (!hasAdminRight) {
                await this._dialogService.showErrorDialog("Для запуска игры необходимо запустить лаунчер от имени администратора. Если сообщение повторяется вы можете запустить игру через valheim.exe файл в папке с игрой.", null, "Запустите лаунчер от имени администратора.");

                this.isGameStarting = false;

                return;
            }

            await this.gameService.startGame(this.selectedServer);
        } catch (error) {
            await this._dialogService.showErrorDialog("Ошибка при запуске игры.", error.message);

            this._changeDetectorRef.markForCheck();
        }

        this.isGameStarting = false;
    }

    private async showVoteDialog(): Promise<void> {
        if (this.selectedServer.VoteUrl && this.userPreferenceService.shouldVote) {
            await this._dialogService.openDialog(VoteDialogComponent, this.selectedServer.VoteUrl);

            this.userPreferenceService.shouldVote = false;
        }
    }

    openGameFolder() {
        this.gameService.openGameFolder(this.selectedServer.Name);
    }

    openLogFolder() {
        this.gameService.openLogFolder(this.selectedServer.Name);
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
