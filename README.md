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

### 4. 교통수단 안내 여러 줄로 쓰기

`transit` 각 항목의 `text`는 한 줄 문자열 대신 배열로 써서 여러 줄로 표시할 수 있습니다.

```json
{
  "label": "지하철",
  "text": ["3호선 양재역", "신분당선 양재역 9번 출구 바로 연결"]
}
```

문자열 안에 `\n`을 넣어도 동일하게 줄바꿈됩니다.

```json
{ "label": "지하철", "text": "3호선 양재역\n신분당선 양재역 9번 출구 바로 연결" }
```

### 5. 길찾기 버튼 동작 방식

오시는 길 지도 바로 아래에 네이버지도 · 카카오맵 · 티맵 3개 버튼이 동일한 크기로 표시됩니다. `lat`/`lng`/`venue` 값을 기반으로 각 서비스의 앱 딥링크(`nmap://`, `kakaomap://`, `tmap://`)를 실행하며, 앱이 설치되어 있지 않으면 약 1.5초 후 자동으로 스토어(또는 네이버·카카오는 웹 지도)로 전환됩니다. PC 브라우저에서는 앱 스킴 대신 바로 웹 페이지가 열립니다.

### 참고

- Client ID가 비어있거나 스크립트 로드에 실패하면 `wedding.json`의 `mapImage`(정적 이미지)로 자동 폴백됩니다.
- Client ID를 공개 저장소에 커밋해도 되는지 걱정된다면, 콘솔의 `Web 서비스 URL` 등록으로 허용 도메인이 제한되어 있어 타 도메인에서의 무단 사용은 차단됩니다.

## 문구별 폰트 / 크기 설정

`wedding.json`의 `typography` 항목에서 각 문구 영역별로 글꼴(`fontFamily`)과 크기(`fontSize`) 등을 지정할 수 있습니다. 페이지가 로드될 때 이 값들이 읽혀 해당 영역에 자동으로 적용됩니다 (`script.js`의 `applyTypography` 함수).

```json
"typography": {
  "hero": { "fontFamily": "script", "fontSize": "26px" },
  "sectionTitle": { "fontFamily": "serif", "fontSize": "27px" },
  "body": { "fontFamily": "myeongjo", "fontSize": "16px" }
}
```

- `fontFamily`: 아래 프리셋 중 하나를 쓰거나, 구글 폰트 등 원하는 글꼴 이름을 그대로 문자열로 넣을 수 있습니다. 새 폰트를 쓰려면 `index.html`의 `<link href="https://fonts.googleapis.com/css2?...">` 줄에 해당 글꼴도 함께 불러와야 합니다.
- `fontSize`: `"18px"`처럼 단위 포함 문자열.
- 그 외 `fontWeight`, `lineHeight`, `letterSpacing`, `color`도 선택적으로 지정 가능합니다.
- 값을 비워두면(`{}`) 해당 카테고리는 `style.css`의 기본 디자인이 그대로 유지됩니다. 한 카테고리는 여러 요소를 함께 묶은 것이라, 값을 지정하면 그 안의 모든 요소에 동일하게 적용됩니다.

### 폰트 프리셋 (모바일 청첩장에서 자주 쓰이는 글씨체)

| 프리셋 키 | 실제 폰트 | 분위기 |
| --- | --- | --- |
| `serif` | Gowun Batang | 차분하고 단정한 한글 명조. 기본 세리프 |
| `myeongjo` | Nanum Myeongjo | 전통적이고 격식 있는 명조체. 가독성 좋아 본문에 적합 |
| `thin` | Song Myung | 가늘고 우아한 세리프. 숫자·날짜처럼 짧은 문구에 포인트로 어울림 |
| `dodum` | Gowun Dodum | 부드럽고 둥근 고딕. 편안하고 따뜻한 느낌 |
| `sans` | Pretendard | 깔끔한 기본 고딕. 라벨이나 정보성 텍스트에 적합 |
| `script` | Parisienne | 우아한 영문 필기체. 한글엔 자동으로 다른 폰트로 대체되므로 영문·숫자 포인트용 |
| `handwriting` | Gamja Flower | 귀엽고 따뜻한 손글씨. 방명록처럼 친근한 느낌을 줄 때 |
| `maruburi` | 마루 부리(MaruBuri) | 네이버가 배포한 온기 있는 명조 계열. 본문에 현대적이면서 단정한 느낌을 줄 때 |

### 카테고리별 기본 적용 폰트

각 카테고리에는 분위기가 어울리는 폰트를 기본으로 지정해뒀습니다. 마음에 들지 않으면 `wedding.json`에서 자유롭게 바꿀 수 있습니다.

| 키 | 적용 위치 | 기본 폰트 | 이유 |
| --- | --- | --- | --- |
| `hero` | 첫 화면 제목·이름·날짜·예식장명 | `script` | 첫인상을 우아하게 장식하는 필기체 포인트 |
| `sectionLabel` | 각 섹션 상단 라벨(INVITATION, GALLERY 등) | `sans` | 짧은 영문 라벨은 깔끔한 고딕이 잘 읽힘 |
| `sectionTitle` | 각 섹션 제목(h2), 마지막 인사 이름 | `serif` | 단정한 명조로 제목의 무게감 유지 |
| `body` | 초대의 글, 계좌 정보, D-day 문구 | `myeongjo` | 격식 있고 가독성 좋은 명조로 본문 안정감 |
| `parents` | 혼주 이름 두 줄(예: "○○○ · ○○○의 아들 ○○○") | `myeongjo` | 본문과 분리해 크기·자간을 별도로 조정 가능 |
| `countdown` | 카운트다운 숫자 | `thin` | 가는 세리프로 숫자가 세련되게 보임 |
| `calendar` | WEDDING DAY 섹션의 달력 요일·날짜 숫자 | 기본값(미지정) | `style.css`의 기본 디자인 유지, 원하면 자유롭게 지정 |
| `story` | 스토리(타임라인) 연도·제목·설명 | `dodum` | 둥글고 부드러운 고딕으로 편안한 서술 느낌 |
| `transit` | 오시는 길 교통수단 안내(지하철·버스·주차 등) | `myeongjo` | 본문과 분리해 크기·자간을 별도로 조정 가능 |
| `guestbook` | 방명록 메시지·작성자 이름 | `handwriting` | 손글씨체로 진짜 방명록처럼 친근하게 |
| `thanks` | 마지막 인사 라벨·날짜 | `serif` | hero·제목과 통일감 있는 마무리 |

## 카카오톡 등 링크 공유 시 썸네일 이미지 설정

`index.html`의 `<head>`에 있는 `og:image`(및 `twitter:image`) 값이 카카오톡·문자·SNS에 링크를 붙여넣었을 때 뜨는 미리보기 사진입니다. 현재는 `wedding.json`의 `hero.image`와 같은 사진(`assets/images/gallery_006.jpg`)의 절대 주소로 지정되어 있습니다.

- 대표 사진을 바꾸고 싶다면 `og:image`와 `twitter:image` 두 줄의 파일명을 원하는 사진으로 교체하세요. 주소는 반드시 `https://wsoarc.github.io/wedding-card/...` 형태의 **절대 경로**여야 하며, 상대 경로(`assets/images/...`)로는 미리보기가 뜨지 않습니다.
- 카카오톡은 이미지를 정사각형에 가깝게 크롭해서 보여주므로, 인물이 사진 중앙에 오는 사진을 고르는 것이 좋습니다.
- 배포(GitHub Pages 반영) 후에도 카카오톡 등은 한 번 가져온 미리보기를 한동안 캐싱합니다. 새 이미지가 바로 안 뜨면 [카카오 디버거](https://developers.kakao.com/tool/debugger/sharing)에 주소를 넣고 새로고침하면 캐시가 갱신됩니다.
- 제목/설명 문구도 같은 위치의 `og:title`, `og:description`(및 twitter 버전)에서 수정할 수 있습니다.



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
