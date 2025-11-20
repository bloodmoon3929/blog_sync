# Obsidian-sync-blog
깃허브와 개인서버로 옵시디언의 문서를 사진과 마크다운 문서로 분리하고, 옵시디언의 마크다운 문법을 공식 마크다운 문법으로 수정하여 사용자가 정해진 경로로 업로드 해주는 옵시디언 확장프로그램

## 핵심 기술 스택
- 언어: TypeScript
- 빌드: esbuild
- GitHub API: @octokit/rest
- 파일 시스템: Node.js fs 모듈
- HTTP 요청: Obsidian requestUrl API
- UI: Obsidian Plugin API

## 주요 기능
1. 발행 (Publish)
- 사용자가 노트 선택
- IntegratedPublisher가 GitHub/로컬 서버로 발행
- 마크다운 링크 변환 (![[image.png]] → ![image.png].(/src/site/img/user/image.png))
- 이미지 파일 자동 처리
- Webhook으로 Docker 재시작

2. 상태 관리
- 각 노트의 해시값 저장
- 4가지 상태 추적: Unpublished, Changed, Deleted, Published
- 폴더 구조 기반 UI


3. 배치 처리
- Git Tree API를 사용한 원자적 커밋
- 여러 파일을 하나의 커밋으로 통합
- 중복 이미지 자동 제거


## 개발 방법
### 터미널 1
```
npm run dev
```
위의 명령을 통해, src에 개발 중인 플러그인의 수정 사항이 생기면, 이것을 확인하고 문제가 없다면 main.js 파일로 변환 해줌

### 터미널 2
```
.\deply-to-vault.ps1
```
위의 명령은 다음과 같은 내용을 포함함

```ps1
$SOURCE_DIR = "C:\Users\gnbup\Desktop\wootech\Obsidian-sync-blog"
$VAULT_PLUGIN_DIR = "C:\Users\gnbup\OneDrive\Obsidian\.obsidian\plugins\obsidian-sync-blog"

Write-Host "=== Deploying Plugin to Obsidian ===" -ForegroundColor Cyan
Write-Host ""

$files = @("main.js", "manifest.json", "styles.css")

foreach ($file in $files) {
    $sourcePath = Join-Path $SOURCE_DIR $file
    $destPath = Join-Path $VAULT_PLUGIN_DIR $file
    
    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath -Destination $destPath -Force
        Write-Host "[OK] $file copied" -ForegroundColor Green
    } else {
        Write-Host "[SKIP] $file not found" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Please reload Obsidian to see changes." -ForegroundColor Cyan
```

SOURCE_DIR에는 현재 이 폴더의 경로가 지정되어 있다.<br>
VAULT_PLUGIN_DIR에는 사용중인 옵시디언 vault의 플러그인 폴더의 경로로 지정되어 있다.

그 후 main.js, manifest.json, styles.css을 플러그인 폴더로 복사함으로써 플러그인을 사용할 수 있다.

## 폴더 구조
```text
Obsidian-sync-blog/
├── src/
│   ├── publisher/           # 발행 로직
│   │   ├── GitHubPublisher.ts
│   │   ├── IntegratedPublisher.ts
│   │   ├── LocalServerPublisher.ts
│   │   ├── SSHExecutor.ts
│   │   └── WebhookClient.ts
│   ├── types/              # 타입 정의
│   │   └── settings.ts
│   └── ui/                 # UI 컴포넌트
│       ├── ConnectionTestModal.ts
│       ├── Notification.ts
│       ├── PublicationCenterModal.ts
│       ├── SettingTab.ts
│       └── StatusBar.ts
├── main.ts                 # 플러그인 진입점
├── manifest.json           # 플러그인 메타데이터
├── package.json            # npm 설정
├── esbuild.config.mjs      # 빌드 설정
├── deploy-to-vault.ps1     # 배포 스크립트
└── styles.css              # 스타일시트
```

## 파일별 역할
Core Files (루트)
|파일|역할|
|----|---|
|main.ts|플러그인의 진입점. 플러그인 초기화, 커맨드 등록, UI 초기화 담당|
|manifest.json|플러그인 메타데이터 (ID, 이름, 버전, 설명)|
|package.json|npm 의존성 및 스크립트 정의|
|esbuild.config.mjs|TypeScript → JavaScript 빌드 설정|
|deploy-to-vault.ps1|개발 중인 플러그인을 Obsidian vault로 배포하는 스크립트|
|styles.css|플러그인 UI 스타일링|


Publisher Layer (src/publisher/)
|파일|역할|
|----|---|
|IntegratedPublisher.ts|통합 발행 관리자. GitHub, 로컬 서버, Webhook을 조율하는 중앙 컨트롤러|
|GitHubPublisher.ts|GitHub API를 통한 발행. Octokit 사용, Git Tree API로 원자적 커밋 생성|
|LocalServerPublisher.ts|OMV 서버로 파일 복사. SMB 경로를 통해 직접 파일시스템 접근|
|WebhookClient.ts|로컬 서버에 Webhook 호출하여 Docker 컨테이너 재시작 트리거|
|SSHExecutor.ts|(미사용) SSH를 통한 원격 명령 실행|

Types Layer (src/types/)
|파일|역할|
|----|---|
|settings.ts|플러그인 설정 타입 정의, 기본 설정값, 발행 상태 관리|

UI Layer (src/ui/)
|파일|역할|
|----|----|
|PublicationCenterModal.ts|Publication Center UI. 폴더 구조, 배치 발행, 상태 필터링|
|SettingTab.ts|플러그인 설정 탭 (GitHub, 로컬 서버, Webhook 설정)|
|StatusBar.ts|Obsidian 하단 상태바에 발행 진행 상황 표시|
|Notification.ts|알림 관리 (info, success, warning, error)|
|ConnectionTestModal.ts|연결 테스트 모달|


## 다이어그램
### Publication Center 플로우차트
```mermaid
flowchart TD
    Start([사용자가 Publication Center 열기]) --> ValidateSettings{설정 유효성 검사}
    
    ValidateSettings -->|유효하지 않음| ShowError[설정 오류 화면 표시]
    ShowError --> End1([종료])
    
    ValidateSettings -->|유효함| AnalyzeNotes[노트 상태 분석]
    AnalyzeNotes --> BuildTree[폴더 트리 구조 생성]
    BuildTree --> RenderUI[UI 렌더링]
    
    RenderUI --> DisplaySections[4개 섹션 표시]
    DisplaySections --> Unpublished[📝 Unpublished Notes]
    DisplaySections --> Changed[✏️ Changed Notes]
    DisplaySections --> Deleted[🗑️ Deleted Notes]
    DisplaySections --> Published[✅ Published Notes]
    
    Unpublished --> UserSelection{사용자 선택}
    Changed --> UserSelection
    Deleted --> UserSelection
    Published --> UserSelection
    
    UserSelection -->|Publish 버튼| CheckSelection{선택된 노트 있음?}
    CheckSelection -->|없음| ShowWarning[경고 메시지]
    ShowWarning --> UserSelection
    
    CheckSelection -->|있음| DeterminePublishType{파일 개수}
    
    DeterminePublishType -->|1개| SinglePublish[단일 파일 발행]
    DeterminePublishType -->|여러 개| BatchPublish[배치 발행]
    
    SinglePublish --> PublishToGitHub{GitHub 발행?}
    BatchPublish --> PublishToGitHub
    
    PublishToGitHub -->|Yes| GitHubAPI[GitHub API 호출]
    PublishToGitHub -->|No| PublishToLocal
    GitHubAPI --> PublishToLocal{로컬 서버 발행?}
    
    PublishToLocal -->|Yes| CopyFiles[SMB를 통해 파일 복사]
    PublishToLocal -->|No| TriggerWebhook
    CopyFiles --> TriggerWebhook{Webhook 활성화?}
    
    TriggerWebhook -->|Yes| CallWebhook[Docker 재시작 Webhook 호출]
    TriggerWebhook -->|No| SaveMetadata
    CallWebhook --> SaveMetadata[발행 메타데이터 저장]
    
    SaveMetadata --> ShowSuccess[성공 알림 표시]
    ShowSuccess --> End2([종료])
    
    UserSelection -->|Unpublish 버튼| ConfirmUnpublish{삭제 확인}
    ConfirmUnpublish -->|취소| UserSelection
    ConfirmUnpublish -->|확인| DeleteFromGitHub[GitHub에서 삭제]
    DeleteFromGitHub --> DeleteFromLocal[로컬 서버에서 삭제]
    DeleteFromLocal --> RemoveMetadata[메타데이터 제거]
    RemoveMetadata --> RefreshUI[UI 새로고침]
    RefreshUI --> End3([종료])
```


### 발행 프로세스 순서도
```mermaid
sequenceDiagram
    participant User
    participant Plugin
    participant IntegratedPublisher
    participant GitHub
    participant LocalServer
    participant Webhook

    User->>Plugin: 1. "Publish" 버튼 클릭
    Plugin->>Plugin: 2. 현재 파일 가져오기
    Plugin->>IntegratedPublisher: 3. publishFile(file)
    
    alt GitHub 발행 활성화
        IntegratedPublisher->>GitHub: 4a. publishFile()
        GitHub->>GitHub: 4b. 마크다운 변환
        GitHub->>GitHub: 4c. 이미지 처리
        GitHub->>GitHub: 4d. Git Tree 생성
        GitHub->>GitHub: 4e. 커밋 생성
        GitHub-->>IntegratedPublisher: 4f. 성공/실패
    end
    
    alt 로컬 서버 활성화
        IntegratedPublisher->>LocalServer: 5a. publishFiles()
        LocalServer->>LocalServer: 5b. 경로 검증
        LocalServer->>LocalServer: 5c. 파일 복사 (SMB)
        LocalServer-->>IntegratedPublisher: 5d. 성공/실패
    end
    
    alt Webhook 활성화 & 로컬 발행 성공
        IntegratedPublisher->>Webhook: 6a. triggerDockerRestart()
        Webhook->>Webhook: 6b. HTTP POST 요청
        Webhook-->>IntegratedPublisher: 6c. 성공/실패
    end
    
    IntegratedPublisher-->>Plugin: 7. PublishResult 반환
    Plugin->>Plugin: 8. 발행 정보 저장
    Plugin->>User: 9. 알림 표시
```


### 아키텍처 개요 다이어그램
```mermaid
graph TB
    subgraph "Obsidian Plugin"
        A[main.ts<br/>플러그인 진입점] --> B[IntegratedPublisher<br/>통합 발행 관리자]
        A --> C[PublicationCenterModal<br/>UI]
        A --> D[StatusBar<br/>상태 표시]
        
        B --> E[GitHubPublisher]
        B --> F[LocalServerPublisher]
        B --> G[WebhookClient]
    end
    
    subgraph "GitHub"
        E --> H[Octokit API]
        H --> I[Repository<br/>bloodmoon3929.github.io/blog]
        I --> J[GitHub Pages<br/>정적 사이트]
    end
    
    subgraph "Local Server OMV"
        F --> K[SMB 파일 공유<br/>\\GNBUPI\500gssd1\quartz-blog]
        K --> L[Quartz 소스 파일]
        
        G --> M[Webhook Endpoint<br/>:8099/restart-docker]
        M --> N[Docker Compose]
        N --> O[Quartz Container]
        O --> P[Nginx Load Balancer]
    end
    
    subgraph "User Access"
        J --> Q[Cloudflare Workers<br/>로드 밸런싱]
        P --> Q
        Q --> R[bloodmoon3929.duckdns.org<br/>사용자 접근]
    end
    
    style A fill:#e1f5ff
    style B fill:#fff4e1
    style E fill:#ffe1e1
    style F fill:#e1ffe1
    style G fill:#f4e1ff
```
