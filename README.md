# wedding-card
mobile wedding invitation card

access page to [wedding-card](https://wsoarc.github.io/wedding-card/)

## 네이버 지도 연동 설정

오시는 길 섹션은 네이버 지도 JS API(Web Dynamic Map)로 표시됩니다. 배포 전 아래 설정이 필요합니다.

### 1. Client ID 발급

1. [네이버 클라우드 플랫폼](https://www.ncloud.com)에 가입/로그인 후 콘솔로 이동
2. `Services` → `Application Services` → `Maps`로 이동 (AI·NAVER API 최초 이용 시 약관 동의 진행)
3. `Application 등록` 클릭 → 이름 입력(예: `wedding-card`) → 이용할 Service에서 **`Web Dynamic Map`** 체크
4. `Web 서비스 URL`에 실제 배포 주소를 등록
   `https://wsoarc.github.io/wedding-card/`
   (로컬 테스트 시 `http://localhost:포트`도 추가 등록 권장. `file://`로 직접 열면 인증 실패)
5. 등록 완료 후 Application 목록에서 방금 만든 앱 클릭 → `인증정보` 탭에서 **Client ID** 확인

> 무료 이용량: Web Dynamic Map은 대표 계정 기준 월 최소 3,000건 ~ 최대 1억 건까지 자동으로 무료 제공됩니다(지도가 1회 로드될 때 1건 소모, 이후 줌/마커 조작은 카운트되지 않음). 청첩장 방문자 규모에서는 사실상 무료입니다.

### 2. Client ID 적용

`index.html`의 아래 스크립트 태그에서 `YOUR_NCP_CLIENT_ID`를 발급받은 Client ID로 교체합니다.

```html
<script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=YOUR_NCP_CLIENT_ID"></script>
```

### 3. 위치 정보 입력

`data/wedding.json`의 `location` 항목에 실제 예식장 좌표와 링크를 입력합니다.

```json
"location": {
  "lat": 37.5665,
  "lng": 126.9780,
  "zoom": 17,
  "mapAlt": "예식장 주변 지도"
}
```

- `lat`/`lng`: 네이버 지도에서 예식장 검색 → 지도 우클릭 → "여기 좌표 복사"로 확인
- `wedding.venue` 값이 길찾기 버튼의 목적지 이름(dname)으로 그대로 사용되므로, 정확한 예식장 이름을 넣어주세요.

### 4. 길찾기 버튼 동작 방식

오시는 길 지도 바로 아래에 네이버지도 · 카카오맵 · 티맵 3개 버튼이 동일한 크기로 표시됩니다. `lat`/`lng`/`venue` 값을 기반으로 각 서비스의 앱 딥링크(`nmap://`, `kakaomap://`, `tmap://`)를 실행하며, 앱이 설치되어 있지 않으면 약 1.5초 후 자동으로 스토어(또는 네이버·카카오는 웹 지도)로 전환됩니다. PC 브라우저에서는 앱 스킴 대신 바로 웹 페이지가 열립니다.

### 참고

- Client ID가 비어있거나 스크립트 로드에 실패하면 `wedding.json`의 `mapImage`(정적 이미지)로 자동 폴백됩니다.
- Client ID를 공개 저장소에 커밋해도 되는지 걱정된다면, 콘솔의 `Web 서비스 URL` 등록으로 허용 도메인이 제한되어 있어 타 도메인에서의 무단 사용은 차단됩니다.

## Firebase 방명록 설정

방명록은 Cloud Firestore에 `이름`, `메시지`, `작성 시각`을 저장하고 최근 20개를 실시간으로 표시합니다. 방문자에게는 수정·삭제 기능을 제공하지 않으며, 부적절한 글은 Firebase Console에서 삭제할 수 있습니다.

### 1. Firebase 프로젝트와 웹 앱 만들기

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트를 만듭니다. Analytics는 방명록에 필수가 아닙니다.
2. 프로젝트 개요에서 웹 앱(`</>`)을 등록합니다.
3. `프로젝트 설정` → `일반` → `내 앱`의 **SDK 설정 및 구성**에서 Firebase 구성 값을 복사합니다.
4. [`firebase-config.js`](firebase-config.js)의 `YOUR_...` 값을 복사한 구성 값으로 교체합니다.

`firebase-config.js`에 들어가는 값은 웹 앱을 식별하는 공개 구성값이라 정적 GitHub Pages 저장소에 포함될 수 있습니다. 데이터 접근 권한은 아래 Firestore 보안 규칙으로 보호합니다. 서비스 계정 키나 관리자 비밀번호는 이 파일에 넣으면 안 됩니다.

### 2. Cloud Firestore 만들기

Firebase Console의 `빌드` → `Firestore Database` → `데이터베이스 만들기`에서 데이터베이스 위치를 선택해 생성합니다. 처음에는 테스트 모드로 만들어도 되지만, 배포 전에는 반드시 다음 규칙으로 바꿉니다.

규칙은 저장소의 [`firestore.rules`](firestore.rules)를 배포합니다. 방문자는 공개 방명록을 읽고, 익명 로그인한 방문자는 새 글만 작성할 수 있습니다. 기존 글의 수정·삭제는 허용하지 않습니다.

### 3. 익명 로그인 켜기

`빌드` → `Authentication` → `Sign-in method`에서 **익명(Anonymous)** 제공업체를 활성화합니다. 방문자는 별도 가입 화면 없이 글을 남길 때 자동으로 익명 로그인됩니다.

### 4. 배포 및 확인

GitHub Pages에서 사용하는 실제 주소와 로컬 테스트 주소를 `Authentication` → `Settings` → `Authorized domains`에 추가합니다. 배포 후 방명록 버튼을 눌러 이름과 메시지를 남기고, Firestore의 `guestbook` 컬렉션에 문서가 생성되는지 확인합니다.

문제가 생기면 브라우저 개발자 도구의 오류와 다음 항목을 확인하세요.

- `firebase-config.js`의 `projectId` 등 값이 같은 Firebase 프로젝트의 값인지
- Firestore 규칙을 **게시**했는지
- 익명 로그인을 활성화했는지
- GitHub Pages가 HTTPS 주소로 열렸는지

스팸이 반복될 경우 Firebase App Check 또는 CAPTCHA를 추가하는 것을 권장합니다. 현재 규칙은 인증되지 않은 대량 쓰기와 기존 글의 변조는 막지만, 익명 계정 생성 자체를 통한 악성 반복 작성까지 완전히 차단하지는 않습니다.
