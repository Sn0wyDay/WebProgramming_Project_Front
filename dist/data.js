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

// 앨범(아티스트) 목록과 곡 목록은 비어 있는 상태로 시작해요.
// 아래 seedSongs와 추천·검색으로 가져온 곡이 script.js의 registerExt()로 채워집니다.
const albums = {};
const songs = [];
// 처음부터 보여 줄 실제 곡 (음악 정보: MusicBrainz). 가사는 앱이 열릴 때 LRCLIB에서 불러와요.
// id = 'mb-' + MusicBrainz recording id, artistMbid = MusicBrainz artist id,
// releaseId = 발매반 id, releaseGroupId = 앨범 묶음 id (앨범 이미지는 releaseGroupId로 Cover Art Archive에서 가져와요)
const seedSongs = [
  {id:'mb-c4ca6261-fb10-4901-8acd-0be1c0b1f66b',title:'Square (2017)',artist:'백예린',artistMbid:'d598652a-b64a-4e21-b607-bcec71698731',release:'Every letter I sent you.',releaseId:'ba815536-8b39-4cd2-b11c-d852d56150bf',releaseGroupId:'3c687a27-af46-4d2d-8981-dc8dc8241af9',year:'2019',genre:'인디 팝',tags:['설렘','따뜻한','밤']},
  {id:'mb-24f7c5d1-632a-481b-8c91-27f4e0994084',title:'Bye bye my blue',artist:'백예린',artistMbid:'d598652a-b64a-4e21-b607-bcec71698731',release:'Bye Bye My Blue',releaseId:'2f11857e-5517-4d03-a7e6-37b143cb816b',releaseGroupId:'130e2d58-e62e-4f0e-8eca-f6d6121b1798',year:'2016',genre:'인디 팝',tags:['그리움','잔잔한']},
  {id:'mb-5b874e34-7584-4006-bc7d-0b7f43aa3f1d',title:'그건 아마 우리의 잘못은 아닐 거야',artist:'백예린',artistMbid:'d598652a-b64a-4e21-b607-bcec71698731',release:'Our love is great',releaseId:'3e285255-511a-4ea4-b16a-8a33d5e6fe3e',releaseGroupId:'f0f8f811-72bd-4983-aac6-5fece916c3a4',year:'2019',genre:'인디 팝',tags:['위로','잔잔한']},
  {id:'mb-d0ea4b20-5f4c-4e49-9fdb-e585d810d9da',title:'NO PAIN',artist:'실리카겔',artistMbid:'2c8b5bb2-6110-488d-bc15-abb08379d3c6',release:'NO PAIN',releaseId:'2cf9d49c-0101-4964-aa94-874e8d0d0f15',releaseGroupId:'f450908b-d801-4f57-8580-8f92a3653a5c',year:'2022',genre:'인디 록',tags:['설렘','위로']},
  {id:'mb-1b77302b-2461-4ed8-877d-fe43a44125c2',title:'Desert Eagle',artist:'실리카겔',artistMbid:'2c8b5bb2-6110-488d-bc15-abb08379d3c6',release:'Desert Eagle',releaseId:'73f4b122-314a-4487-b2d0-aa948f3b6755',releaseGroupId:'a2e21aa0-82bb-4a00-b7b0-d8981698d969',year:'2021',genre:'인디 록',tags:['설렘','밤']},
  {id:'mb-8e3f159d-6a7e-4b22-b833-42c5c8875c9a',title:'LIMBO',artist:'keshi',artistMbid:'ee74db56-c264-4c23-9504-29e2d8078f36',release:'GABRIEL',releaseId:'9e26a57f-4ff8-4bee-99fd-2824d4b172b1',releaseGroupId:'34513978-0a8f-4e48-b47c-6a8694f227cb',year:'2022',genre:'R&B',tags:['그리움','밤']},
  {id:'mb-9923f201-2e80-42e0-872c-3bd4c6c88944',title:'beside you',artist:'keshi',artistMbid:'ee74db56-c264-4c23-9504-29e2d8078f36',release:'beside you',releaseId:'ba8e6c05-31a9-47ac-9caa-6df1a340898c',releaseGroupId:'a8d00096-e6f8-4171-ab7d-62cbc41f4972',year:'2021',genre:'R&B',tags:['설렘','따뜻한']},
  {id:'mb-e5c48c5a-e9b9-4bb7-bece-423570597159',title:'2 soon',artist:'keshi',artistMbid:'ee74db56-c264-4c23-9504-29e2d8078f36',release:'THE REAPER',releaseId:'32c02551-782e-4882-a751-196345b55826',releaseGroupId:'a0a089ed-0520-4e58-8a86-e17cd595945e',year:'2018',genre:'R&B',tags:['그리움','잔잔한']},
  {id:'mb-04a65911-4ae6-49ff-aa7e-a3fe69f693ec',title:'drunk',artist:'keshi',artistMbid:'ee74db56-c264-4c23-9504-29e2d8078f36',release:'always',releaseId:'a96a26cb-212d-4077-b9f0-97734b2cf07a',releaseGroupId:'5a511cb4-010a-4a46-a551-93a099c7aedb',year:'2020',genre:'R&B',tags:['밤','그리움']},
  {id:'mb-f57bc274-3cd0-42e2-a267-5ea4b64efa41',title:'like i need u',artist:'keshi',artistMbid:'ee74db56-c264-4c23-9504-29e2d8078f36',release:'THE REAPER',releaseId:'32c02551-782e-4882-a751-196345b55826',releaseGroupId:'a0a089ed-0520-4e58-8a86-e17cd595945e',year:'2018',genre:'R&B',tags:['설렘','잔잔한']}
];
// 곡 id를 짧게 부르기 위한 별칭 (예시 코멘트에서 사용)
const SEED = {square:seedSongs[0].id,byebye:seedSongs[1].id,ourfault:seedSongs[2].id,nopain:seedSongs[3].id,desert:seedSongs[4].id,limbo:seedSongs[5].id,beside:seedSongs[6].id,soon:seedSongs[7].id,drunk:seedSongs[8].id,needu:seedSongs[9].id};
const people = [
  {id:'hana',name:'하나',initial:'하',color:'pink',handle:'hana.notes',description:'가사에서 작은 위로를 찾아요'},
  {id:'jiu',name:'지우',initial:'지',color:'blue',handle:'jiwoo.wav',description:'밤에 듣는 음악을 좋아해요'},
  {id:'min',name:'민서',initial:'민',color:'purple',handle:'min.archive',description:'음악과 일상의 조각들을 기록해요'},
  {id:'soojin',name:'수진',initial:'수',color:'pink',handle:'soo.playlist',description:'천천히 듣고, 오래 기억하기'},
  {id:'doyun',name:'도윤',initial:'도',color:'blue',handle:'doyun.offbeat',description:'새로운 음악을 찾는 중'},
  {id:'yuna',name:'윤아',initial:'윤',color:'purple',handle:'yuna.room',description:'평범한 날들의 사운드트랙'}
];
// 친구들이 남긴 예시 코멘트 (line은 LRCLIB 가사의 몇 번째 줄인지, 0부터)
const feed = [
  {id:'feed-hana-1',person:'hana',song:SEED.ourfault,line:3,text:'헤어짐을 누구의 탓으로 돌리지 않는 노래라서 좋아요. 끝난 관계도 다정하게 기억할 수 있다는 걸 알려 줘요.',date:'2026-11-12T08:30:00',likes:8},
  {id:'feed-jiu-1',person:'jiu',song:SEED.limbo,line:6,text:'새벽 두 시에 들으면 반칙인 노래. 어디에도 속하지 못한 기분을 이렇게 담담하게 부를 수 있구나.',date:'2026-11-11T02:10:00',likes:7},
  {id:'feed-min-1',person:'min',song:SEED.nopain,line:8,text:'공연장에서 다 같이 따라 부르던 순간이 생각나요. 아픈데 아프지 않다고 외치는 게 오히려 위로가 됐어요.',date:'2026-11-10T19:20:00',likes:5},
  {id:'feed-hana-2',person:'hana',song:SEED.square,line:1,text:'고백하기 직전의 떨림이 가사 한 줄 한 줄에 다 들어 있어요. 이 곡은 봄보다 겨울밤에 더 잘 어울려요.',date:'2026-11-09T22:30:00',likes:6},
  {id:'feed-jiu-2',person:'jiu',song:SEED.beside,line:2,text:'좋아하는 사람 옆자리에 앉고 싶은 마음, 딱 그거 하나만 노래해서 더 좋아요.',date:'2026-11-08T21:40:00',likes:4},
  {id:'feed-soojin-1',person:'soojin',song:SEED.byebye,line:4,text:'우울에게 작별 인사를 건네는 노래. 오늘은 저도 조금 가볍게 보내 주려고요.',date:'2026-11-07T15:30:00',likes:3},
  {id:'feed-min-2',person:'min',song:SEED.desert,line:6,text:'기타 소리가 몰아칠 때 이 구절이 나오면 숨이 멎는 느낌. 실리카겔은 늘 예상한 방향과 다르게 가요.',date:'2026-11-06T23:00:00',likes:2},
  {id:'feed-soojin-2',person:'soojin',song:SEED.soon,line:3,text:'너무 빨리 마음을 줘 버린 적이 있다면 이 노래가 남 얘기 같지 않을 거예요.',date:'2026-11-05T01:15:00',likes:5}
];

