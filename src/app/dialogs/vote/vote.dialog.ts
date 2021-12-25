import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import { ErrorMessage } from '../../interfaces/error-message';
import { ElectronService } from 'ngx-electron';
import { Metrika } from 'ng-yandex-metrika';
import { SettingsService } from '../../services/settings.service';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
    selector: 'vote-dialog',
    templateUrl: './vote.dialog.html',
    styleUrls: ['./vote.dialog.scss']
})
export class VoteDialogComponent {
    constructor(
        public dialogRef: MatDialogRef<VoteDialogComponent>,
        public sanitized: DomSanitizer,
        @Inject(MAT_DIALOG_DATA) public data: string,
        private _electronService: ElectronService,
        public settingsService: SettingsService,
        private _metrika: Metrika) {
    }

    public vote() {
        this._metrika.fireEvent("VOTE");

        this._electronService.shell.openExternal(this.data);

        this.dialogRef.close();
    }
}
