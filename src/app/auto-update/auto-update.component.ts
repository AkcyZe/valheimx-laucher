import { Component } from '@angular/core';;
import { AutoUpdateService } from '../services/auto-update.service';

@Component({
    selector: 'app-auto-update',
    templateUrl: './auto-update.component.html',
    styleUrls: ['./auto-update.component.scss']
})
export class AutoUpdateComponent {

    public get isUpdateInProgress(): boolean {
        return this._autoUpdateService.isUpdateInProgress;
    }

    constructor(private _autoUpdateService: AutoUpdateService) {
    }

    public cancelUpdate() {
        this._autoUpdateService.skipUpdate();
    }

    public update() {
        this._autoUpdateService.update();
    }
}
