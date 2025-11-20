// src/publisher/WebhookClient.ts

import { Notice, requestUrl } from 'obsidian';

export class WebhookClient {
    private webhookUrl: string;
    private authToken: string;

    constructor(webhookUrl: string, authToken: string) {
        this.webhookUrl = webhookUrl;
        this.authToken = authToken;
    }

    /**
     * Docker 재시작 Webhook 호출
     */
    async triggerDockerRestart(): Promise<boolean> {
        try {
            new Notice('🔄 Docker 컨테이너 재시작 중...');

            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            // 토큰이 있을 때만 Authorization 헤더 추가
            if (this.authToken && this.authToken.trim()) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            const response = await requestUrl({
                url: this.webhookUrl,
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    action: 'restart',
                    timestamp: Date.now()
                }),
                throw: false
            });

            console.log('Webhook response:', response);

            // 200, 204 모두 성공으로 처리
            if (response.status === 200 || response.status === 204) {
                new Notice('✅ Docker 컨테이너가 재시작되었습니다!');
                return true;
            } else {
                new Notice(`❌ Webhook 호출 실패: ${response.status}`);
                console.error('Webhook error response:', response);
                return false;
            }

        } catch (error) {
            console.error('Webhook error:', error);
            new Notice(`❌ Webhook 호출 실패: ${error.message}`);
            return false;
        }
    }

    /**
     * Webhook 연결 테스트
     */
    async testConnection(): Promise<boolean> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            // 토큰이 있을 때만 Authorization 헤더 추가
            if (this.authToken && this.authToken.trim()) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            // 테스트 모드로 호출 (action: 'test')
            const response = await requestUrl({
                url: this.webhookUrl,
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    action: 'test',
                    timestamp: Date.now()
                }),
                throw: false
            });

            console.log('Webhook test response:', response);

            // 200, 204 성공으로 처리
            if (response.status === 200 || response.status === 204) {
                return true;
            }

            // 404 등의 에러는 서버가 응답은 하는 것
            if (response.status >= 400 && response.status < 500) {
                console.warn('Webhook endpoint returned client error:', response.status);
                // 서버는 응답하지만 엔드포인트가 구현되지 않은 것으로 간주
                return true;
            }

            return false;

        } catch (error) {
            console.error('Webhook test error:', error);
            return false;
        }
    }
}
