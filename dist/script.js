'use strict';

icons.star='<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8l-6.2 3.2L7 14.2 2 9.3l6.9-1Z"/>';
const STORAGE_KEY='sidenote-demo-v1';
const main=document.getElementById('main');
const modal=document.getElementById('modal');
const findSong=id=>songs.find(s=>s.id===id);
const albumOf=s=>albums[s.album];
const findPerson=id=>people.find(p=>p.id===id);
const now=()=>new Date().toISOString();
const dateLabel=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':`${d.getMonth()+1}월 ${d.getDate()}일`;};
let storageWarning='';
function defaults(){return {version:1,name:'음악 산책자',notes:[
  {id:'seed-note-1',song:'blue-hour',line:6,text:'모두에게 같은 속도가 필요한 건 아니니까. 오늘은 나의 속도를 조금 믿어 보기로.',visibility:'friends',date:'2026-10-01T20:40:00'},
  {id:'seed-note-2',song:'slow-sunday',line:7,text:'함께 아침을 먹었던 그 일요일이 생각난다. 소소한 순간이 가장 오래 남는 것 같아.',visibility:'private',date:'2026-09-30T10:00:00'}
],library:['blue-hour','slow-sunday','detour'],added:{'blue-hour':'2026-10-02T10:00:00','slow-sunday':'2026-10-01T10:00:00','detour':'2026-09-30T10:00:00'},ratings:{'blue-hour':5,'slow-sunday':4,'detour':3},saved:['blue-hour','slow-sunday'],friends:['hana','jiu'],outgoing:[],incoming:['min'],likes:[],mood:'잔잔한',seed:'blue-hour'};}
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw){const first=defaults();localStorage.setItem(STORAGE_KEY,JSON.stringify(first));return first;}
    const parsed=JSON.parse(raw);if(!parsed||parsed.version!==1)throw new Error('invalid');
    const base=defaults();const result={...base,...parsed};
    result.name=typeof result.name==='string'?result.name.slice(0,20):base.name;
    result.notes=Array.isArray(result.notes)?result.notes.filter(n=>n&&typeof n.id==='string'&&typeof n.text==='string'&&findSong(n.song)&&Number.isInteger(n.line)&&n.line>=0&&n.line<findSong(n.song).lines.length&&['friends','private'].includes(n.visibility)).map(n=>({...n,id:n.id.replace(/[^a-zA-Z0-9_-]/g,''),text:n.text.slice(0,500)})):[];
    for(const key of ['library','saved'])result[key]=Array.isArray(result[key])?[...new Set(result[key].filter(id=>findSong(id)))]:[];
    for(const key of ['friends','incoming','outgoing'])result[key]=Array.isArray(result[key])?[...new Set(result[key].filter(id=>findPerson(id)))]:[];
    result.likes=Array.isArray(result.likes)?result.likes.filter(id=>feed.some(n=>n.id===id)):[];
    result.ratings=result.ratings&&typeof result.ratings==='object'?Object.fromEntries(Object.entries(result.ratings).filter(([id,r])=>findSong(id)&&Number.isInteger(r)&&r>=1&&r<=5)):{};
    result.added=result.added&&typeof result.added==='object'?result.added:{};
    result.notes.forEach(n=>{if(!result.library.includes(n.song))result.library.push(n.song);});
    result.mood=['잔잔한','따뜻한','설렘','그리움'].includes(result.mood)?result.mood:'잔잔한';
    result.seed=findSong(result.seed)?result.seed:'blue-hour';return result;
  }catch(error){storageWarning='저장 데이터를 읽지 못했어요. 브라우저의 저장 설정을 확인해 주세요.';return defaults();}
}
let state=loadState();
let page='home',viewAll=false,recordTab='notes',query='',genre='전체',friendFilter='all',selectedLine=-1,currentSong='blue-hour',toastTimer,aiTimer,aiResults=null;
function toast(message){const t=document.getElementById('toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),3200);}
function commit(mutator){const next=JSON.parse(JSON.stringify(state));mutator(next);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));state=next;storageWarning='';return true;}catch(error){toast('저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.');return false;}}
function addToLibrary(s,id){if(!s.library.includes(id))s.library.unshift(id);s.added[id]=now();}
const avatar=(p,mine=false)=>`<span class="avatar ${mine?'mine':p.color}">${mine?'나':esc(p.initial)}</span>`;
const empty=(title,text,action='')=>`<div class="empty">${icon('headphones')}<h3>${title}</h3><p>${text}</p>${action}</div>`;
const heading=(tag,title,description,extra='')=>`<div class="page-heading"><div><div class="eyebrow">${tag}</div><h1>${title}</h1><p>${description}</p></div>${extra}</div>`;
const miniStats=()=>`<div class="count-banner"><div><strong>${state.library.length}</strong>기록한 음악</div><span class="divider"></span><div><strong>${state.notes.length}</strong>남긴 코멘트</div></div>`;
function nav(){
  const entries=[['home','explore','홈'],['friends','friends','친구'],['ai','spark','AI 추천'],['records','note','나의 기록']];
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
  const tracks=(viewAll?songs:state.library.map(findSong).filter(Boolean)).slice(0,viewAll?8:5);
  main.innerHTML=heading('YOUR THOUGHTS BETWEEN THE LYRICS','음악을 다시 듣고,<br>새롭게 남기는 이야기.','좋아하는 구절에 머물고, 당신의 해석을 남겨 보세요.',miniStats())+
    `<section><div class="home-toolbar"><h2>${viewAll?'모든 음악':'최근에 추가한 음악'}</h2><div class="toolbar-actions"><button class="text-button" data-action="view-all">${viewAll?'최근 기록 보기':'전체 목록 보기'}</button><button class="button dark" data-action="add">${icon('plus')} 추가</button></div></div><div class="song-grid home-grid">${tracks.map(s=>card(s)).join('')}<button class="add-card" data-action="add"><span class="add-circle">${icon('plus')}</span><strong>새로운 음악 기록</strong><small>기억하고 싶은 곡을 추가해 보세요</small></button></div></section><div class="home-bottom"><div><p>오늘의 마음에 어울리는 음악이 궁금한가요?</p><small>당신의 기록을 바탕으로 새로운 곡을 발견해 보세요.</small></div><a href="#ai" class="button">${icon('spark')} AI 추천받기</a></div>`;
}
function showModal(title,body,buttons=''){
  document.getElementById('modal-content').innerHTML=`<div class="modal-heading"><h2 id="modal-title">${title}</h2><button class="close-button" data-action="close" aria-label="닫기">${icon('close')}</button></div><div class="modal-body">${body}</div>${buttons?`<div class="modal-buttons">${buttons}</div>`:''}`;
  if(!modal.open)modal.showModal();
}
function addModal(){showModal('기록을 추가할 음악 선택',`<div class="search-box add-search">${icon('search')}<input type="search" id="add-search" aria-label="음악 검색" placeholder="곡 제목, 아티스트, 기억나는 가사 검색"></div><div id="add-results" class="add-results"></div><p class="inline-warning">가상 곡 8곡이 준비되어 있어요. 선택하면 가사와 기록 화면이 열립니다.</p>`);filterAdd('');document.getElementById('add-search').focus();}
function filterAdd(value){
  const q=value.trim().toLocaleLowerCase();const found=songs.filter(s=>[s.title,albumOf(s).artist,...s.lines].join(' ').toLocaleLowerCase().includes(q));
  document.getElementById('add-results').innerHTML=found.length?found.map(s=>`<button class="add-result" data-action="select-song" data-id="${s.id}"><img src="${albumOf(s).image}" alt=""><span><strong>${s.title}</strong><small>${albumOf(s).artist} · ${s.genre}</small></span>${state.library.includes(s.id)?'<span class="pill">기록 중</span>':icon('plus')}</button>`).join(''):empty('검색 결과가 없어요','유월, 모브, OFFDAY 또는 곡 제목으로 찾아보세요.');
}
const critics=[
  {name:'서윤',initial:'서',color:'blue',role:'음악 에디터 · 예시',quote:'소리보다 여백이 더 많은 이야기를 전하는 음악.',body:['이 노래의 중심에는 큰 사건이 아니라 작고 평범한 감정이 놓여 있다. 반복되는 일상에 천천히 귀를 기울이면서, 지나치기 쉬운 순간들을 다시 바라보게 한다.','가사가 흥미로운 이유는 정답을 말하기보다 해석할 자리를 남기기 때문이다. 듣는 사람이 자신의 기억을 가져와 빈칸을 채울 수 있도록 문장은 단정하고 열려 있다.','자신의 속도를 잃기 쉬운 날, 이 음악은 잠시 멈추어도 괜찮다고 말한다. 한 번의 강렬한 인상보다 여러 번 꺼내 듣는 다정함에 가까운 곡이다.']},
  {name:'도현',initial:'도',color:'purple',role:'음악 에디터 · 예시',quote:'평범한 하루가 한 편의 장면이 되는 순간.',body:['익숙한 풍경을 새롭게 만드는 것은 거창한 이야기가 아니라 시선의 변화다. 이 곡은 특별하지 않은 하루에서 오래 남을 장면을 발견한다.','짧은 문장들이 서로의 의미를 확장한다. 창문, 불빛, 바람 같은 이미지들은 배경으로 머무르지 않고 듣는 사람의 기억과 만나며 새로운 이야기를 만든다.','이 작품을 읽는 가장 좋은 방법은 마음에 남는 한 줄을 고르는 일이다. 같은 구절도 오늘과 내일에는 전혀 다른 의미로 다가올 수 있다.']},
  {name:'은재',initial:'은',color:'pink',role:'음악 에디터 · 예시',quote:'과장하지 않는 문장들이 남기는 오래가는 온기.',body:['감정을 크게 외치기보다 조용히 건네는 방식이 인상적이다. 직접적인 설명을 줄인 문장들은 그만큼 듣는 사람의 감정이 들어설 공간을 만든다.','이 음악이 전하는 위로는 모든 문제가 해결된다는 약속이 아니다. 서로의 곁에 잠시 머무를 수 있다는 작고 구체적인 제안이다.','가사의 끝에서 남는 것은 특정한 결론보다 태도다. 지나간 시간을 다정하게 바라보고, 아직 오지 않은 하루에는 조금의 가능성을 남겨 두는 태도다.']}
];
function noteHtml(note,mine=true){const p=mine?null:findPerson(note.person);return `<div class="inline-note"><div class="note-person">${avatar(p,mine)}<strong>${mine?esc(state.name):p.name}</strong>${mine?`<span class="pill">${note.visibility==='private'?'나만 보기':'친구 공개'}</span>`:''}<time>${dateLabel(note.date)}</time></div><p>${esc(note.text)}</p>${mine?`<div class="note-actions"><button data-action="edit-note" data-id="${esc(note.id)}">수정</button><button data-action="delete-note" data-id="${esc(note.id)}">삭제</button></div>`:''}</div>`;}
function lineNotes(song,line){return state.notes.filter(n=>n.song===song.id&&n.line===line).map(n=>noteHtml(n)).join('')+feed.filter(n=>n.song===song.id&&n.line===line&&state.friends.includes(n.person)).map(n=>noteHtml(n,false)).join('');}
function detail(id){
  const s=findSong(id);if(!s){main.innerHTML=empty('이 곡을 찾을 수 없어요','홈에서 다른 곡을 골라 주세요.','<a class="button dark" href="#home">홈으로</a>');return;}
  currentSong=id;const a=albumOf(s);
  main.innerHTML=`<a class="back-button" href="#home">${icon('back')} 돌아가기</a><div class="song-hero"><img src="${a.image}" alt="${a.title} 앨범 아트"><div><div class="eyebrow">${a.title.toUpperCase()}</div><h1>${s.title}</h1><p class="song-meta">${a.artist} · ${s.genre} · ${a.year}</p><div class="rating-control" aria-label="내 별점 선택">${Array.from({length:5},(_,i)=>`<button class="${i<(state.ratings[id]||0)?'filled':''}" data-action="rate" data-value="${i+1}" aria-label="별점 ${i+1}점" aria-pressed="${state.ratings[id]===i+1}">${icon('star')}</button>`).join('')}<span class="rating-label">${state.ratings[id]?`나의 별점 ${state.ratings[id]}.0`:'별점을 남겨 주세요'}</span></div></div>${bookmark(id,true)}</div>
  <div class="detail-layout reverse-detail"><section class="panel lyrics-panel"><div class="panel-header"><h2>가사와 나의 코멘트</h2><span>${state.notes.filter(n=>n.song===id).length}개의 기록</span></div><div class="lyric-hint">${icon('note')} 마음에 남는 가사를 누르면 바로 아래에 코멘트를 남길 수 있어요.</div><ol class="lyric-list">${s.lines.map((line,i)=>`<li class="line-wrapper" id="line-${i}"><button class="lyric-line ${selectedLine===i?'selected':''}" data-action="line" data-value="${i}" aria-pressed="${selectedLine===i}"><span class="line-number">${String(i+1).padStart(2,'0')}</span><span>${line}</span>${state.notes.some(n=>n.song===id&&n.line===i)?icon('comment'):''}</button><div class="inline-notes">${lineNotes(s,i)}</div>${selectedLine===i?editor():''}</li>`).join('')}</ol><p class="lyrics-source">RE:VERSE 데모 창작 가사 · 가상 곡/아티스트 · 작성한 기록은 이 브라우저에 저장됩니다.</p><button class="button dark record-button" data-action="record">${icon('plus')} 기록 추가</button></section>
  <aside class="panel critics-panel"><div class="panel-header"><h2>짧은 한줄평</h2><span>CRITICS' NOTES</span></div>${critics.map((c,i)=>`<article class="critic-item"><div class="critic-person">${avatar(c)}<div><strong>${c.name}</strong><small>${c.role}</small></div></div><blockquote>“${c.quote}”</blockquote><button data-action="critic" data-value="${i}">평론 전체 읽기</button></article>`).join('')}<p class="critic-disclaimer">화면 시연을 위해 작성한 예시 평론입니다.</p></aside></div>`;
}
function editor(){return `<form id="comment-form" class="inline-editor"><label class="form-label" for="comment-text">이 구절은 어떻게 들렸나요?</label><textarea class="textarea" id="comment-text" maxlength="500" required placeholder="당신의 감상이나 떠오른 기억을 남겨 보세요."></textarea><div class="form-meta"><span>한 줄의 가사, 하나의 새로운 이야기.</span><span id="comment-length">0 / 500</span></div><div class="form-bottom"><select class="select" id="comment-visibility" aria-label="코멘트 공개 범위"><option value="friends">친구에게 공개</option><option value="private">나만 보기</option></select><button class="button dark" type="submit">코멘트 저장</button></div></form>`;}
function openLine(line){
  const existing=document.getElementById('comment-text');const draft=existing?.value||'';const visibility=document.getElementById('comment-visibility')?.value||'friends';
  selectedLine=line;detail(currentSong);document.getElementById('comment-text').value=draft;document.getElementById('comment-visibility').value=visibility;document.getElementById('comment-length').textContent=`${draft.length} / 500`;
  document.getElementById('comment-text').focus({preventScroll:true});document.getElementById('comment-form').scrollIntoView({block:'nearest',behavior:'smooth'});
}
function ownNoteCard(n){const s=findSong(n.song);const a=albumOf(s);return `<article class="saved-note"><div class="saved-note-top"><a href="#song/${s.id}"><img src="${a.image}" alt="${a.title} 앨범 아트"></a><div><a href="#song/${s.id}"><h3>${s.title}</h3></a><small>${a.artist}</small></div><span class="pill">${n.visibility==='private'?'나만 보기':'친구 공개'}</span></div><blockquote>${s.lines[n.line]}</blockquote><p>${esc(n.text)}</p><div class="saved-note-bottom"><time>${dateLabel(n.date)}</time><div class="note-actions"><button data-action="edit-note" data-id="${esc(n.id)}">수정</button><button data-action="delete-note" data-id="${esc(n.id)}">삭제</button></div></div></article>`;}
function records(){
  main.innerHTML=heading('MY LITTLE ARCHIVE','나의 기록','다시 꺼내 보고 싶은 음악과, 그때의 마음을 모았어요.',miniStats())+`<div class="record-tabs" aria-label="기록 종류">${[['notes','코멘트',state.notes.length],['songs','기록한 음악',state.library.length],['saved','저장한 곡',state.saved.length]].map(([id,title,count])=>`<button class="record-tab ${recordTab===id?'active':''}" data-action="record-tab" data-value="${id}" aria-pressed="${recordTab===id}">${title} <span class="quiet-label">${count}</span></button>`).join('')}</div><div class="search-box record-search">${icon('search')}<input type="search" id="record-search" aria-label="나의 기록 검색" placeholder="곡 제목 또는 코멘트로 검색" value="${esc(query)}"></div><div id="record-results"></div>`;filterRecords();
}
function filterRecords(){const q=query.trim().toLocaleLowerCase();let html='';
  if(recordTab==='notes'){const results=state.notes.filter(n=>[findSong(n.song).title,albumOf(findSong(n.song)).artist,n.text].join(' ').toLocaleLowerCase().includes(q));html=results.length?`<div class="notes-grid">${results.map(ownNoteCard).join('')}</div>`:empty(q?'찾는 코멘트가 없어요':'아직 코멘트가 없어요',q?'다른 단어로 검색해 보세요.':'가사의 한 구절을 선택하고 첫 기록을 남겨 보세요.','<button class="button outline" data-action="add">음악 선택하기</button>');}
  else{const ids=recordTab==='saved'?state.saved:state.library;const results=ids.map(findSong).filter(s=>[s.title,albumOf(s).artist].join(' ').toLocaleLowerCase().includes(q));html=results.length?`<div class="song-grid home-grid">${results.map(s=>card(s)).join('')}</div>`:empty('아직 담아 둔 곡이 없어요','기억하고 싶은 음악을 추가하거나 저장해 보세요.','<button class="button outline" data-action="add">음악 선택하기</button>');}
  document.getElementById('record-results').innerHTML=html;
}
function likeButton(n){const liked=state.likes.includes(n.id);return `<button data-action="like" data-id="${n.id}" class="${liked?'liked':''}" aria-label="${liked?'공감 취소':'공감하기'}" aria-pressed="${liked}">${icon('heart')} ${n.likes+(liked?1:0)}</button>`;}
function feedCard(n,mine=false){const p=mine?null:findPerson(n.person);const s=findSong(n.song);return `<article class="feed-card"><div class="note-person">${avatar(p,mine)}<strong>${mine?esc(state.name):p.name}</strong><time>${dateLabel(n.date)}</time></div><blockquote>${s.lines[n.line]}</blockquote><p>${esc(n.text)}</p><div class="feed-song"><a href="#song/${s.id}"><img src="${albumOf(s).image}" alt=""></a><a href="#song/${s.id}">${s.title}<small>${albumOf(s).artist}</small></a>${mine?'':`<div class="note-actions">${likeButton(n)}</div>`}</div></article>`;}
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
function recommendations(){
  const seed=findSong(state.seed);const likedTags=new Set(seed.tags);
  const noteText=state.notes.map(n=>n.text).join(' ');
  const ranked=songs.filter(s=>s.id!==seed.id).map(s=>({song:s,score:(s.tags.includes(state.mood)?8:0)+s.tags.filter(t=>likedTags.has(t)).length*2+(s.genre===seed.genre?2:0)+s.tags.filter(t=>noteText.includes(t)).length*3})).sort((a,b)=>b.score-a.score);
  return ranked.slice(0,3).map(({song})=>({id:song.id,reason:song.tags.includes(state.mood)?`‘${state.mood}’ 분위기의 가사와 ${albumOf(song).artist}의 이야기를 만나 보세요.`:`${seed.title}과 이어지는 ${song.tags[0]} 감정을 담은 곡이에요.`}));
}
function ai(){
  main.innerHTML=heading('ANOTHER VERSE, JUST FOR YOU','당신의 취향에 이어지는 음악.','좋아하는 곡과 지금의 분위기로, 다음에 들을 음악을 찾아보세요.')+
  `<section class="ranked-commentators"><h2>함께 듣는 친구들</h2>${state.friends.slice(0,3).map((id,i)=>{const p=findPerson(id);return `<div class="ranked-person"><span>${String(i+1).padStart(2,'0')}</span>${avatar(p)}<div><strong>${p.name}</strong><small>${feed.filter(n=>n.person===id).length}개의 음악 이야기</small></div></div>`;}).join('')||'<p class="small-muted">친구를 추가하면 함께 듣는 친구가 표시돼요.</p>'}</section>
  <section class="recommend-top"><div><span class="ai-label">${icon('spark')} AI RECOMMENDATION</span><h2>지금의 마음에<br>어떤 음악이 어울릴까요?</h2><p>좋아하는 곡과 코멘트, 선택한 분위기를 참고해<br>음악과 아티스트를 함께 추천해 드려요.</p></div><div><label class="form-label" for="ai-seed">이 곡을 좋아해요</label><select class="field" id="ai-seed">${songs.map(s=>`<option value="${s.id}" ${state.seed===s.id?'selected':''}>${s.title} · ${albumOf(s).artist}</option>`).join('')}</select><div class="mood-options" aria-label="지금의 분위기">${['잔잔한','따뜻한','설렘','그리움'].map(m=>`<button class="chip ${state.mood===m?'active':''}" data-action="mood" data-value="${m}" aria-pressed="${state.mood===m}">${m}</button>`).join('')}</div><button class="button dark block" id="recommend-button" data-action="recommend">${icon('spark')} 음악 추천받기</button></div></section>
  <div id="ai-results">${aiResults?recommendResults():empty('새로운 음악을 발견할 준비가 됐나요?','곡과 분위기를 선택한 뒤 추천받기를 눌러 보세요.')}</div><p class="inline-warning">AI 분석 화면을 체험하는 프로토타입입니다. 실제 AI API 호출 대신 예시 곡에서 추천을 생성해요.</p>`;
}
function recommendResults(){
  const recommended=aiResults.map(r=>({song:findSong(r.id),reason:r.reason}));
  const artistSongs=[...recommended.map(r=>r.song),...songs.filter(s=>s.id!==state.seed)];
  const artistIds=[...new Set(artistSongs.map(s=>s.album))];
  return `<div class="ai-result-columns"><section><h2>당신을 위한 노래 추천</h2>${recommended.map(({song:s,reason},i)=>`<a class="recommend-list-item" href="#song/${s.id}"><span>${String(i+1).padStart(2,'0')}</span><img src="${albumOf(s).image}" alt="${albumOf(s).title} 앨범 아트"><div><strong>${s.title}</strong><small> · ${albumOf(s).artist}</small><p>${esc(reason)}</p></div>${icon('chevron')}</a>`).join('')}</section><section><h2>새롭게 만나 볼 아티스트</h2>${artistIds.map((id,i)=>{const a=albums[id];const song=songs.find(s=>s.album===id);return `<a class="recommend-list-item" href="#song/${song.id}"><span>${String(i+1).padStart(2,'0')}</span><img src="${a.image}" alt="${a.title} 앨범 아트"><div><strong>${a.artist}</strong><p>${id==='blue'?'밤과 기억을 잔잔한 문장으로 풀어내는 인디 팝.':id==='sunday'?'평범한 일상에 따뜻한 시선을 건네는 포크 음악.':'도시의 설렘과 불빛을 담아내는 R&B와 신스 팝.'}</p></div>${icon('chevron')}</a>`;}).join('')}</section></div>`;
}
function render(){
  clearTimeout(aiTimer);const [route,id]=location.hash.slice(1).split('/');page=['friends','ai','records'].includes(route)?route:'home';nav();
  if(route==='song')detail(id);else if(page==='friends')friends();else if(page==='ai')ai();else if(page==='records')records();else home();
}
function bookmarkToggle(id){if(!findSong(id))return;const saved=state.saved.includes(id);if(!commit(s=>{s.saved=saved?s.saved.filter(v=>v!==id):[...s.saved,id];}))return;document.querySelectorAll(`[data-action="bookmark"][data-id="${id}"]`).forEach(b=>{b.classList.toggle('saved',!saved);b.setAttribute('aria-pressed',String(!saved));b.setAttribute('aria-label',saved?'곡 저장':'저장 취소');const label=b.querySelector('span');if(label)label.textContent=saved?'곡 저장':'저장한 곡';});if(page==='records'&&recordTab==='saved')records();toast(saved?'저장한 곡에서 뺐어요.':'나의 기록의 ‘저장한 곡’에 담았어요.');}
function editNote(id){const n=state.notes.find(n=>n.id===id);if(!n)return;showModal('코멘트 수정',`<blockquote class="selected-quote">${findSong(n.song).lines[n.line]}</blockquote><label class="form-label" for="edit-text">나의 코멘트</label><textarea class="textarea" id="edit-text" maxlength="500">${esc(n.text)}</textarea><div class="form-bottom"><select class="select" id="edit-visibility" aria-label="공개 범위"><option value="friends" ${n.visibility==='friends'?'selected':''}>친구에게 공개</option><option value="private" ${n.visibility==='private'?'selected':''}>나만 보기</option></select></div>`,`<button class="button outline" data-action="close">취소</button><button class="button dark" data-action="save-edit" data-id="${esc(id)}">저장하기</button>`);}
function about(){showModal('RE:VERSE 프로토타입',`<p>화이트보드에 그린 음악 기록 서비스의 흐름을 직접 체험할 수 있도록 만들었어요.</p><ul><li>가상 곡 8곡, 창작 가사와 예시 평론이 준비돼 있어요.</li><li>별점, 코멘트, 음악 기록과 친구 목록은 이 브라우저에 저장돼요.</li><li>친구 공유와 AI 추천은 실제 서비스 연결 없이 시연합니다.</li></ul>${storageWarning?`<p>${esc(storageWarning)}</p>`:''}`,'<button class="button outline" data-action="reset">데모 초기화</button><button class="button dark" data-action="close">확인</button>');}
document.addEventListener('click',event=>{
  const b=event.target.closest('[data-action]');if(!b)return;const {action,id,value}=b.dataset;
  if(action==='close'){modal.close();if(page==='friends')friends();}
  else if(action==='add')addModal();
  else if(action==='about')about();
  else if(action==='view-all'){viewAll=!viewAll;home();}
  else if(action==='bookmark')bookmarkToggle(id);
  else if(action==='select-song'){if(!findSong(id))return;if(commit(s=>addToLibrary(s,id))){modal.close();selectedLine=-1;if(location.hash===`#song/${id}`)detail(id);else location.hash=`song/${id}`;toast('음악 기록에 추가했어요. 마음에 남는 가사를 골라 보세요.');}}
  else if(action==='rate'){const rating=Number(value);if(!Number.isInteger(rating)||rating<1||rating>5)return;if(commit(s=>{s.ratings[currentSong]=rating;if(!s.library.includes(currentSong))addToLibrary(s,currentSong);})){document.querySelectorAll('[data-action="rate"]').forEach((button,i)=>{button.classList.toggle('filled',i<rating);button.setAttribute('aria-pressed',String(i+1===rating));});document.querySelector('.rating-label').textContent=`나의 별점 ${rating}.0`;toast(`${rating}점으로 기록했어요.`);}}
  else if(action==='line')openLine(Number(value));
  else if(action==='record')openLine(selectedLine>=0?selectedLine:0);
  else if(action==='critic'){const c=critics[Number(value)];if(c)showModal(c.name+'의 평론',`<div class="eyebrow">${findSong(currentSong).title} · 예시 평론</div><h3>${c.quote}</h3><div class="article-body">${c.body.map(p=>`<p>${p}</p>`).join('')}</div><p class="quiet-label">RE:VERSE 프로토타입을 위한 창작 평론 · ${c.name}은 가상 에디터입니다.</p>`,'<button class="button dark" data-action="close">닫기</button>');}
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
  else if(action==='mood'){if(commit(s=>{s.mood=value;})){document.querySelectorAll('[data-action="mood"]').forEach(button=>{const active=button.dataset.value===value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});}}
  else if(action==='recommend'){const seed=document.getElementById('ai-seed').value;if(!commit(s=>{s.seed=seed;}))return;b.disabled=true;b.innerHTML=icon('spark')+' 취향을 살펴보는 중…';document.getElementById('ai-results').innerHTML=`<div class="loading" role="status">${icon('spark')}<strong>당신의 음악 기록을 읽고 있어요.</strong><p>가사의 분위기와 코멘트를 살펴보는 중…</p></div>`;aiTimer=setTimeout(()=>{aiResults=recommendations();const target=document.getElementById('ai-results');if(!target)return;target.innerHTML=recommendResults();b.disabled=false;b.innerHTML=icon('spark')+' 다시 추천받기';toast('새로운 음악과 아티스트를 추천했어요.');},1000);}
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
render();if(storageWarning)setTimeout(()=>toast(storageWarning),500);
