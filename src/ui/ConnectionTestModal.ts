import { App, Modal, Setting } from 'obsidian';
import BlogSyncPlugin from '../../main';
import { GitHubPublisher } from '../publisher/GitHubPublisher';
import { LocalServerPublisher } from '../publisher/LocalServerPublisher';

/**
 * 연결 테스트 모달
 */
export class ConnectionTestModal extends Modal {
	plugin: BlogSyncPlugin;
	private testInProgress: boolean = false;

	constructor(app: App, plugin: BlogSyncPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: '🔌 연결 테스트' });

		// GitHub 테스트 섹션
		this.createGitTestSection(contentEl);

		// 로컬 서버 테스트 섹션
		this.createLocalServerTestSection(contentEl);

		// 닫기 버튼
		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('닫기')
				.onClick(() => {
					this.close();
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Git 테스트 섹션 생성
	 */
	private createGitTestSection(containerEl: HTMLElement): void {
		const section = containerEl.createDiv({ cls: 'test-section' });
		section.createEl('h3', { text: '🔀 Git 연결 테스트' });

		// 상태 표시
		const statusEl = section.createDiv({ cls: 'test-status' });
		statusEl.setText('준비됨');

		// 결과 표시
		const resultEl = section.createDiv({ cls: 'test-result' });
		resultEl.style.display = 'none';

		// 테스트 버튼
		new Setting(section)
			.setName('Git 저장소 확인')
			.setDesc(`경로: ${this.plugin.settings.blogFolderPath || '(설정되지 않음)'}`)
			.addButton(button => button
				.setButtonText('테스트 시작')
				.setCta()
				.setDisabled(!(this.plugin.settings.githubToken && this.plugin.settings.githubUsername && this.plugin.settings.githubRepo) || !this.plugin.settings.blogFolderPath)
				.onClick(async () => {
					if (this.testInProgress) return;
					await this.runGitTest(statusEl, resultEl);
				}));

		if (!(this.plugin.settings.githubToken && this.plugin.settings.githubUsername && this.plugin.settings.githubRepo)) {
			statusEl.setText('⚠️ GitHub 설정을 완료해주세요. (토큰/사용자명/레포지토리)');
			statusEl.addClass('status-warning');
		} else if (!this.plugin.settings.blogFolderPath) {
			statusEl.setText('⚠️ 블로그 폴더 경로를 설정해주세요.');
			statusEl.addClass('status-warning');
		}
	}

	/**
	 * SFTP 테스트 섹션 생성
	 */
	private createLocalServerTestSection(containerEl: HTMLElement): void {
		const section = containerEl.createDiv({ cls: 'test-section' });
		section.createEl('h3', { text: '💾 로컬 서버 연결 테스트' });

		// 상태 표시
		const statusEl = section.createDiv({ cls: 'test-status' });
		statusEl.setText('준비됨');

		// 결과 표시
		const resultEl = section.createDiv({ cls: 'test-result' });
		resultEl.style.display = 'none';

		// 테스트 버튼
		new Setting(section)
			.setName('로컬 서버 경로 확인')
			.setDesc(`경로: ${this.plugin.settings.localServerPath || '(설정되지 않음)'}`)
			.addButton(button => button
				.setButtonText('테스트 시작')
				.setCta()
				.setDisabled(!this.plugin.settings.enableLocalServer || !this.plugin.settings.localServerPath)
				.onClick(async () => {
					if (this.testInProgress) return;
					await this.runLocalServerTest(statusEl, resultEl);
				}));

		if (!this.plugin.settings.enableLocalServer) {
			statusEl.setText('⚠️ 로컬 서버가 비활성화되어 있습니다.');
			statusEl.addClass('status-warning');
		} else if (!this.plugin.settings.localServerPath) {
			statusEl.setText('⚠️ 로컬 서버 경로를 설정해주세요.');
			statusEl.addClass('status-warning');
		}
	}

	/**
	 * Git 테스트 실행
	 */
	private async runGitTest(statusEl: HTMLElement, resultEl: HTMLElement): Promise<void> {
		this.testInProgress = true;
		statusEl.setText('🔄 테스트 중...');
		statusEl.className = 'test-status status-loading';
		resultEl.style.display = 'none';

		try {
			// Build GitHubPublisher from settings for a simple connection test
			const settings = this.plugin.settings;
			if (!settings.githubToken || !settings.githubUsername || !settings.githubRepo) {
				throw new Error('GitHub 설정이 완전히 입력되지 않았습니다.');
			}
			const githubPublisher = new GitHubPublisher(this.plugin, {
				githubToken: settings.githubToken,
				githubUsername: settings.githubUsername,
				githubRepo: settings.githubRepo,
				githubBranch: settings.githubBranch,
				publicBasePath: settings.publicBasePath,
				blogContentPath: settings.blogContentPath,
				blogAssetsPath: settings.blogAssetsPath
			});
			const success = await githubPublisher.testConnection();

			if (success) {
				statusEl.setText('✅ 연결 성공!');
				statusEl.className = 'test-status status-success';
				
				// 상세 정보 표시 (간단한 확인 메시지만 제공)
				resultEl.empty();
				resultEl.style.display = 'block';
				resultEl.createEl('div', { text: `✓ Git 저장소 확인됨` });

				this.plugin.notificationManager.success('GitHub 연결 테스트 성공!');
			} else {
				statusEl.setText('❌ 연결 실패');
				statusEl.className = 'test-status status-error';
				
				resultEl.empty();
				resultEl.style.display = 'block';
				resultEl.createEl('div', { text: `연결을 확인할 수 없습니다.` });
				
				this.plugin.notificationManager.error(`GitHub 테스트 실패`);
			}
		} catch (error) {
			statusEl.setText('❌ 테스트 실패');
			statusEl.className = 'test-status status-error';
			
			resultEl.empty();
			resultEl.style.display = 'block';
			resultEl.createEl('div', { text: `오류: ${error.message}` });
			
			this.plugin.notificationManager.error(`Git 테스트 오류: ${error.message}`);
		} finally {
			this.testInProgress = false;
		}
	}

	/**
	 * SFTP 테스트 실행
	 */
	private async runLocalServerTest(statusEl: HTMLElement, resultEl: HTMLElement): Promise<void> {
		this.testInProgress = true;
		statusEl.setText('🔄 테스트 중...');
		statusEl.className = 'test-status status-loading';
		resultEl.style.display = 'none';

		try {
			const settings = this.plugin.settings;
			const localPublisher = new LocalServerPublisher(
				settings.localServerPath,
				settings.localServerNotesPath,
				settings.localServerAssetsPath
			);
			const success = await localPublisher.validatePaths();

			if (success) {
				statusEl.setText('✅ 연결 성공!');
				statusEl.className = 'test-status status-success';
				
				// 상세 정보 표시 (간단한 확인 메시지)
				resultEl.empty();
				resultEl.style.display = 'block';
				resultEl.createEl('div', { text: `✓ 로컬 서버 경로에 접근 가능` });

				this.plugin.notificationManager.success('로컬 서버 연결 테스트 성공!');
			} else {
				statusEl.setText('❌ 연결 실패');
				statusEl.className = 'test-status status-error';
				
				resultEl.empty();
				resultEl.style.display = 'block';
				resultEl.createEl('div', { text: `로컬 서버 경로에 접근할 수 없습니다.` });
				
				this.plugin.notificationManager.error(`로컬 서버 테스트 실패`);
			}
		} catch (error) {
			statusEl.setText('❌ 테스트 실패');
			statusEl.className = 'test-status status-error';
			
			resultEl.empty();
			resultEl.style.display = 'block';
			resultEl.createEl('div', { text: `오류: ${error.message}` });
			
			this.plugin.notificationManager.error(`SFTP 테스트 오류: ${error.message}`);
		} finally {
			this.testInProgress = false;
		}
	}
}
