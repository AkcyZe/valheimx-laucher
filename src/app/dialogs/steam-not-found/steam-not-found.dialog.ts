import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';

@Component({
    selector: 'steam-not-found',
    templateUrl: './steam-not-found.dialog.html',
    styleUrls: ['./steam-not-found.dialog.scss']
})
export class SteamNotFoundDialog {
    constructor(public dialogRef: MatDialogRef<SteamNotFoundDialog>,
                @Inject(MAT_DIALOG_DATA) public data: any) {
        console.log(data);
    }

    close(result: boolean) {
        this.dialogRef.close(result);
    }
}
