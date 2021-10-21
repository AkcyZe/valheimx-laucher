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

    showErrorDialog(message: string, critical?: string): Promise<void> {
        return new Promise<void>((resolve) => {
            this._dialog.open(ErrorDialogComponent, {
                data: {
                    Title: 'Ошибка',
                    Message: message,
                    Critical: critical
                }
            }).afterClosed().subscribe(() => {
                resolve();
            });
        });
    }

    openDialog<T>(component: ComponentType<T>, data?: any) {
        return new Promise<void>((resolve) => {
            this._dialog.open(component, {
                data: data
            }).afterClosed().subscribe(() => {
                resolve();
            })
        });
    }
}
