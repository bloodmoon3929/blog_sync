import { Plugin, TFile } from 'obsidian';
import { BlogSyncSettings, DEFAULT_SETTINGS } from './src/types/settings';
import { BlogSyncStatusBar } from './src/ui/StatusBar';
import { NotificationManager } from './src/ui/Notification';
import { BlogSyncSettingTab } from './src/ui/SettingTab';
import { PublicationCenterModal } from 'src/ui/PublicationCenterModal';
import { IntegratedPublisher } from './src/publisher/IntegratedPublisher';

export default class BlogSyncPlugin extends Plugin {
	settings: BlogSyncSettings;
	statusBar: BlogSyncStatusBar;
	notificationManager: NotificationManager;
	publisher: IntegratedPublisher;

	async onload() {
		console.log('Loading Blog Sync Plugin');

		// 설정 로드
		await this.loadSettings();

		// UI 초기화
		this.notificationManager = new NotificationManager(this.settings.showNotifications);
		this.statusBar = new BlogSyncStatusBar(this);
		
		// Publisher 초기화
		this.publisher = new IntegratedPublisher(this);

		// 리본 아이콘 추가
		this.addRibbonIcon('cloud-upload', 'Publication Center', (evt: MouseEvent) => {
			new PublicationCenterModal(this.app, this).open();
		});

		// 커맨드 추가
		this.addCommand({
			id: 'open-publication-center',
			name: 'Open Publication Center',
			callback: () => {
				new PublicationCenterModal(this.app, this).open();
			}
		});

		// 현재 파일 발행 커맨드
		this.addCommand({
			id: 'publish-current-file',
			name: '현재 파일을 블로그에 발행',
			callback: async () => {
				await this.publishCurrentFile();
			}
		});

		// 연결 테스트 커맨드
		this.addCommand({
			id: 'test-connections',
			name: '연결 테스트 (GitHub/로컬 서버/Webhook)',
			callback: async () => {
				await this.testConnections();
			}
		});

		// 설정 탭 추가
		this.addSettingTab(new BlogSyncSettingTab(this.app, this));

		this.notificationManager.info('블로그 동기화 플러그인이 로드되었습니다!');
	}

	onunload() {
		console.log('Unloading Blog Sync Plugin');
		this.statusBar.destroy();
	}

	/**
	 * 현재 파일 발행
	 */
	async publishCurrentFile(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		
		if (!file) {
			this.notificationManager.warning('발행할 파일이 없습니다.');
			return;
		}

		if (file.extension !== 'md') {
			this.notificationManager.warning('마크다운 파일만 발행할 수 있습니다.');
			return;
		}

		try {
			this.statusBar.setStatus('syncing', file.basename);
			
			// IntegratedPublisher로 발행
			const result = await this.publisher.publishFile(file);
			
			if (result.success) {
				this.statusBar.setStatus('success', file.basename);
			} else {
				this.statusBar.setStatus('error', file.basename);
			}
			
			// 3초 후 idle 상태로
			setTimeout(() => {
				this.statusBar.setStatus('idle');
			}, 3000);
			
		} catch (error) {
			console.error('Publish error:', error);
			this.statusBar.setStatus('error', file.basename);
			this.notificationManager.error(`발행 실패: ${error.message}`);
			
			setTimeout(() => {
				this.statusBar.setStatus('idle');
			}, 5000);
		}
	}

	/**
	 * 연결 테스트
	 */
	async testConnections(): Promise<void> {
		this.notificationManager.info('연결 테스트 중...');
		
		try {
			const result = await this.publisher.testConnections();
			
			let message = '연결 테스트 결과:\n';
			message += `GitHub: ${result.github ? '✅' : '❌'}\n`;
			message += `로컬 서버: ${result.localServer ? '✅' : '❌'}\n`;
			message += `Webhook: ${result.webhook ? '✅' : '❌'}`;
			
			console.log(message);
			
		} catch (error) {
			console.error('Connection test error:', error);
			this.notificationManager.error(`연결 테스트 실패: ${error.message}`);
		}
	}

	/**
	 * 설정 로드
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * 설정 저장
	 */
	async saveSettings() {
		await this.saveData(this.settings);
		
		// 알림 설정 업데이트
		if (this.notificationManager) {
			this.notificationManager.setEnabled(this.settings.showNotifications);
		}
		
		// Publisher 재초기화
		if (this.publisher) {
			this.publisher = new IntegratedPublisher(this);
		}
	}
}
