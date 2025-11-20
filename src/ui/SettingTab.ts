// src/ui/SettingTab.ts

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import BlogSyncPlugin from '../../main';
import { GitHubPublisher } from '../publisher/GitHubPublisher';

export class BlogSyncSettingTab extends PluginSettingTab {
    plugin: BlogSyncPlugin;

    constructor(app: App, plugin: BlogSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Blog Sync Settings' });

        // ============================================
        // 기본 설정
        // ============================================
        containerEl.createEl('h3', { text: 'Basic Settings' });

        new Setting(containerEl)
            .setName('Blog folder path')
            .setDesc('로컬 블로그 폴더 경로')
            .addText(text => text
                .setPlaceholder('C:/Users/username/blog')
                .setValue(this.plugin.settings.blogFolderPath)
                .onChange(async (value) => {
                    this.plugin.settings.blogFolderPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show notifications')
            .setDesc('작업 완료 시 알림 표시')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showNotifications)
                .onChange(async (value) => {
                    this.plugin.settings.showNotifications = value;
                    await this.plugin.saveSettings();
                }));

        // ============================================
        // 발행 대상 선택
        // ============================================
        containerEl.createEl('h3', { text: 'Publish Target' });

        new Setting(containerEl)
            .setName('Custom Domain')
            .setDesc('블로그 커스텀 도메인 (예: blog.example.com)')
            .addText(text => text
                .setPlaceholder('blog.example.com')
                .setValue(this.plugin.settings.customDomain)
                .onChange(async (value) => {
                    this.plugin.settings.customDomain = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Publish to')
            .setDesc('노트를 발행할 대상을 선택하세요')
            .addDropdown(dropdown => dropdown
                .addOption('github', 'GitHub Repository')
                .addOption('server', 'Personal Server')
                .addOption('both', 'Both (GitHub + Server)') 
                .setValue(this.plugin.settings.publishTarget)
                .onChange(async (value: 'github' | 'server'|'both') => {
                    this.plugin.settings.publishTarget = value;
                    await this.plugin.saveSettings();
                    this.display(); // UI 새로고침
                }));

        // ============================================
        // GitHub 설정
        // ============================================
        if (this.plugin.settings.publishTarget === 'github' || 
            this.plugin.settings.publishTarget === 'both') {
            this.displayGitHubSettings(containerEl);
        }

        // ============================================
        // 서버 설정
        // ============================================
        if (this.plugin.settings.publishTarget === 'server' || 
            this.plugin.settings.publishTarget === 'both') {
            this.displayServerSettings(containerEl);
        }


        containerEl.createEl('h3', { text: '📘 Documentation' });

        const docSection = containerEl.createDiv();
        docSection.style.display = 'grid';
        docSection.style.gridTemplateColumns = '1fr 1fr';
        docSection.style.gap = '10px';

        // Helper function to add a link button
        function addDocButton(name: string, url: string) {
            const btn = docSection.createEl('button', { text: name });
            btn.style.padding = '8px';
            btn.style.borderRadius = '6px';
            btn.style.cursor = 'pointer';
            btn.style.border = '1px solid var(--background-modifier-border)';
            btn.style.backgroundColor = 'var(--background-secondary)';
            btn.onclick = () => window.open(url, '_blank');
        }

        // Buttons
        addDocButton('📄 Plugin Home', 'https://bloodmoon3929.github.io/Obsidian-sync-blog/');
        addDocButton('⚙️ GitHub Action', 'https://bloodmoon3929.github.io/Obsidian-sync-blog/Github_Action');
        addDocButton('🔑 GitHub Token 설정', 'https://bloodmoon3929.github.io/Obsidian-sync-blog/GitToken');
        addDocButton('🖥️ Local Server 설정', 'https://bloodmoon3929.github.io/Obsidian-sync-blog/localServer');
        addDocButton('📚 Quartz 설정', 'https://bloodmoon3929.github.io/Obsidian-sync-blog/Quartz');
    }

    /**
     * GitHub 설정 UI
     */
    private displayGitHubSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '⚙️ GitHub Settings' });

        // GitHub Token
        new Setting(containerEl)
            .setName('GitHub Token')
            .setDesc('GitHub Personal Access Token (repo 권한 필요)')
            .addText(text => {
                text
                    .setPlaceholder('ghp_xxxxxxxxxxxx')
                    .setValue(this.plugin.settings.githubToken)
                    .onChange(async (value) => {
                        this.plugin.settings.githubToken = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.type = 'password';
                return text;
            })
            .addButton(button => button
                .setButtonText('How to get token?')
                .onClick(() => {
                    window.open('https://github.com/settings/tokens/new');
                }));

        // GitHub Username
        new Setting(containerEl)
            .setName('GitHub Username')
            .setDesc('GitHub 사용자 이름')
            .addText(text => text
                .setPlaceholder('your-username')
                .setValue(this.plugin.settings.githubUsername)
                .onChange(async (value) => {
                    this.plugin.settings.githubUsername = value;
                    await this.plugin.saveSettings();
                }));

        // Repository Name
        new Setting(containerEl)
            .setName('Repository Name')
            .setDesc('블로그 저장소 이름')
            .addText(text => text
                .setPlaceholder('my-blog')
                .setValue(this.plugin.settings.githubRepo)
                .onChange(async (value) => {
                    this.plugin.settings.githubRepo = value;
                    await this.plugin.saveSettings();
                }));

        // Branch
        new Setting(containerEl)
            .setName('Branch')
            .setDesc('푸시할 브랜치 이름')
            .addText(text => text
                .setPlaceholder('main')
                .setValue(this.plugin.settings.githubBranch)
                .onChange(async (value) => {
                    this.plugin.settings.githubBranch = value;
                    await this.plugin.saveSettings();
                }));

        // Public Base Path
        new Setting(containerEl)
            .setName('Public Base Path')
            .setDesc('웹 퍼블리싱 기본 경로 (예: src/site) - Quartz 빌드 시 루트가 되는 경로')
            .addText(text => text
                .setPlaceholder('src/site')
                .setValue(this.plugin.settings.publicBasePath)
                .onChange(async (value) => {
                    this.plugin.settings.publicBasePath = value;
                    await this.plugin.saveSettings();
                }));

        // Blog Content Path
        new Setting(containerEl)
            .setName('Blog Content Path')
            .setDesc('노트 저장 경로 (예: notes) - Public Base Path 하위 경로')
            .addText(text => text
                .setPlaceholder('notes')
                .setValue(this.plugin.settings.blogContentPath)
                .onChange(async (value) => {
                    this.plugin.settings.blogContentPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Blog Assets Path')
            .setDesc('이미지 저장 경로 (예: img/user) - Public Base Path 하위 경로')
            .addText(text => text
                .setPlaceholder('img/user')
                .setValue(this.plugin.settings.blogAssetsPath)
                .onChange(async (value) => {
                    this.plugin.settings.blogAssetsPath = value;
                    await this.plugin.saveSettings();
                }));

        // 연결 테스트 버튼
        new Setting(containerEl)
            .setName('Test Connection')
            .setDesc('GitHub 연결 테스트')
            .addButton(button => button
                .setButtonText('Test Connection')
                .setCta()
                .onClick(async () => {
                    button.setDisabled(true);
                    button.setButtonText('Testing...');
                    
                    try {
                        const publisher = new GitHubPublisher(this.plugin, {
                            githubToken: this.plugin.settings.githubToken,
                            githubUsername: this.plugin.settings.githubUsername,
                            githubRepo: this.plugin.settings.githubRepo,
                            githubBranch: this.plugin.settings.githubBranch,
                            publicBasePath: this.plugin.settings.publicBasePath,
                            blogContentPath: this.plugin.settings.blogContentPath,
                            blogAssetsPath: this.plugin.settings.blogAssetsPath
                        });

                        const success = await publisher.testConnection();
                        
                        if (success) {
                            button.setButtonText('✅ Success!');
                        } else {
                            button.setButtonText('❌ Failed');
                        }
                    } catch (error) {
                        new Notice('Connection test failed: ' + error.message);
                        button.setButtonText('❌ Failed');
                    }
                    
                    setTimeout(() => {
                        button.setDisabled(false);
                        button.setButtonText('Test Connection');
                    }, 3000);
                }));

        // 설정 가이드
        const guideEl = containerEl.createDiv({ cls: 'setting-item-description' });
        guideEl.style.padding = '16px';
        guideEl.style.marginTop = '16px';
        guideEl.style.border = '1px solid var(--background-modifier-border)';
        guideEl.style.borderRadius = '8px';
        guideEl.style.backgroundColor = 'var(--background-secondary)';
        
        guideEl.createEl('h4', { text: '📖 Setup Guide' });
        guideEl.createEl('ol').innerHTML = `
            <li>GitHub에서 Personal Access Token을 생성하세요 (repo 권한 필요)</li>
            <li>위의 설정을 모두 입력하세요</li>
            <li>"Test Connection" 버튼으로 연결을 확인하세요</li>
            <li>Publication Center에서 노트를 선택하고 발행하세요</li>
        `;
    }

    /**
     * 서버 설정 UI
     */
    private displayServerSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '🖥️ Server Settings' });

        // ============================================
        // 로컬 서버 (OMV) 설정
        // ============================================
        containerEl.createEl('h4', { text: '📁 Local Server (OMV/SMB)' });

        new Setting(containerEl)
            .setName('Enable Local Server')
            .setDesc('로컬 서버로 파일 복사 활성화 (SMB 공유 폴더)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableLocalServer)
                .onChange(async (value) => {
                    this.plugin.settings.enableLocalServer = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.enableLocalServer) {
            // Server Host
            new Setting(containerEl)
                .setName('Server Host/IP')
                .setDesc('로컬 서버 주소 (예: 203.234.57.91, gnbupi.local)')
                .addText(text => text
                    .setPlaceholder('203.234.57.91')
                    .setValue(this.plugin.settings.localServerHost)
                    .onChange(async (value) => {
                        this.plugin.settings.localServerHost = value;
                        await this.plugin.saveSettings();
                    }));

            // Server Port
            new Setting(containerEl)
                .setName('Server Port')
                .setDesc('웹 서버 포트 (예: 2052)')
                .addText(text => text
                    .setPlaceholder('2052')
                    .setValue(String(this.plugin.settings.localServerPort))
                    .onChange(async (value) => {
                        const port = parseInt(value);
                        if (!isNaN(port)) {
                            this.plugin.settings.localServerPort = port;
                            await this.plugin.saveSettings();
                        }
                    }));

            new Setting(containerEl)
                .setName('Local Server Path')
                .setDesc('SMB 공유 폴더 경로 (예: \\\\GNBUPI\\500gssd(1)\\quartz-blog)')
                .addText(text => text
                    .setPlaceholder('\\\\GNBUPI\\500gssd(1)\\quartz-blog')
                    .setValue(this.plugin.settings.localServerPath)
                    .onChange(async (value) => {
                        this.plugin.settings.localServerPath = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Notes Path')
                .setDesc('노트 파일 저장 경로 (로컬 서버 경로 기준, 예: src\\site\\notes)')
                .addText(text => text
                    .setPlaceholder('src\\site\\notes')
                    .setValue(this.plugin.settings.localServerNotesPath)
                    .onChange(async (value) => {
                        this.plugin.settings.localServerNotesPath = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Assets Path')
                .setDesc('이미지 파일 저장 경로 (로컬 서버 경로 기준, 예: src\\site\\img\\user)')
                .addText(text => text
                    .setPlaceholder('src\\site\\img\\user')
                    .setValue(this.plugin.settings.localServerAssetsPath)
                    .onChange(async (value) => {
                        this.plugin.settings.localServerAssetsPath = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // ============================================
        // Webhook 설정
        // ============================================
        containerEl.createEl('h4', { text: '🔄 Webhook (Docker Restart)' });

        new Setting(containerEl)
            .setName('Enable Webhook')
            .setDesc('파일 발행 후 Docker 재시작 Webhook 호출')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableWebhook)
                .onChange(async (value) => {
                    this.plugin.settings.enableWebhook = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.enableWebhook) {
            new Setting(containerEl)
                .setName('Webhook URL')
                .setDesc('Docker 재시작 Webhook URL (예: http://gnbupi.local:8099/restart-docker)')
                .addText(text => text
                    .setPlaceholder('http://gnbupi.local:8099/restart-docker')
                    .setValue(this.plugin.settings.webhookUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.webhookUrl = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Webhook Token')
                .setDesc('인증 토큰 (선택사항)')
                .addText(text => {
                    text
                        .setPlaceholder('your-secret-token')
                        .setValue(this.plugin.settings.webhookToken)
                        .onChange(async (value) => {
                            this.plugin.settings.webhookToken = value;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.type = 'password';
                    return text;
                });
        }

        // ============================================
        // Test Connection
        // ============================================
        new Setting(containerEl)
            .setName('Test All Connections')
            .setDesc('로컬 서버와 Webhook 연결 테스트')
            .addButton(button => button
                .setButtonText('Test Connections')
                .setCta()
                .onClick(async () => {
                    button.setDisabled(true);
                    button.setButtonText('Testing...');
                    
                    try {
                        const result = await this.plugin.publisher.testConnections();
                        
                        let message = '연결 테스트 결과:\n';
                        message += `로컬 서버: ${result.localServer ? '✅' : '❌'}\n`;
                        message += `Webhook: ${result.webhook ? '✅' : '❌'}`;
                        
                        new Notice(message);
                        button.setButtonText(result.localServer && result.webhook ? '✅ Success' : '⚠️ Partial');
                    } catch (error) {
                        new Notice('Connection test failed: ' + error.message);
                        button.setButtonText('❌ Failed');
                    }
                    
                    setTimeout(() => {
                        button.setDisabled(false);
                        button.setButtonText('Test Connections');
                    }, 3000);
                }));

        // ============================================
        // 설정 가이드
        // ============================================
        const guideEl = containerEl.createDiv({ cls: 'setting-item-description' });
        guideEl.style.padding = '16px';
        guideEl.style.marginTop = '16px';
        guideEl.style.border = '1px solid var(--background-modifier-border)';
        guideEl.style.borderRadius = '8px';
        guideEl.style.backgroundColor = 'var(--background-secondary)';
        
        guideEl.createEl('h4', { text: '📖 Setup Guide' });
        guideEl.createEl('ol').innerHTML = `
            <li><strong>로컬 서버:</strong> SMB 공유 폴더를 설정하세요 (예: \\\\GNBUPI\\500gssd(1)\\quartz-blog)</li>
            <li><strong>서버 포트:</strong> 웹 접근 포트를 설정하세요 (예: 2052)</li>
            <li><strong>Webhook:</strong> Docker 재시작 엔드포인트를 설정하세요 (예: http://gnbupi.local:8099/restart-docker)</li>
            <li>"Test Connections" 버튼으로 연결을 확인하세요</li>
        `;
    }
}
