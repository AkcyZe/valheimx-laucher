import { Injectable } from '@angular/core';
import { ElectronService } from 'ngx-electron';
import { UserPreference } from '../interfaces/user-preference';


@Injectable({
    providedIn: 'root',
})
export class UserPreferenceService {
    public get skipUpdate(): boolean {
        return this._userPreference.SkipUpdate;
    }
    public set skipUpdate(value: boolean) {
        this._userPreference.SkipUpdate = value;

        this.onPropertyChanged();
    }

    public get lastConnectedServer(): string {
        return this._userPreference.LastConnectedServer;
    }
    public set lastConnectedServer(value: string) {
        this._userPreference.LastConnectedServer = value;

        this.onPropertyChanged();
    }

    public get vulkanEnabled(): boolean {
        return this._userPreference.VulkanEnabled;
    }
    public set vulkanEnabled(value: boolean) {
        this._userPreference.VulkanEnabled = value;

        this.onPropertyChanged();
    }

    public get shouldVote(): boolean {
        return this._userPreference.ShouldVote;
    }
    public set shouldVote(value: boolean) {
        this._userPreference.ShouldVote = value;

        this.onPropertyChanged();
    }

    public get gameFolder(): string {
        return this._userPreference.GameFolder;
    }
    public set gameFolder(value: string) {
        this._userPreference.GameFolder = value;

        this.onPropertyChanged();
    }

    private _userPreference: UserPreference;

    constructor(private _electronService: ElectronService) {
        this.loadOrCreate();
    }

    private onPropertyChanged(): void {
        this.save();
    }

    private save() {
        this._electronService.ipcRenderer.send('save-user-preference', JSON.stringify(this._userPreference));
    }

    private loadOrCreate(): void {
        this._electronService.ipcRenderer.invoke('load-user-preference').then((result: string) => {
            if (!result) {
                this._userPreference = new UserPreference();

                this.save();

                return;
            }

            this._userPreference = JSON.parse(result) as UserPreference;

            this.setGameFolder();
        });
    }

    public async changeGameFolder() {
        this._electronService.ipcRenderer.invoke("change-game-folder").then((result) => {
            if (result) {
                this.gameFolder = result;
            }
        });
    }

    private setGameFolder() {
        if (this._userPreference.GameFolder && this._userPreference.GameFolder.length) {
            this._electronService.ipcRenderer.send('set-game-folder', this._userPreference.GameFolder);
        }
    }
}
