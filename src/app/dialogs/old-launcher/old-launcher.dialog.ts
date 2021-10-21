import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import { ErrorMessage } from '../../interfaces/error-message';
import { ElectronService } from 'ngx-electron';

@Component({
    selector: 'old-launcher-dialog',
    templateUrl: './old-launcher.dialog.html',
    styleUrls: ['./old-launcher.dialog.scss']
})
export class OldLauncherDialogComponent {
    constructor(public dialogRef: MatDialogRef<OldLauncherDialogComponent>,
                @Inject(MAT_DIALOG_DATA) public data: string,
                private _electronService: ElectronService) {}

    close() {
        this._electronService.shell.openExternal(this.data);

        this.dialogRef.close();
    }
}
