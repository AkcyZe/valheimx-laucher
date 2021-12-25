import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { ElectronService } from 'ngx-electron';
import { DomSanitizer } from '@angular/platform-browser';
import { Metrika } from 'ng-yandex-metrika';
import { Progress } from 'electron-dl';
import { SettingsService } from './settings.service';
import { UserPreferenceService } from './user-preference.service';
import { ServerData } from '../interfaces/settings';


export interface HashKey {
    hash: string;
    path: string;
}

export interface DownloadProgress {
    fileName: string;
    progress: Progress;
}

const ServersUrl = 'https://pastebin.com/raw/cbFFb6ZT';

@Injectable({
    providedIn: 'root',
})
export class GameService {
    public downloadProgressSubject = new Subject<DownloadProgress>();
    public downloadCompletedSubject = new Subject();

    constructor(
        private _http: HttpClient,
        private _electronService: ElectronService,
        private _settingsService: SettingsService,
        private _userPreferenceService: UserPreferenceService,
        private _metric: Metrika) {
        this.subscribeOnIpcMainEvents();
    }

    private subscribeOnIpcMainEvents() {
        this._electronService.ipcRenderer.on('download-progress', (event, fileName: string, progress: Progress) => {
            this.downloadProgressSubject.next({ fileName, progress });
        });

        this._electronService.ipcRenderer.on('download-completed', (event) => {
            this.downloadCompletedSubject.next();
        });
    }

    getLastConnectedServer() {
        if (this._userPreferenceService.lastConnectedServer) {
            return this._settingsService.servers.find(server => server.Name === this._userPreferenceService.lastConnectedServer);
        }
    }

    async deleteAllFiles(serverName: string): Promise<void> {
        await this._electronService.ipcRenderer.invoke('delete-all-file', serverName).then((() => {}));
    }

    async deleteFiles(serverName: string, paths: any[]) {
        for (const path of paths) {
            await this._electronService.ipcRenderer.invoke('delete-file', serverName, path).then((() => {}));
        }
    }

    downloadFiles(serverName: string, baseUrl: string, paths: any[]): Observable<number> {
        return new Observable(observer => {
            new Promise<void>(async (resolve, reject) => {
                let loaded = 0;
                for (const path of paths) {
                    try {
                        await this._electronService.ipcRenderer.invoke('download-file', serverName, baseUrl, path).then((() => {}));
                    } catch (error) {
                        observer.error(error);
                    }

                    loaded++;

                    observer.next(loaded);
                }

                resolve();
            }).then(() => {
                observer.complete();
            })
        });


    }

    async getLocalHashTable(serverName: string): Promise<HashKey[]> {
        return new Promise((resolve, reject) => {
            this._electronService.ipcRenderer.invoke('getHashTable', serverName).then((hashTable: HashKey[]) => {
                resolve(hashTable);
            }, error => {
                console.error(error);

                reject(error);
            });
        })
    }

    async getRemoteHashTable(hashTableUrl: string): Promise<HashKey[]> {
        return new Promise((resolve, reject) => {
            this._http.get(hashTableUrl,  {responseType: 'text'}).subscribe((result) => {
                const hashTable = [] as HashKey[];

                result.split('\n').forEach(stringHashCode => {
                    const hashArray = stringHashCode.split(':');
                    if (hashArray.length == 2) {
                        hashTable.push({ hash: hashArray[0], path: hashArray[1] });
                    }
                });

                resolve(hashTable);
            }, error => {
                reject(error);
            });
        });
    }

    checkAdminRights(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this._electronService.ipcRenderer.invoke('checkOnAdminRights').then((value) => {
                resolve(value);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    isSteamEnabled(): Promise<boolean> {
        return this._electronService.ipcRenderer.invoke('isProcessRunning', "steam");
    }

    startGame(server: ServerData): Promise<void> {
        const launchParams = [];

        if (server) {
            launchParams.push('server');
            launchParams.push(server.Ip);
        }

        if (this._userPreferenceService.vulkanEnabled) {
            launchParams.push('-force-vulkan');
        }

        const params = {
            server: server.Name,
            launchParams
        };

        this._metric.fireEvent('START-GAME');

        this._userPreferenceService.lastConnectedServer = server.Name;

        return this._electronService.ipcRenderer.invoke('startGame', params);
    }

    openGameFolder(serverName: string) {
        this._electronService.ipcRenderer.send('openGameFolder', serverName);
    }

    openLogFolder(serverName: string) {
        this._electronService.ipcRenderer.send('openLogFolder', serverName);
    }

    openDevMode() {
        this._electronService.ipcRenderer.send('openDevMode');
    }
}
