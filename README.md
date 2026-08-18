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
