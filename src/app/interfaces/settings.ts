import { SafeResourceUrl } from '@angular/platform-browser';

export interface Settings {
    Description: string;
    Servers: ServerData[];
    News: News[];
    Contacts: Contacts;
    VoteImg: string;
}

export interface Contacts {
    Vk: string;
    Wiki: string;
    Discord: string;
}

export interface News {
    Title: string;
    Content: string;
}

export interface ServerData {
    Name: string;
    DisplayText: string
    Ip: string;
    HashTableUrl: string;
    VoteUrl: string;
    TrackerUrl: string;
    TrustedTrackerUrl: SafeResourceUrl;
}
