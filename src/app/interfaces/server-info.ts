import { SafeResourceUrl } from '@angular/platform-browser';

export interface ServerInfo {
    Name: string;
    DisplayText: string
    Ip: string;
    GameVersion: string;
    GameUrl: string;
    HashTableUrl: string;
    VoteUrl: string;
    TrackerUrl: string;
    TrustedTrackerUrl: SafeResourceUrl;
}
