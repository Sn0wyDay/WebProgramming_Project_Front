# WebProgramming_Project_Front — RE:VERSE

웹프로그래밍 18팀 프로젝트

화이트보드 스케치의 음악 기록 서비스 흐름을 구현한 HTML / CSS / JavaScript 데모입니다.

[공개 데모 바로 보기](https://sidenote-music-room.ancrs0527.chatgpt.site)

## 실행

별도의 패키지 설치나 빌드 과정 없이 실행할 수 있습니다.

1. 저장소를 내려받거나 복제합니다.
2. `dist/index.html`을 최신 브라우저에서 엽니다.

로컬 서버로 실행하려면 저장소의 최상위 폴더에서 아래 명령을 실행한 뒤 `http://localhost:8840`에 접속합니다. Python 3가 필요합니다.

```sh
python3 -m http.server 8840 --directory dist
```

## 화면과 기능

- **홈**: 최근 음악 기록, 별점, 전체 곡 목록, 음악 추가.
- **음악 추가**: MusicBrainz에서 곡 제목 / 아티스트 검색, LRCLIB에 가사가 있는 곡을 골라 기록 시작.
- **곡 상세**: 1~5 별점, LRCLIB 가사 구절별 코멘트 작성·수정·삭제, 나만 보기 / 친구 공개, 저장한 곡, MusicBrainz 곡 정보.
- **친구**: 이름 / 아이디 검색, 요청·취소·수락, 상대의 수락 시연, 친구별 음악과 코멘트, 공감.
- **AI 리포트**: 선호 곡·분위기·기록을 참고한 추천, 분석 상태, 노래 및 아티스트 결과. 실제 음악 정보는 [MusicBrainz](https://github.com/metabrainz/musicbrainz-server), 가사는 [LRCLIB](https://github.com/tranxuanthang/lrclib)에서 불러옵니다(API 키 없이 고정 연결).
- **나의 기록**: 코멘트 / 기록한 음악 / 저장한 곡 탭, 검색.

별점, 코멘트, 음악 기록과 친구 상태는 `localStorage`에 저장됩니다. 같은 브라우저에서 새로고침해도 유지됩니다. 프로필에서 표시 이름을 바꿀 수 있고, 하단 안내에서 예시 데이터를 초기화할 수 있습니다.

## 데모 범위

처음 화면에는 백예린, 실리카겔, keshi의 곡 10곡이 예시로 들어 있습니다(`dist/data.js`의 `seedSongs`). 곡 정보는 MusicBrainz, 가사는 앱을 열 때 LRCLIB에서 불러오며 한 번 받은 가사는 브라우저에 저장됩니다. 예시 친구와 코멘트는 시연용으로 작성했습니다. 실제 로그인, 실제 사용자 간 공유와 AI(LLM) API 호출은 연결되어 있지 않습니다. 추천은 내 별점·코멘트·장르를 MusicBrainz 태그로 바꿔 검색해 만듭니다.

## 파일

- `dist/index.html`: 공통 화면과 메뉴
- `dist/style.css`: 반응형 디자인
- `dist/data.js`: 예시 곡(MusicBrainz id), 예시 친구와 코멘트
- `dist/script.js`: 화면 전환, 검색, 저장 및 데모 기능
- `dist/ai.js` / `dist/ai.css`: AI 리포트 화면, MusicBrainz · LRCLIB 연동

모바일에서는 메뉴가 화면 하단으로 이동하며, 가사와 곡 정보는 세로로 배치됩니다. Google Fonts를 불러오지 못할 경우 시스템 글꼴로 표시됩니다.
