import { App, Modal, Setting } from 'obsidian';
import BlogSyncPlugin from '../../main';
import { GitUploader } from '../upload/GitUploader';
import { SftpUploader } from '../upload/SftpUploader';

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

		// Git 테스트 섹션
		this.createGitTestSection(contentEl);

		// SFTP 테스트 섹션
		this.createSftpTestSection(contentEl);

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
				.setDisabled(!this.plugin.settings.gitEnabled || !this.plugin.settings.blogFolderPath)
				.onClick(async () => {
					if (this.testInProgress) return;
					await this.runGitTest(statusEl, resultEl);
				}));

		if (!this.plugin.settings.gitEnabled) {
			statusEl.setText('⚠️ Git이 비활성화되어 있습니다.');
			statusEl.addClass('status-warning');
		} else if (!this.plugin.settings.blogFolderPath) {
			statusEl.setText('⚠️ 블로그 폴더 경로를 설정해주세요.');
			statusEl.addClass('status-warning');
		}
	}

	/**
	 * SFTP 테스트 섹션 생성
	 */
	private createSftpTestSection(containerEl: HTMLElement): void {
		const section = containerEl.createDiv({ cls: 'test-section' });
		section.createEl('h3', { text: '🌐 SFTP 연결 테스트' });

		// 상태 표시
		const statusEl = section.createDiv({ cls: 'test-status' });
		statusEl.setText('준비됨');

		// 결과 표시
		const resultEl = section.createDiv({ cls: 'test-result' });
		resultEl.style.display = 'none';

		// 테스트 버튼
		new Setting(section)
			.setName('SFTP 서버 연결')
			.setDesc(`호스트: ${this.plugin.settings.sftpHost || '(설정되지 않음)'}`)
			.addButton(button => button
				.setButtonText('테스트 시작')
				.setCta()
				.setDisabled(!this.plugin.settings.sftpEnabled || !this.plugin.settings.sftpHost)
				.onClick(async () => {
					if (this.testInProgress) return;
					await this.runSftpTest(statusEl, resultEl);
				}));

		if (!this.plugin.settings.sftpEnabled) {
			statusEl.setText('⚠️ SFTP가 비활성화되어 있습니다.');
			statusEl.addClass('status-warning');
		} else if (!this.plugin.settings.sftpHost) {
			statusEl.setText('⚠️ SFTP 호스트를 설정해주세요.');
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
			const gitUploader = new GitUploader(this.plugin.settings);
			const result = await gitUploader.testConnection();

			if (result.success) {
				statusEl.setText('✅ 연결 성공!');
				statusEl.className = 'test-status status-success';
				
				// 상세 정보 표시
				resultEl.empty();
				resultEl.style.display = 'block';
				resultEl.createEl('div', { text: `✓ Git 저장소 확인됨` });
				if (result.details?.branch) {
					resultEl.createEl('div', { text: `✓ 현재 브랜치: ${result.details.branch}` });
				}
				if (result.details?.remote) {
					resultEl.createEl('div', { text: `✓ 원격 저장소: ${result.details.remote}` });
				}
				if (result.details?.hasChanges !== undefined) {
					resultEl.createEl('div', { 
						text: result.details.hasChanges 
							? '⚠️ 커밋되지 않은 변경사항이 있습니다' 
							: '✓ 모든 변경사항이 커밋되었습니다' 
					});
				}

				this.plugin.notificationManager.success('Git 연결 테스트 성공!');
			} else {
				statusEl.setText('❌ 연결 실패');
				statusEl.className = 'test-status status-error';
				
				resultEl.empty();
				resultEl.style.display = 'block';
				resultEl.createEl('div', { text: result.message });
				
				this.plugin.notificationManager.error(`Git 테스트 실패: ${result.message}`);
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
	private async runSftpTest(statusEl: HTMLElement, resultEl: HTMLElement): Promise<void> {
		this.testInProgress = true;
		statusEl.setText('🔄 테스트 중...');
		statusEl.className = 'test-status status-loading';
		resultEl.style.display = 'none';

		try {
			const sftpUploader = new SftpUploader(this.plugin.settings);
			const result = await sftpUploader.testConnection();

			if (result.success) {
				statusEl.setText('✅ 연결 성공!');
				statusEl.className = 'test-status status-success';
				
				// 상세 정보 표시
				resultEl.empty();
				resultEl.style.display = 'block';
				resultEl.createEl('div', { text: `✓ SFTP 서버 연결 성공` });
				if (result.details?.remotePath) {
					resultEl.createEl('div', { text: `✓ 원격 경로: ${result.details.remotePath}` });
				}
				if (result.details?.writable) {
					resultEl.createEl('div', { text: `✓ 쓰기 권한 확인됨` });
				}

				this.plugin.notificationManager.success('SFTP 연결 테스트 성공!');
			} else {
				statusEl.setText('❌ 연결 실패');
				statusEl.className = 'test-status status-error';
				
				resultEl.empty();
				resultEl.style.display = 'block';
				resultEl.createEl('div', { text: result.message });
				
				this.plugin.notificationManager.error(`SFTP 테스트 실패: ${result.message}`);
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
