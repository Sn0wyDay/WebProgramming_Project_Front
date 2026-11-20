'use strict';

icons.star='<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8l-6.2 3.2L7 14.2 2 9.3l6.9-1Z"/>';
const STORAGE_KEY='reverse-demo-v2';
try{localStorage.removeItem('sidenote-demo-v1');}catch(error){} // 가짜 곡 시절의 예전 저장 데이터
const main=document.getElementById('main');
const modal=document.getElementById('modal');
const findSong=id=>songs.find(s=>s.id===id);
// MusicBrainz·LRCLIB에서 가져온 곡은 곡마다 앨범(발매반)·이미지가 달라서 곡 정보로 덮어써요.
const albumOf=s=>s.ext?{...albums[s.album],title:s.release||s.title,image:s.image,year:s.year}:albums[s.album];
/* ---------- 외부 곡 (MusicBrainz 음악 정보 + LRCLIB 가사) ----------
 * 추천에서 가져온 곡을 앱의 songs / albums에 등록해 별점·코멘트·저장을 똑같이 쓸 수 있게 해요.
 * 곡 id는 'mb-<MusicBrainz recording id>', 아티스트(앨범 칸) id는 'mba-<MusicBrainz artist id>' 입니다.
 * 등록한 곡 정보는 state.ext에 저장돼 새로고침해도 남아요. */
const EXT_COVER='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#e9f0da"/><path d="M50 82V40l34-8v42" fill="none" stroke="#8fae4c" stroke-width="6" stroke-linejoin="round"/><circle cx="42" cy="82" r="9" fill="#8fae4c"/><circle cx="76" cy="74" r="9" fill="#8fae4c"/></svg>');
const EXT_ID=/^mb-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EXT_MBID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// 외부 글자는 화면 HTML에 그대로 들어가므로 특수문자를 비슷한 모양의 안전한 글자로 바꿔요.
const extText=(v,max=200)=>String(v??'').replace(/[<>&"'`]/g,c=>({'<':'‹','>':'›','&':'＆','"':'”',"'":'’','`':'’'}[c])).slice(0,max);
function registerExt(meta){
  if(!meta||!EXT_ID.test(meta.id)||!Array.isArray(meta.lines))return null;
  const lines=meta.lines.filter(l=>typeof l==='string'&&l.trim()).slice(0,120).map(l=>extText(l,200));
  if(!meta.title||!meta.artist)return null; // 가사가 아직 없으면(빈 배열) 나중에 hydrateLyrics()가 채워요.
  const artistMbid=EXT_MBID.test(meta.artistMbid||'')?meta.artistMbid:meta.id.slice(3);
  const albumId='mba-'+artistMbid;
  // 앨범 이미지는 앨범 묶음(release group) 표지를 먼저, 없으면 발매반 표지를 써요.
  const image=EXT_MBID.test(meta.releaseGroupId||'')?`https://coverartarchive.org/release-group/${meta.releaseGroupId}/front-250`:EXT_MBID.test(meta.releaseId||'')?`https://coverartarchive.org/release/${meta.releaseId}/front-250`:EXT_COVER;
  // 장르는 앱이 정한 이름(AI_GENRE_TAGS)이면 그대로 둬요. 'R&B'의 &가 바뀌면 장르 분석이 어긋나요.
  const genre=Object.prototype.hasOwnProperty.call(AI_GENRE_TAGS,meta.genre)?meta.genre:(extText(meta.genre||'',30)||'팝');
  if(!albums[albumId])albums[albumId]={title:extText(meta.release||meta.title),artist:extText(meta.artist,120),image,year:extText(meta.year,4),genre,ext:true,mbid:artistMbid};
  const song={id:meta.id,title:extText(meta.title),album:albumId,genre,tags:(Array.isArray(meta.tags)?meta.tags:[]).filter(t=>typeof t==='string').slice(0,4).map(t=>extText(t,20)),lines,
    ext:true,mbid:meta.id.slice(3),release:extText(meta.release||''),image,year:extText(meta.year,4)};
  const old=findSong(meta.id);if(old)Object.assign(old,song);else songs.push(song);
  return song;
}
// 처음부터 보여 줄 곡(seedSongs)을 등록해요. 한 번 받아 온 가사는 브라우저에 저장해 두고 다시 써요.
const LYRICS_CACHE_KEY='reverse-lyrics-v1';
function lyricsCache(){try{const c=JSON.parse(localStorage.getItem(LYRICS_CACHE_KEY)||'{}');return c&&typeof c==='object'?c:{};}catch(error){return {};}}
(()=>{const cache=lyricsCache();seedSongs.forEach(m=>registerExt({...m,lines:Array.isArray(cache[m.id])?cache[m.id]:[]}));})();
// 가사가 비어 있는 곡은 LRCLIB에서 가사를 받아 채운 뒤 화면을 다시 그려요.
let lyricsLoading=false;
async function hydrateLyrics(){
  const missing=songs.filter(s=>!s.lines.length&&!s.lyricsFailed);if(!missing.length||lyricsLoading)return;
  lyricsLoading=true;const cache=lyricsCache();
  await Promise.allSettled(missing.map(async s=>{
    try{const l=await aiLyrics({title:s.title,artist:albumOf(s).artist});
      if(l?.lines?.length){s.lines=l.lines.slice(0,120).map(x=>extText(x,200));cache[s.id]=s.lines;}else s.lyricsFailed=true;}
    catch(error){s.lyricsFailed=true;}
  }));
  try{localStorage.setItem(LYRICS_CACHE_KEY,JSON.stringify(cache));}catch(error){}
  lyricsLoading=false;
  if(!document.getElementById('comment-text'))render();
}
const lineText=(s,i)=>s.lines[i]??(s.lyricsFailed?'(가사를 불러오지 못했어요)':'가사를 불러오는 중…');
// 커버 이미지가 없는 발매반은 404가 나므로 기본 이미지로 바꿔요.
document.addEventListener('error',event=>{const img=event.target;if(img instanceof HTMLImageElement&&img.src.startsWith('https://coverartarchive.org/'))img.src=EXT_COVER;},true);
const findPerson=id=>people.find(p=>p.id===id);
const now=()=>new Date().toISOString();
const dateLabel=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':`${d.getMonth()+1}월 ${d.getDate()}일`;};
let storageWarning='';
function defaults(){return {version:1,name:'음악 산책자',notes:[
  {id:'seed-note-1',song:SEED.square,line:2,text:'처음 들었을 때 이 구절에서 멈췄다. 좋아한다는 말을 이렇게 둥글게 꺼낼 수도 있구나.',visibility:'friends',date:'2026-11-14T22:40:00'},
  {id:'seed-note-2',song:SEED.ourfault,line:5,text:'끝난 관계를 탓하지 않고 보내 주는 법. 지난 일 년 동안 제일 많이 돌려 들은 부분.',visibility:'private',date:'2026-11-13T10:00:00'},
  {id:'seed-note-3',song:SEED.limbo,line:6,text:'퇴근길 버스에서 이 부분이 나오면 창밖만 보게 된다. 어디에도 닿지 않은 마음 같아서.',visibility:'friends',date:'2026-11-12T19:20:00'},
  {id:'seed-note-4',song:SEED.nopain,line:1,text:'아프지 않다고 크게 외치고 나면 정말 조금 덜 아프다. 볼륨 최대로.',visibility:'friends',date:'2026-11-11T08:10:00'}
],library:[SEED.square,SEED.ourfault,SEED.limbo,SEED.nopain,SEED.beside],added:{[SEED.square]:'2026-11-15T10:00:00',[SEED.ourfault]:'2026-11-14T10:00:00',[SEED.limbo]:'2026-11-13T10:00:00',[SEED.nopain]:'2026-11-12T10:00:00',[SEED.beside]:'2026-11-11T10:00:00'},
ratings:{[SEED.square]:5,[SEED.ourfault]:5,[SEED.limbo]:4,[SEED.nopain]:4,[SEED.beside]:3},saved:[SEED.square,SEED.limbo],friends:['hana','jiu'],outgoing:[],incoming:['min'],likes:[],mood:'잔잔한',pickGenre:'인디 팝',seed:SEED.square,ext:{}};}
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw){const first=defaults();localStorage.setItem(STORAGE_KEY,JSON.stringify(first));return first;}
    const parsed=JSON.parse(raw);if(!parsed||parsed.version!==1)throw new Error('invalid');
    const base=defaults();const result={...base,...parsed};
    result.ext=result.ext&&typeof result.ext==='object'&&!Array.isArray(result.ext)?result.ext:{};
    Object.entries(result.ext).forEach(([id,meta])=>{if(!registerExt({...meta,id}))delete result.ext[id];});
    result.name=typeof result.name==='string'?result.name.slice(0,20):base.name;
    result.notes=Array.isArray(result.notes)?result.notes.filter(n=>n&&typeof n.id==='string'&&typeof n.text==='string'&&findSong(n.song)&&Number.isInteger(n.line)&&n.line>=0&&(!findSong(n.song).lines.length||n.line<findSong(n.song).lines.length)&&['friends','private'].includes(n.visibility)).map(n=>({...n,id:n.id.replace(/[^a-zA-Z0-9_-]/g,''),text:n.text.slice(0,500)})):[];
    for(const key of ['library','saved'])result[key]=Array.isArray(result[key])?[...new Set(result[key].filter(id=>findSong(id)))]:[];
    for(const key of ['friends','incoming','outgoing'])result[key]=Array.isArray(result[key])?[...new Set(result[key].filter(id=>findPerson(id)))]:[];
    result.likes=Array.isArray(result.likes)?result.likes.filter(id=>feed.some(n=>n.id===id)):[];
    result.ratings=result.ratings&&typeof result.ratings==='object'?Object.fromEntries(Object.entries(result.ratings).filter(([id,r])=>findSong(id)&&Number.isInteger(r)&&r>=1&&r<=5)):{};
    result.added=result.added&&typeof result.added==='object'?result.added:{};
    result.notes.forEach(n=>{if(!result.library.includes(n.song))result.library.push(n.song);});
    result.mood=['잔잔한','따뜻한','설렘','그리움'].includes(result.mood)?result.mood:'잔잔한';
    result.pickGenre=AI_PICK_GENRES.includes(result.pickGenre)?result.pickGenre:'인디 팝';
    result.seed=findSong(result.seed)?result.seed:SEED.square;
    // 별점·코멘트·기록·저장 어디에도 쓰이지 않는 외부 곡 정보는 정리해요(지금 보고 있는 곡은 남김).
    const used=new Set([...result.library,...result.saved,...Object.keys(result.ratings),...result.notes.map(n=>n.song),result.seed,location.hash.split('/')[1]]);
    Object.keys(result.ext).forEach(id=>{if(!used.has(id))delete result.ext[id];});
    return result;
  }catch(error){storageWarning='저장 데이터를 읽지 못했어요. 브라우저의 저장 설정을 확인해 주세요.';return defaults();}
}
let state=loadState();
let page='home',viewAll=false,recordTab='notes',query='',genre='전체',friendFilter='all',selectedLine=-1,currentSong=SEED.square,toastTimer,aiTimer,aiResults=null;
function toast(message){const t=document.getElementById('toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),3200);}
function commit(mutator){const next=JSON.parse(JSON.stringify(state));mutator(next);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));state=next;storageWarning='';return true;}catch(error){toast('저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.');return false;}}
function addToLibrary(s,id){if(!s.library.includes(id))s.library.unshift(id);s.added[id]=now();}
const avatar=(p,mine=false)=>`<span class="avatar ${mine?'mine':p.color}">${mine?'나':esc(p.initial)}</span>`;
const empty=(title,text,action='')=>`<div class="empty">${icon('headphones')}<h3>${title}</h3><p>${text}</p>${action}</div>`;
const heading=(tag,title,description,extra='')=>`<div class="page-heading"><div><div class="eyebrow">${tag}</div><h1>${title}</h1><p>${description}</p></div>${extra}</div>`;
const miniStats=()=>`<div class="count-banner"><div><strong>${state.library.length}</strong>기록한 음악</div><span class="divider"></span><div><strong>${state.notes.length}</strong>남긴 코멘트</div></div>`;
function nav(){
  const entries=[['home','explore','홈'],['friends','friends','친구'],['ai','spark','AI 리포트'],['records','note','나의 기록']];
  document.getElementById('navigation').innerHTML=entries.map(([id,i,title])=>`<a class="nav-link ${page===id?'active':''}" href="#${id}" ${page===id?'aria-current="page"':''}>${icon(i)}<span>${title}</span></a>`).join('');
  document.getElementById('profile-name').textContent=state.name;
}
function stars(rating=0){return Array.from({length:5},(_,i)=>`<span class="${i<rating?'filled':''}">${icon('star')}</span>`).join('');}
function bookmark(id,full=false){const saved=state.saved.includes(id);return `<button class="${full?'button outline':'bookmark'} ${saved?'saved':''}" data-action="bookmark" data-id="${id}" aria-label="${saved?'저장 취소':'곡 저장'}" aria-pressed="${saved}">${icon('bookmark')}${full?`<span>${saved?'저장한 곡':'곡 저장'}</span>`:''}</button>`;}
function card(song,options={}){
  const a=albumOf(song);const n=state.notes.filter(n=>n.song===song.id).length;
  return `<article class="song-card"><div class="cover-wrap"><a class="cover-link" href="#song/${song.id}" aria-label="${song.title} 가사와 기록 보기"><img src="${a.image}" alt="${a.title} 앨범 아트" loading="lazy"><span class="cover-album"><small>${a.artist.toUpperCase()}</small>${a.title.replace(' ','<br>')}</span></a>${bookmark(song.id)}</div><div class="song-info"><div><a class="song-title" href="#song/${song.id}">${song.title}</a><p class="song-artist">${a.artist} · ${song.genre}</p></div>${icon('chevron')}</div>${options.friend?`<div class="song-foot"><span class="genre-label">친구의 기록</span><span class="note-count">${icon('comment')} ${options.count||1}개의 코멘트</span></div>`:`<div class="star-row" aria-label="내 별점 ${state.ratings[song.id]||0}점">${stars(state.ratings[song.id])}<small>${n}개의 코멘트</small></div>`}</article>`;
}
function home(){
  const tracks=(viewAll?songs:state.library.map(findSong).filter(Boolean)).slice(0,viewAll?24:5);
  main.innerHTML=heading('YOUR THOUGHTS BETWEEN THE LYRICS','음악을 다시 듣고,<br>새롭게 남기는 이야기.','좋아하는 구절에 머물고, 당신의 해석을 남겨 보세요.',miniStats())+
    `<section><div class="home-toolbar"><h2>${viewAll?'모든 음악':'최근에 추가한 음악'}</h2><div class="toolbar-actions"><button class="text-button" data-action="view-all">${viewAll?'최근 기록 보기':'전체 목록 보기'}</button><button class="button dark" data-action="add">${icon('plus')} 추가</button></div></div><div class="song-grid home-grid">${tracks.map(s=>card(s)).join('')}<button class="add-card" data-action="add"><span class="add-circle">${icon('plus')}</span><strong>새로운 음악 기록</strong><small>기억하고 싶은 곡을 추가해 보세요</small></button></div></section><div class="home-bottom"><div><p>오늘의 마음에 어울리는 음악이 궁금한가요?</p><small>당신의 기록을 바탕으로 새로운 곡을 발견해 보세요.</small></div><a href="#ai" class="button">${icon('spark')} AI 추천받기</a></div>`;
}
function showModal(title,body,buttons=''){
  document.getElementById('modal-content').innerHTML=`<div class="modal-heading"><h2 id="modal-title">${title}</h2><button class="close-button" data-action="close" aria-label="닫기">${icon('close')}</button></div><div class="modal-body">${body}</div>${buttons?`<div class="modal-buttons">${buttons}</div>`:''}`;
  if(!modal.open)modal.showModal();
}
function addModal(){showModal('기록을 추가할 음악 선택',`<div class="search-box add-search">${icon('search')}<input type="search" id="add-search" aria-label="음악 검색" placeholder="곡 제목 또는 아티스트 검색"></div><div id="add-results" class="add-results"></div><p class="inline-warning">MusicBrainz에서 곡을 찾고, 가사는 LRCLIB에서 불러와요. 가사가 있는 곡만 기록할 수 있어요.</p>`);filterAdd('');document.getElementById('add-search').focus();}
let addTimer,addRun=0,addFound=[];
const mbEscape=q=>q.replace(/[+\-&|!(){}\[\]^"~*?:\\\/]/g,'\\$&');
function addLocalRow(s){return `<button class="add-result" data-action="select-song" data-id="${s.id}"><img src="${albumOf(s).image}" alt=""><span><strong>${s.title}</strong><small>${albumOf(s).artist} · ${s.genre}</small></span>${state.library.includes(s.id)?'<span class="pill">기록 중</span>':icon('plus')}</button>`;}
function filterAdd(value){
  const q=value.trim().toLocaleLowerCase();const box=document.getElementById('add-results');clearTimeout(addTimer);const run=++addRun;
  const local=songs.filter(s=>[s.title,albumOf(s).artist].join(' ').toLocaleLowerCase().includes(q)).slice(0,q?6:10);
  const localHtml=local.length?`<p class="add-group">${q?'앱에 있는 곡':'추천 곡'}</p>${local.map(addLocalRow).join('')}`:'';
  if(q.length<2){box.innerHTML=localHtml||empty('검색어를 입력해 주세요','곡 제목이나 아티스트 이름을 두 글자 이상 입력해 보세요.');return;}
  box.innerHTML=localHtml+'<p class="add-group">MusicBrainz에서 찾는 중…</p>';
  addTimer=setTimeout(async()=>{
    let found=[];
    try{const e=mbEscape(value.trim());found=await aiFindRecordings(`(recording:(${e}) OR artist:(${e}))`);}
    catch(error){if(run===addRun)box.innerHTML=localHtml+`<p class="add-group">MusicBrainz 검색 실패: ${esc(aiErrorReason(error))}</p>`;return;}
    if(run!==addRun||!document.getElementById('add-results'))return;
    const seen=new Set(local.map(s=>s.id));
    addFound=found.filter(t=>{const k=aiTrackKey(t);if(seen.has('mb-'+t.mbid)||seen.has(k))return false;seen.add(k);return true;}).slice(0,10);
    box.innerHTML=localHtml+(addFound.length?`<p class="add-group">MusicBrainz 검색 결과</p>${addFound.map((t,i)=>`<button class="add-result" data-action="select-mb" data-value="${i}"><img src="${t.releaseId?`https://coverartarchive.org/release/${t.releaseId}/front-250`:EXT_COVER}" alt=""><span><strong>${esc(t.title)}</strong><small>${esc(t.artist)}${t.year?` · ${esc(t.year)}`:''}${t.release?` · ${esc(t.release)}`:''}</small></span>${icon('plus')}</button>`).join('')}`
      :local.length?'':empty('검색 결과가 없어요','다른 곡 제목이나 아티스트 이름으로 찾아보세요.'));
  },500);
}
// MusicBrainz 검색 결과를 고르면 LRCLIB에서 가사를 찾아 앱에 등록하고 기록 화면을 열어요.
async function selectMb(index,button){
  const t=addFound[index];if(!t)return;button.disabled=true;toast('LRCLIB에서 가사를 찾는 중이에요…');
  try{
    const [meta]=await aiWithLyrics([t],undefined,{genre:'팝',tags:[]},1);
    if(!meta){button.disabled=false;toast('LRCLIB에 이 곡의 가사가 없어서 기록할 수 없어요.');return;}
    aiRegister([meta]);selectSong(meta.id);
  }catch(error){button.disabled=false;toast('가사를 불러오지 못했어요: '+aiErrorReason(error));}
}
function selectSong(id){if(!findSong(id))return;if(commit(s=>addToLibrary(s,id))){modal.close();selectedLine=-1;if(location.hash===`#song/${id}`)detail(id);else location.hash=`song/${id}`;toast('음악 기록에 추가했어요. 마음에 남는 가사를 골라 보세요.');}}
function noteHtml(note,mine=true){const p=mine?null:findPerson(note.person);return `<div class="inline-note"><div class="note-person">${avatar(p,mine)}<strong>${mine?esc(state.name):p.name}</strong>${mine?`<span class="pill">${note.visibility==='private'?'나만 보기':'친구 공개'}</span>`:''}<time>${dateLabel(note.date)}</time></div><p>${esc(note.text)}</p>${mine?`<div class="note-actions"><button data-action="edit-note" data-id="${esc(note.id)}">수정</button><button data-action="delete-note" data-id="${esc(note.id)}">삭제</button></div>`:''}</div>`;}
function lineNotes(song,line){return state.notes.filter(n=>n.song===song.id&&n.line===line).map(n=>noteHtml(n)).join('')+feed.filter(n=>n.song===song.id&&n.line===line&&state.friends.includes(n.person)).map(n=>noteHtml(n,false)).join('');}
function detail(id){
  const s=findSong(id);if(!s){main.innerHTML=empty('이 곡을 찾을 수 없어요','홈에서 다른 곡을 골라 주세요.','<a class="button dark" href="#home">홈으로</a>');return;}
  currentSong=id;const a=albumOf(s);
  main.innerHTML=`<a class="back-button" href="#home">${icon('back')} 돌아가기</a><div class="song-hero"><img src="${a.image}" alt="${a.title} 앨범 아트"><div><div class="eyebrow">${a.title.toUpperCase()}</div><h1>${s.title}</h1><p class="song-meta">${a.artist} · ${s.genre} · ${a.year}</p><div class="rating-control" aria-label="내 별점 선택">${Array.from({length:5},(_,i)=>`<button class="${i<(state.ratings[id]||0)?'filled':''}" data-action="rate" data-value="${i+1}" aria-label="별점 ${i+1}점" aria-pressed="${state.ratings[id]===i+1}">${icon('star')}</button>`).join('')}<span class="rating-label">${state.ratings[id]?`나의 별점 ${state.ratings[id]}.0`:'별점을 남겨 주세요'}</span></div></div>${bookmark(id,true)}</div>
  <div class="detail-layout reverse-detail"><section class="panel lyrics-panel"><div class="panel-header"><h2>가사와 나의 코멘트</h2><span>${state.notes.filter(n=>n.song===id).length}개의 기록</span></div><div class="lyric-hint">${icon('note')} 마음에 남는 가사를 누르면 바로 아래에 코멘트를 남길 수 있어요.</div><ol class="lyric-list">${s.lines.map((line,i)=>`<li class="line-wrapper" id="line-${i}"><button class="lyric-line ${selectedLine===i?'selected':''}" data-action="line" data-value="${i}" aria-pressed="${selectedLine===i}"><span class="line-number">${String(i+1).padStart(2,'0')}</span><span>${line}</span>${state.notes.some(n=>n.song===id&&n.line===i)?icon('comment'):''}</button><div class="inline-notes">${lineNotes(s,i)}</div>${selectedLine===i?editor():''}</li>`).join('')}</ol>${s.lines.length?'':`<p class="small-muted">${s.lyricsFailed?'LRCLIB에서 가사를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.':'LRCLIB에서 가사를 불러오는 중…'}</p>`}<p class="lyrics-source">가사 제공 LRCLIB · 음악 정보 MusicBrainz · 작성한 기록은 이 브라우저에 저장됩니다.</p><button class="button dark record-button" data-action="record">${icon('plus')} 기록 추가</button></section>
  <aside class="panel critics-panel"><div class="panel-header"><h2>곡 정보</h2><span>SOURCES</span></div><p class="ext-source-row"><strong>음악 정보</strong>MusicBrainz</p>${s.release?`<p class="ext-source-row"><strong>발매반</strong>${s.release}</p>`:''}<p class="ext-source-row"><strong>가사</strong>LRCLIB</p><div class="tag-row ext-tags">${s.tags.map(t=>`<span>#${t}</span>`).join('')}</div><a class="button outline block" href="https://musicbrainz.org/recording/${s.mbid}" target="_blank" rel="noopener noreferrer">MusicBrainz에서 보기 ↗</a></aside></div>`;
}
function editor(){return `<form id="comment-form" class="inline-editor"><label class="form-label" for="comment-text">이 구절은 어떻게 들렸나요?</label><textarea class="textarea" id="comment-text" maxlength="500" required placeholder="당신의 감상이나 떠오른 기억을 남겨 보세요."></textarea><div class="form-meta"><span>한 줄의 가사, 하나의 새로운 이야기.</span><span id="comment-length">0 / 500</span></div><div class="form-bottom"><select class="select" id="comment-visibility" aria-label="코멘트 공개 범위"><option value="friends">친구에게 공개</option><option value="private">나만 보기</option></select><button class="button dark" type="submit">코멘트 저장</button></div></form>`;}
function openLine(line){
  const existing=document.getElementById('comment-text');const draft=existing?.value||'';const visibility=document.getElementById('comment-visibility')?.value||'friends';
  selectedLine=line;detail(currentSong);document.getElementById('comment-text').value=draft;document.getElementById('comment-visibility').value=visibility;document.getElementById('comment-length').textContent=`${draft.length} / 500`;
  document.getElementById('comment-text').focus({preventScroll:true});document.getElementById('comment-form').scrollIntoView({block:'nearest',behavior:'smooth'});
}
function ownNoteCard(n){const s=findSong(n.song);const a=albumOf(s);return `<article class="saved-note"><div class="saved-note-top"><a href="#song/${s.id}"><img src="${a.image}" alt="${a.title} 앨범 아트"></a><div><a href="#song/${s.id}"><h3>${s.title}</h3></a><small>${a.artist}</small></div><span class="pill">${n.visibility==='private'?'나만 보기':'친구 공개'}</span></div><blockquote>${lineText(s,n.line)}</blockquote><p>${esc(n.text)}</p><div class="saved-note-bottom"><time>${dateLabel(n.date)}</time><div class="note-actions"><button data-action="edit-note" data-id="${esc(n.id)}">수정</button><button data-action="delete-note" data-id="${esc(n.id)}">삭제</button></div></div></article>`;}
function records(){
  main.innerHTML=heading('MY LITTLE ARCHIVE','나의 기록','다시 꺼내 보고 싶은 음악과, 그때의 마음을 모았어요.',miniStats())+`<div class="record-tabs" aria-label="기록 종류">${[['notes','코멘트',state.notes.length],['songs','기록한 음악',state.library.length],['saved','저장한 곡',state.saved.length]].map(([id,title,count])=>`<button class="record-tab ${recordTab===id?'active':''}" data-action="record-tab" data-value="${id}" aria-pressed="${recordTab===id}">${title} <span class="quiet-label">${count}</span></button>`).join('')}</div><div class="search-box record-search">${icon('search')}<input type="search" id="record-search" aria-label="나의 기록 검색" placeholder="곡 제목 또는 코멘트로 검색" value="${esc(query)}"></div><div id="record-results"></div>`;filterRecords();
}
function filterRecords(){const q=query.trim().toLocaleLowerCase();let html='';
  if(recordTab==='notes'){const results=state.notes.filter(n=>[findSong(n.song).title,albumOf(findSong(n.song)).artist,n.text].join(' ').toLocaleLowerCase().includes(q));html=results.length?`<div class="notes-grid">${results.map(ownNoteCard).join('')}</div>`:empty(q?'찾는 코멘트가 없어요':'아직 코멘트가 없어요',q?'다른 단어로 검색해 보세요.':'가사의 한 구절을 선택하고 첫 기록을 남겨 보세요.','<button class="button outline" data-action="add">음악 선택하기</button>');}
  else{const ids=recordTab==='saved'?state.saved:state.library;const results=ids.map(findSong).filter(s=>[s.title,albumOf(s).artist].join(' ').toLocaleLowerCase().includes(q));html=results.length?`<div class="song-grid home-grid">${results.map(s=>card(s)).join('')}</div>`:empty('아직 담아 둔 곡이 없어요','기억하고 싶은 음악을 추가하거나 저장해 보세요.','<button class="button outline" data-action="add">음악 선택하기</button>');}
  document.getElementById('record-results').innerHTML=html;
}
function likeButton(n){const liked=state.likes.includes(n.id);return `<button data-action="like" data-id="${n.id}" class="${liked?'liked':''}" aria-label="${liked?'공감 취소':'공감하기'}" aria-pressed="${liked}">${icon('heart')} ${n.likes+(liked?1:0)}</button>`;}
function feedCard(n,mine=false){const p=mine?null:findPerson(n.person);const s=findSong(n.song);return `<article class="feed-card"><div class="note-person">${avatar(p,mine)}<strong>${mine?esc(state.name):p.name}</strong><time>${dateLabel(n.date)}</time></div><blockquote>${lineText(s,n.line)}</blockquote><p>${esc(n.text)}</p><div class="feed-song"><a href="#song/${s.id}"><img src="${albumOf(s).image}" alt=""></a><a href="#song/${s.id}">${s.title}<small>${albumOf(s).artist}</small></a>${mine?'':`<div class="note-actions">${likeButton(n)}</div>`}</div></article>`;}
function personRow(p,buttons){return `<div class="person-row">${avatar(p)}<span><strong>${p.name}</strong><small>@${p.handle}</small></span>${buttons}</div>`;}
function friends(){
  const chosen=friendFilter==='all'?null:findPerson(friendFilter);
  const friendFeed=feed.filter(n=>state.friends.includes(n.person)&&(!chosen||n.person===chosen.id));
  const shared=chosen?[]:state.notes.filter(n=>n.visibility==='friends');
  const songIds=[...new Set(friendFeed.map(n=>n.song))];
  main.innerHTML=heading('MUSIC IS BETTER TOGETHER','같은 음악, 다른 이야기.','친구가 남긴 해석을 읽고, 서로의 음악 취향을 발견해 보세요.','<button class="button dark" data-action="add-friend">'+icon('plus')+' 친구 추가</button>')+
  `<div class="shared-person-tabs"><button class="person-chip ${!chosen?'active':''}" data-action="friend-filter" data-value="all">${icon('friends')} 모두의 기록</button>${state.friends.map(id=>{const p=findPerson(id);return `<button class="person-chip ${friendFilter===id?'active':''}" data-action="friend-filter" data-value="${id}">${avatar(p)}${p.name}</button>`;}).join('')}</div>
  <div class="friends-layout"><section><div class="friend-record-heading">${chosen?avatar(chosen):icon('headphones')}<h2>${chosen?chosen.name+'님의 기록':'친구들이 기록한 음악'}</h2></div>${songIds.length?`<div class="song-grid friend-card-grid">${songIds.map(id=>card(findSong(id),{friend:true,count:friendFeed.filter(n=>n.song===id).length})).join('')}</div>`:empty('아직 공유한 기록이 없어요','친구를 추가하고 함께 음악 이야기를 나누어 보세요.')}
  <h2 class="friend-feed-title">${chosen?chosen.name+'님의 코멘트':'최근에 남긴 코멘트'}</h2>${shared.map(n=>feedCard(n,true)).join('')}${friendFeed.map(n=>feedCard(n)).join('')}${!friendFeed.length&&!shared.length?'<p class="small-muted">공유한 코멘트가 이곳에 표시돼요.</p>':''}</section>
  <aside class="friends-side"><section class="panel"><div class="panel-header"><h2>내 친구</h2><span>${state.friends.length}명</span></div>${state.friends.map(id=>personRow(findPerson(id),`<button class="button small subtle" data-action="friend-filter" data-value="${id}">기록 보기</button>`)).join('')||'<p class="small-muted">첫 친구를 추가해 보세요.</p>'}</section>
  <section class="panel"><div class="panel-header"><h2>받은 친구 요청</h2><span>${state.incoming.length}건</span></div>${state.incoming.map(id=>personRow(findPerson(id),`<button class="button small lime" data-action="accept-friend" data-id="${id}">수락</button>`)).join('')||'<p class="small-muted">새로운 요청이 없어요.</p>'}</section>
  ${state.outgoing.length?`<section class="panel"><div class="panel-header"><h2>보낸 친구 요청</h2></div>${state.outgoing.map(id=>personRow(findPerson(id),`<button class="button small subtle" data-action="simulate-accept" data-id="${id}">수락 시연</button>`)).join('')}<p class="inline-warning">시연 버튼으로 상대가 수락한 상태를 체험할 수 있어요.</p></section>`:''}<div class="notice">${icon('info')} 친구와 공유하는 흐름을 보여주는 예시입니다. 다른 사용자에게 실제로 전송되지는 않아요.</div></aside></div>`;
}
function friendModal(){showModal('친구를 찾아보세요',`<div class="search-box add-search">${icon('search')}<input type="search" id="friend-search" aria-label="친구 검색" placeholder="이름 또는 아이디로 검색"></div><div id="friend-results" class="add-results"></div><p class="inline-warning">데모에 준비된 프로필을 검색할 수 있어요.</p>`);filterFriends('');document.getElementById('friend-search').focus();}
function filterFriends(value){const q=value.trim().toLocaleLowerCase();const results=people.filter(p=>[p.name,p.handle].join(' ').toLocaleLowerCase().includes(q));document.getElementById('friend-results').innerHTML=results.map(p=>personRow(p,state.friends.includes(p.id)?'<span class="pill" style="margin-left:auto">친구</span>':state.outgoing.includes(p.id)?`<button class="button small subtle" data-action="cancel-request" data-id="${p.id}">요청 취소</button>`:state.incoming.includes(p.id)?`<button class="button small lime" data-action="accept-friend" data-id="${p.id}">수락</button>`:`<button class="button small outline" data-action="request-friend" data-id="${p.id}">추가</button>`)).join('')||empty('검색 결과가 없어요','이름이나 아이디를 다시 확인해 주세요.');}
// AI 추천 페이지(ai, 추천 계산, 결과 화면, 관련 클릭 처리)는 ai.js / ai.css로 옮겼습니다.
function render(){
  clearTimeout(aiTimer);const [route,id]=location.hash.slice(1).split('/');page=['friends','ai','records'].includes(route)?route:'home';nav();
  if(route==='song')detail(id);else if(page==='friends')friends();else if(page==='ai')ai();else if(page==='records')records();else home();
}
function bookmarkToggle(id){if(!findSong(id))return;const saved=state.saved.includes(id);if(!commit(s=>{s.saved=saved?s.saved.filter(v=>v!==id):[...s.saved,id];}))return;document.querySelectorAll(`[data-action="bookmark"][data-id="${id}"]`).forEach(b=>{b.classList.toggle('saved',!saved);b.setAttribute('aria-pressed',String(!saved));b.setAttribute('aria-label',saved?'곡 저장':'저장 취소');const label=b.querySelector('span');if(label)label.textContent=saved?'곡 저장':'저장한 곡';});if(page==='records'&&recordTab==='saved')records();toast(saved?'저장한 곡에서 뺐어요.':'나의 기록의 ‘저장한 곡’에 담았어요.');}
function editNote(id){const n=state.notes.find(n=>n.id===id);if(!n)return;showModal('코멘트 수정',`<blockquote class="selected-quote">${lineText(findSong(n.song),n.line)}</blockquote><label class="form-label" for="edit-text">나의 코멘트</label><textarea class="textarea" id="edit-text" maxlength="500">${esc(n.text)}</textarea><div class="form-bottom"><select class="select" id="edit-visibility" aria-label="공개 범위"><option value="friends" ${n.visibility==='friends'?'selected':''}>친구에게 공개</option><option value="private" ${n.visibility==='private'?'selected':''}>나만 보기</option></select></div>`,`<button class="button outline" data-action="close">취소</button><button class="button dark" data-action="save-edit" data-id="${esc(id)}">저장하기</button>`);}
function about(){showModal('RE:VERSE 프로토타입',`<p>화이트보드에 그린 음악 기록 서비스의 흐름을 직접 체험할 수 있도록 만들었어요.</p><ul><li>백예린, 실리카겔, keshi의 곡 10곡이 예시로 준비돼 있어요. 음악 정보는 MusicBrainz, 가사는 LRCLIB에서 불러와요.</li><li>별점, 코멘트, 음악 기록과 친구 목록은 이 브라우저에 저장돼요.</li><li>친구 공유는 실제 서비스 연결 없이 시연합니다.</li><li>음악 추가와 AI 리포트 추천도 MusicBrainz·LRCLIB에서 곡을 찾아요.</li></ul>${storageWarning?`<p>${esc(storageWarning)}</p>`:''}`,'<button class="button outline" data-action="reset">데모 초기화</button><button class="button dark" data-action="close">확인</button>');}
document.addEventListener('click',event=>{
  const b=event.target.closest('[data-action]');if(!b)return;const {action,id,value}=b.dataset;
  if(action==='close'){modal.close();if(page==='friends')friends();}
  else if(action==='add')addModal();
  else if(action==='about')about();
  else if(action==='view-all'){viewAll=!viewAll;home();}
  else if(action==='bookmark')bookmarkToggle(id);
  else if(action==='select-song')selectSong(id);
  else if(action==='select-mb')selectMb(Number(value),b);
  else if(action==='rate'){const rating=Number(value);if(!Number.isInteger(rating)||rating<1||rating>5)return;if(commit(s=>{s.ratings[currentSong]=rating;if(!s.library.includes(currentSong))addToLibrary(s,currentSong);})){document.querySelectorAll('[data-action="rate"]').forEach((button,i)=>{button.classList.toggle('filled',i<rating);button.setAttribute('aria-pressed',String(i+1===rating));});document.querySelector('.rating-label').textContent=`나의 별점 ${rating}.0`;toast(`${rating}점으로 기록했어요.`);}}
  else if(action==='line')openLine(Number(value));
  else if(action==='record'){if(!findSong(currentSong)?.lines.length){toast('가사를 불러온 뒤에 기록할 수 있어요.');return;}openLine(selectedLine>=0?selectedLine:0);}
  else if(action==='record-tab'){recordTab=value;query='';records();}
  else if(action==='edit-note')editNote(id);
  else if(action==='save-edit'){const text=document.getElementById('edit-text').value.trim();if(!text){toast('코멘트를 입력해 주세요.');return;}const visibility=document.getElementById('edit-visibility').value;if(commit(s=>{const n=s.notes.find(n=>n.id===id);if(n){n.text=text;n.visibility=visibility;}})){modal.close();render();toast('코멘트를 수정했어요.');}}
  else if(action==='delete-note'){showModal('코멘트를 삭제할까요?','<p>선택한 코멘트가 나의 기록에서 삭제됩니다.</p>',`<button class="button outline" data-action="close">취소</button><button class="button danger" data-action="confirm-delete" data-id="${esc(id)}">삭제</button>`);}
  else if(action==='confirm-delete'){if(commit(s=>{s.notes=s.notes.filter(n=>n.id!==id);})){modal.close();render();toast('코멘트를 삭제했어요.');}}
  else if(action==='friend-filter'){friendFilter=value;friends();}
  else if(action==='add-friend')friendModal();
  else if(action==='request-friend'){if(!findPerson(id))return;if(commit(s=>{if(!s.outgoing.includes(id))s.outgoing.push(id);})){filterFriends(document.getElementById('friend-search').value);toast('친구 요청을 보낸 상태로 기록했어요.');}}
  else if(action==='cancel-request'){if(commit(s=>{s.outgoing=s.outgoing.filter(v=>v!==id);})){filterFriends(document.getElementById('friend-search').value);toast('친구 요청을 취소했어요.');}}
  else if(action==='accept-friend'||action==='simulate-accept'){if(!findPerson(id))return;if(commit(s=>{if(!s.friends.includes(id))s.friends.push(id);s.incoming=s.incoming.filter(v=>v!==id);s.outgoing=s.outgoing.filter(v=>v!==id);})){if(modal.open)filterFriends(document.getElementById('friend-search').value);else friends();toast(`${findPerson(id).name}님과 친구가 됐어요.`);}}
  else if(action==='like'){const f=feed.find(n=>n.id===id);if(!f)return;if(commit(s=>{s.likes=s.likes.includes(id)?s.likes.filter(v=>v!==id):[...s.likes,id];})){const liked=state.likes.includes(id);b.innerHTML=`${icon('heart')} ${f.likes+(liked?1:0)}`;b.classList.toggle('liked',liked);b.setAttribute('aria-pressed',String(liked));b.setAttribute('aria-label',liked?'공감 취소':'공감하기');}}
  else if(action==='profile'){showModal('나의 음악 공간',`<div class="profile-summary">${avatar(null,true)}<span>${state.library.length}곡의 음악 · ${state.notes.length}개의 코멘트</span></div><label class="form-label" for="profile-input">이름</label><input class="field" id="profile-input" maxlength="20" value="${esc(state.name)}"><p>음악 기록에 표시할 이름을 정해 주세요.</p>`,'<button class="button dark" data-action="save-profile">저장하기</button>');}
  else if(action==='save-profile'){const name=document.getElementById('profile-input').value.trim();if(!name){toast('이름을 입력해 주세요.');return;}if(commit(s=>{s.name=name;})){modal.close();render();toast('이름을 저장했어요.');}}
  else if(action==='reset'){showModal('처음의 예시로 돌아갈까요?','<p>이 브라우저에서 만든 코멘트와 별점, 친구 목록을 처음의 예시 데이터로 초기화합니다.</p>','<button class="button outline" data-action="close">취소</button><button class="button danger" data-action="confirm-reset">초기화</button>');}
  else if(action==='confirm-reset'){try{const fresh=defaults();localStorage.setItem(STORAGE_KEY,JSON.stringify(fresh));state=fresh;aiResults=null;modal.close();selectedLine=-1;friendFilter='all';query='';render();toast('처음의 예시 데이터로 돌아왔어요.');}catch(error){toast('초기화하지 못했어요. 저장 설정을 확인해 주세요.');}}
});
document.addEventListener('input',event=>{const {id,value}=event.target;if(id==='add-search')filterAdd(value);else if(id==='friend-search')filterFriends(value);else if(id==='record-search'){query=value;filterRecords();}else if(id==='comment-text')document.getElementById('comment-length').textContent=`${value.length} / 500`;});
document.addEventListener('submit',event=>{if(event.target.id!=='comment-form')return;event.preventDefault();const text=document.getElementById('comment-text').value.trim();if(!text){toast('코멘트를 입력해 주세요.');return;}const visibility=document.getElementById('comment-visibility').value;if(commit(s=>{s.notes.unshift({id:crypto.randomUUID(),song:currentSong,line:selectedLine,text,visibility,date:now()});if(!s.library.includes(currentSong))addToLibrary(s,currentSong);})){detail(currentSong);toast(visibility==='friends'?'친구에게 공개하는 코멘트를 저장했어요.':'나만 보는 코멘트를 저장했어요.');}});
modal.addEventListener('click',event=>{if(event.target!==modal)return;const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();});
window.addEventListener('hashchange',()=>{selectedLine=-1;render();window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){state=loadState();render();}});
render();hydrateLyrics();if(storageWarning)setTimeout(()=>toast(storageWarning),500);
