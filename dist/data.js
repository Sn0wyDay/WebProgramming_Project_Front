'use strict';

const icons = {
  explore: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  note: '<path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9"/><path d="m10 14 1-4 8-8 3 3-8 8Z"/>',
  friends: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.8M15 3.2a4 4 0 0 1 0 7.6"/><circle cx="9" cy="7" r="4"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="m20 2 .7 1.3L22 4l-1.3.7L20 6l-.7-1.3L18 4l1.3-.7Z"/>',
  review: '<path d="M4 3h16v18H4Z"/><path d="M8 7h8m-8 4h8m-8 4h4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
  comment: '<path d="M21 11.5A8.5 8.5 0 0 1 8.5 19L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5Z"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 13h4v8H3Zm14 0h4v8h-4Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.note}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const albums = {
  blue: {title:'Blue Hour',artist:'유월',image:'assets/blue-hour.webp',year:'2026'},
  sunday: {title:'Sunday Window',artist:'모브',image:'assets/sunday-window.webp',year:'2026'},
  night: {title:'Night Drive',artist:'OFFDAY',image:'assets/night-drive.webp',year:'2026'}
};
const songs = [
  {id:'blue-hour',title:'푸른 시간',album:'blue',genre:'인디 팝',tags:['잔잔한','밤','위로'],lines:['해가 저문 자리에 나를 내려놓고','오늘의 소음을 잠시 접어 두어요','말하지 못한 마음은 파도에 실어','아무도 모르는 곳으로 보내요','우리가 서툴렀던 그 모든 날에도','하늘은 어김없이 푸르게 물들었죠','조금 늦어도 괜찮아, 너의 속도로','내일은 아직 이름 없는 빛이니까']},
  {id:'slow-sunday',title:'느린 일요일',album:'sunday',genre:'포크',tags:['따뜻한','일상','여유'],lines:['햇살 한 조각이 식탁 위에 앉고','식어 가는 커피에도 향기는 남아','서둘러야 할 이유 없는 이 아침','너의 웃음만 천천히 읽고 싶어','창밖의 세상은 바쁘게 흘러도','우리의 시계는 조금 느려도 좋아','아무것도 아닌 날에 이름을 붙여','오래 기억할 작은 행복이라 하자']},
  {id:'detour',title:'우회로',album:'night',genre:'R&B',tags:['설렘','밤','도시'],lines:['익숙한 길을 벗어나 한 번쯤','지도에 없는 밤을 걸어 볼래','붉은 신호 앞에 멈춰 선 마음도','너를 만나면 다시 움직이니까','조금 먼 길로 돌아가도 좋아','우리에겐 서두를 내일이 없잖아','헤드라이트 너머 반짝이는 이름','이 도시의 끝에서 너를 부를게']},
  {id:'morning-sentence',title:'새벽의 문장',album:'blue',genre:'인디 팝',tags:['잔잔한','밤','그리움'],lines:['잠들지 못한 방에 빈 종이를 펴고','끝내 보내지 못할 문장을 써','너의 이름 대신 작은 쉼표 하나','우리 사이에 남겨 두고 싶어','별들은 지워져도 하늘은 남아','기억은 그렇게 자리를 바꿔','언젠가 이 문장을 다시 읽을 때','아픈 말보다 다정한 말이 많기를']},
  {id:'sunlit-place',title:'볕이 드는 자리',album:'sunday',genre:'포크',tags:['따뜻한','위로','일상'],lines:['작은 화분을 창가로 옮기고','너에게도 볕이 드는 자리를 줄게','어제의 비가 남긴 작은 흔적에','오늘의 빛이 조용히 내려앉아','괜찮다는 말이 어려운 날이면','아무 말 없이 나란히 앉아 있자','우리는 매일 조금씩 자라나고','너의 계절도 곧 꽃을 피울 거야']},
  {id:'city-afterimage',title:'도시의 잔상',album:'night',genre:'신스 팝',tags:['설렘','밤','도시'],lines:['유리창 위에 번지는 불빛들','잠든 거리엔 우리의 잔상이 남아','어제의 끝과 오늘의 시작 사이','너의 목소리가 길을 밝혀 줘','신호가 바뀌면 뒤돌아보지 말자','끝나지 않은 노래를 따라가','도시는 우리를 기억하지 못해도','우리는 이 밤을 잊지 않을 거야']},
  {id:'our-waves',title:'우리가 남긴 파도',album:'blue',genre:'인디 팝',tags:['잔잔한','그리움','위로'],lines:['모래 위에 쓴 우리의 약속을','바다가 가져가도 슬퍼하지 마','사라진 것은 없어진 게 아니라','조금 더 넓은 곳으로 간 거야','멀어지는 마음을 잡을 순 없어도','다정했던 순간은 여기 남겨 둘게','언젠가 같은 바다를 만난다면','그때의 우리에게 안부를 전해 줘']},
  {id:'open-window',title:'반쯤 열린 창',album:'sunday',genre:'포크',tags:['따뜻한','여유','일상'],lines:['반쯤 열린 창에 바람이 머물고','읽다 만 책의 페이지를 넘겨','특별한 일은 하나도 없었지만','오늘은 왠지 오래 남을 것 같아','빈칸을 채우려고 애쓰지 말자','여백도 우리 이야기가 되니까','네가 쉬어 갈 작은 자리를 위해','이 창은 내일도 열어 둘 거야']}
];
const people = [
  {id:'hana',name:'하나',initial:'하',color:'pink',handle:'hana.notes',description:'가사에서 작은 위로를 찾아요'},
  {id:'jiu',name:'지우',initial:'지',color:'blue',handle:'jiwoo.wav',description:'밤에 듣는 음악을 좋아해요'},
  {id:'min',name:'민서',initial:'민',color:'purple',handle:'min.archive',description:'음악과 일상의 조각들을 기록해요'},
  {id:'soojin',name:'수진',initial:'수',color:'pink',handle:'soo.playlist',description:'천천히 듣고, 오래 기억하기'},
  {id:'doyun',name:'도윤',initial:'도',color:'blue',handle:'doyun.offbeat',description:'새로운 음악을 찾는 중'},
  {id:'yuna',name:'윤아',initial:'윤',color:'purple',handle:'yuna.room',description:'평범한 날들의 사운드트랙'}
];
const feed = [
  {id:'feed-hana-1',person:'hana',song:'blue-hour',line:6,text:'남들보다 조금 늦어도 괜찮다는 말. 오늘 나에게 꼭 필요했던 문장이에요.',date:'2026-10-01T08:30:00',likes:8},
  {id:'feed-jiu-1',person:'jiu',song:'slow-sunday',line:6,text:'특별한 일이 없어도 좋은 하루일 수 있다는 걸, 이 노래가 알려주는 것 같아요.',date:'2026-09-30T21:10:00',likes:5},
  {id:'feed-min-1',person:'min',song:'sunlit-place',line:4,text:'말없이 함께 있어 주는 마음이 때로는 어떤 위로보다 크죠.',date:'2026-09-29T19:20:00',likes:3},
  {id:'feed-hana-2',person:'hana',song:'open-window',line:4,text:'계획으로 가득 찬 일주일. 오늘은 잠깐 비워 둔 시간도 필요하겠다 싶어요.',date:'2026-09-29T13:30:00',likes:4},
  {id:'feed-jiu-2',person:'jiu',song:'city-afterimage',line:7,text:'돌아오는 버스 창문에 비친 불빛을 보다가 문득. 음악은 장면을 기억하는 방법이기도 하네요.',date:'2026-09-28T22:40:00',likes:7},
  {id:'feed-soojin-1',person:'soojin',song:'our-waves',line:3,text:'떠나보내는 마음을 이렇게 다정하게 말할 수 있구나.',date:'2026-09-27T15:30:00',likes:2}
];

