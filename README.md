# 위너스 학원 화면 (정적 호스팅)

폰·태블릿에서 구글 계정 선택 없이 바로 열리는 화면 모음입니다.
화면만 정적 호스팅(GitHub Pages)에서 열리고, 실제 데이터는 학원의 Google Apps Script 웹앱과
직접 주고받습니다(`?api=` JSON 및 `bridge` 화이트리스트 호출).

## 주소

| 화면 | 주소 |
|---|---|
| 허브 | https://rhew-jh.github.io/winners/ |
| 클리닉 학생 | https://rhew-jh.github.io/winners/clinic.html |
| 클리닉 선생님 | https://rhew-jh.github.io/winners/clinic-teacher.html |
| 수학 QR 채점 | https://rhew-jh.github.io/winners/math.html?exam=시험코드 |
| 수학 채점 교사 | https://rhew-jh.github.io/winners/math-teacher.html |
| 영어 초등 학습 | https://rhew-jh.github.io/winners/english-elem.html |
| 영어 문제지 QR 채점 | https://rhew-jh.github.io/winners/english-paper.html?exam=시험코드 |
| 영어 교사 | https://rhew-jh.github.io/winners/english-teacher.html |

## 보안

- 교사 키·토큰·핀·학생 개인정보는 이 저장소에 없습니다. 각 화면에서 입력하면 그 기기에만 저장됩니다.
- 서버는 화면이 원래 부르던 함수만 허용하는 화이트리스트(`waeStaticBridge_`)로 응답합니다.

## 구성

- `bridge.js` — 화면의 `google.script.run` 자리에 들어가는 얇은 다리(정적 호스팅에는 그 객체가 없음)
- `*.html` — 각 Apps Script 화면 원본 + 다리 주입
