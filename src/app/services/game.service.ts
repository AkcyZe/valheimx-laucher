import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { ElectronService } from 'ngx-electron';
import { DomSanitizer } from '@angular/platform-browser';
import { ServerInfo } from '../interfaces/server-info';
import { Metrika } from 'ng-yandex-metrika';
import { Progress } from 'electron-dl';

const fs = (window as any).require('fs');

export interface IUserPreference {
    LastConnectedServer: string;
    Vulkan: boolean;
    ShouldVote: boolean;
}

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
    public servers: ServerInfo[];
    public userPreference: IUserPreference;

    public downloadProgressSubject = new Subject<DownloadProgress>();
    public downloadCompletedSubject = new Subject();

    public serversListUpdated: Subject<ServerInfo[]> = new Subject<ServerInfo[]>();

    private refreshInterval: NodeJS.Timeout;

    constructor(
        private _http: HttpClient,
        private _electronService: ElectronService,
        private _metrika: Metrika,
        private _sanitizer: DomSanitizer) {

        this.userPreference = this.getUserPreference();
        this.createGameFolder();

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

    createGameFolder() {
        if (!fs.existsSync('Games')) {
            fs.mkdirSync('Games');
        }
    }

    getLastConnectedServer() {
        if (this.userPreference && this.userPreference.LastConnectedServer) {
            return this.servers.find(server => server.Name === this.userPreference.LastConnectedServer);
        }
    }

    async fetchServerList() {
        return new Promise<ServerInfo[]>((resolve, reject) => {
           this._http.get<ServerInfo[]>(ServersUrl).subscribe(servers => {
               this.servers = servers;

               this.servers.forEach(server => {
                   server.TrustedTrackerUrl = this._sanitizer.bypassSecurityTrustResourceUrl(server.TrackerUrl);

                   const serverFilesDir = `Games/${server.Name}`;
                   if (!fs.existsSync(serverFilesDir)) {
                       fs.mkdirSync(serverFilesDir);
                   }
               });

               this.serversListUpdated.next(this.servers);

               this.startFetchingInterval();

               resolve(servers);
           }, error => {
               console.error(error);

               reject(error);
           });
        });
    }

    startFetchingInterval() {
        if (!this.refreshInterval) {
            this.refreshInterval = setInterval(() => {
                this.fetchServerList();
            }, 10000);
        }
    }

    getUserPreference(): IUserPreference {
        if (!fs.existsSync(`config.json`)) {
            return {
                LastConnectedServer: null,
                Vulkan: false,
                ShouldVote: true
            } as IUserPreference;
        } else {
            const prefString = fs.readFileSync(`config.json`, { encoding: 'utf8' });

            return JSON.parse(prefString);
        }
    }

    updateUserPreference() {
        fs.writeFileSync(`config.json`, JSON.stringify(this.userPreference));
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

    isGameInstalled(serverName: string): boolean {
        return fs.existsSync(`Games/${serverName}/valheim.exe`);
    }

    isGameVersionValid(server: ServerInfo): boolean {
        if (!fs.existsSync(`Games/${server.Name}/version.txt`)) {
            return false;
        } else {
            const gameVersion = fs.readFileSync(`Games/${server.Name}/version.txt`, { encoding: 'utf8' }) .trim();

            return server.GameVersion === gameVersion;
        }
    }

    isSteamEnabled(): Promise<boolean> {
        return this._electronService.ipcRenderer.invoke('isProcessRunning', "steam");
    }

    startGame(server: ServerInfo): Promise<void> {
        const launchParams = [];

        if (server) {
            launchParams.push('server');
            launchParams.push(server.Ip);
        }

        if (this.userPreference.Vulkan) {
            launchParams.push('-force-vulkan');
        }

        const params = {
            server: server.Name,
            launchParams,
            vulkan: this.userPreference.Vulkan
        };

        this._metrika.fireEvent('START-GAME');

        this.userPreference.LastConnectedServer = server.Name;

        this.updateUserPreference();

        return this._electronService.ipcRenderer.invoke('startGame', params);
    }

    openGameFolder(serverName: string) {
        this._electronService.ipcRenderer.send('openGameFolder', serverName);
    }

    openLogFolder() {
        this._electronService.ipcRenderer.send('openLogFolder');
    }

    openDevMode() {
        this._electronService.ipcRenderer.send('openDevMode');
    }
}
