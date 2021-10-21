import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';

@Component({
    selector: 'old-launcher-dialog',
    templateUrl: './old-launcher.dialog.html',
    styleUrls: ['./old-launcher.dialog.scss']
})
export class OldLauncherDialogComponent {
    constructor(public dialogRef: MatDialogRef<OldLauncherDialogComponent>,
                @Inject(MAT_DIALOG_DATA) public data: any) {
        console.log(data);
    }

    close() {
        this.dialogRef.close();
    }
}
