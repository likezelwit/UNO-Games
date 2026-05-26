// =============================================
// UNO GAME ENGINE - Enhanced
// =============================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDU0rqDjPdMsjhS_7MmvCYaoPoXpqeqyRE",
    authDomain: "unno-f3338.firebaseapp.com",
    databaseURL: "https://unno-f3338-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "unno-f3338",
    storageBucket: "unno-f3338.firebasestorage.app",
    messagingSenderId: "925580365013",
    appId: "1:925580365013:web:0c29f8e8de6b96ee8e265c",
    measurementId: "G-S7TD1HWV6J"
};

const CFG = {
    COLORS: ['red','blue','green','yellow'],
    NUMS: ['0','1','2','3','4','5','6','7','8','9'],
    ACTIONS: ['skip','reverse','+2'],
    WILDS: ['wild','+4'],
    SCORES: {0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,skip:20,reverse:20,'+2':20,wild:50,'+4':50},
    BOTS: ['Rex','Nova','Blitz','Jinx'],
    INIT: 7, TURN_MS: 15000
};

let db = null, G = null, me = null, roomCode = null, roomRef = null;
let settings = { sound:true, timer:true, stack:true };
let mode = 'classic', pendingWild = null, timerInt = null, busy = false;
let lobbyCount = 4, isHost = false, lobbySub = null;

// ===== AUDIO =====
let actx = null;
function initAudio() { if(!actx) actx = new (window.AudioContext||window.webkitAudioContext)(); }
function sfx(type) {
    if(!settings.sound||!actx) return;
    try {
        const t = actx.currentTime;
        const make = (freq,dur,vol=.08) => {
            const o=actx.createOscillator(), g=actx.createGain();
            o.connect(g); g.connect(actx.destination);
            o.frequency.setValueAtTime(freq,t);
            g.gain.setValueAtTime(vol,t);
            g.gain.exponentialRampToValueAtTime(.001,t+dur);
            o.start(t); o.stop(t+dur);
        };
        switch(type) {
            case 'play': make(520,.12); setTimeout(()=>make(780,.1),60); break;
            case 'draw': make(280,.18,.06); break;
            case 'skip': make(400,.1,.06); setTimeout(()=>make(250,.1,.06),80); break;
            case 'reverse': make(350,.1,.06); setTimeout(()=>make(450,.1,.06),80); break;
            case 'draw2': make(200,.2,.1); break;
            case 'draw4': make(150,.25,.12); break;
            case 'uno': [523,659,784].forEach((f,i)=>{setTimeout(()=>make(f,.18,.1),i*100)}); break;
            case 'win': [523,659,784,1047].forEach((f,i)=>{setTimeout(()=>make(f,.25,.1),i*140);}); break;
            case 'lose': make(300,.4,.08); break;
            case 'tick': make(900,.04,.03); break;
            case 'buzz': make(180,.08,.06); break;
        }
    } catch(e){}
}

// ===== UTILS =====
const $=id=>document.getElementById(id);
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=0|Math.random()*(i+1);[b[i],b[j]]=[b[j],b[i]]}return b};
const save=(k,v)=>{try{localStorage.setItem('u_'+k,JSON.stringify(v))}catch(e){}};
const load=(k,d)=>{try{const v=localStorage.getItem('u_'+k);return v?JSON.parse(v):d}catch(e){return d}};

function toast(msg) {
    const t=$('toast'); if(!t)return;
    t.textContent=msg; t.classList.add('show');
    clearTimeout(t._t);
    t._t=setTimeout(()=>t.classList.remove('show'),2200);
}
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const el=$(id); if(el) el.classList.add('active');
}
function showModal(id) { const el=$(id); if(el) el.classList.add('active'); }
function closeModal(id) { const el=$(id); if(el) el.classList.remove('active'); }
function genCode() {
    const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let r=''; for(let i=0;i<5;i++) r+=c[0|Math.random()*c.length];
    return 'UNO-'+r;
}

// ===== DECK =====
function makeDeck() {
    const d=[];
    CFG.COLORS.forEach(c=>{
        d.push({id:uid(),type:'0',color:c,value:0});
        for(let n=1;n<=9;n++){d.push({id:uid(),type:''+n,color:c,value:n});d.push({id:uid(),type:''+n,color:c,value:n})}
        CFG.ACTIONS.forEach(a=>{d.push({id:uid(),type:a,color:c,value:20});d.push({id:uid(),type:a,color:c,value:20})}
    });
    const wc = mode==='wild'?8:4;
    for(let i=0;i<wc;i++){d.push({id:uid(),type:'wild',color:'wild',value:50});d.push({id:uid(),type:'+4',color:'wild',value:50})}
    return shuffle(d);
}
function draw(n) {
    const c=[];
    for(let i=0;i<n&&G.deck.length>0;i++) c.push(G.deck.pop());
    if(G.deck.length<5&&G.discard.length>1){
        const top=G.discard.pop();
        G.deck=shuffle(G.discard);
        G.discard=[top];
    }
    return c;
}

// ===== GAME INIT =====
function initGame(players) {
    const deck=makeDeck(), hands={};
    players.forEach(p=>hands[p.id]=draw(CFG.INIT));
    let first=deck.pop();
    while(CFG.WILDS.includes(first.type)||CFG.ACTIONS.includes(first.type)){deck.unshift(first);first=deck.pop();}
    G={
        players, hands, deck, discard:[first],
        cur:0, dir:1, color:first.color, wildColor:null,
        mode, over:false, winner:null, unoCalled:{},
        turnStart:Date.now(), log:[], stackPending:0, lastDrawId:null
    };
    me=players.find(p=>!p.bot);
}

// ===== RULES =====
function canPlay(card) {
    if(!G) return false;
    const cc=G.wildColor||G.color;
    if(card.type==='wild'||card.type==='+4') return true;
    if(card.color===cc) return true;
    const top=G.discard[G.discard.length-1];
    if(card.type===top.type&&!CFG.WILDS.includes(card.type)) return true;
    return false;
}
function playable(hand){return hand.filter(canPlay)}

// ===== PLAY =====
function doPlay(pid, cid, color) {
    if(!G||G.over||busy) return {ok:false};
    const p=G.players[G.cur];
    if(p.id!==pid) return {ok:false,msg:'Not your turn'};
    const h=G.hands[pid], idx=h.findIndex(c=>c.id===cid);
    if(idx<0) return {ok:false,msg:'Card not found'};
    const card=h[idx];
    if(!canPlay(card)) return {ok:false,msg:'Cannot play that'};
    busy=true;
    h.splice(idx,1);
    G.discard.push(card);
    G.unoCalled[pid]=false;
    G.lastDrawId=null;

    if(card.type==='wild'||card.type==='+4'){
        if(!color){busy=false;return {ok:false,msg:'Pick color'};}
        G.wildColor=color; G.color=color;
        addLog(p.name+' chose '+color);
    } else {
        G.color=card.color; G.wildColor=null;
    }

    let skip=false, dc=0;
    if(card.type==='skip'){skip=true;addLog(p.name+' skipped '+G.players[(G.cur+G.dir+G.players.length)%G.players.length].name);}
    else if(card.type==='reverse'){G.dir*=-1;if(G.players.length===2)skip=true;addLog(p.name+' reversed direction');}
    else if(card.type==='+2'){dc=2;}
    else if(card.type==='+4'){dc=4;}

    // Stacking
    if(dc>0 && settings.stack){
        const topType=G.discard[G.discard.length-1].type;
        if((topType==='+2'&&card.type==='+2')||(topType==='+4'&&card.type==='+4')){
            G.stackPending+=dc;
            addLog(p.name+' stacked +'+dc+'!');
            sfx('draw'+dc);
            G.cur=(G.cur+G.dir+G.players.length)%G.players.length;
            G.turnStart=Date.now();
            busy=false;
            return {ok:true,card};
        }
    }

    if(h.length===0){
        G.over=true; G.winner=pid; sfx('win');
        busy=false;
        return {ok:true,win:true,card};
    }

    let next=(G.cur+G.dir+G.players.length)%G.players.length;
    if(skip) next=(next+G.dir+G.players.length)%G.players.length;
    if(dc>0){
        const np=G.players[next];
        const drawn=draw(dc);
        G.hands[np.id].push(...drawn);
        addLog(np.name+' draws '+dc);
        sfx('draw'+dc);
        if(!settings.stack) next=(next+G.dir+G.players.length)%G.players.length;
    }

    G.cur=next;
    G.turnStart=Date.now();
    sfx('play');
    busy=false;
    return {ok:true,card,next:G.players[next]};
}

function doDraw(pid) {
    if(!G||G.over||busy) return {ok:false};
    const p=G.players[G.cur];
    if(p.id!==pid) return {ok:false};
    if(playable(G.hands[pid]).length>0) return {ok:false,msg:'You have playable cards'};
    const c=draw(1);
    if(!c.length) return {ok:false,msg:'No cards'};
    G.hands[pid].push(...c);
    G.lastDrawId=c[0].id;
    sfx('draw');
    return {ok:true,card:c[0],playable:canPlay(c[0])};
}

function doPass(pid) {
    if(!G||G.over) return false;
    const p=G.players[G.cur];
    if(p.id!==pid) return false;
    G.cur=(G.cur+G.dir+G.players.length)%G.players.length;
    G.turnStart=Date.now();
    G.lastDrawId=null;
    return true;
}

function doUno(pid) {
    if(!G) return false;
    const h=G.hands[pid];
    if(!h||h.length!==1) return false;
    G.unoCalled[pid]=true;
    sfx('uno');
    addLog(pid===me.id?'You called UNO!':G.players.find(p=>p.id===pid).name+' called UNO!');
    return true;
}

function addLog(msg) {
    if(!G) return;
    G.log.unshift({msg, t:Date.now()});
    if(G.log.length>30) G.log.length=30;
    renderFeed();
}

// ===== BOT AI =====
function botPick(bot) {
    const h=G.hands[bot.id], pl=playable(h);
    if(!pl.length) return null;
    // Strategy: prioritize color matches, save wilds, use action cards tactically
    const scored=pl.map(c=>{
        let s=0;
        if(c.type==='wild') s=h.length<=3?99:5;
        else if(c.type==='+4') s=h.length<=2?98:4;
        else if(c.type==='+2') s=15;
        else if(c.type==='skip') s=h.length<=3?12:14;
        else if(c.type==='reverse') s=h.length<=3?11:8;
        else s=c.value;
        // Prefer current color
        if(c.color===(G.wildColor||G.color)) s+=6;
        return {card:c,score:s};
    });
    scored.sort((a,b)=>b.score-a.score);
    return scored[0].card;
}
function botColor(bot) {
    const h=G.hands[bot.id], ct={};
    h.forEach(c=>{if(c.color!=='wild') ct[c.color]=(ct[c.color]||0)+1});
    return Object.entries(ct).sort((a,b)=>b[1]-a[1])[0][0]||CFG.COLORS[0];
}
function botTurn() {
    if(!G||G.over) return;
    const p=G.players[G.cur];
    if(!p.bot) return;
    const delay=800+Math.random()*700;
    setTimeout(()=>{
        if(!G||G.over) return;
        const card=botPick(p);
        if(card){
            let col=null;
            if(card.type==='wild'||card.type==='+4') col=botColor(p);
            const r=doPlay(p.id,card.id,col);
            if(r.ok){
                renderAll();
                if(r.win){endGame();return;}
                botTurn();
            }
        } else {
            const dr=doDraw(p.id);
            renderAll();
            if(dr.ok&&dr.playable){
                setTimeout(()=>{
                    if(!G||G.over) return;
                    const r2=doPlay(p.id,dr.card.id);
                    if(r2.ok){renderAll();if(r2.win){endGame();return;}botTurn();}
                    else{doPass(p.id);renderAll();botTurn();}
                },500);
            } else {
                setTimeout(()=>{doPass(p.id);renderAll();botTurn();},400);
            }
        }
        // UNO call
        const h=G.hands[p.id];
        if(h&&h.length===1&&Math.random()>.05) doUno(p.id);
    },delay);
}

// ===== RENDERING =====
function cardHTML(card, playable, small) {
    const cls=small?'card-back-sm':'card';
    if(!small){
        if(playable) cls+=' playable';
        if(card.color!=='wild') cls+=' card-'+card.color;
        else cls+=' card-wild';
    }
    const sym = card.type==='skip'?'⊘':card.type==='reverse'?'⇄':card.type;
    const vs=small?'small-val':'card-value';
    const vc=small?'':('card-value'+(card.type.length>2?' small-val':'':''));
    const cs=small?'':'card-corner tl';
    const ce=small?'':'card-corner br';
    return `<div class="${cls}" data-cid="${card.id}">${sym?`<span class="${cs}">${sym}</span><span class="${vc}">${sym}</span><span class="${ce}">${sym}</span>`:''}</div>`;
}

function renderAll() {
    if(!G) return;
    renderHand(); renderDiscard(); renderOpps(); renderUI(); renderFeed();
}

function renderHand() {
    const c=$('player-hand'); if(!c) return; c.innerHTML='';
    if(!me) return;
    const h=G.hands[me.id]||[];
    const myTurn=G.players[G.cur].id===me.id&&!G.over;
    const pl=myTurn?playable(h):[];
    h.forEach(card=>{
        const ok=pl.some(x=>x.id===card.id);
        const el=document.createElement('div');
        el.innerHTML=cardHTML(card,ok);
        if(ok) el.onclick=()=>handlePlay(card);
        if(!ok&&myTurn) el.classList.add('disabled');
        c.appendChild(el);
    });
}

function renderDiscard() {
    const c=$('top-card'); if(!c||!G.discard.length) return;
    const top=G.discard[G.discard.length-1];
    c.innerHTML=cardHTML(top,false);
    const ci=$('color-indicator');
    if(ci) ci.className='color-indicator '+(G.wildColor||G.color);
}

function renderOpps() {
    const bots=G.players.filter(p=>p.bot);
    bots.forEach((b,i)=>{
        const cards=$('opp-cards-'+i);
        const name=$('opp-name-'+i);
        const count=$('opp-count-'+i);
        const avatar=$('opp-avatar-'+i);
        const opp=$('opp-'+i);
        if(!cards||!name||!count) return;
        const h=G.hands[b.id]||[];
        name.textContent=b.name;
        count.textContent=h.length+' cards';
        avatar.textContent=b.name[0];
        cards.innerHTML=h.slice(0,8).map(()=>'<div class="opp-mini-card"></div>').join('');
        const isActive=G.players[G.cur].id===b.id;
        opp.classList.toggle('active',isActive);
    });
}

function renderUI() {
    const dc=$('deck-count'); if(dc) dc.textContent=G.deck.length;
    const dir=$('direction-indicator');
    if(dir){dir.textContent=G.dir===1?'↻':'↺';dir.classList.toggle('rev',G.dir===-1);}
    const rc=$('game-room-code'); if(rc) rc.textContent=roomCode||'LOCAL';
    const ub=$('uno-btn');
    if(ub){
        const h=me?G.hands[me.id]:[];
        const show=h.length===1&&!G.unoCalled[me.id]&&!G.over;
        ub.classList.toggle('visible',show);
        ub.classList.remove('called');
    }
}

function renderFeed() {
    const f=$('action-feed'); if(!f) return;
    const now=Date.now();
    f.innerHTML=G.log.filter(l=>now-l.t<4000).slice(0,6).map(l=>
        `<div class="feed-item"><b>${l.msg}</b></div>`
    ).join('');
}

// ===== HANDLERS =====
function handlePlay(card) {
    if(!G||G.over||busy) return;
    if(card.type==='wild'||card.type==='+4'){pendingWild=card;showModal('color-picker');return;}
    execPlay(card.id);
}

function chooseColor(color) {
    closeModal('color-picker');
    if(!pendingWild) return;
    execPlay(pendingWild.id,color);
    pendingWild=null;
}

function execPlay(cid) {
    const r=doPlay(me.id,cid);
    if(r.ok){
        const el=document.querySelector(`[data-cid="${cid}"]`);
        if(el){el.classList.add('anim-play');setTimeout(()=>el.classList.remove('anim-play'),350);}
        renderAll();
        if(r.win){endGame();}
        else botTurn();
    } else if(r.msg){
        toast(r.msg);
        const el=document.querySelector(`[data-cid="${cid}"]`);
        if(el){el.classList.add('anim-shake');setTimeout(()=>el.classList.remove('anim-shake'),300);}
        sfx('buzz');
    }
}

function handleDraw() {
    if(!G||G.over||busy) return;
    const r=doDraw(me.id);
    if(r.ok){
        renderAll();
        if(r.playable) toast('You can play the drawn card!');
        else {
            setTimeout(()=>{doPass(me.id);renderAll();botTurn();},400);
        }
    } else if(r.msg) toast(r.msg);
}

function callUno() {
    if(!me||!G) return;
    if(doUno(me.id)){
        const ub=$('uno-btn');
        if(ub){ub.classList.add('called');}
        renderFeed();
    } else toast('You can only call UNO with 1 card!');
}

function sortHand(by) {
    if(!me||!G) return;
    const h=G.hands[me.id];
    if(by==='color'){
        const o={red:0,blue:1,green:2,yellow:3,wild:4};
        h.sort((a,b)=>(o[a.color]??4)-(o[b.color]??4));
    } else {
        h.sort((a,b)=>(a.value||0)-(b.value||0));
    }
    renderHand();
}

// ===== TIMER =====
function startTimer() {
    stopTimer();
    if(!settings.timer||!G||G.over) return;
    const el=$('turn-timer');
    timerInt=setInterval(()=>{
        if(!G||G.over){stopTimer();return;}
        const left=Math.max(0,CFG.TURN_MS-(Date.now()-G.turnStart));
        const s=Math.ceil(left/1000);
        if(el){
            el.textContent=s+'s';
            el.classList.toggle('warning',s<=3);
        }
        if(left<=0){
            stopTimer();
            if(G.players[G.cur].id===me.id){
                toast('Time is up!');
                if(G.lastDrawId){
                    doPass(me.id);
                } else {
                    const dr=doDraw(me.id);
                    if(dr.ok&&dr.playable){
                        // One chance to play drawn card
                        setTimeout(()=>{
                            if(!G||G.over) return;
                            const pl=playable(G.hands[me.id]);
                            if(pl.length>0) renderAll(); // let them click
                            else {doPass(me.id);renderAll();botTurn();}
                        },800);
                    } else {
                        doPass(me.id); renderAll(); botTurn();
                    }
                }
            }
        }
        if(s<=3&&s>0) sfx('tick');
    },100);
}
function stopTimer(){if(timerInt){clearInterval(timerInt);timerInt=null;}}

// ===== GAME FLOW =====
function startQuickMatch() {
    const name=load('name','Player');
    const bots=CFG.BOTS.slice(0,3).map(n=>({id:uid(),name:n,bot:true}));
    initGame([{id:uid(),name,bot:false},...bots]);
    roomCode=null; isHost=false;
    showScreen('game-screen');
    renderAll(); startTimer();
    addLog('Game started!');
}

function createRoom() {
    const name=$('create-name')?.value.trim();
    if(!name){toast('Enter your name');return;}
    save('name',name);
    closeModal('create-modal');
    roomCode=genCode();
    isHost=true; lobbyCount=4;
    showScreen('lobby-screen');
    $('lobby-code-display').textContent=roomCode;
    renderLobby();
    initFirebase();
    toast('Room created!');
}

function joinRoom() {
    const code=$('join-code')?.value.trim().toUpperCase();
    const name=$('join-name')?.value.trim();
    if(!code){toast('Enter room code');return;}
    if(!name){toast('Enter your name');return;}
    save('name',name);
    closeModal('join-modal');
    roomCode=code; isHost=false;
    showScreen('lobby-screen');
    $('lobby-code-display').textContent=roomCode;
    renderLobby();
    initFirebase();
    toast('Joining...');
}

function leaveLobby() {
    stopTimer();
    if(lobbySub) lobbySub();
    roomCode=null; roomRef=null; isHost=false;
    showScreen('menu-screen');
}

function startFromLobby() {
    if(!isHost) return;
    if(lobbySub) lobbySub();
    // Create game with bots to fill
    const name=load('name','Player');
    const needed=Math.max(0,lobbyCount-1);
    const bots=CFG.BOTS.slice(0,needed).map(n=>({id:uid(),name:n,bot:true}));
    initGame([{id:uid(),name,bot:false},...bots]);
    showScreen('game-screen');
    renderAll(); startTimer();
    addLog('Game started!');
}

function leaveGame() {
    stopTimer();
    if(roomRef&&db){
        db.ref('rooms/'+roomCode+'/players/'+me.id).remove();
    }
    roomCode=null; roomRef=null; isHost=false;
    G=null; showScreen('menu-screen');
    toast('Left game');
}

function endGame() {
    stopTimer();
    if(roomRef&&db){
        db.ref('rooms/'+roomCode+'/gameOver').set(true);
    }
    const won=me&&G.winner===me.id;
    sfx(won?'win':'lose');

    const title=$('game-result-title');
    const results=$('game-results');
    if(!title||!results) return;

    title.textContent=won?'You Win!':'Game Over';

    const sorted=G.players.map(p=>({
        name:p.name, isMe:!p.bot,
        score:(G.hands[p.id]||[]).reduce((s,c)=>s+(CFG.SCORES[c.type]||0),0),
        isWin:p.id===G.winner
    })).sort((a,b)=>a.score-b.score);

    results.innerHTML=sorted.map((r,i)=>`
        <div class="result-item ${r.isWin?'winner':''}">
            <span class="result-rank">${i+1}</span>
            <span class="result-name">${r.name}${r.isMe?' (You)':''}</span>
            <span class="result-score">${r.score}pts</span>
        </div>`).join('');

    if(won){
        for(let i=0;i<60;i++){
            const c=document.createElement('div');
            c.className='confetti';
            c.style.left=Math.random()*100+'%';
            c.style.background=['#E63946','#457BF5','#2DC66B','#F5C542'][0|Math.random()*4];
            c.style.animationDelay=Math.random()*2+'s';
            c.style.width=(4+Math.random()*8)+'px';
            c.style.height=(4+Math.random()*8)+'px';
            document.body.appendChild(c);
            setTimeout(()=>c.remove(),5000);
        }
    }

    // Stats
    const st=load('stats',{g:0,w:0,x:0,l:1});
    st.g++; if(won)st.w++;
    st.x+=won?300:60;
    if(st.x>=st.l*300){st.l++;st.x=0;}
    save('stats',st);

    showModal('game-over-modal');
}

function playAgain() {
    closeModal('game-over-modal');
    if(roomCode&&isHost&&db){
        db.ref('rooms/'+roomCode).remove();
    }
    startQuickMatch();
}

function backToMenu() {
    stopTimer();
    G=null; showScreen('menu-screen');
    updateMenuProfile();
}

function selectMode(m) {
    mode=m;
    document.querySelectorAll('.mode-card').forEach(c=>c.classList.toggle('active',c.dataset.mode===m));
    save('mode',m);
}

// ===== MENU UI =====
function showCreateLobby(){showModal('create-modal');}
function showJoinLobby(){showModal('join-modal');}
function showSettings(){
    const s=load('settings',settings); settings={...settings,...s};
    ['sound','timer','stack'].forEach(k=>{
        const b=$(k+'-toggle');
        if(b){b.classList.toggle('active',settings[k]);b.textContent=settings[k]?'ON':'OFF';}
    });
    showModal('settings-modal');
}
function toggleSetting(k){
    settings[k]=!settings[k];
    const b=$(k+'-toggle');
    if(b){b.classList.toggle('active',settings[k]);b.textContent=settings[k]?'ON':'OFF';}
    save('settings',settings);
}
function showLeaderboard(){
    const list=$('leaderboard-list');if(!list) return;
    const s=load('stats',{g:0,w:0,x:0,l:1});
    list.innerHTML=`
        <div class="leaderboard-item"><span class="leaderboard-rank">G</span><span class="leaderboard-name">Games</span><span class="leaderboard-score">${s.g}</span></div>
        <div class="leaderboard-item"><span class="leaderboard-rank">W</span><span class="leaderboard-name">Wins</span><span class="leaderboard-score">${s.w}</span></div>
        <div class="leaderboard-item"><span class="leaderboard-rank">L</span><span class="leaderboard-name">Level</span><span class="leaderboard-score">${s.l}</span></div>
        <div class="leaderboard-item"><span class="leaderboard-rank">XP</span><span class="leaderboard-name">Experience</span><span class="leaderboard-score">${s.xp}/${s.l*300}</span></div>
    `;
    showModal('leaderboard-modal');
}
function setPlayerCount(n){
    lobbyCount=n;
    document.querySelectorAll('.count-btn').forEach(b=>b.classList.toggle('active',parseInt(b.textContent)===n));
}
function updateMenuProfile(){
    const name=load('name','Player');
    const el=$('menu-player-name'); if(el) el.textContent=name;
    const av=$('menu-avatar'); if(av) av.textContent=name[0]||'P';
    const lv=$('player-level'); if(lv) lv.textContent=load('stats',{l:1}).l;
    const xf=$('xp-fill');
    const st=load('stats',{l:1,x:0});
    if(xf) xf.style.width=Math.min(st.x/(st.l*300)*100,100)+'%';
}
function copyCode(){
    navigator.clipboard?.writeText(roomCode);
    toast('Copied!');
}

// ===== FIREBASE =====
function initFirebase() {
    try{
        if(typeof firebase==='undefined'||!db) return;
        if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        db=firebase.database();
        roomRef=db.ref('rooms/'+roomCode);
        // Host writes room data
        if(isHost){
            roomRef.set({
                code:roomCode, mode, status:'waiting',
                maxPlayers:lobbyCount, settings,
                createdAt:firebase.database.ServerValue.TIMESTAMP
            });
            roomRef.child('players').on('child_added',snap=>{
                renderLobby();
            });
            roomRef.child('players').on('child_removed',snap=>{
                renderLobby();
            });
            roomRef.child('startSignal').on('value',()=>{
                startFromLobby();
            });
        } else {
            // Joiner listens
            lobbySub=roomRef.on('value',snap=>{
                const d=snap.val;
                if(!d) return;
                if(d.gameOver){
                    // Load game state from Firebase
                    roomRef.child('state').once('value',s=>{
                        if(!s) return;
                        G=s.state;
                        me=G.players.find(p=>!p.bot);
                        showScreen('game-screen');
                        renderAll(); startTimer();
                    });
                    return;
                }
                if(d.started&&!G){
                    roomRef.child('state').once('value',s=>{
                        if(!s) return;
                        G=s.state;
                        me=G.players.find(p=>!p.bot);
                        showScreen('game-screen');
                        renderAll(); startTimer();
                    });
                }
                if(d.players) renderLobby();
            });
        }
        console.log('Firebase ready');
    }catch(e){console.log('Firebase offline mode');}
}

// ===== INIT =====
function init() {
    // Particles
    const pc=$('particles');
    if(pc) for(let i=0;i<18;i++){
        const p=document.createElement('div');
        p.className='particle';
        p.style.left=Math.random()*100+'%';
        p.style.top=Math.random()*100+'%';
        p.style.background=['#E63946','#457BF5','#2DC66B','#F5C542'][0|Math.random()*4];
        p.style.animationDelay=Math.random()*18+'s';
        p.style.animationDuration=(14+Math.random()*8)+'s';
        pc.appendChild(p);
    }

    // Load saved
    updateMenuProfile();
    selectMode(load('mode','classic'));

    // Loading animation
    let prog=0;
    const bar=$('loading-progress'), txt=$('loading-text');
    const msgs=['Shuffling...','Dealing...','Ready!'];
    const iv=setInterval(()=>{
        prog+=Math.random()*30+15;
        if(prog>=100){
            prog=100;clearInterval(iv);
            if(bar) bar.style.width='100%';
            if(txt) txt.textContent=msgs[2];
            setTimeout(()=>showScreen('menu-screen'),350);
        } else {
            if(bar) bar.style.width=prog+'%';
            if(txt) txt.textContent=msgs[Math.min(Math.floor(prog/35),1)];
        }
    },180);

    // Audio
    document.addEventListener('click',initAudio,{once:true});
    document.addEventListener('touchstart',initAudio,{once:true});

    // Firebase
    try{
        if(typeof firebase!=='undefined'&&!firebase.apps.length){
            firebase.initializeApp(FIREBASE_CONFIG);
            db=firebase.database();
            console.log('Firebase initialized');
        }
    }catch(e){console.log('Firebase not available');}

    // Keyboard
    document.addEventListener('keydown',e=>{
        if(!G||G.over) return;
        if(G.players[G.cur].id!==me.id) return;
        if(e.key==='d'||e.key==='D') handleDraw();
        else if(e.key==='u'||e.key==='U') callUno();
        else if(e.key>='0'&&e.key<='9'){
            const h=G.hands[me.id];
            const idx=parseInt(e.key)-1;
            if(h&&h[idx]) handlePlay(h[idx]);
        }
    });
}

document.addEventListener('DOMContentLoaded',init);
