// src/types/settings.ts

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface PublishedNoteInfo {
    hash: string;
    timestamp: number;
}

export interface BlogSyncSettings {
    // 기본 설정
    blogFolderPath: string;
    showNotifications: boolean;
    
    // 발행 설정
    publishTarget: 'github' | 'server' | 'both';
    customDomain: string;
    
    // GitHub 설정
    githubToken: string;
    githubUsername: string;
    githubRepo: string;
    githubBranch: string;
    publicBasePath: string;
    blogContentPath: string;
    blogAssetsPath: string;
    
    // OMV 로컬 서버 설정
    enableLocalServer: boolean;
    localServerHost: string;  // 서버 IP/호스트: 203.234.57.91
    localServerPort: number;  // 웹 포트: 2052
    localServerPath: string;  // SMB 경로: \\GNBUPI\500gssd(1)\quartz-blog
    localServerNotesPath: string;  // 노트 경로: src\site\notes
    localServerAssetsPath: string;  // 이미지 경로: src\site\img\user
    
    // Webhook 설정
    enableWebhook: boolean;
    webhookUrl: string;  // http://gnbupi.local:8099/restart-docker
    webhookToken: string;  // 인증 토큰
    
    publishedNotes: Record<string, PublishedNoteInfo>;
}

export const DEFAULT_SETTINGS: BlogSyncSettings = {
    blogFolderPath: '',
    showNotifications: true,
    
    publishTarget: 'both',
    customDomain: '',
    
    githubToken: '',
    githubUsername: '',
    githubRepo: '',
    githubBranch: 'main',
    publicBasePath: 'src/site',
    blogContentPath: 'notes',
    blogAssetsPath: 'img/user',
    
    enableLocalServer: false,
    localServerHost: '203.234.57.91',
    localServerPort: 2052,
    localServerPath: '\\\\GNBUPI\\500gssd(1)\\quartz-blog',
    localServerNotesPath: 'src\\site\\notes',
    localServerAssetsPath: 'src\\site\\img\\user',
    
    enableWebhook: false,
    webhookUrl: 'http://gnbupi.local:8099/restart-docker',
    webhookToken: '',
    
    publishedNotes: {}
};
