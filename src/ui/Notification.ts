import { Notice } from 'obsidian';
import { NotificationType } from '../types/settings';

/**
 * 알림 관리 클래스
 */
export class NotificationManager {
	private enabled: boolean;

	constructor(enabled: boolean = true) {
		this.enabled = enabled;
	}

	/**
	 * 알림 활성화/비활성화 설정
	 */
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	/**
	 * 정보 알림
	 */
	info(message: string, duration: number = 4000): void {
		if (!this.enabled) return;
		new Notice(`ℹ️ ${message}`, duration);
	}

	/**
	 * 성공 알림
	 */
	success(message: string, duration: number = 4000): void {
		if (!this.enabled) return;
		new Notice(`✅ ${message}`, duration);
	}

	/**
	 * 경고 알림
	 */
	warning(message: string, duration: number = 5000): void {
		if (!this.enabled) return;
		new Notice(`⚠️ ${message}`, duration);
	}

	/**
	 * 에러 알림
	 */
	error(message: string, duration: number = 6000): void {
		if (!this.enabled) return;
		new Notice(`❌ ${message}`, duration);
	}

	/**
	 * 타입에 따른 알림
	 */
	show(type: NotificationType, message: string, duration?: number): void {
		switch (type) {
			case 'info':
				this.info(message, duration);
				break;
			case 'success':
				this.success(message, duration);
				break;
			case 'warning':
				this.warning(message, duration);
				break;
			case 'error':
				this.error(message, duration);
				break;
		}
	}

	/**
	 * 진행 상황 알림 (자동으로 사라지지 않음)
	 */
	progress(message: string): Notice {
		if (!this.enabled) return new Notice('', 0);
		return new Notice(`🔄 ${message}`, 0);
	}
}
