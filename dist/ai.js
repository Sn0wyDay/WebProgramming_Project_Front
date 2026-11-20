'use strict';
/* ==========================================================================
 * RE:VERSE — AI 리포트 페이지 (ai.js / ai.css) · 메뉴 이름 "AI 리포트", 주소는 #ai
 *
 * - 이 파일은 script.js보다 "먼저" 로드됩니다(index.html 참고).
 *   data.js(songs, albums, icon, esc)와 script.js(state, commit, findSong,
 *   albumOf, bookmark, toast, main …)의 값은 함수가 "호출될 때"만
 *   사용하므로 로드 순서와 관계없이 동작합니다.
 * - script.js의 render()가 #ai 화면에서 ai()를 호출합니다.
 * - 이 파일의 이름은 모두 ai / AI_ 로 시작해 다른 파트와 겹치지 않게 했습니다.
 *
 * 화면 구성 (스크롤하면 한 장씩 흐릿하게 떠오름)
 *   01 내가 별점을 가장 높게 준 곡 TOP 5 (+ 아티스트)
 *   02 코멘트(평론)를 가장 많이 남긴 아티스트 TOP 3
 *   03 별점·코멘트·기록을 종합한 추천 (노래 3 / 아티스트 3)
 *   04 선택한 곡과 비슷한 음악 추천 (노래 3 / 아티스트 3)
 *   추천된 곡·아티스트를 누르면 페이지 이동 없이 오른쪽 패널(모바일은 아래)에서 열립니다.
 *
 * 외부 데이터 연결은 고정입니다(설정 화면 없음, API 키 필요 없음).
 *   음악 정보: MusicBrainz — https://github.com/metabrainz/musicbrainz-server
 *   가사:      LRCLIB      — https://github.com/tranxuanthang/lrclib
 * 03·04장의 추천(노래·아티스트)은 모두 MusicBrainz에서 찾고, 가사는 LRCLIB에서 불러옵니다.
 * 추천된 곡은 script.js의 registerExt()로 앱의 곡 목록에 등록되어 별점·코멘트·저장을 그대로 쓸 수 있어요.
 * ========================================================================== */

const AI_SOURCES={
  music:{name:'MusicBrainz',api:'https://musicbrainz.org/ws/2',site:'https://musicbrainz.org',repo:'https://github.com/metabrainz/musicbrainz-server'},
  lyrics:{name:'LRCLIB',api:'https://lrclib.net/api',site:'https://lrclib.net',repo:'https://github.com/tranxuanthang/lrclib'}
};
// 앱의 장르·분위기를 MusicBrainz 태그로 바꿔 검색해요.
const AI_GENRE_TAGS={'인디 팝':'indie pop','인디 록':'indie rock','R&B':'r&b','팝':'pop','힙합':'hip hop','재즈':'jazz','포크':'folk','일렉트로닉':'electronic','신스 팝':'synthpop'};
// 04 '비슷한 음악'에서 고를 수 있는 장르
const AI_PICK_GENRES=['인디 팝','인디 록','R&B','팝','힙합','재즈','포크','일렉트로닉'];
// 취향 태그의 '스타일' 줄에 쓰는 말 (장르·감정 → 어떤 스타일의 노래인지)
const AI_STYLE_BY_GENRE={'인디 팝':'감성적인 보컬','인디 록':'강렬한 밴드 사운드','R&B':'그루브 있는 리듬','팝':'중독성 있는 멜로디','힙합':'리듬감 있는 랩','재즈':'여유로운 재즈 화성','포크':'담백한 어쿠스틱','일렉트로닉':'몽환적인 신스 사운드','신스 팝':'반짝이는 신스 팝'};
const AI_STYLE_BY_MOOD={'잔잔한':'잔잔하게 흐르는 곡','따뜻한':'따뜻한 가사','설렘':'설레는 사랑 노래','그리움':'새벽 감성 이별 노래','밤':'밤에 듣기 좋은 곡','위로':'위로가 되는 가사'};
const AI_MOOD_TAGS={'잔잔한':'mellow','따뜻한':'acoustic','설렘':'romantic','그리움':'melancholic'};
const AI_MBID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// 예전 버전에서 저장한 AI API 키가 남아 있으면 지워요.
try{localStorage.removeItem('reverse-ai-config-v1');}catch(error){}
const AI_CHAPTERS=[['ai-top','나의 TOP 5'],['ai-talked','많이 이야기한 아티스트'],['ai-overall','종합 추천'],['ai-similar','비슷한 음악']];

const aiView={
  overall:null,overallStatus:'idle',overallKey:'',overallRun:0,
  similar:null,similarStatus:'idle',similarRun:0,
  observer:null,chapter:0,sheetStack:[],sheetReturn:null,mbArtists:{}
};

/* ---------- 작은 도우미 ---------- */
const aiPad=n=>String(n).padStart(2,'0');
const aiSongsOf=albumId=>songs.filter(s=>s.album===albumId);
const aiWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const aiProfileKey=()=>JSON.stringify([state.ratings,state.notes.map(n=>[n.song,n.text]),state.library,state.saved]);
const aiStars=(rating,size='')=>`<span class="star-row ai-stars ${size}" aria-label="별점 ${rating}점">${stars(rating)}</span>`;

/* ---------- 내 기록 분석 ---------- */
function aiProfile(){
  const notesBy={};state.notes.forEach(n=>{notesBy[n.song]=(notesBy[n.song]||0)+1;});
  const tagW={},genreW={},artistW={};
  const ids=[...new Set([...state.library,...state.saved,...Object.keys(state.ratings)])];
  ids.forEach(id=>{
    const s=findSong(id);if(!s)return;const r=state.ratings[id];
    // 별점이 높을수록, 코멘트가 많을수록, 저장했을수록 취향 가중치가 커져요.
    const w=(r?r-2:1)+(notesBy[id]||0)*1.5+(state.saved.includes(id)?1:0);
    s.tags.forEach(t=>{tagW[t]=(tagW[t]||0)+w;});
    genreW[s.genre]=(genreW[s.genre]||0)+w;artistW[s.album]=(artistW[s.album]||0)+w;
  });
  const topTags=Object.entries(tagW).filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([t])=>t);
  return {notesBy,tagW,genreW,artistW,topTags,noteText:state.notes.map(n=>n.text).join(' ')};
}
function aiTopRated(){
  return Object.entries(state.ratings).map(([id,rating])=>({song:findSong(id),rating})).filter(x=>x.song)
    .sort((a,b)=>b.rating-a.rating||String(state.added[b.song.id]||'').localeCompare(String(state.added[a.song.id]||''))).slice(0,5);
}
function aiArtistStats(){
  return Object.keys(albums).map(id=>{
    const list=aiSongsOf(id);const rated=list.map(s=>state.ratings[s.id]).filter(Boolean);
    const notes=state.notes.filter(n=>findSong(n.song)?.album===id);
    return {id,album:albums[id],notes:notes.length,latest:notes[0]||null,avg:rated.length?rated.reduce((a,b)=>a+b,0)/rated.length:0,rated:rated.length,inLibrary:list.filter(s=>state.library.includes(s.id)).length,total:list.length};
  }).sort((a,b)=>b.notes-a.notes||b.avg-a.avg||b.inLibrary-a.inLibrary);
}
/* ---------- 외부 음악 데이터 (고정 연결: MusicBrainz + LRCLIB) ----------
 * 두 서비스 모두 공개 API라 키 없이 브라우저에서 바로 호출합니다.
 * MusicBrainz는 1초에 1번만 요청하도록 권장하므로 요청 사이에 간격을 둬요. */
let aiMbNext=0;
async function aiMusicBrainz(path,signal,retry=2){
  const at=Math.max(Date.now(),aiMbNext);aiMbNext=at+1100;
  if(at>Date.now())await aiWait(at-Date.now());
  const response=await fetch(`${AI_SOURCES.music.api}/${path}&fmt=json`,{signal,headers:{accept:'application/json'}});
  // 요청이 몰려 503/429가 오면 잠시 쉬었다가 다시 시도해요.
  if((response.status===503||response.status===429)&&retry>0){aiMbNext=Math.max(aiMbNext,Date.now()+2000);return aiMusicBrainz(path,signal,retry-1);}
  if(!response.ok){const failure=new Error('http-'+response.status);failure.status=response.status;failure.source=AI_SOURCES.music.name;throw failure;}
  return response.json();
}
async function aiFindRecordings(query,signal){
  const data=await aiMusicBrainz(`recording?query=${encodeURIComponent(query+' AND video:false')}&limit=40`,signal);
  return (data.recordings||[]).map(r=>{
    const rel=(r.releases||[]).find(x=>x.status==='Official')||(r.releases||[])[0];const credit=r['artist-credit']||[];
    return {mbid:r.id,title:r.title||'',artist:credit.map(c=>(c.name||'')+(c.joinphrase||'')).join('').trim(),
      artistMbid:AI_MBID.test(credit[0]?.artist?.id||'')?credit[0].artist.id:'',artistName:credit[0]?.artist?.name||credit[0]?.name||'',
      release:rel?.title||'',releaseId:AI_MBID.test(rel?.id||'')?rel.id:'',releaseGroupId:AI_MBID.test(rel?.['release-group']?.id||'')?rel['release-group'].id:'',year:String(r['first-release-date']||rel?.date||'').slice(0,4)};
  }).filter(x=>x.title&&x.artist&&AI_MBID.test(x.mbid));
}
const aiTagQuery=tags=>tags.map(t=>`tag:"${t}"`).join(' AND ');
const aiTrackKey=t=>(t.title.replace(/\s*[\(\[].*$/,'')+'|'+t.artist).toLowerCase();
const aiLyricsCache=new Map();
// LRCLIB은 한꺼번에 많이 요청하면 429로 막아서, 동시에 3개까지만 보내고 막히면 잠시 뒤 다시 시도해요.
let aiLrclibActive=0;const aiLrclibQueue=[];
async function aiLrclibFetch(url,signal){
  if(aiLrclibActive>=3)await new Promise(resolve=>aiLrclibQueue.push(resolve));
  aiLrclibActive++;
  try{
    for(let attempt=0;;attempt++){
      const response=await fetch(url,{signal});
      if(response.status!==429||attempt>=3)return response;
      await aiWait(1500*(attempt+1));
    }
  }finally{aiLrclibActive--;aiLrclibQueue.shift()?.();}
}
async function aiLyrics(track,signal){
  const key=(track.title+'|'+track.artist).toLowerCase();if(aiLyricsCache.has(key))return aiLyricsCache.get(key);
  const params=new URLSearchParams({track_name:track.title,artist_name:track.artist});
  const response=await aiLrclibFetch(`${AI_SOURCES.lyrics.api}/search?${params}`,signal);
  if(!response.ok){const failure=new Error('http-'+response.status);failure.status=response.status;failure.source=AI_SOURCES.lyrics.name;throw failure;}
  const list=await response.json();
  const hit=(Array.isArray(list)?list:[]).find(x=>x&&typeof x.plainLyrics==='string'&&x.plainLyrics.trim()&&!x.instrumental);
  const out=hit?{lines:hit.plainLyrics.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)}:null;
  aiLyricsCache.set(key,out);return out;
}
const aiShuffle=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
// 앨범 표지 주소 (Cover Art Archive). 앨범 묶음 표지가 더 잘 있어서 먼저 써요.
const aiCoverUrl=t=>t.releaseGroupId?`https://coverartarchive.org/release-group/${t.releaseGroupId}/front-250`:t.releaseId?`https://coverartarchive.org/release/${t.releaseId}/front-250`:'';
// 표지 이미지가 실제로 있는지 브라우저에서 불러 보고 확인해요.
const aiImageCache=new Map();
function aiImageOk(url){
  if(!url)return Promise.resolve(false);if(aiImageCache.has(url))return aiImageCache.get(url);
  const check=new Promise(resolve=>{const img=new Image();const timer=setTimeout(()=>resolve(false),8000);
    img.onload=()=>{clearTimeout(timer);resolve(img.naturalWidth>0);};img.onerror=()=>{clearTimeout(timer);resolve(false);};img.src=url;});
  aiImageCache.set(url,check);return check;
}
// 후보 곡의 가사(LRCLIB)와 표지 이미지를 확인해, 가사가 있는 곡만 고르고 이미지가 있는 곡을 먼저 골라요.
async function aiWithLyrics(candidates,signal,extra,max){
  const [lyrics,images]=await Promise.all([Promise.allSettled(candidates.map(t=>aiLyrics(t,signal))),Promise.all(candidates.map(t=>aiImageOk(aiCoverUrl(t))))]);
  return candidates.map((t,i)=>({t,l:lyrics[i].status==='fulfilled'?lyrics[i].value:null,img:images[i]})).filter(x=>x.l?.lines?.length)
    .sort((a,b)=>b.img-a.img).slice(0,max)
    .map(({t,l,img})=>({id:'mb-'+t.mbid,title:t.title,artist:t.artist,artistMbid:t.artistMbid,release:t.release,releaseId:img?t.releaseId:'',releaseGroupId:img?t.releaseGroupId:'',year:t.year,genre:extra.genre,tags:extra.tags,lines:l.lines.slice(0,120)}));
}
// 앱의 곡 목록에 등록하고, 새로고침해도 남도록 state.ext에 저장해요.
function aiRegister(metas){
  const ok=metas.filter(m=>registerExt(m));
  if(ok.length)commit(s=>{s.ext=s.ext||{};ok.forEach(m=>{s.ext[m.id]=m;});});
  return ok.map(m=>m.id);
}
function aiRememberArtist(a){const old=aiView.mbArtists[a.mbid]||{};aiView.mbArtists[a.mbid]={...old,...a,name:old.name||a.name,image:a.image||old.image||'',reason:a.reason||old.reason};return aiView.mbArtists[a.mbid];}
// 내 기록(종합) 또는 선택한 곡·장르(비슷한 음악)에 맞는 노래 3곡과 아티스트 3명을 MusicBrainz에서 찾아요.
async function aiDiscover(kind){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);const signal=controller.signal;
  try{
    let genre,mood;
    if(kind==='overall'){
      const p=aiProfile();genre=Object.entries(p.genreW).filter(([g])=>AI_GENRE_TAGS[g]).sort((a,b)=>b[1]-a[1])[0]?.[0]||'인디 팝';mood=p.topTags.find(t=>AI_MOOD_TAGS[t]);
    }else{const seed=findSong(state.seed)||songs[0];genre=AI_GENRE_TAGS[state.pickGenre]?state.pickGenre:'인디 팝';mood=seed.tags.find(t=>AI_MOOD_TAGS[t]);}
    const genreTag=AI_GENRE_TAGS[genre];const moodTag=AI_MOOD_TAGS[mood];
    let found=moodTag?await aiFindRecordings(aiTagQuery([genreTag,moodTag]),signal):[];
    const usedMood=found.length>=3;
    if(found.length<10)found=found.concat(await aiFindRecordings(aiTagQuery([genreTag]),signal));
    const exclude=new Set(kind==='overall'?[...Object.keys(state.ratings),...state.library]:[state.seed]);
    const seen=new Set();const unique=found.filter(t=>{const k=aiTrackKey(t);if(seen.has(k)||exclude.has('mb-'+t.mbid))return false;seen.add(k);return true;});
    const label=usedMood?`${genreTag} · ${moodTag}`:genreTag;
    const metas=await aiWithLyrics(aiShuffle(unique).slice(0,12),signal,{genre,tags:mood?[mood]:[]},3);
    const ids=aiRegister(metas);
    const songsOut=ids.map(id=>({id,reason:kind==='overall'
      ?`자주 들은 ‘${genre}’${mood?`, ‘${mood}’`:''} 취향을 바탕으로 MusicBrainz ‘${label}’ 태그에서 찾은 곡이에요.`
      :`‘${findSong(state.seed)?.title||''}’ 좋아하는 당신에게 고른 ‘${genre}’ 곡이에요.${mood?` ‘${mood}’ 분위기도 함께 담았어요.`:''}`}));
    // 같은 태그에서 곡이 많이 검색된 아티스트를 골라요.
    // 아티스트 사진 대신 그 아티스트 곡의 앨범 표지를 쓰고, 표지가 있는 아티스트를 먼저 골라요.
    const byArtist={};unique.forEach(t=>{if(!t.artistMbid)return;const a=byArtist[t.artistMbid]=byArtist[t.artistMbid]||{mbid:t.artistMbid,name:t.artistName,count:0,covers:[]};a.count++;const c=aiCoverUrl(t);if(c&&a.covers.length<3)a.covers.push(c);});
    const pool=aiShuffle(Object.values(byArtist)).sort((a,b)=>b.count-a.count).slice(0,8);
    await Promise.all(pool.map(async a=>{for(const c of a.covers){if(await aiImageOk(c)){a.image=c;return;}}a.image='';}));
    const artists=pool.sort((a,b)=>!!b.image-!!a.image).slice(0,3).map(({covers,...a})=>aiRememberArtist({...a,genre,label,
      reason:`MusicBrainz ‘${label}’ 태그에서 ${a.count}곡이 검색된 아티스트예요.`}));
    return {songs:songsOut,artists,label,seed:state.seed,genre,mood};
  }finally{clearTimeout(timer);}
}
// 아티스트 패널을 열면 MusicBrainz에서 정보와 노래를 불러와요(가사가 있는 곡만 등록).
async function aiLoadArtist(ar){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);const signal=controller.signal;
  try{
    const info=await aiMusicBrainz(`artist/${ar.mbid}?inc=tags+genres`,signal);
    ar.name=ar.name||info.name;ar.type=info.type||'';ar.country=info.area?.name||info.country||'';ar.begin=String(info['life-span']?.begin||'').slice(0,4);
    ar.tags=[...(info.genres?.length?info.genres:info.tags||[])].sort((a,b)=>(b.count||0)-(a.count||0)).slice(0,5).map(t=>t.name);
    const recs=await aiFindRecordings(`arid:${ar.mbid}`,signal);
    const seen=new Set();const unique=recs.filter(t=>{const k=aiTrackKey(t);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,12);
    aiRegister(await aiWithLyrics(unique,signal,{genre:ar.genre||'팝',tags:[]},6));
  }finally{clearTimeout(timer);}
}
// 실패 이유를 사람이 읽을 수 있는 말로 바꿔요.
function aiErrorReason(error){
  const s=error.status;const who=error.source||'MusicBrainz·LRCLIB';
  return error.name==='AbortError'?'응답이 너무 늦어요(25초 초과).'
    :!s?'응답을 받지 못했어요. 인터넷 연결을 확인해 주세요.'
    :s===429||s===503?`${who} 요청이 많아 잠시 막혔어요(${s}). 조금 뒤 다시 시도해 주세요.`
    :`${who} 서비스 오류(${s}).`;
}
async function aiRun(kind){
  const run=++aiView[kind+'Run'];aiView[kind+'Status']='loading';aiPaint(kind);
  const started=Date.now();
  let result={songs:[],artists:[],label:'',seed:state.seed,genre:kind==='overall'?'':state.pickGenre},note='';
  try{
    result=await aiDiscover(kind);
    if(!result.songs.length)note='MusicBrainz·LRCLIB에서 가사가 있는 곡을 찾지 못했어요. 다시 분석해 보세요.';
  }catch(error){console.warn('[AI 리포트] 음악 데이터 연결 실패',error.status||'',error.message);note=`음악을 불러오지 못했어요: ${aiErrorReason(error)}`;}
  await aiWait(Math.max(0,1200-(Date.now()-started))); // 분석 화면을 잠깐 보여 줘요.
  if(run!==aiView[kind+'Run'])return;
  aiView[kind]={...result,note};aiView[kind+'Status']='done';
  if(kind==='overall')aiView.overallKey=aiProfileKey();
  aiPaint(kind);
  if(page==='ai')toast(note||(kind==='overall'?'기록을 종합한 추천이 준비됐어요.':'새로운 음악과 아티스트를 추천했어요.'));
}

/* ---------- 화면 ---------- */
function ai(){
  main.innerHTML=heading('AI REPORT · ANOTHER VERSE, JUST FOR YOU','당신이 남긴 기록,<br>그리고 다음 음악.','별점과 코멘트, 듣는 노래를 돌아보고 다음에 들을 음악을 찾아 드려요.',`<div class="ai-sources" aria-label="연결된 음악 데이터">${icon('headphones')}<span>음악 <a href="${AI_SOURCES.music.site}" target="_blank" rel="noopener noreferrer">${AI_SOURCES.music.name}</a></span><span>가사 <a href="${AI_SOURCES.lyrics.site}" target="_blank" rel="noopener noreferrer">${AI_SOURCES.lyrics.name}</a></span></div>`)+
  `<nav class="ai-chapters" aria-label="AI 리포트 목차">${AI_CHAPTERS.map(([id,title],i)=>`<button class="ai-chapter ${aiView.chapter===i?'active':''}" data-action="ai-jump" data-value="${id}"><span>${aiPad(i+1)}</span>${title}</button>`).join('')}</nav>
  <div class="ai-story">
    <section class="ai-slide ai-slide-dark" id="ai-top" data-chapter="0" aria-labelledby="ai-top-title">
      <div class="ai-slide-inner">
        <div class="ai-slide-head ai-reveal"><span class="ai-kicker">01 · MY TOP 5</span><h2 id="ai-top-title">내가 가장 높은<br>별점을 준 음악</h2><p id="ai-top-sub"></p></div>
        <div id="ai-top-body"></div>
      </div>
      <button class="ai-scroll-cue ai-reveal" data-action="ai-jump" data-value="ai-talked">스크롤해서 다음 이야기 보기 ${icon('chevron')}</button>
    </section>
    <section class="ai-slide ai-slide-soft" id="ai-talked" data-chapter="1" aria-labelledby="ai-talked-title">
      <div class="ai-slide-inner">
        <div class="ai-slide-head ai-reveal"><span class="ai-kicker">02 · MOST TALKED ABOUT</span><h2 id="ai-talked-title">가장 많은 이야기를<br>남긴 아티스트</h2><p id="ai-talked-sub"></p></div>
        <div id="ai-talked-body"></div>
      </div>
    </section>
    <section class="ai-slide ai-slide-paper" id="ai-overall" data-chapter="2" aria-labelledby="ai-overall-title">
      <div class="ai-slide-inner">
        <div class="ai-slide-head ai-reveal"><span class="ai-kicker">03 · FOR YOU, OVERALL</span><h2 id="ai-overall-title">당신의 기록을 종합한<br>오늘의 추천</h2><p id="ai-overall-sub"></p></div>
        <div id="ai-overall-body"></div>
      </div>
    </section>
    <section class="ai-slide ai-slide-plain" id="ai-similar" data-chapter="3" aria-labelledby="ai-similar-title">
      <div class="ai-slide-inner">
        <div class="ai-slide-head ai-reveal"><span class="ai-kicker">04 · MORE LIKE THIS</span></div>
        <div class="recommend-top ai-reveal"><div><span class="ai-label">${icon('spark')} AI RECOMMENDATION</span><h2 id="ai-similar-title">오늘은 어떤 장르가<br>끌리나요?</h2><p>좋아하는 곡과 고른 장르를 참고해<br>음악과 아티스트를 함께 추천해 드려요.</p></div><div><label class="form-label" for="ai-seed">이 곡을 좋아해요</label><select class="field" id="ai-seed">${aiSeedOptions()}</select><span class="form-label ai-genre-label" id="ai-genre-label">듣고 싶은 장르</span><div class="mood-options" role="group" aria-labelledby="ai-genre-label">${AI_PICK_GENRES.map(g=>`<button class="chip ${state.pickGenre===g?'active':''}" data-action="ai-genre" data-value="${g}" aria-pressed="${state.pickGenre===g}">${g}</button>`).join('')}</div><button class="button dark block" id="ai-recommend-button" data-action="ai-recommend">${icon('spark')} 음악 추천받기</button></div></div>
        <div id="ai-similar-body" class="ai-reveal"></div>
      </div>
    </section>
  </div>
`; // 출처 안내(MusicBrainz·LRCLIB)는 index.html의 맨 아래 푸터에 있어요.
  if(aiView.overallKey&&aiView.overallKey!==aiProfileKey()&&aiView.overallStatus==='done')aiView.overallStatus='stale';
  aiRefreshReport();aiPaint('overall');aiPaint('similar');aiObserve();
}
function aiSeedOptions(){
  // 내가 기록한(듣는) 곡을 먼저, 나머지는 아래에 보여 줘요.
  const mine=state.library.map(findSong).filter(Boolean);const rest=songs.filter(s=>!state.library.includes(s.id));
  const opt=s=>`<option value="${s.id}" ${state.seed===s.id?'selected':''}>${s.title} · ${albumOf(s).artist}</option>`;
  return `<optgroup label="내가 듣는 노래">${mine.map(opt).join('')}</optgroup>${rest.length?`<optgroup label="다른 노래">${rest.map(opt).join('')}</optgroup>`:''}`;
}
// 01·02 장은 별점/기록이 바뀌면 그 자리에서 다시 그려요.
function aiRefreshReport(){
  const topBody=document.getElementById('ai-top-body');if(!topBody)return;
  const top=aiTopRated();const rated=Object.keys(state.ratings).length;
  document.getElementById('ai-top-sub').textContent=rated?`별점을 남긴 ${rated}곡 가운데 가장 높은 순서예요.`:'아직 별점을 남긴 곡이 없어요.';
  if(!top.length){topBody.innerHTML=`<div class="ai-dark-empty ai-reveal">${icon('star')}<p>추천 곡을 열어 별점을 남기면 이곳에 나만의 TOP 5가 채워져요.</p><button class="button lime" data-action="ai-jump" data-value="ai-overall">추천 곡 보러 가기</button></div>`;}
  else{
    const [first,...others]=top;const fa=albumOf(first.song);
    const best=aiArtistStats().filter(a=>a.rated).sort((a,b)=>b.avg-a.avg||b.rated-a.rated)[0];
    topBody.innerHTML=`<div class="ai-top-grid">
      <button class="ai-top-hero ai-reveal" data-action="ai-song" data-id="${first.song.id}" style="--i:1"><span class="ai-rank-big">No.1</span><img src="${fa.image}" alt="${fa.title} 앨범 아트"><span class="ai-top-hero-text"><strong>${first.song.title}</strong><small>${fa.artist} · ${first.song.genre}</small>${aiStars(first.rating,'large')}</span></button>
      <ol class="ai-top-list">${[0,1,2,3].map(i=>{const x=others[i];const n=i+2;
        if(!x)return `<li class="ai-top-row ai-top-empty ai-reveal" style="--i:${n}"><span class="ai-rank">${aiPad(n)}</span><span class="ai-top-placeholder">${icon('star')}</span><span class="ai-top-text"><strong>아직 비어 있어요</strong><small>추천 곡에 별점을 남겨 채워 보세요</small></span></li>`;
        const a=albumOf(x.song);return `<li class="ai-reveal" style="--i:${n}"><button class="ai-top-row" data-action="ai-song" data-id="${x.song.id}"><span class="ai-rank">${aiPad(n)}</span><img src="${a.image}" alt=""><span class="ai-top-text"><strong>${x.song.title}</strong><small>${a.artist}</small></span>${aiStars(x.rating)}</button></li>`;}).join('')}</ol>
    </div>
    ${best?`<button class="ai-best-artist ai-reveal" data-action="ai-artist" data-id="${best.id}" style="--i:6"><img src="${best.album.image}" alt=""><span>평균 별점이 가장 높은 아티스트 <strong>${best.album.artist}</strong> · ${best.avg.toFixed(1)}점</span>${icon('chevron')}</button>`:''}`;
  }
  const stats=aiArtistStats().slice(0,3);const total=state.notes.length;const max=Math.max(...stats.map(s=>s.notes),1);
  document.getElementById('ai-talked-sub').textContent=total?`내가 남긴 코멘트 ${total}개를 아티스트별로 모았어요.`:'아직 남긴 코멘트가 없어요. 가사에 첫 코멘트를 남겨 보세요.';
  document.getElementById('ai-talked-body').innerHTML=`<div class="ai-talked-grid">${stats.map((st,i)=>`<button class="ai-talked-card ai-reveal" data-action="ai-artist" data-id="${st.id}" style="--i:${i+1}">
    <span class="ai-talked-rank">${aiPad(i+1)}</span><img src="${st.album.image}" alt="${st.album.artist} 대표 앨범">
    <strong>${st.album.artist}</strong><small>${st.album.genre||''}</small>
    <span class="ai-talked-count"><b>${st.notes}</b>개의 코멘트</span>
    <span class="ai-meter" aria-hidden="true"><i style="width:${Math.round(st.notes/max*100)}%"></i></span>
    <span class="ai-talked-quote">${st.latest?`“${esc(st.latest.text)}”`:'아직 이 아티스트에 남긴 이야기가 없어요.'}</span>
    <span class="ai-talked-foot">기록한 곡 ${st.inLibrary}/${st.total}${st.rated?` · 평균 ${st.avg.toFixed(1)}점`:''}</span>
  </button>`).join('')}</div>`;
  const p=aiProfile();
  document.getElementById('ai-overall-sub').innerHTML=`별점 ${Object.keys(state.ratings).length}개 · 코멘트 ${state.notes.length}개 · 기록한 음악 ${state.library.length}곡을 함께 읽었어요.`;
  // 이미 보이는 장이면 새로 그린 항목도 바로 보이게
  document.querySelectorAll('.ai-slide.is-in .ai-reveal').forEach(el=>el.classList.add('no-delay'));
}
function aiSongRow(r,i){const s=findSong(r.id);if(!s)return '';const a=albumOf(s);return `<button class="recommend-list-item ai-pop" style="--i:${i}" data-action="ai-song" data-id="${s.id}" data-reason="${esc(r.reason)}"><span>${aiPad(i+1)}</span><img src="${a.image}" alt="${a.title} 앨범 아트"><div><strong>${s.title}</strong><small> · ${a.artist}</small>${state.ratings[s.id]?`<span class="pill ai-inline-pill">★ ${state.ratings[s.id]}</span>`:state.library.includes(s.id)?'<span class="pill ai-inline-pill">내 음악</span>':''}<p>${esc(r.reason)}</p>${s.lines[0]?`<em class="ai-lyric-preview">“${s.lines[0]}”</em>`:''}</div>${icon('chevron')}</button>`;}
const aiInitial=name=>esc([...String(name||'?').trim()][0]||'?');
function aiArtistRow(r,i){return `<button class="recommend-list-item ai-pop" style="--i:${i+3}" data-action="ai-mbartist" data-id="${r.mbid}" data-reason="${esc(r.reason)}"><span>${aiPad(i+1)}</span>${r.image?`<img class="ai-round" src="${r.image}" alt="${esc(r.name)} 앨범 표지">`:`<span class="ai-artist-initial">${aiInitial(r.name)}</span>`}<div><strong>${esc(r.name)}</strong><span class="pill ai-inline-pill">${r.count}곡 검색</span><p>${esc(r.reason)}</p></div>${icon('chevron')}</button>`;}
function aiResultColumns(result,songTitle,artistTitle){
  const none=text=>`<p class="small-muted ai-none">${text}</p>`;
  return `<div class="ai-result-meta"><span class="ai-source is-ai">${icon('headphones')} ${AI_SOURCES.music.name} · ${AI_SOURCES.lyrics.name}</span>${result.label?`<span class="ai-source">‘${esc(result.label)}’ 태그</span>`:''}${result.note?`<span class="ai-note">${esc(result.note)}</span>`:''}</div>
  <div class="ai-result-columns"><section><h2>${songTitle}</h2>${result.songs.map(aiSongRow).join('')||none('추천할 노래를 찾지 못했어요.')}</section><section><h2>${artistTitle}</h2>${result.artists.map(aiArtistRow).join('')||none('추천할 아티스트를 찾지 못했어요.')}</section></div>`;
}
// 추천 결과 밑에 보여 줄 취향 태그: 장르 / 감정 / 스타일(어떤 스타일의 노래를 좋아하는지)
function aiTaste(kind,result){
  const uniq=list=>[...new Set(list.filter(Boolean))];let genres,moods,artist;
  if(kind==='overall'){
    const p=aiProfile();
    genres=Object.entries(p.genreW).filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([g])=>g);
    moods=p.topTags.slice(0,3);
    const topArtist=Object.entries(p.artistW).sort((a,b)=>b[1]-a[1])[0]?.[0];artist=albums[topArtist]?.artist;
  }else{
    const seed=findSong(result.seed);genres=uniq([result.genre,seed?.genre]);moods=(seed?.tags||[]).slice(0,3);artist=seed?albumOf(seed).artist:'';
  }
  const styles=uniq([...genres.map(g=>AI_STYLE_BY_GENRE[g]),...moods.map(m=>AI_STYLE_BY_MOOD[m]),artist?`${artist} 같은 음색`:'']).slice(0,4);
  return {genres:uniq(genres),moods:uniq(moods),styles};
}
function aiTasteBlock(kind,result){
  if(!result)return '';const t=aiTaste(kind,result);
  const tag=x=>`<span class="pill">#${esc(String(x).replace(/\s+/g,''))}</span>`;
  const row=(label,list)=>list.length?`<div class="ai-taste-row"><b>${label}</b><span>${list.map(tag).join('')}</span></div>`:'';
  const body=row('장르',t.genres)+row('감정',t.moods)+row('스타일',t.styles);
  return body?`<div class="ai-taste ai-pop" style="--i:7"><span class="ai-label">${icon('spark')} ${kind==='overall'?'이런 음악을 좋아하시네요':'이번 추천의 기준'}</span>${body}</div>`:'';
}
function aiAnalyzing(kind){
  const steps=kind==='overall'?[`별점 ${Object.keys(state.ratings).length}개 읽기`,`코멘트 ${state.notes.length}개 살펴보기`]:[`‘${findSong(state.seed).title}’ 살펴보기`,`‘${state.pickGenre}’ 장르로 찾기`];
  steps.push('MusicBrainz에서 노래·아티스트 찾기','LRCLIB에서 가사 불러오기','앨범 표지가 있는 곡 고르기');
  return `<div class="loading ai-analyzing" role="status"><span class="ai-orb">${icon('spark')}</span><strong>당신의 음악 기록을 읽고 있어요.</strong><ol class="ai-steps">${steps.map((s,i)=>`<li style="--i:${i}">${icon('check')}${esc(s)}</li>`).join('')}</ol></div>`;
}
function aiPaint(kind){
  if(kind==='overall'){
    const body=document.getElementById('ai-overall-body');if(!body)return;const st=aiView.overallStatus;
    if(st==='loading')body.innerHTML=aiAnalyzing('overall');
    else if(aiView.overall)body.innerHTML=(st==='stale'?`<div class="ai-stale">${icon('info')}<span>새로운 별점이나 기록이 생겼어요.</span><button class="button small dark" data-action="ai-rerun">다시 분석하기</button></div>`:'')+aiResultColumns(aiView.overall,'종합 추천 노래','취향이 닮은 아티스트')+aiTasteBlock('overall',aiView.overall)+(st!=='stale'?`<button class="text-button ai-rerun" data-action="ai-rerun">${icon('spark')} 다시 분석하기</button>`:'');
    else body.innerHTML=`<div class="loading ai-analyzing">${icon('spark')}<strong>이 장에 도착하면 분석을 시작해요.</strong></div>`;
  }else{
    const body=document.getElementById('ai-similar-body');if(!body)return;const button=document.getElementById('ai-recommend-button');const st=aiView.similarStatus;
    if(button){button.disabled=st==='loading';button.innerHTML=icon('spark')+(st==='loading'?' 취향을 살펴보는 중…':aiView.similar?' 다시 추천받기':' 음악 추천받기');}
    if(st==='loading')body.innerHTML=aiAnalyzing('similar');
    else if(aiView.similar){const seed=findSong(aiView.similar.seed);body.innerHTML=aiResultColumns(aiView.similar,`‘${seed?.title||''}’ 좋아한다면 들어 볼 ${esc(aiView.similar.genre||'')}`,'새롭게 만나 볼 아티스트')+aiTasteBlock('similar',aiView.similar);}
    else body.innerHTML=empty('새로운 음악을 발견할 준비가 됐나요?','내가 듣는 곡과 분위기를 고른 뒤 추천받기를 눌러 보세요.');
  }
}

/* ---------- 스크롤하면 한 장씩 떠오르는 효과 ---------- */
function aiObserve(){
  aiView.observer?.disconnect();
  const slides=[...document.querySelectorAll('.ai-slide')];
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce||!('IntersectionObserver' in window)){slides.forEach(s=>s.classList.add('is-in'));aiStartOverallIfNeeded();return;}
  aiView.observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{
    entry.target.classList.toggle('is-in',entry.isIntersecting);
    if(!entry.isIntersecting)entry.target.querySelectorAll('.no-delay').forEach(el=>el.classList.remove('no-delay'));
    if(entry.isIntersecting&&entry.target.id==='ai-overall')aiStartOverallIfNeeded();
  });},{threshold:.18,rootMargin:'-6% 0px -10% 0px'});
  slides.forEach(s=>aiView.observer.observe(s));
  aiUpdateChapter();
}
function aiStartOverallIfNeeded(){if(aiView.overallStatus==='idle'||(aiView.overallStatus==='stale'&&!aiView.overall))aiRun('overall');}
function aiUpdateChapter(){
  if(page!=='ai')return;const slides=[...document.querySelectorAll('.ai-slide')];if(!slides.length)return;
  let current=0;slides.forEach((s,i)=>{if(s.getBoundingClientRect().top<window.innerHeight*.45)current=i;});
  if(current===aiView.chapter&&document.querySelector('.ai-chapter.active'))return;
  aiView.chapter=current;document.querySelectorAll('.ai-chapter').forEach((b,i)=>{b.classList.toggle('active',i===current);if(i===current)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
}
let aiScrollTick=false;
window.addEventListener('scroll',()=>{if(aiScrollTick)return;aiScrollTick=true;requestAnimationFrame(()=>{aiScrollTick=false;aiUpdateChapter();});},{passive:true});

/* ---------- 곡 / 아티스트 상세 패널 (페이지 이동 없이) ---------- */
function aiSheetRoot(){
  let root=document.getElementById('ai-sheet-root');
  if(!root){
    root=document.createElement('div');root.id='ai-sheet-root';root.hidden=true;
    root.innerHTML='<div class="ai-sheet-backdrop" data-action="ai-sheet-close"></div><section class="ai-sheet" role="dialog" aria-modal="true" aria-labelledby="ai-sheet-title" tabindex="-1"><div class="ai-sheet-bar"><button class="ai-sheet-back" data-action="ai-sheet-back" hidden>'+icon('back')+' 이전</button><button class="close-button" data-action="ai-sheet-close" aria-label="닫기">'+icon('close')+'</button></div><div class="ai-sheet-content"></div></section>';
    document.body.appendChild(root);
  }
  return root;
}
function aiOpenSheet(entry,push=true){
  const root=aiSheetRoot();const wasOpen=!root.hidden;
  if(!wasOpen){aiView.sheetReturn=document.activeElement;aiView.sheetStack=[];}
  if(push)aiView.sheetStack.push(entry);
  aiDrawSheet();
  if(!wasOpen){root.hidden=false;document.body.classList.add('ai-sheet-open');requestAnimationFrame(()=>root.classList.add('open'));}
  root.querySelector('.ai-sheet-content').scrollTop=0;
  root.querySelector('.close-button').focus({preventScroll:true});
}
function aiDrawSheet(){
  const root=aiSheetRoot();const entry=aiView.sheetStack[aiView.sheetStack.length-1];if(!entry)return;
  const content=root.querySelector('.ai-sheet-content');const scroll=content.scrollTop;
  content.innerHTML=entry.type==='song'?aiSongSheet(entry.id,entry.reason):entry.type==='mbartist'?aiMbArtistSheet(entry):'';
  content.scrollTop=scroll;
  root.querySelector('.ai-sheet-back').hidden=aiView.sheetStack.length<2;
}
function aiCloseSheet(){
  const root=document.getElementById('ai-sheet-root');if(!root||root.hidden)return;
  root.classList.remove('open');document.body.classList.remove('ai-sheet-open');aiView.sheetStack=[];
  setTimeout(()=>{if(!root.classList.contains('open'))root.hidden=true;},260);
  if(aiView.sheetReturn?.isConnected)aiView.sheetReturn.focus({preventScroll:true});
}
function aiSongSheet(id,reason){
  const s=findSong(id);if(!s)return '';const a=albumOf(s);const rating=state.ratings[id]||0;const inLib=state.library.includes(id);
  const removable=inLib&&!rating&&!state.notes.some(n=>n.song===id);
  return `<div class="ai-sheet-hero"><img src="${a.image}" alt="${a.title} 앨범 아트"><div><div class="eyebrow">${esc(a.title.toUpperCase())} · ${a.year}</div><h2 id="ai-sheet-title">${s.title}</h2><button class="ai-artist-link" data-action="ai-artist" data-id="${s.album}">${a.artist}${icon('chevron')}</button><p class="ai-sheet-meta">${s.genre}</p></div></div>
  ${reason?`<div class="ai-sheet-reason"><span class="ai-label">${icon('spark')} 추천 이유</span><p>${esc(reason)}</p></div>`:''}
  <div class="ai-tags">${s.tags.map(t=>`<span class="pill">#${t}</span>`).join('')}</div>
  <div class="ai-sheet-actions">
    <button class="button ${inLib?'subtle':'dark'}" data-action="ai-library" data-id="${id}" aria-pressed="${inLib}" ${inLib&&!removable?'disabled':''}>${icon(inLib?'check':'plus')}<span>${inLib?(removable?'내 음악에서 빼기':'내 음악에 있어요'):'내 음악(홈)에 추가'}</span></button>
    ${bookmark(id,true)}
  </div>
  <section class="ai-sheet-section"><h3>내 별점</h3><div class="rating-control ai-rating" aria-label="내 별점 선택">${Array.from({length:5},(_,i)=>`<button class="${i<rating?'filled':''}" data-action="ai-rate" data-id="${id}" data-value="${i+1}" aria-label="별점 ${i+1}점" aria-pressed="${rating===i+1}">${icon('star')}</button>`).join('')}<span class="rating-label">${rating?`나의 별점 ${rating}.0`:'별점을 남기면 TOP 5에 반영돼요'}</span></div></section>
  <section class="ai-sheet-section"><h3>가사 미리 보기</h3><ol class="ai-lyrics">${s.lines.slice(0,4).map(l=>`<li>${l}</li>`).join('')}</ol></section>
  <section class="ai-sheet-section"><h3>곡 정보</h3><p class="ai-hint">음악 정보 ${AI_SOURCES.music.name}${s.release?` · ${s.release}`:''} · 가사 ${AI_SOURCES.lyrics.name}</p><a class="ai-source-link" href="${AI_SOURCES.music.site}/recording/${s.mbid}" target="_blank" rel="noopener noreferrer">MusicBrainz에서 보기 ↗</a></section>
  <a class="ai-detail-link" href="#song/${id}">가사 전체에 코멘트 남기러 가기 ${icon('chevron')}</a>`;
}
function aiMbArtistSheet(entry){
  const ar=aiView.mbArtists[entry.id];if(!ar)return '';
  if(!ar.loaded&&!ar.loading){
    ar.loading=true;ar.error='';
    aiLoadArtist(ar).catch(error=>{ar.error=aiErrorReason(error);}).finally(()=>{ar.loading=false;ar.loaded=!ar.error;if(aiView.sheetStack[aiView.sheetStack.length-1]===entry)aiDrawSheet();});
  }
  const albumId='mba-'+ar.mbid;const list=aiSongsOf(albumId);
  const rated=list.map(s=>state.ratings[s.id]).filter(Boolean);const notes=state.notes.filter(n=>findSong(n.song)?.album===albumId).length;
  const meta=[ar.type,ar.country,ar.begin?`${ar.begin}~`:''].filter(Boolean).map(esc).join(' · ');
  const reason=entry.reason||ar.reason;
  const songsHtml=list.length?`<ul class="ai-artist-songs">${list.map(s=>{const inLib=state.library.includes(s.id);const saved=state.saved.includes(s.id);return `<li><button class="ai-artist-song" data-action="ai-song" data-id="${s.id}"><img src="${albumOf(s).image}" alt=""><span><strong>${s.title}</strong><small>${s.release||''}${state.ratings[s.id]?` · ★ ${state.ratings[s.id]}`:''}</small></span></button><span class="ai-mini-actions"><button class="ai-icon-button ${inLib?'on':''}" data-action="ai-library" data-id="${s.id}" aria-pressed="${inLib}" aria-label="${inLib?'내 음악에 있음':'내 음악에 추가'}" ${inLib?'disabled':''}>${icon(inLib?'check':'plus')}</button><button class="ai-icon-button bookmark-lite ${saved?'saved on':''}" data-action="bookmark" data-id="${s.id}" aria-pressed="${saved}" aria-label="${saved?'저장 취소':'곡 저장'}">${icon('bookmark')}</button></span></li>`;}).join('')}</ul>`:'';
  const status=ar.loading?'<p class="ai-hint">MusicBrainz에서 노래를, LRCLIB에서 가사를 불러오는 중…</p>'
    :ar.error?`<p class="ai-hint">노래를 불러오지 못했어요: ${esc(ar.error)}</p>`
    :!list.length?'<p class="ai-hint">LRCLIB에 가사가 있는 노래를 찾지 못했어요.</p>':'';
  const photo=ar.image||(albums[albumId]?.image&&albums[albumId].image!==EXT_COVER?albums[albumId].image:'');
  return `<div class="ai-sheet-hero">${photo?`<img class="ai-round" src="${photo}" alt="${esc(ar.name)} 앨범 표지">`:`<span class="ai-artist-initial large">${aiInitial(ar.name)}</span>`}<div><div class="eyebrow">ARTIST${ar.genre?` · ${esc(ar.genre)}`:''}</div><h2 id="ai-sheet-title">${esc(ar.name)}</h2><p class="ai-sheet-meta">${meta||'MusicBrainz 아티스트'}</p></div></div>
  ${reason?`<div class="ai-sheet-reason"><span class="ai-label">${icon('spark')} 추천 이유</span><p>${esc(reason)}</p></div>`:''}
  ${ar.tags?.length?`<div class="ai-tags">${ar.tags.map(t=>`<span class="pill">#${esc(t)}</span>`).join('')}</div>`:''}
  <div class="ai-artist-stats"><div><strong>${rated.length?(rated.reduce((a,b)=>a+b,0)/rated.length).toFixed(1):'–'}</strong>평균 별점</div><div><strong>${notes}</strong>남긴 코멘트</div><div><strong>${list.filter(s=>state.library.includes(s.id)).length}/${list.length}</strong>기록한 곡</div></div>
  <section class="ai-sheet-section"><h3>${esc(ar.name)}의 노래</h3>${songsHtml}${status}</section>
  <a class="ai-detail-link" href="${AI_SOURCES.music.site}/artist/${ar.mbid}" target="_blank" rel="noopener noreferrer">MusicBrainz에서 아티스트 정보 보기 ${icon('chevron')}</a>`;
}
// 패널 안에서 별점·추가·저장을 바꾸면 리포트도 그 자리에서 갱신해요.
function aiAfterChange(){
  if(document.getElementById('ai-sheet-root')?.hidden===false)aiDrawSheet();
  if(page!=='ai')return;
  aiRefreshReport();
  if(aiView.overallStatus==='done'&&aiView.overallKey!==aiProfileKey()){aiView.overallStatus='stale';aiPaint('overall');}
  const seed=document.getElementById('ai-seed');if(seed){const v=seed.value;seed.innerHTML=aiSeedOptions();seed.value=v;}
}

/* ---------- 이벤트 ---------- */
document.addEventListener('click',event=>{
  const b=event.target.closest('[data-action]');if(!b)return;const {action,id,value}=b.dataset;
  if(action==='bookmark'){if(page==='ai')setTimeout(aiAfterChange,0);return;} // 저장은 script.js의 공용 기능을 그대로 사용
  if(!action.startsWith('ai-'))return;
  if(action==='ai-jump'){const target=document.getElementById(value);if(target){const top=target.getBoundingClientRect().top+window.scrollY-(window.innerWidth>700?120:16);window.scrollTo({top,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}
  else if(action==='ai-song')aiOpenSheet({type:'song',id,reason:b.dataset.reason||''});
  else if(action==='ai-artist'){
    const al=albums[id];if(!al)return;
    aiRememberArtist({mbid:al.mbid,name:al.artist,genre:al.genre,image:al.image!==EXT_COVER?al.image:''});aiOpenSheet({type:'mbartist',id:al.mbid,reason:b.dataset.reason||''});
  }
  else if(action==='ai-mbartist'){if(aiView.mbArtists[id])aiOpenSheet({type:'mbartist',id,reason:b.dataset.reason||''});}
  else if(action==='ai-sheet-close')aiCloseSheet();
  else if(action==='ai-sheet-back'){aiView.sheetStack.pop();aiDrawSheet();}
  else if(action==='ai-genre'){if(!AI_PICK_GENRES.includes(value))return;if(commit(s=>{s.pickGenre=value;}))document.querySelectorAll('[data-action="ai-genre"]').forEach(c=>{const on=c.dataset.value===value;c.classList.toggle('active',on);c.setAttribute('aria-pressed',String(on));});}
  else if(action==='ai-recommend'){const seed=document.getElementById('ai-seed').value;if(!findSong(seed)||!commit(s=>{s.seed=seed;}))return;aiRun('similar');}
  else if(action==='ai-rerun')aiRun('overall');
  else if(action==='ai-library'){
    if(!findSong(id))return;const inLib=state.library.includes(id);
    if(commit(s=>{if(inLib){s.library=s.library.filter(v=>v!==id);delete s.added[id];}else addToLibrary(s,id);})){toast(inLib?'내 음악에서 뺐어요.':'홈의 ‘최근에 추가한 음악’에 담았어요.');aiAfterChange();}
  }
  else if(action==='ai-rate'){
    const rating=Number(value);if(!findSong(id)||!Number.isInteger(rating)||rating<1||rating>5)return;
    if(commit(s=>{s.ratings[id]=rating;if(!s.library.includes(id))addToLibrary(s,id);})){toast(`${rating}점으로 기록했어요. TOP 5에 반영했어요.`);aiAfterChange();}
  }
});
document.addEventListener('keydown',event=>{
  const root=document.getElementById('ai-sheet-root');if(!root||root.hidden)return;
  if(event.key==='Escape'){event.preventDefault();aiCloseSheet();return;}
  if(event.key!=='Tab')return;
  const focusable=[...root.querySelectorAll('.ai-sheet button:not([disabled]):not([hidden]),.ai-sheet a[href],.ai-sheet input,.ai-sheet select')].filter(el=>el.offsetParent!==null);
  if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
window.addEventListener('hashchange',aiCloseSheet);
