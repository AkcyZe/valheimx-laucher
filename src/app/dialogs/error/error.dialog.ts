import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import { ErrorMessage } from '../../interfaces/error-message';

@Component({
    selector: 'error-dialog',
    templateUrl: './error.dialog.html',
    styleUrls: ['./error.dialog.scss']
})
export class ErrorDialogComponent {
    constructor(
        public dialogRef: MatDialogRef<ErrorDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ErrorMessage) {}
}
