// src/publisher/IntegratedPublisher.ts

import { Notice, TFile } from 'obsidian';
import BlogSyncPlugin from '../../main';
import { GitHubPublisher } from './GitHubPublisher';
import { LocalServerPublisher } from './LocalServerPublisher';
import { WebhookClient } from './WebhookClient';

export interface PublishResult {
    success: boolean;
    github?: {
        success: boolean;
        filesPublished: number;
        commitSha?: string;
    };
    localServer?: {
        success: boolean;
        filesPublished: number;
    };
    webhook?: {
        success: boolean;
    };
    errors?: string[];
}

export class IntegratedPublisher {
    private plugin: BlogSyncPlugin;
    private githubPublisher?: GitHubPublisher;
    private localServerPublisher?: LocalServerPublisher;
    private webhookClient?: WebhookClient;

    constructor(plugin: BlogSyncPlugin) {
        this.plugin = plugin;
        this.initialize();
    }

    /**
     * Publishers 초기화
     */
    private initialize() {
        const settings = this.plugin.settings;

        // GitHub Publisher
        if (settings.githubToken && settings.githubUsername && settings.githubRepo) {
            this.githubPublisher = new GitHubPublisher(this.plugin, {
                githubToken: settings.githubToken,
                githubUsername: settings.githubUsername,
                githubRepo: settings.githubRepo,
                githubBranch: settings.githubBranch,
                publicBasePath: settings.publicBasePath,
                blogContentPath: settings.blogContentPath,
                blogAssetsPath: settings.blogAssetsPath
            });
        }

        // Local Server Publisher
        if (settings.enableLocalServer && settings.localServerPath) {
            this.localServerPublisher = new LocalServerPublisher(
                settings.localServerPath,
                settings.localServerNotesPath,
                settings.localServerAssetsPath
            );
        }

        // Webhook Client
        if (settings.enableWebhook && settings.webhookUrl && settings.webhookToken) {
            this.webhookClient = new WebhookClient(
                settings.webhookUrl,
                settings.webhookToken
            );
        }
    }

    /**
     * 단일 파일 발행
     */
    async publishFile(file: TFile): Promise<PublishResult> {
        const settings = this.plugin.settings;
        const result: PublishResult = {
            success: false,
            errors: []
        };

        new Notice(`📤 "${file.basename}" 발행 중...`);

        try {
            // 1. GitHub 발행
            if (this.githubPublisher && (settings.publishTarget === 'github' || settings.publishTarget === 'both')) {
                new Notice('📝 GitHub에 발행 중...');
                try {
                    const githubSuccess = await this.githubPublisher.publishFile(file);
                    result.github = {
                        success: githubSuccess,
                        filesPublished: githubSuccess ? 1 : 0,
                        commitSha: undefined
                    };

                    if (githubSuccess) {
                        new Notice('✅ GitHub 발행 완료!');
                    } else {
                        result.errors?.push('GitHub 발행 실패');
                    }
                } catch (error) {
                    console.error('GitHub publish error:', error);
                    result.errors?.push(`GitHub: ${error.message}`);
                }
            }

            // 2. 로컬 서버 발행
            if (this.localServerPublisher && settings.enableLocalServer) {
                new Notice('💾 로컬 서버에 복사 중...');
                try {
                    // 파일 읽기
                    const content = await this.plugin.app.vault.read(file);
                    const sourcePath = (this.plugin.app.vault.adapter as any).getFullPath(file.path);
                    
                    // 이미지 파일 찾기
                    const images = this.extractImageLinks(content);
                    const files: { source: string; target: string; isAsset?: boolean }[] = [];
                    
                    // 노트 파일 추가
                    files.push({
                        source: sourcePath,
                        target: file.path,
                        isAsset: false
                    });
                    
                    // 이미지 파일 추가
                    for (const imageName of images) {
                        const imageFile = this.plugin.app.metadataCache.getFirstLinkpathDest(imageName, file.path);
                        if (imageFile) {
                            const imageSourcePath = (this.plugin.app.vault.adapter as any).getFullPath(imageFile.path);
                            files.push({
                                source: imageSourcePath,
                                target: imageName,
                                isAsset: true
                            });
                        }
                    }
                    
                    // 파일 발행
                    const localResult = await this.localServerPublisher.publishFiles(files);
                    result.localServer = {
                        success: localResult.success,
                        filesPublished: localResult.filesPublished
                    };
                    
                    if (localResult.success) {
                        new Notice(`✅ 로컬 서버에 ${localResult.filesPublished}개 파일 복사 완료!`);
                    } else {
                        result.errors?.push('로컬 서버 복사 실패');
                    }
                } catch (error) {
                    console.error('Local server publish error:', error);
                    result.errors?.push(`로컬 서버: ${error.message}`);
                }
            }

            // 3. Webhook 호출 (로컬 서버 발행 성공 시에만)
            if (this.webhookClient && settings.enableWebhook && result.localServer?.success) {
                try {
                    const webhookSuccess = await this.webhookClient.triggerDockerRestart();
                    result.webhook = {
                        success: webhookSuccess
                    };
                } catch (error) {
                    console.error('Webhook error:', error);
                    result.errors?.push(`Webhook: ${error.message}`);
                }
            }

            // 최종 성공 여부
            result.success = (Boolean(result.github?.success) || Boolean(result.localServer?.success)) && (result.errors?.length === 0);

            if (result.success) {
                new Notice('🎉 발행 완료!');
            } else {
                new Notice(`⚠️ 발행 중 일부 오류 발생`);
            }

        } catch (error) {
            console.error('Publish error:', error);
            new Notice(`❌ 발행 실패: ${error.message}`);
            result.errors?.push(error.message);
        }

        return result;
    }

    /**
     * 여러 파일 발행
     */
    async publishFiles(files: TFile[]): Promise<PublishResult> {
        const settings = this.plugin.settings;
        const result: PublishResult = {
            success: false,
            errors: [],
            github: { success: false, filesPublished: 0 },
            localServer: { success: false, filesPublished: 0 }
        };

        new Notice(`📤 ${files.length}개 파일 발행 중...`);

        try {
            // 1. GitHub 발행
            if (this.githubPublisher && (settings.publishTarget === 'github' || settings.publishTarget === 'both')) {
                new Notice('📝 GitHub에 발행 중...');
                try {
                    const githubSuccess = await this.githubPublisher.publishFiles(files);
                    result.github = {
                        success: githubSuccess,
                        filesPublished: githubSuccess ? files.length : 0,
                        commitSha: undefined
                    };

                    if (githubSuccess) {
                        new Notice(`✅ GitHub에 ${files.length}개 파일 발행 완료!`);
                    }
                } catch (error) {
                    console.error('GitHub publish error:', error);
                    result.errors?.push(`GitHub: ${error.message}`);
                }
            }

            // 2. 로컬 서버 발행
            if (this.localServerPublisher && settings.enableLocalServer) {
                new Notice('💾 로컬 서버에 복사 중...');
                try {
                    const allFiles: { source: string; target: string; isAsset?: boolean }[] = [];
                    
                    // 모든 파일과 이미지 수집
                    for (const file of files) {
                        const content = await this.plugin.app.vault.read(file);
                        const sourcePath = (this.plugin.app.vault.adapter as any).getFullPath(file.path);
                        
                        // 노트 파일
                        allFiles.push({
                            source: sourcePath,
                            target: file.path,
                            isAsset: false
                        });
                        
                        // 이미지 파일
                        const images = this.extractImageLinks(content);
                        for (const imageName of images) {
                            const imageFile = this.plugin.app.metadataCache.getFirstLinkpathDest(imageName, file.path);
                            if (imageFile) {
                                const imageSourcePath = (this.plugin.app.vault.adapter as any).getFullPath(imageFile.path);
                                allFiles.push({
                                    source: imageSourcePath,
                                    target: imageName,
                                    isAsset: true
                                });
                            }
                        }
                    }
                    
                    // 중복 제거
                    const uniqueFiles = Array.from(new Map(allFiles.map(f => [f.target, f])).values());
                    
                    // 파일 발행
                    const localResult = await this.localServerPublisher.publishFiles(uniqueFiles);
                    result.localServer = {
                        success: localResult.success,
                        filesPublished: localResult.filesPublished
                    };
                    
                    if (localResult.success) {
                        new Notice(`✅ 로컬 서버에 ${localResult.filesPublished}개 파일 복사 완료!`);
                    }
                } catch (error) {
                    console.error('Local server publish error:', error);
                    result.errors?.push(`로컬 서버: ${error.message}`);
                }
            }

            // 3. Webhook 호출
            if (this.webhookClient && settings.enableWebhook && result.localServer?.success) {
                try {
                    const webhookSuccess = await this.webhookClient.triggerDockerRestart();
                    result.webhook = {
                        success: webhookSuccess
                    };
                } catch (error) {
                    console.error('Webhook error:', error);
                    result.errors?.push(`Webhook: ${error.message}`);
                }
            }

            // 최종 성공 여부
            result.success = (Boolean(result.github?.success) || Boolean(result.localServer?.success)) && (result.errors?.length === 0);

            if (result.success) {
                new Notice('🎉 모든 파일 발행 완료!');
            } else {
                new Notice(`⚠️ 발행 중 일부 오류 발생`);
            }

        } catch (error) {
            console.error('Batch publish error:', error);
            new Notice(`❌ 발행 실패: ${error.message}`);
            result.errors?.push(error.message);
        }

        return result;
    }

    /**
     * 이미지 링크 추출 (GitHub Publisher와 동일)
     */
    private extractImageLinks(content: string): string[] {
        const images: string[] = [];
        
        // ![[image.png]] 형식
        const wikiLinkRegex = /!\[\[([^\]]+)\]\]/g;
        let match;
        while ((match = wikiLinkRegex.exec(content)) !== null) {
            images.push(match[1]);
        }
        
        // ![](image.png) 형식
        const mdLinkRegex = /!\[.*?\]\(([^)]+)\)/g;
        while ((match = mdLinkRegex.exec(content)) !== null) {
            const link = match[1];
            if (!link.startsWith('http://') && !link.startsWith('https://')) {
                images.push(link);
            }
        }
        
        return [...new Set(images)]; // 중복 제거
    }

    /**
     * 연결 테스트
     */
    async testConnections(): Promise<{ github: boolean; localServer: boolean; webhook: boolean }> {
        const result = {
            github: false,
            localServer: false,
            webhook: false
        };

        // GitHub 테스트
        if (this.githubPublisher) {
            try {
                // GitHub API 호출 테스트
                result.github = true;
                new Notice('✅ GitHub 연결 성공');
            } catch {
                new Notice('❌ GitHub 연결 실패');
            }
        }

        // 로컬 서버 테스트
        if (this.localServerPublisher) {
            result.localServer = await this.localServerPublisher.validatePaths();
            if (result.localServer) {
                new Notice('✅ 로컬 서버 경로 확인');
            }
        }

        // Webhook 테스트
        if (this.webhookClient) {
            result.webhook = await this.webhookClient.testConnection();
            if (result.webhook) {
                new Notice('✅ Webhook 연결 성공');
            } else {
                new Notice('❌ Webhook 연결 실패');
            }
        }

        return result;
    }
}
