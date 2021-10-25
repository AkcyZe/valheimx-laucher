import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';

import { NgxElectronModule } from 'ngx-electron';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HttpClientModule } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { ShellComponent } from './shell/shell.component';
import { SettingsService } from './services/settings.service';
import { MatDialogModule } from '@angular/material/dialog'
import { ErrorDialogComponent } from './dialogs/error/error.dialog';
import { DialogService } from './services/dialog.service';
import { SteamNotFoundDialog } from './dialogs/steam-not-found/steam-not-found.dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MetrikaModule } from 'ng-yandex-metrika';
import { VoteDialogComponent } from './dialogs/vote/vote.dialog';
import { AutoUpdateComponent } from './auto-update/auto-update.component';
import { UserPreferenceService } from './services/user-preference.service';
import { AutoUpdateService } from './services/auto-update.service';

@NgModule({
    declarations: [
        AppComponent,
        ShellComponent,
        ErrorDialogComponent,
        SteamNotFoundDialog,
        VoteDialogComponent,
        AutoUpdateComponent
    ],
    imports: [
        BrowserModule,
        NgxElectronModule,
        MatProgressBarModule,
        HttpClientModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        FormsModule,
        ReactiveFormsModule,
        MatInputModule,
        BrowserAnimationsModule,
        MatProgressSpinnerModule,
        MatMenuModule,
        MatDialogModule,
        MatCheckboxModule,

        MetrikaModule.forRoot({
            id: 82629355,
            webvisor: true,
            clickmap: true,
            trackLinks: true,
            accurateTrackBounce: true
        }, 82629355)
    ],
    providers: [SettingsService, DialogService, UserPreferenceService, AutoUpdateService],
    bootstrap: [AppComponent]
})
export class AppModule {
}
