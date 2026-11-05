# 여행 환율 계산기 — 배포 가이드

해외여행용 환율 계산기 웹앱(PWA)입니다. 이 폴더를 그대로 웹에 올리면 폰 홈 화면에 설치되는 앱이 되고, 같은 주소를 Play 스토어용 안드로이드 앱으로 포장할 수 있습니다.

## 폴더 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 앱 본체 (환율 · 계산기 · 정산) |
| `manifest.webmanifest` | 앱 이름, 아이콘, 색상 등 설치 정보 |
| `sw.js` | 오프라인에서도 앱이 열리게 하는 서비스 워커 |
| `privacy.html` | 개인정보처리방침 (Play 스토어 등록 필수) |
| `icons/` | 앱 아이콘 (192, 512, 마스커블 512, iOS 180, 파비콘) |
| `.well-known/assetlinks.json` | Play 앱과 웹사이트를 연결하는 인증 파일 (3단계에서 채움) |
| `.nojekyll` | GitHub Pages가 `.well-known` 폴더를 무시하지 않게 하는 빈 파일 |

---

## 1단계 · GitHub Pages에 올리기 (무료)

> **중요:** Play 스토어 앱으로 만들려면 `assetlinks.json`이 **도메인 맨 앞**(`https://bshan0118.github.io/.well-known/assetlinks.json`)에 있어야 합니다. 그래서 저장소 이름을 반드시 **`bshan0118.github.io`** 로 만드세요. `travel-fx` 같은 다른 이름으로 만들면 주소가 `bshan0118.github.io/travel-fx/`가 되어 앱 인증이 실패합니다.

1. [github.com](https://github.com)에 로그인 (계정이 없으면 가입)
2. 오른쪽 위 **+** → **New repository**
   - Repository name: `bshan0118.github.io` (예: 아이디가 `bshan`이면 `bshan.github.io`)
   - **Public** 선택 → **Create repository**
3. 새 저장소 화면에서 **uploading an existing file** 클릭
4. 이 폴더 안의 **모든 파일과 폴더**를 끌어다 놓기
   - `.well-known`, `.nojekyll`처럼 점(.)으로 시작하는 항목은 숨김 파일이라 안 보일 수 있습니다. Mac은 Finder에서 `Cmd + Shift + .`, Windows는 탐색기 **보기 → 숨긴 항목**을 켜세요.
5. **Commit changes** 클릭
6. 저장소의 **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: **main**, 폴더 **/(root)** → **Save**
7. 1~2분 뒤 `https://bshan0118.github.io` 접속해서 앱이 뜨는지 확인

## 2단계 · 폰에서 확인

- **안드로이드(Chrome):** 주소 접속 → 메뉴(⋮) → **홈 화면에 추가** 또는 **앱 설치**
- **아이폰(Safari):** 주소 접속 → 공유 버튼 → **홈 화면에 추가**

확인할 것:
- 상단에 "실시간 환율"이 초록색으로 뜨고, 날씨가 표시되는지
- 비행기 모드로 바꾼 뒤 앱을 다시 열어도 화면이 뜨고 "오프라인 · 저장된 환율"로 계산되는지

## 3단계 · Play 스토어용 앱 파일 만들기 (PWABuilder)

1. [pwabuilder.com](https://www.pwabuilder.com) 접속 → 1단계 주소 입력 → **Start**
2. 점수 확인 후 **Package For Stores** → **Android** → **Generate Package**
3. 옵션 설정
   - **Package ID:** `io.github.bshan0118.travelfx` (한 번 정하면 바꿀 수 없음)
   - **App name:** 여행 환율 계산기 / **Short name:** 여행환율
   - **Signing key:** **Create new** (새 서명 키 생성)
4. **Download** → 받은 zip 안에 아래 파일이 있습니다
   - `*.aab` : Play 스토어에 올릴 파일
   - `*.apk` : 내 폰에서 직접 설치해 볼 테스트용 파일
   - `signing.keystore`, `signing-key-info.txt` : **서명 키. 잃어버리면 앱 업데이트를 못 하니 안전한 곳 2군데 이상에 백업**
   - `assetlinks.json`
5. 받은 `assetlinks.json`으로 저장소의 `.well-known/assetlinks.json`을 **교체**해서 다시 올리기
6. `https://bshan0118.github.io/.well-known/assetlinks.json` 접속 시 내용이 보이면 성공

> 인증이 안 되면 앱 위에 주소창이 보입니다. 이 경우 4단계의 "앱 서명 키" 지문 추가를 확인하세요.

## 4단계 · Play Console 등록

1. [Play Console](https://play.google.com/console) → **앱 만들기**
   - 앱 이름: 여행 환율 계산기 / 기본 언어: 한국어 / 앱 / 무료
2. **앱 설정** 항목 채우기
   - 개인정보처리방침: `https://bshan0118.github.io/privacy.html`
   - 앱 액세스 권한: 모든 기능 제한 없이 이용 가능
   - 광고: 없음
   - 콘텐츠 등급: 설문 작성 (유틸리티)
   - 타겟층: 18세 이상 권장 (아동 대상 아님)
   - **데이터 보안:** 사용자 데이터를 수집하거나 공유하지 않음
3. **스토어 등록정보**
   - 아이콘 512×512: `icons/store-icon-512.png` (모서리 없는 정사각형 버전)
   - 그래픽 이미지 1024×500, 휴대전화 스크린샷 2장 이상
4. **테스트 → 비공개 테스트** 트랙 만들기 → `.aab` 업로드
5. **설정 → 앱 무결성 → 앱 서명**에서 **앱 서명 키 인증서의 SHA-256 지문**을 복사
   → `assetlinks.json`의 `sha256_cert_fingerprints` 배열에 **추가**(기존 값은 유지)하고 다시 올리기
6. 테스터 12명 이상을 이메일 목록으로 등록하고 14일간 테스트 진행
   (2023년 11월 이후 만든 개인 계정에 해당)
7. 14일이 지나면 **프로덕션 액세스 신청** → 심사 통과 후 공개

## 앱을 수정했을 때

1. 파일을 고쳐서 GitHub에 다시 올리기
2. `sw.js` 맨 위 `VERSION = "v1"`의 숫자를 `v2`, `v3`처럼 올리기 (안 올리면 사용자 폰에 예전 화면이 남을 수 있음)
3. Play 스토어 앱은 웹 주소를 그대로 보여주므로 **다시 올릴 필요 없이 자동 반영**됩니다
   (앱 이름·아이콘을 바꿀 때만 PWABuilder로 새 버전을 만들어 업로드)

## 데이터 출처

- 환율: [ExchangeRate-API](https://www.exchangerate-api.com) 무료 버전 (하루 1회 갱신, 출처 표기 필수 — 앱에 표기됨)
- 날씨: [Open-Meteo](https://open-meteo.com) (비상업용 무료. 광고·유료화 시 상업용 플랜 확인 필요)
