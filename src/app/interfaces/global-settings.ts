export interface GlobalSettings {
    LauncherVersion: string;
    LauncherUrl: string;
    Host: string;
    DiscordUrl: string;
    ProjectName: string;
    ProjectDescription: string;
    VkUrl: string;
    WikiUrl: string;
    News: News[];
}

export interface News {
    Title: string;
    Content: string;
}
