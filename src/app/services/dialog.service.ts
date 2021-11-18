import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogComponent } from '../dialogs/error/error.dialog';
import { ComponentType } from '@angular/cdk/portal';

@Injectable({
    providedIn: 'root',
})
export class DialogService {
    constructor(private _dialog: MatDialog) {
    }

    showErrorDialog(message: string, critical?: string, title = "Ошибка"): Promise<void> {
        return new Promise<void>((resolve) => {
            this._dialog.closeAll();

            this._dialog.open(ErrorDialogComponent, {
                data: {
                    Title: title,
                    Message: message,
                    Critical: critical
                },
                disableClose: true
            }).afterClosed().subscribe(() => {
                resolve();
            });
        });
    }

    openDialog<T>(component: ComponentType<T>, data?: any): Promise<any> {
        return new Promise<any>((resolve) => {
            this._dialog.closeAll();

            this._dialog.open(component, {
                data: data,
                disableClose: true
            }).afterClosed().subscribe((result) => {
                resolve(result);
            })
        });
    }
}
