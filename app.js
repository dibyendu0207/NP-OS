/* NP-OS — NEET Progress OS — Final Guardian app.js
   Read-only guardian dashboard.
   Same-origin sync: reads NEET OS localStorage data without writing it.
   Cross-origin cloud sync is intentionally not faked; a backend/bridge is
   required when the two apps are hosted on different origins.
*/
"use strict";

const NP_VERSION="1.0.0";
const PIN_KEY="nposGuardianPinHash";
const SESSION_KEY="nposGuardianSession";
const LAST_SYNC_KEY="nposLastSync";
const PLAN_START="2026-09-14";

const K={
    current:"neetOSStudyData",
    history:"neetOSHistory",
    syllabus:"neetOSSyllabus",
    settings:"neetOSSettings"
};

const TASKS=[
    {
        name:"Physics Class",
        start:"08:45",
        end:"11:00",
        type:"class",
        subject:"Physics"
    },
    {
        name:"Biology Class",
        start:"11:00",
        end:"13:00",
        type:"class",
        subject:"Biology"
    },
    {
        name:"Chemistry Class",
        start:"13:15",
        end:"15:30",
        type:"class",
        subject:"Chemistry"
    },
    {
        name:"Physics Questions",
        start:"15:45",
        end:"16:30",
        type:"questions",
        subject:"Physics",
        target:30
    },
    {
        name:"Chemistry Revision + Questions",
        start:"18:50",
        end:"20:50",
        type:"revision",
        subject:"Chemistry",
        target:50
    },
    {
        name:"Biology Revision + NCERT + Class Questions",
        start:"21:00",
        end:"22:30",
        type:"biology",
        subject:"Biology"
    },
    {
        name:"Physics Question Practice",
        start:"23:00",
        end:"00:30",
        type:"questions",
        subject:"Physics",
        target:50
    },
    {
        name:"Daily Repair",
        start:"00:30",
        end:"02:00",
        type:"repair",
        subject:"Mixed"
    },
    {
        name:"Self Study",
        start:"00:00",
        end:"23:59",
        type:"self-study",
        subject:"Mixed"
    }
];

const PROGRESS_TASKS=8;

const FALLBACK_SYLLABUS={
    Physics:[
        "Physics and Measurement",
        "Kinematics",
        "Laws of Motion",
        "Work, Energy and Power",
        "Rotational Motion",
        "Gravitation",
        "Properties of Solids and Liquids",
        "Thermodynamics",
        "Kinetic Theory of Gases",
        "Oscillations and Waves",
        "Electrostatics",
        "Current Electricity",
        "Magnetic Effects of Current and Magnetism",
        "Electromagnetic Induction and Alternating Currents",
        "Electromagnetic Waves",
        "Optics",
        "Dual Nature of Matter and Radiation",
        "Atoms and Nuclei",
        "Electronic Devices",
        "Experimental Skills"
    ],

    "Physical Chemistry":[
        "Some Basic Concepts of Chemistry",
        "Atomic Structure",
        "Chemical Thermodynamics",
        "Solutions",
        "Equilibrium",
        "Redox Reactions and Electrochemistry",
        "Chemical Kinetics"
    ],

    "Inorganic Chemistry":[
        "Classification of Elements and Periodicity in Properties",
        "P-Block Elements",
        "d- and f-Block Elements",
        "Coordination Compounds"
    ],

    "Organic Chemistry":[
        "Purification and Characterisation of Organic Compounds",
        "Some Basic Principles of Organic Chemistry",
        "Hydrocarbons",
        "Organic Compounds Containing Halogens",
        "Organic Compounds Containing Oxygen",
        "Organic Compounds Containing Nitrogen",
        "Biomolecules",
        "Principles Related to Practical Chemistry"
    ],

    Botany:[
        "The Living World",
        "Biological Classification",
        "Plant Kingdom",
        "Morphology of Flowering Plants",
        "Anatomy of Flowering Plants",
        "Cell: The Unit of Life",
        "Biomolecules",
        "Transport in Plants",
        "Mineral Nutrition",
        "Photosynthesis in Plants",
        "Respiration in Plants",
        "Plant Growth and Development",
        "Sexual Reproduction in Flowering Plants",
        "Principles of Inheritance and Variation",
        "Molecular Basis of Inheritance",
        "Evolution",
        "Plant Biotechnology: Principles and Processes",
        "Biotechnology and Its Applications",
        "Organisms and Populations",
        "Ecosystem",
        "Biodiversity and Conservation"
    ],

    Zoology:[
        "Animal Kingdom",
        "Structural Organisation in Animals",
        "Cell Cycle and Cell Division",
        "Human Digestive System",
        "Breathing and Exchange of Gases",
        "Body Fluids and Circulation",
        "Excretory Products and Their Elimination",
        "Locomotion and Movement",
        "Neural Control and Coordination",
        "Chemical Coordination and Integration",
        "Human Reproduction",
        "Reproductive Health",
        "Human Health and Disease",
        "Evolution",
        "Animal Husbandry",
        "Microbes in Human Welfare",
        "Biotechnology and Its Applications",
        "Organisms and Populations",
        "Ecosystem",
        "Biodiversity and Conservation"
    ]
};

let S={
    current:null,
    history:[],
    syllabus:FALLBACK_SYLLABUS,
    settings:null,
    lastSynced:null,
    source:"Waiting"
};

let page="homePage";
let filter="All";
let syncLoop=null;
let clockLoop=null;
let menu=false;

const $=id=>document.getElementById(id);

const esc=v=>String(v??"").replace(
    /[&<>"']/g,
    c=>({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#39;"
    }[c])
);

function json(key,f=null){
    try{
        let x=localStorage.getItem(key);
        return x==null||x===""?f:JSON.parse(x);
    }catch{
        return f;
    }
}

function dk(d=new Date()){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function pd(k){
    let [y,m,d]=String(k).split("-").map(Number);
    return new Date(y,m-1,d);
}

function calendarKey(){
    return dk();
}

function studyKey(d=new Date()){
    d=new Date(d);

    if(d.getHours()<3){
        d.setDate(d.getDate()-1);
    }

    return dk(d);
}

function dayNo(k){
    return Math.max(
        1,
        Math.floor(
            (pd(k)-pd(PLAN_START))/86400000
        )+1
    );
}

function weekNo(k){
    return Math.ceil(dayNo(k)/7);
}

function fmtDate(k){
    return k
        ? pd(k).toLocaleDateString(
            "en-IN",
            {
                weekday:"long",
                day:"numeric",
                month:"long",
                year:"numeric"
            }
        )
        : "—";
}

function shortDate(k){
    return k
        ? pd(k).toLocaleDateString(
            "en-IN",
            {
                day:"numeric",
                month:"short"
            }
        )
        : "—";
}

function dur(sec){
    sec=Math.max(
        0,
        Math.floor(Number(sec)||0)
    );

    let h=Math.floor(sec/3600);

    sec%=3600;

    let m=Math.floor(sec/60);
    let s=sec%60;

    return h
        ? `${h}h ${String(m).padStart(2,"0")}m`
        : `${m}m ${String(s).padStart(2,"0")}s`;
}

function longDur(sec){
    sec=Math.max(
        0,
        Math.floor(Number(sec)||0)
    );

    let h=Math.floor(sec/3600);

    sec%=3600;

    let m=Math.floor(sec/60);
    let s=sec%60;

    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function clamp(v,a=0,b=100){
    return Math.max(
        a,
        Math.min(
            b,
            Number(v)||0
        )
    );
}

function tmin(t){
    let [h,m]=String(t).split(":").map(Number);
    return h*60+m;
}

function nowIn(t){
    let n=new Date();

    let x=n.getHours()*60+n.getMinutes();

    let a=tmin(t.start);
    let b=tmin(t.end);

    if(b===0){
        b=1440;
    }

    return a<b
        ? x>=a&&x<b
        : x>=a||x<b;
}

function validPin(p){
    return /^\d{4,6}$/.test(String(p));
}

async function hashPin(p){

    if(crypto?.subtle){

        let b=new TextEncoder().encode(
            String(p)
        );

        let d=await crypto.subtle.digest(
            "SHA-256",
            b
        );

        return [...new Uint8Array(d)]
            .map(
                x=>x
                    .toString(16)
                    .padStart(2,"0")
            )
            .join("");
    }

    let h=2166136261;

    for(let c of String(p)){
        h^=c.charCodeAt(0);
        h=Math.imul(
            h,
            16777619
        );
    }

    return `f-${h>>>0}`;
}

function hasPin(){
    return !!localStorage.getItem(
        PIN_KEY
    );
}

function logged(){
    return localStorage.getItem(
        SESSION_KEY
    )==="1";
}

function msg(id,text,ok=false){

    let e=$(id);

    if(!e){
        return;
    }

    e.textContent=text;

    e.classList.toggle(
        "success",
        ok
    );

    e.classList.toggle(
        "error",
        !ok
    );
}

function loginView(){

    $("loginScreen")?.removeAttribute(
        "hidden"
    );

    $("mainApp")?.setAttribute(
        "hidden",
        ""
    );

    $("pinSetupBox")?.toggleAttribute(
        "hidden",
        hasPin()
    );

    $("pinLoginBox")?.toggleAttribute(
        "hidden",
        !hasPin()
    );
}

function appView(){

    $("loginScreen")?.setAttribute(
        "hidden",
        ""
    );

    $("mainApp")?.removeAttribute(
        "hidden"
    );
}

async function setupPin(){

    let p=$("setupPin")?.value.trim()||"";
    let c=$("confirmPin")?.value.trim()||"";

    if(!validPin(p)){
        msg(
            "pinSetupMessage",
            "PIN must contain 4–6 digits."
        );
        return;
    }

    if(p!==c){
        msg(
            "pinSetupMessage",
            "PINs do not match."
        );
        return;
    }

    localStorage.setItem(
        PIN_KEY,
        await hashPin(p)
    );

    localStorage.setItem(
        SESSION_KEY,
        "1"
    );

    $("setupPin").value="";
    $("confirmPin").value="";

    appView();
    startApp();
}

async function login(){

    let p=$("loginPin")?.value.trim()||"";

    if(!validPin(p)){
        msg(
            "loginMessage",
            "Enter your 4–6 digit PIN."
        );
        return;
    }

    let good=
        await hashPin(p)===
        localStorage.getItem(PIN_KEY);

    if(!good){
        msg(
            "loginMessage",
            "Incorrect PIN."
        );
        return;
    }

    localStorage.setItem(
        SESSION_KEY,
        "1"
    );

    $("loginPin").value="";

    appView();
    startApp();
}

function logout(){

    localStorage.removeItem(
        SESSION_KEY
    );

    if(syncLoop){
        clearInterval(syncLoop);
    }

    if(clockLoop){
        clearInterval(clockLoop);
    }

    closeMenu();
    loginView();
}

function openPin(){
    $("changePinModal")?.removeAttribute(
        "hidden"
    );
}

function closePin(){

    $("changePinModal")?.setAttribute(
        "hidden",
        ""
    );

    [
        "currentPin",
        "newPin",
        "newPinConfirm"
    ].forEach(id=>{
        if($(id)){
            $(id).value="";
        }
    });

    msg(
        "changePinMessage",
        ""
    );
}

async function changePin(){

    let a=$("currentPin")?.value.trim()||"";
    let b=$("newPin")?.value.trim()||"";
    let c=$("newPinConfirm")?.value.trim()||"";

    if(!validPin(a)||!validPin(b)){
        msg(
            "changePinMessage",
            "All PINs must contain 4–6 digits."
        );
        return;
    }

    if(
        await hashPin(a)!==
        localStorage.getItem(PIN_KEY)
    ){
        msg(
            "changePinMessage",
            "Current PIN is incorrect."
        );
        return;
    }

    if(b!==c){
        msg(
            "changePinMessage",
            "New PINs do not match."
        );
        return;
    }

    localStorage.setItem(
        PIN_KEY,
        await hashPin(b)
    );

    msg(
        "changePinMessage",
        "PIN changed successfully.",
        true
    );

    setTimeout(
        closePin,
        500
    );
}/* -------------------- SYNC -------------------- */

function normCurrent(x){

    if(!x || typeof x!=="object"){
        return null;
    }

    return {
        ...x,

        completed:x.completed||{},

        studySeconds:x.studySeconds||{},

        taskMeta:x.taskMeta||{},

        questionCounts:x.questionCounts||{},

        missedReasons:x.missedReasons||{},

        repairLog:
            Array.isArray(x.repairLog)
                ? x.repairLog
                : []
    };
}

function normHistory(x){

    return Array.isArray(x)
        ? x
            .filter(v=>v&&v.date)
            .sort(
                (a,b)=>
                    String(a.date)
                    .localeCompare(
                        String(b.date)
                    )
            )
        : [];
}

function normSyllabus(x){

    x=x&&typeof x==="object"
        ? x
        : {};

    return Object.fromEntries(
        Object.keys(FALLBACK_SYLLABUS)
        .map(k=>[
            k,
            Array.isArray(x[k])
                ? x[k]
                : FALLBACK_SYLLABUS[k]
        ])
    );
}

function sync(){

    S.current=
        normCurrent(
            json(
                K.current,
                null
            )
        );

    S.history=
        normHistory(
            json(
                K.history,
                []
            )
        );

    S.syllabus=
        normSyllabus(
            json(
                K.syllabus,
                FALLBACK_SYLLABUS
            )
        );

    S.settings=
        json(
            K.settings,
            null
        );

    S.lastSynced=
        new Date();

    localStorage.setItem(
        LAST_SYNC_KEY,
        S.lastSynced.toISOString()
    );

    S.source=
        S.current
            ? "NEET OS • Same-origin"
            : "Waiting for NEET OS data";

    updateAll();

    setSync(
        S.current
    );
}

function setSync(ok){

    let title=
        $("syncStatusTitle");

    let text=
        $("syncStatusMessage");

    if(title){
        title.textContent=
            ok
                ? "Connected"
                : "Waiting for Sync";
    }

    if(text){
        text.textContent=
            ok
                ? "Latest NEET OS progress is available."
                : "Open NEET OS on the same browser origin to provide progress data.";
    }

    $("connectionIndicator")
        ?.classList
        .toggle(
            "connected",
            !!ok
        );

    if($("connectionIndicator")){

        $("connectionIndicator").title=
            ok
                ? "Synced with NEET OS"
                : "Waiting for sync";
    }

    if($("syncIcon")){

        $("syncIcon").textContent=
            ok
                ? "☁️"
                : "⏳";
    }

    if($("syncDataStatus")){

        $("syncDataStatus").textContent=
            ok
                ? "Available"
                : "Waiting";
    }
}

function startSync(){

    sync();

    clearInterval(
        syncLoop
    );

    syncLoop=
        setInterval(
            ()=>{
                if(logged()){
                    sync();
                }
            },
            3000
        );

    window.addEventListener(
        "storage",
        e=>{
            if(
                Object.values(K)
                    .includes(e.key)
            ){
                sync();
            }
        }
    );
}

function cur(){

    return S.current || {
        date:studyKey(),

        completed:{},

        studySeconds:{},

        taskMeta:{},

        questionCounts:{},

        missedReasons:{},

        repairLog:[],

        activeTask:null,

        activeStartTime:null
    };
}

function ts(i,d=cur()){

    let v=
        Number(
            d.studySeconds?.[i]||0
        );

    if(
        d.activeTask===i &&
        d.activeStartTime
    ){

        v+=Math.max(
            0,
            Math.floor(
                (
                    Date.now()-
                    Number(
                        d.activeStartTime
                    )
                )/1000
            )
        );
    }

    return v;
}

function totalTime(d=cur()){

    return TASKS.reduce(
        (a,_,i)=>
            a+ts(i,d),
        0
    );
}

function totalQ(d=cur()){

    return Object.values(
        d.questionCounts||{}
    ).reduce(
        (a,v)=>
            a+Number(v||0),
        0
    );
}

function completed(d=cur()){

    return TASKS.reduce(
        (a,_,i)=>
            a+
            (
                i<PROGRESS_TASKS &&
                d.completed?.[i]
                    ? 1
                    : 0
            ),
        0
    );
}

function progress(){

    return Math.round(
        completed(cur())/
        PROGRESS_TASKS*
        100
    );
}

function snapshot(d){

    if(!d?.date){
        return null;
    }

    let x=
        JSON.parse(
            JSON.stringify(d)
        );

    x.activeTask=null;

    x.activeStartTime=null;

    x.totalStudySeconds=
        TASKS.reduce(
            (a,_,i)=>
                a+
                Number(
                    x.studySeconds?.[i]||0
                ),
            0
        );

    x.totalQuestions=
        totalQ(x);

    x.completedCount=
        completed(x);

    return x;
}

function allHistory(){

    let h=[
        ...S.history
    ];

    let x=
        snapshot(
            cur()
        );

    if(x){

        let i=
            h.findIndex(
                v=>v.date===x.date
            );

        if(i>=0){
            h[i]=x;
        }else{
            h.push(x);
        }
    }

    return h.sort(
        (a,b)=>
            String(a.date)
            .localeCompare(
                String(b.date)
            )
    );
}

function active(s){

    return !!s &&
        (
            Number(
                s.totalStudySeconds??0
            )>0 ||

            Number(
                s.totalQuestions??0
            )>0 ||

            Number(
                s.completedCount??0
            )>0
        );
}

function streak(){

    let h=
        new Map(
            allHistory()
                .map(
                    x=>[
                        x.date,
                        x
                    ]
                )
        );

    let d=
        pd(
            studyKey()
        );

    let n=0;

    while(
        active(
            h.get(
                dk(d)
            )
        )
    ){

        n++;

        d.setDate(
            d.getDate()-1
        );
    }

    return n;
}

function longestStreak(){

    let h=
        new Set(
            allHistory()
                .filter(active)
                .map(
                    x=>x.date
                )
        );

    let best=0;

    for(let k of h){

        let d=
            pd(k);

        d.setDate(
            d.getDate()-1
        );

        if(
            h.has(
                dk(d)
            )
        ){
            continue;
        }

        let n=1;

        while(true){

            d.setDate(
                d.getDate()+1
            );

            if(
                !h.has(
                    dk(d)
                )
            ){
                break;
            }

            n++;
        }

        best=
            Math.max(
                best,
                n
            );
    }

    return best;
}

function bests(){

    let b={
        study:{
            value:0,
            date:null
        },

        q:{
            value:0,
            date:null
        },

        tasks:{
            value:0,
            date:null
        }
    };

    for(
        let x of allHistory()
    ){

        let st=
            Number(
                x.totalStudySeconds||0
            );

        let q=
            Number(
                x.totalQuestions||0
            );

        let t=
            Number(
                x.completedCount||0
            );

        if(
            st>b.study.value
        ){
            b.study={
                value:st,
                date:x.date
            };
        }

        if(
            q>b.q.value
        ){
            b.q={
                value:q,
                date:x.date
            };
        }

        if(
            t>b.tasks.value
        ){
            b.tasks={
                value:t,
                date:x.date
            };
        }
    }

    return {
        ...b,
        streak:longestStreak()
    };
}


/* -------------------- HOME -------------------- */

function headers(){

    let k=
        calendarKey();

    let d=
        dayNo(k);

    let w=
        weekNo(k);

    if($("todayDate")){
        $("todayDate").textContent=
            fmtDate(k);
    }

    if($("weekLabel")){
        $("weekLabel").textContent=
            `Week ${w}`;
    }

    if($("dayLabel")){
        $("dayLabel").textContent=
            `Day ${d}`;
    }

    if($("dailyReportDate")){
        $("dailyReportDate").textContent=
            `Study day: ${fmtDate(studyKey())}`;
    }

    if($("weeklyCurrentDay")){
        $("weeklyCurrentDay").textContent=
            `Day ${d}`;
    }

    let wd=
        pd(k);

    let dow=
        wd.getDay();

    let off=
        dow===0
            ? -6
            : 1-dow;

    wd.setDate(
        wd.getDate()+off
    );

    let we=
        new Date(wd);

    we.setDate(
        we.getDate()+6
    );

    if($("weeklyDateRange")){

        $("weeklyDateRange").textContent=
            `${shortDate(dk(wd))} – ${shortDate(dk(we))}`;
    }

    let mo=
        pd(k);

    mo.setDate(
        mo.getDate()-29
    );

    if($("monthlyDateRange")){

        $("monthlyDateRange").textContent=
            `${shortDate(dk(mo))} – ${shortDate(k)}`;
    }
}

function subjects(){

    let d=
        cur();

    return [
        "Physics",
        "Chemistry",
        "Biology"
    ].map(
        s=>({

            s,

            time:
                TASKS.reduce(
                    (a,t,i)=>
                        a+
                        (
                            t.subject===s
                                ? ts(i,d)
                                : 0
                        ),
                    0
                ),

            q:
                TASKS.reduce(
                    (a,t,i)=>
                        a+
                        (
                            t.subject===s
                                ? Number(
                                    d.questionCounts?.[i]||0
                                )
                                : 0
                        ),
                    0
                ),

            tasks:
                TASKS.reduce(
                    (a,t,i)=>
                        a+
                        (
                            t.subject===s &&
                            i<8 &&
                            d.completed?.[i]
                                ? 1
                                : 0
                        ),
                    0
                )
        })
    );
}

function home(){

    let d=
        cur();

    let p=
        progress();

    let time=
        totalTime(d);

    let q=
        totalQ(d);

    let c=
        completed(d);

    let st=
        streak();

    [
        "todayProgressPercent",
        "progressRingValue"
    ].forEach(
        id=>{
            if($(id)){
                $(id).textContent=
                    `${p}%`;
            }
        }
    );

    if($("homeStudyTime")){
        $("homeStudyTime").textContent=
            dur(time);
    }

    if($("homeTaskCount")){
        $("homeTaskCount").textContent=
            `${c} / 8`;
    }

    if($("homeQuestionCount")){
        $("homeQuestionCount").textContent=
            q;
    }

    if($("homeStreak")){
        $("homeStreak").textContent=
            `${st} days`;
    }

    if($("summaryStudyTime")){
        $("summaryStudyTime").textContent=
            dur(time);
    }

    if($("summaryTasks")){
        $("summaryTasks").textContent=
            `${c} / 8`;
    }

    if($("summaryQuestions")){
        $("summaryQuestions").textContent=
            q;
    }

    if($("summaryStreak")){
        $("summaryStreak").textContent=
            `${st} days`;
    }

    let map={
        Physics:[
            "homePhysicsTime",
            "homePhysicsProgress",
            "homePhysicsQuestions"
        ],

        Chemistry:[
            "homeChemistryTime",
            "homeChemistryProgress",
            "homeChemistryQuestions"
        ],

        Biology:[
            "homeBiologyTime",
            "homeBiologyProgress",
            "homeBiologyQuestions"
        ]
    };

    subjects().forEach(
        x=>{

            let [
                a,
                b,
                cid
            ]=
                map[x.s];

            if($(a)){
                $(a).textContent=
                    dur(x.time);
            }

            if($(b)){
                $(b).style.width=
                    `${time
                        ? Math.round(
                            x.time/time*100
                        )
                        : 0}%`;
            }

            if($(cid)){
                $(cid).textContent=
                    x.q;
            }
        }
    );

    repair(d);
    missed(d);
    live();
}

function repair(d){

    let i=
        TASKS.findIndex(
            t=>t.type==="repair"
        );

    let sec=
        i>=0
            ? ts(i,d)
            : 0;

    let n=
        Array.isArray(
            d.repairLog
        )
            ? d.repairLog.length
            : 0;

    if($("repairTime")){
        $("repairTime").textContent=
            `${Math.round(sec/60)}m`;
    }

    if($("repairedTasks")){
        $("repairedTasks").textContent=
            n;
    }

    let b=
        $("repairStatusBadge");

    if(b){

        b.textContent=
            sec||n
                ? "Used"
                : "Clear";

        b.classList.toggle(
            "success",
            !!(sec||n)
        );
    }
}

function missed(d){

    let arr=
        TASKS
            .map(
                (t,i)=>({
                    t,
                    i
                })
            )
            .filter(
                x=>
                    x.i<8 &&
                    x.i!==7 &&
                    !d.completed?.[x.i] &&
                    !nowIn(x.t)
            );

    let card=
        $("missedTaskCard");

    if(!card){
        return;
    }

    if(!arr.length){

        card.setAttribute(
            "hidden",
            ""
        );

        return;
    }

    card.removeAttribute(
        "hidden"
    );

    if($("missedTaskText")){

        $("missedTaskText").textContent=
            arr
                .slice(0,3)
                .map(
                    x=>x.t.name
                )
                .join(", ") +
            (
                arr.length>3
                    ? ` + ${arr.length-3} more`
                    : ""
            );
    }
}

function live(){

    let d=
        cur();

    let i=
        Number.isInteger(
            d.activeTask
        )
            ? d.activeTask
            : null;

    if(
        i!==null &&
        TASKS[i]
    ){

        let t=
            TASKS[i];

        if($("liveStatusTitle")){
            $("liveStatusTitle").textContent=
                "Studying Now";
        }

        if($("liveTaskName")){
            $("liveTaskName").textContent=
                t.name;
        }

        if($("liveSubject")){
            $("liveSubject").textContent=
                t.subject;
        }

        if($("liveTimer")){
            $("liveTimer").textContent=
                longDur(
                    ts(i,d)
                );
        }

        if($("liveChapter")){
            $("liveChapter").textContent=
                d.taskMeta?.[i]?.chapter ||
                "Chapter not specified";
        }

        $("liveStatusDot")
            ?.classList
            .add("active");

        return;
    }

    let n=
        TASKS.findIndex(
            nowIn
        );

    if(n>=0){

        let t=
            TASKS[n];

        if($("liveStatusTitle")){
            $("liveStatusTitle").textContent=
                "Scheduled";
        }

        if($("liveTaskName")){
            $("liveTaskName").textContent=
                t.name;
        }

        if($("liveSubject")){
            $("liveSubject").textContent=
                t.subject;
        }

        if($("liveTimer")){
            $("liveTimer").textContent=
                `${t.start} – ${t.end}`;
        }

        if($("liveChapter")){
            $("liveChapter").textContent=
                d.taskMeta?.[n]?.chapter ||
                "Waiting for study start";
        }

        $("liveStatusDot")
            ?.classList
            .remove("active");

        return;
    }

    if($("liveStatusTitle")){
        $("liveStatusTitle").textContent=
            "Not Studying";
    }

    if($("liveTaskName")){
        $("liveTaskName").textContent=
            "No active task";
    }

    if($("liveSubject")){
        $("liveSubject").textContent=
            "—";
    }

    if($("liveTimer")){
        $("liveTimer").textContent=
            "00:00:00";
    }

    if($("liveChapter")){
        $("liveChapter").textContent=
            "—";
    }

    $("liveStatusDot")
        ?.classList
        .remove("active");
}/* -------------------- REPORTS -------------------- */

function daily(){

    let d=cur();

    if($("dailyStudyTime")){
        $("dailyStudyTime").textContent=
            dur(totalTime(d));
    }

    if($("dailyTasks")){
        $("dailyTasks").textContent=
            `${completed(d)} / 8`;
    }

    if($("dailyQuestions")){
        $("dailyQuestions").textContent=
            totalQ(d);
    }

    if($("dailyProgress")){
        $("dailyProgress").textContent=
            `${progress()}%`;
    }

    if($("dailyStreak")){
        $("dailyStreak").textContent=
            `${streak()} days`;
    }

    let c=
        $("dailyTaskReport");

    if(c){

        c.innerHTML=
            TASKS
                .slice(0,8)
                .map(
                    (t,i)=>`
                        <div class="task-report-row">

                            <div class="task-report-main">

                                <strong>
                                    ${esc(t.name)}
                                </strong>

                                <span>
                                    ${esc(t.start)}
                                    –
                                    ${esc(t.end)}
                                </span>

                                ${
                                    d.taskMeta?.[i]?.chapter
                                    ?
                                    `<small>
                                        Chapter:
                                        ${esc(
                                            d.taskMeta[i].chapter
                                        )}
                                    </small>`
                                    :
                                    ""
                                }

                            </div>

                            <div class="task-report-stats">

                                <strong>
                                    ${dur(ts(i,d))}
                                </strong>

                                <span>
                                    ${
                                        d.completed?.[i]
                                        ?
                                        "Completed"
                                        :
                                        "Incomplete"
                                    }
                                </span>

                                ${
                                    Number(
                                        d.questionCounts?.[i]||0
                                    )
                                    ?
                                    `<small>
                                        ${
                                            Number(
                                                d.questionCounts[i]
                                            )
                                        }
                                        questions
                                    </small>`
                                    :
                                    ""
                                }

                            </div>

                        </div>
                    `
                )
                .join("");
    }

    let s=
        $("dailySubjectReport");

    if(s){

        s.innerHTML=
            subjects()
                .map(
                    x=>`
                        <div class="subject-report-row">

                            <div>

                                <strong>
                                    ${x.s}
                                </strong>

                                <span>
                                    ${x.tasks}
                                    completed tasks
                                </span>

                            </div>

                            <div>

                                <strong>
                                    ${dur(x.time)}
                                </strong>

                                <span>
                                    ${x.q}
                                    questions
                                </span>

                            </div>

                        </div>
                    `
                )
                .join("");
    }
}


/* -------------------- WEEKLY REPORT -------------------- */

function weekKeys(){

    let d=
        pd(
            calendarKey()
        );

    let day=
        d.getDay();

    let off=
        day===0
            ? -6
            : 1-day;

    d.setDate(
        d.getDate()+off
    );

    return Array.from(
        {length:7},
        (_,i)=>{

            let x=
                new Date(d);

            x.setDate(
                d.getDate()+i
            );

            return dk(x);
        }
    );
}

function snapTime(x){

    return Number(
        x?.totalStudySeconds ??
        TASKS.reduce(
            (a,_,i)=>
                a+
                Number(
                    x?.studySeconds?.[i]||0
                ),
            0
        )
    );
}

function snapQ(x){

    return Number(
        x?.totalQuestions ??
        Object.values(
            x?.questionCounts||{}
        ).reduce(
            (a,v)=>
                a+Number(v||0),
            0
        )
    );
}

function snapT(x){

    return Number(
        x?.completedCount ??
        TASKS
            .slice(0,8)
            .reduce(
                (a,_,i)=>
                    a+
                    (
                        x?.completed?.[i]
                            ? 1
                            : 0
                    ),
                0
            )
    );
}

function weekly(){

    let map=
        new Map(
            allHistory()
                .map(
                    x=>[
                        x.date,
                        x
                    ]
                )
        );

    let keys=
        weekKeys();

    let ss=0;
    let qq=0;
    let tt=0;

    let rows=
        keys.map(
            k=>{

                let x=
                    map.get(k);

                let s=
                    snapTime(x);

                let q=
                    snapQ(x);

                let t=
                    snapT(x);

                ss+=s;
                qq+=q;
                tt+=t;

                return {
                    k,
                    s,
                    q,
                    t
                };
            }
        );

    if($("weeklyStudyTime")){
        $("weeklyStudyTime").textContent=
            dur(ss);
    }

    if($("weeklyTasks")){
        $("weeklyTasks").textContent=
            tt;
    }

    if($("weeklyQuestions")){
        $("weeklyQuestions").textContent=
            qq;
    }

    if($("weeklyStreak")){
        $("weeklyStreak").textContent=
            `${streak()} days`;
    }

    let pct=
        Math.round(
            tt/(8*7)*100
        );

    if($("weeklyPercent")){
        $("weeklyPercent").textContent=
            `${clamp(pct)}%`;
    }

    if($("weeklyProgressBar")){
        $("weeklyProgressBar").style.width=
            `${clamp(pct)}%`;
    }

    if($("weeklyDailyBreakdown")){

        $("weeklyDailyBreakdown").innerHTML=
            rows
                .map(
                    x=>`
                        <div class="daily-breakdown-row">

                            <div>

                                <strong>
                                    ${shortDate(x.k)}
                                </strong>

                                <span>
                                    ${
                                        x.k===studyKey()
                                        ?
                                        "Today"
                                        :
                                        "Study day"
                                    }
                                </span>

                            </div>

                            <div>

                                <strong>
                                    ${dur(x.s)}
                                </strong>

                                <span>
                                    ${x.t}/8 tasks
                                    •
                                    ${x.q} Q
                                </span>

                            </div>

                        </div>
                    `
                )
                .join("");
    }

    if($("weeklySubjectAnalysis")){

        $("weeklySubjectAnalysis").innerHTML=
            [
                "Physics",
                "Chemistry",
                "Biology"
            ]
            .map(
                s=>{

                    let time=0;
                    let q=0;

                    rows.forEach(
                        r=>{

                            let x=
                                map.get(r.k);

                            TASKS.forEach(
                                (t,i)=>{

                                    if(
                                        x &&
                                        t.subject===s
                                    ){

                                        time+=
                                            Number(
                                                x.studySeconds?.[i]||0
                                            );

                                        q+=
                                            Number(
                                                x.questionCounts?.[i]||0
                                            );
                                    }
                                }
                            );
                        }
                    );

                    return `
                        <div class="subject-report-row">

                            <div>

                                <strong>
                                    ${s}
                                </strong>

                                <span>
                                    Weekly study time
                                </span>

                            </div>

                            <div>

                                <strong>
                                    ${dur(time)}
                                </strong>

                                <span>
                                    ${q} questions
                                </span>

                            </div>

                        </div>
                    `;
                }
            )
            .join("");
    }
}


/* -------------------- MONTHLY REPORT -------------------- */

function monthKeys(){

    let d=
        pd(
            calendarKey()
        );

    return Array.from(
        {length:30},
        (_,i)=>{

            let x=
                new Date(d);

            x.setDate(
                d.getDate()-29+i
            );

            return dk(x);
        }
    );
}

function monthly(){

    let map=
        new Map(
            allHistory()
                .map(
                    x=>[
                        x.date,
                        x
                    ]
                )
        );

    let rows=
        monthKeys()
            .map(
                k=>{

                    let x=
                        map.get(k);

                    return {
                        k,
                        s:snapTime(x),
                        q:snapQ(x)
                    };
                }
            );

    let ss=
        rows.reduce(
            (a,x)=>
                a+x.s,
            0
        );

    let qq=
        rows.reduce(
            (a,x)=>
                a+x.q,
            0
        );

    let ad=
        rows.filter(
            x=>
                x.s ||
                x.q ||
                snapT(
                    map.get(x.k)
                )
        ).length;

    if($("monthlyStudyTime")){
        $("monthlyStudyTime").textContent=
            dur(ss);
    }

    if($("monthlyQuestions")){
        $("monthlyQuestions").textContent=
            qq;
    }

    if($("monthlyActiveDays")){
        $("monthlyActiveDays").textContent=
            ad;
    }

    if($("monthlyBestStreak")){
        $("monthlyBestStreak").textContent=
            `${longestStreak()} days`;
    }

    draw(
        $("monthlyStudyChart"),
        rows.map(
            x=>({
                l:shortDate(x.k),
                v:Math.round(x.s/60)
            })
        ),
        "minutes"
    );

    draw(
        $("monthlyQuestionChart"),
        rows.map(
            x=>({
                l:shortDate(x.k),
                v:x.q
            })
        ),
        "questions"
    );
}


/* -------------------- SUBJECT TRACKING -------------------- */

function subjectPage(){

    let d=
        cur();

    [
        "Physics",
        "Chemistry",
        "Biology"
    ].forEach(
        s=>{

            let x=
                subjects()
                    .find(
                        v=>v.s===s
                    );

            let chs=
                new Set(
                    Object.values(
                        d.taskMeta||{}
                    )
                    .filter(
                        m=>
                            m?.chapter
                    )
                    .map(
                        m=>m.chapter
                    )
                ).size;

            let possible=
                s==="Physics"
                    ?
                    S.syllabus.Physics.length
                    :
                s==="Chemistry"
                    ?
                    S.syllabus["Physical Chemistry"].length+
                    S.syllabus["Inorganic Chemistry"].length+
                    S.syllabus["Organic Chemistry"].length
                    :
                    S.syllabus.Botany.length+
                    S.syllabus.Zoology.length;

            let pct=
                possible
                    ?
                    Math.round(
                        chs/possible*100
                    )
                    :
                    0;

            let ids={
                Physics:[
                    "physicsStudyTime",
                    "physicsQuestions",
                    "physicsTasks",
                    "physicsChapters",
                    "physicsPercent",
                    "physicsProgressBar"
                ],

                Chemistry:[
                    "chemistryStudyTime",
                    "chemistryQuestions",
                    "chemistryTasks",
                    "chemistryChapters",
                    "chemistryPercent",
                    "chemistryProgressBar"
                ],

                Biology:[
                    "biologyStudyTime",
                    "biologyQuestions",
                    "biologyTasks",
                    "biologyChapters",
                    "biologyPercent",
                    "biologyProgressBar"
                ]
            }[s];

            if($(ids[0])){
                $(ids[0]).textContent=
                    dur(x.time);
            }

            if($(ids[1])){
                $(ids[1]).textContent=
                    x.q;
            }

            if($(ids[2])){
                $(ids[2]).textContent=
                    x.tasks;
            }

            if($(ids[3])){
                $(ids[3]).textContent=
                    chs;
            }

            if($(ids[4])){
                $(ids[4]).textContent=
                    `${clamp(pct)}%`;
            }

            if($(ids[5])){
                $(ids[5]).style.width=
                    `${clamp(pct)}%`;
            }
        }
    );
}


/* -------------------- CHAPTER TRACKING -------------------- */

function chapterEntries(){

    let a=[];

    S.syllabus.Physics
        .forEach(
            (c,i)=>
                a.push({
                    subject:"Physics",
                    group:"Physics",
                    chapter:c,
                    n:i+1
                })
        );

    [
        [
            "Physical Chemistry",
            S.syllabus["Physical Chemistry"]
        ],

        [
            "Inorganic Chemistry",
            S.syllabus["Inorganic Chemistry"]
        ],

        [
            "Organic Chemistry",
            S.syllabus["Organic Chemistry"]
        ]
    ]
    .forEach(
        ([g,l])=>
            l.forEach(
                (c,i)=>
                    a.push({
                        subject:"Chemistry",
                        group:g,
                        chapter:c,
                        n:i+1
                    })
            )
    );

    [
        [
            "Botany",
            S.syllabus.Botany
        ],

        [
            "Zoology",
            S.syllabus.Zoology
        ]
    ]
    .forEach(
        ([g,l])=>
            l.forEach(
                (c,i)=>
                    a.push({
                        subject:"Biology",
                        group:g,
                        chapter:c,
                        n:i+1
                    })
            )
    );

    return a;
}

function chapters(){

    let done=
        new Set();

    allHistory()
        .forEach(
            x=>
                Object.values(
                    x.taskMeta||{}
                )
                .forEach(
                    m=>{
                        if(
                            m?.chapter &&
                            m.finished
                        ){
                            done.add(
                                m.chapter
                            );
                        }
                    }
                )
        );

    let list=
        chapterEntries()
            .filter(
                x=>
                    filter==="All" ||
                    x.subject===filter
            );

    if($("totalChapterCount")){
        $("totalChapterCount").textContent=
            list.length;
    }

    if($("completedChapterCount")){
        $("completedChapterCount").textContent=
            list.filter(
                x=>done.has(
                    x.chapter
                )
            ).length;
    }

    if($("remainingChapterCount")){
        $("remainingChapterCount").textContent=
            list.filter(
                x=>!done.has(
                    x.chapter
                )
            ).length;
    }

    if($("chapterCompletionPercent")){

        $("chapterCompletionPercent").textContent=
            list.length
                ?
                `${Math.round(
                    list.filter(
                        x=>done.has(
                            x.chapter
                        )
                    ).length /
                    list.length *
                    100
                )}%`
                :
                "0%";
    }

    if($("chapterList")){

        $("chapterList").innerHTML=
            list
                .map(
                    x=>`
                        <div class="chapter-row ${
                            done.has(x.chapter)
                                ? "completed"
                                : ""
                        }">

                            <div class="chapter-number">
                                ${x.n}
                            </div>

                            <div class="chapter-info">

                                <strong>
                                    ${esc(x.chapter)}
                                </strong>

                                <span>
                                    ${esc(x.subject)}
                                    •
                                    ${esc(x.group)}
                                </span>

                            </div>

                            <div class="chapter-status">

                                ${
                                    done.has(x.chapter)
                                        ? "✓ Completed"
                                        : "Pending"
                                }

                            </div>

                        </div>
                    `
                )
                .join("");
    }
}/* -------------------- STATS -------------------- */

function stats(){

    let h=
        allHistory();

    let b=
        bests();

    let st=
        h.reduce(
            (a,x)=>
                a+snapTime(x),
            0
        );

    let q=
        h.reduce(
            (a,x)=>
                a+snapQ(x),
            0
        );

    let days=
        h.filter(
            active
        ).length;

    if($("statsCurrentStreak")){
        $("statsCurrentStreak").textContent=
            `${streak()} days`;
    }

    if($("statsLongestStreak")){
        $("statsLongestStreak").textContent=
            `${b.streak} days`;
    }

    if($("statsTotalStudyTime")){
        $("statsTotalStudyTime").textContent=
            dur(st);
    }

    if($("statsTotalQuestions")){
        $("statsTotalQuestions").textContent=
            q;
    }

    if($("statsActiveDays")){
        $("statsActiveDays").textContent=
            days;
    }

    if($("bestStudyTime")){
        $("bestStudyTime").textContent=
            dur(b.study.value);
    }

    if($("bestStudyDate")){
        $("bestStudyDate").textContent=
            shortDate(b.study.date);
    }

    if($("bestQuestions")){
        $("bestQuestions").textContent=
            b.q.value;
    }

    if($("bestQuestionsDate")){
        $("bestQuestionsDate").textContent=
            shortDate(b.q.date);
    }

    if($("bestTasks")){
        $("bestTasks").textContent=
            `${b.tasks.value} / 8`;
    }

    if($("bestTasksDate")){
        $("bestTasksDate").textContent=
            shortDate(b.tasks.date);
    }

    if($("bestStreak")){
        $("bestStreak").textContent=
            `${b.streak} days`;
    }

    if($("bestStreakDate")){
        $("bestStreakDate").textContent=
            b.streak
                ? "Overall"
                : "—";
    }

    draw(
        $("performanceChart"),
        h
            .slice(-30)
            .map(
                x=>({
                    l:shortDate(x.date),
                    v:Math.round(
                        snapTime(x)/60
                    )
                })
            ),
        "minutes"
    );
}


/* -------------------- SYNC PAGE -------------------- */

function syncPage(){

    let last=
        S.lastSynced ||
        (()=>{
            let x=
                localStorage.getItem(
                    LAST_SYNC_KEY
                );

            return x
                ? new Date(x)
                : null;
        })();

    if($("lastSynced")){
        $("lastSynced").textContent=
            last
                ? last.toLocaleString(
                    "en-IN"
                )
                : "Never";
    }

    if($("syncSource")){
        $("syncSource").textContent=
            S.source;
    }

    if($("syncStudyTime")){
        $("syncStudyTime").textContent=
            dur(
                totalTime()
            );
    }

    if($("syncTasks")){
        $("syncTasks").textContent=
            `${completed()} / 8`;
    }

    if($("syncQuestions")){
        $("syncQuestions").textContent=
            totalQ();
    }

    if($("syncChapters")){

        $("syncChapters").textContent=
            new Set(
                Object.values(
                    cur().taskMeta||{}
                )
                .filter(
                    m=>
                        m?.finished &&
                        m.chapter
                )
                .map(
                    m=>m.chapter
                )
            ).size;
    }

    if($("settingsSyncStatus")){
        $("settingsSyncStatus").textContent=
            S.current
                ? "Connected"
                : "Waiting";
    }

    if($("settingsLastSynced")){
        $("settingsLastSynced").textContent=
            last
                ? last.toLocaleString(
                    "en-IN"
                )
                : "Never";
    }
}


/* -------------------- GRAPH -------------------- */

function draw(
    canvas,
    data,
    unit
){

    if(!canvas){
        return;
    }

    let r=
        canvas.getBoundingClientRect();

    let w=
        Math.max(
            300,
            r.width||600
        );

    let h=
        Math.max(
            220,
            r.height||240
        );

    let dpr=
        devicePixelRatio||1;

    canvas.width=
        w*dpr;

    canvas.height=
        h*dpr;

    let c=
        canvas.getContext("2d");

    if(!c){
        return;
    }

    c.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    c.clearRect(
        0,
        0,
        w,
        h
    );

    let vals=
        data.map(
            x=>Number(x.v)||0
        );

    let max=
        Math.max(
            1,
            ...vals
        );

    let L=42;
    let R=14;
    let T=18;
    let B=34;

    let pw=
        w-L-R;

    let ph=
        h-T-B;

    c.font=
        "11px sans-serif";

    c.textAlign=
        "right";

    for(
        let i=0;
        i<=4;
        i++
    ){

        let y=
            T+
            ph*i/4;

        c.globalAlpha=
            .18;

        c.beginPath();

        c.moveTo(
            L,
            y
        );

        c.lineTo(
            w-R,
            y
        );

        c.stroke();

        c.globalAlpha=
            .75;

        c.fillText(
            String(
                Math.round(
                    max*(1-i/4)
                )
            ),
            L-7,
            y
        );
    }

    c.globalAlpha=1;

    if(!data.length){

        c.textAlign=
            "center";

        c.fillText(
            "No data yet",
            w/2,
            h/2
        );

        return;
    }

    let step=
        data.length>1
            ? pw/(data.length-1)
            : pw;

    c.beginPath();

    data.forEach(
        (x,i)=>{

            let xx=
                data.length>1
                    ? L+step*i
                    : L+pw/2;

            let yy=
                T+
                ph-
                (x.v/max)*ph;

            if(i){
                c.lineTo(
                    xx,
                    yy
                );
            }else{
                c.moveTo(
                    xx,
                    yy
                );
            }
        }
    );

    c.lineWidth=2;

    c.stroke();

    data.forEach(
        (x,i)=>{

            let xx=
                data.length>1
                    ? L+step*i
                    : L+pw/2;

            let yy=
                T+
                ph-
                (x.v/max)*ph;

            c.beginPath();

            c.arc(
                xx,
                yy,
                2.5,
                0,
                Math.PI*2
            );

            c.fill();
        }
    );

    c.textAlign=
        "center";

    c.font=
        "10px sans-serif";

    let every=
        Math.max(
            1,
            Math.ceil(
                data.length/6
            )
        );

    data.forEach(
        (x,i)=>{

            if(
                i%every &&
                i!==data.length-1
            ){
                return;
            }

            let xx=
                data.length>1
                    ? L+step*i
                    : L+pw/2;

            c.fillText(
                x.l,
                xx,
                h-B+8
            );
        }
    );

    c.textAlign=
        "left";

    c.globalAlpha=
        .65;

    c.fillText(
        unit,
        L,
        4
    );

    c.globalAlpha=1;
}


/* -------------------- NAVIGATION -------------------- */

const PAGES=[
    "homePage",
    "dailyPage",
    "weeklyPage",
    "monthlyPage",
    "subjectsPage",
    "chaptersPage",
    "statsPage",
    "syncPage",
    "morePage"
];

function showPage(id){

    page=
        PAGES.includes(id)
            ? id
            : "homePage";

    PAGES.forEach(
        x=>{

            $(x)?.toggleAttribute(
                "hidden",
                x!==page
            );

            $(x)?.classList.toggle(
                "active-page",
                x===page
            );
        }
    );

    document
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(
            b=>
                b.classList.toggle(
                    "active",
                    b.dataset.page===page
                )
        );

    closeMenu();

    updatePage();
}

function updatePage(){

    if(page==="dailyPage"){
        daily();
    }

    if(page==="weeklyPage"){
        weekly();
    }

    if(page==="monthlyPage"){
        monthly();
    }

    if(page==="subjectsPage"){
        subjectPage();
    }

    if(page==="chaptersPage"){
        chapters();
    }

    if(page==="statsPage"){
        stats();
    }

    if(page==="syncPage"){
        syncPage();
    }
}

function openMenu(){

    menu=true;

    $("sideMenu")
        ?.classList
        .add("open");
}

function closeMenu(){

    menu=false;

    $("sideMenu")
        ?.classList
        .remove("open");
}

function navSetup(){

    document
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(
            b=>
                b.addEventListener(
                    "click",
                    ()=>
                        showPage(
                            b.dataset.page
                        )
                )
        );

    $("menuButton")
        ?.addEventListener(
            "click",
            ()=>
                menu
                    ? closeMenu()
                    : openMenu()
        );

    $("closeMenuButton")
        ?.addEventListener(
            "click",
            closeMenu
        );

    document
        .querySelectorAll(
            ".chapter-filter"
        )
        .forEach(
            b=>
                b.addEventListener(
                    "click",
                    ()=>{
                        filter=
                            b.dataset.chapterSubject||
                            "All";

                        document
                            .querySelectorAll(
                                ".chapter-filter"
                            )
                            .forEach(
                                x=>
                                    x.classList.toggle(
                                        "active",
                                        x===b
                                    )
                            );

                        chapters();
                    }
                )
        );
}


/* -------------------- ALL UPDATES -------------------- */

function updateAll(){

    if(!logged()){
        return;
    }

    headers();
    home();
    daily();
    weekly();
    monthly();
    subjectPage();
    chapters();
    stats();
    syncPage();
}

function startApp(){

    appView();

    if(!syncLoop){
        startSync();
    }

    if(clockLoop){
        clearInterval(
            clockLoop
        );
    }

    clockLoop=
        setInterval(
            updateAll,
            1000
        );

    updateAll();
}


/* -------------------- BUTTONS -------------------- */

function buttons(){

    $("setPinButton")
        ?.addEventListener(
            "click",
            setupPin
        );

    $("loginButton")
        ?.addEventListener(
            "click",
            login
        );

    $("logoutButton")
        ?.addEventListener(
            "click",
            logout
        );

    $("changePinButton")
        ?.addEventListener(
            "click",
            openPin
        );

    $("closeChangePinModal")
        ?.addEventListener(
            "click",
            closePin
        );

    $("saveNewPinButton")
        ?.addEventListener(
            "click",
            changePin
        );

    $("refreshSyncButton")
        ?.addEventListener(
            "click",
            sync
        );

    $("changePinModal")
        ?.addEventListener(
            "click",
            e=>{
                if(
                    e.target===
                    $("changePinModal")
                ){
                    closePin();
                }
            }
        );

    [
        "setupPin",
        "confirmPin"
    ].forEach(
        id=>
            $(id)?.addEventListener(
                "keydown",
                e=>{
                    if(
                        e.key==="Enter"
                    ){
                        setupPin();
                    }
                }
            )
    );

    $("loginPin")
        ?.addEventListener(
            "keydown",
            e=>{
                if(
                    e.key==="Enter"
                ){
                    login();
                }
            }
        );
}


/* -------------------- BOOT -------------------- */

function boot(){

    navSetup();

    buttons();

    if($("appVersion")){
        $("appVersion").textContent=
            NP_VERSION;
    }

    if(logged()){
        startApp();
    }else{
        loginView();
    }

    window.NPOS={
        version:NP_VERSION,

        status:()=>({
            loggedIn:logged(),
            hasPin:hasPin(),
            source:S.source,
            lastSynced:S.lastSynced
        }),

        sync,

        data:()=>cur(),

        history:allHistory,

        logout
    };
}

if(
    document.readyState===
    "loading"
){

    document.addEventListener(
        "DOMContentLoaded",
        boot
    );

}else{

    boot();
}/* =========================================================
   NP-OS GRAPH FIX
   Ensures graph containers are real Canvas elements.
========================================================= */

(function NPGraphFix(){

    const originalDraw = window.draw;

    if(typeof originalDraw !== "function"){
        console.warn("NP-OS: draw() function not found.");
        return;
    }

    window.draw = function(element, data, unit){

        if(!element){
            return;
        }

        let canvas = element;

        /*
           If the HTML element is not a canvas
           (for example an IMG), replace it with
           a proper canvas automatically.
        */
        if(canvas.tagName !== "CANVAS"){

            const replacement =
                document.createElement("canvas");

            replacement.id =
                canvas.id;

            replacement.className =
                canvas.className || "";

            replacement.style.width =
                canvas.style.width ||
                "100%";

            replacement.style.height =
                canvas.style.height ||
                "240px";

            canvas.replaceWith(
                replacement
            );

            canvas =
                replacement;
        }

        originalDraw(
            canvas,
            data,
            unit
        );
    };

    console.log(
        "NEET OS: Graph rendering FIX loaded."
    );

})();/* =========================================================
   NP-OS LIVE STATUS FIX
   Self Study should NOT appear as scheduled all day.
========================================================= */

(function NPOSLiveStatusFix() {

    function fixedLiveStatus() {

        const d = cur();

        // 1. If a real study session is running,
        // show that session — including Self Study.
        const activeIndex =
            Number.isInteger(d.activeTask)
                ? d.activeTask
                : null;

        if (
            activeIndex !== null &&
            TASKS[activeIndex]
        ) {

            const t = TASKS[activeIndex];

            if ($("liveStatusTitle"))
                $("liveStatusTitle").textContent =
                    "Studying Now";

            if ($("liveTaskName"))
                $("liveTaskName").textContent =
                    t.name;

            if ($("liveSubject"))
                $("liveSubject").textContent =
                    t.subject;

            if ($("liveTimer"))
                $("liveTimer").textContent =
                    longDur(ts(activeIndex, d));

            if ($("liveChapter"))
                $("liveChapter").textContent =
                    d.taskMeta?.[activeIndex]?.chapter ||
                    "Chapter not specified";

            $("liveStatusDot")
                ?.classList.add("active");

            return;
        }


        // 2. No active session.
        // Search ONLY the 8 fixed scheduled tasks.
        // Self Study is NOT included.
        const scheduledIndex =
            TASKS
                .slice(0, 8)
                .findIndex(nowIn);


        // 3. A scheduled class/task is currently available.
        if (scheduledIndex >= 0) {

            const t =
                TASKS[scheduledIndex];

            if ($("liveStatusTitle"))
                $("liveStatusTitle").textContent =
                    "Scheduled";

            if ($("liveTaskName"))
                $("liveTaskName").textContent =
                    t.name;

            if ($("liveSubject"))
                $("liveSubject").textContent =
                    t.subject;

            if ($("liveTimer"))
                $("liveTimer").textContent =
                    `${t.start} – ${t.end}`;

            if ($("liveChapter"))
                $("liveChapter").textContent =
                    d.taskMeta?.[scheduledIndex]?.chapter ||
                    "Waiting for study start";

            $("liveStatusDot")
                ?.classList.remove("active");

            return;
        }


        // 4. Nothing is scheduled and nothing is running.
        if ($("liveStatusTitle"))
            $("liveStatusTitle").textContent =
                "Not Studying";

        if ($("liveTaskName"))
            $("liveTaskName").textContent =
                "No active task";

        if ($("liveSubject"))
            $("liveSubject").textContent =
                "—";

        if ($("liveTimer"))
            $("liveTimer").textContent =
                "00:00:00";

        if ($("liveChapter"))
            $("liveChapter").textContent =
                "—";

        $("liveStatusDot")
            ?.classList.remove("active");
    }


    // Replace the old live() function.
    window.live = fixedLiveStatus;

    console.log(
        "NP-OS: Live Status Self Study FIX loaded."
    );

})();
/* =========================================================
   NP-OS → Firebase Cloud Read-Only Integration
   Guardian app reads NEET OS data from Firebase.
   NO Firebase write operation is exposed from NP-OS.
========================================================= */

(async function NPOSFirebaseIntegration(){

    "use strict";

    const FIREBASE_VERSION = "12.19.0";

    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyBEytCkfC7Nl0kiPOPkxQavA6v4Ue2ZKJ8",
        authDomain: "np-os-b0eed.firebaseapp.com",
        projectId: "np-os-b0eed",
        storageBucket: "np-os-b0eed.firebasestorage.app",
        messagingSenderId: "619023050185",
        appId: "1:619023050185:web:7d3221d76671338f8b7418",
        measurementId: "G-HGNPTFNQ8G",
        databaseURL: "https://np-os-b0eed-default-rtdb.firebaseio.com"
    };

    const fb = {
        ready: false,
        auth: null,
        db: null,
        provider: null,
        user: null,
        unsubscribeData: null,
        signInWithPopup: null,
        signOut: null,
        ref: null,
        onValue: null,
        loading: false,
        error: null,
        lastCloudSync: null
    };

    window.NPOSFirebase = {
        ready: false,
        signedIn: false,
        user: null,
        lastSync: null,
        error: null
    };

    function renderFirebasePanel(){

        const panel = document.getElementById(
            "nposFirebasePanel"
        );

        if(!panel){
            return;
        }

        const status =
            document.getElementById(
                "nposFirebaseStatus"
            );

        const connect =
            document.getElementById(
                "nposFirebaseConnect"
            );

        const disconnect =
            document.getElementById(
                "nposFirebaseDisconnect"
            );

        if(status){

            if(fb.loading){

                status.textContent =
                    "Connecting to Firebase...";

            }else if(fb.error){

                status.textContent =
                    fb.error;

            }else if(fb.user){

                status.textContent =
                    "Cloud Connected • Read-only";

            }else if(!fb.ready){

                status.textContent =
                    "Firebase is starting...";

            }else{

                status.textContent =
                    "Not connected";
            }
        }

        if(connect){

            connect.disabled =
                !fb.ready || fb.loading || !!fb.user;

            connect.textContent =
                fb.loading
                    ? "Connecting..."
                    : "Connect Google";
        }

        if(disconnect){

            disconnect.hidden =
                !fb.user;

            disconnect.disabled =
                fb.loading;
        }

        const email =
            document.getElementById(
                "nposFirebaseEmail"
            );

        if(email){

            email.textContent =
                fb.user
                    ? (
                        fb.user.email ||
                        fb.user.displayName ||
                        fb.user.uid
                    )
                    : "";
        }
    }

    function firebasePanel(){

        const page =
            document.getElementById(
                "syncPage"
            );

        if(!page){
            return;
        }

        if(
            document.getElementById(
                "nposFirebasePanel"
            )
        ){
            return;
        }

        const panel =
            document.createElement("section");

        panel.id =
            "nposFirebasePanel";

        panel.className =
            "card firebase-card";

        panel.innerHTML = `
            <div class="section-title">
                <div>
                    <div class="section-heading">
                        Cloud Sync
                    </div>

                    <div class="muted">
                        Firebase guardian connection
                    </div>
                </div>

                <div class="status-dot"></div>
            </div>

            <div
                id="nposFirebaseStatus"
                class="sync-status"
                style="margin:14px 0;"
            >
                Firebase is starting...
            </div>

            <div
                id="nposFirebaseEmail"
                class="muted"
                style="margin-bottom:14px;"
            ></div>

            <div
                style="
                    display:flex;
                    gap:10px;
                    flex-wrap:wrap;
                "
            >

                <button
                    id="nposFirebaseConnect"
                    class="primary-btn"
                    type="button"
                >
                    Connect Google
                </button>

                <button
                    id="nposFirebaseDisconnect"
                    class="secondary-btn"
                    type="button"
                    hidden
                >
                    Disconnect
                </button>

            </div>

            <div
                class="muted"
                style="
                    margin-top:14px;
                    font-size:12px;
                    line-height:1.6;
                "
            >
                Guardian access is read-only.
                NP-OS never modifies NEET OS data.
            </div>
        `;

        page.appendChild(panel);

        document
            .getElementById(
                "nposFirebaseConnect"
            )
            ?.addEventListener(
                "click",
                cloudLogin
            );

        document
            .getElementById(
                "nposFirebaseDisconnect"
            )
            ?.addEventListener(
                "click",
                cloudLogout
            );

        renderFirebasePanel();
    }

    function normCurrent(value){

        if(!value){
            return null;
        }

        if(typeof value !== "object"){
            return null;
        }

        return value;
    }

    function normHistory(value){

        if(!value){
            return [];
        }

        if(Array.isArray(value)){
            return value;
        }

        if(typeof value === "object"){

            return Object
                .entries(value)
                .map(
                    ([date,data]) => {

                        if(
                            data &&
                            typeof data === "object" &&
                            !Array.isArray(data)
                        ){

                            return {
                                date,
                                ...data
                            };
                        }

                        return {
                            date,
                            value:data
                        };
                    }
                );
        }

        return [];
    }

    function normSyllabus(value){

        if(
            value &&
            typeof value === "object"
        ){
            return value;
        }

        return S.syllabus;
    }

    function applyCloudSnapshot(snapshot){

        if(!snapshot){

            S.current = null;
            S.history = [];
            S.syllabus = FALLBACK_SYLLABUS;
            S.settings = null;

            S.source =
                "Firebase Cloud • No NEET OS data";

            S.lastSynced = null;

            window.NPOSFirebase.lastSync =
                null;

            updateAll();
            syncPage();
            renderFirebasePanel();

            return;
        }

        S.current =
            normCurrent(
                snapshot.studyData
            );

        S.history =
            normHistory(
                snapshot.history
            );

        S.syllabus =
            normSyllabus(
                snapshot.syllabus
            );

        S.settings =
            snapshot.settings ?? null;

        if(snapshot.syncedAt){

            const date =
                new Date(
                    snapshot.syncedAt
                );

            if(
                !Number.isNaN(
                    date.getTime()
                )
            ){

                S.lastSynced =
                    date;

                fb.lastCloudSync =
                    date.toISOString();

                window.NPOSFirebase.lastSync =
                    date.toISOString();

                localStorage.setItem(
                    LAST_SYNC_KEY,
                    date.toISOString()
                );
            }
        }

        S.source =
            S.current
                ? "Firebase Cloud • Read-only"
                : "Firebase Cloud • Waiting for NEET OS data";

        updateAll();
        syncPage();
        renderFirebasePanel();

        console.log(
            "NP-OS Firebase: Cloud snapshot applied.",
            S.lastSynced
                ? S.lastSynced.toISOString()
                : "no timestamp"
        );
    }

    function startCloudListener(user){

        if(
            !fb.db ||
            !user
        ){
            return;
        }

        if(fb.unsubscribeData){

            fb.unsubscribeData();
            fb.unsubscribeData = null;
        }

        const dataRef =
            fb.ref(
                fb.db,
                "users/" +
                user.uid +
                "/neetOS"
            );

        fb.unsubscribeData =
            fb.onValue(
                dataRef,

                snapshot => {

                    try{

                        applyCloudSnapshot(
                            snapshot.val()
                        );

                    }catch(error){

                        console.error(
                            "NP-OS Firebase: Could not apply cloud data.",
                            error
                        );

                        fb.error =
                            "Cloud data could not be read.";

                        renderFirebasePanel();
                    }
                },

                error => {

                    console.error(
                        "NP-OS Firebase read error:",
                        error
                    );

                    fb.error =
                        "Firebase read failed: " +
                        (
                            error?.code ||
                            error?.message ||
                            "unknown error"
                        );

                    S.source =
                        "Firebase Cloud • Read error";

                    renderFirebasePanel();
                    syncPage();
                }
            );
    }

    async function cloudLogin(){

        if(
            !fb.ready ||
            !fb.auth
        ){

            alert(
                "Firebase is still starting. Please try again in a moment."
            );

            return;
        }

        try{

            fb.error = null;
            fb.loading = true;

            renderFirebasePanel();

            console.log(
                "NP-OS Firebase: Starting Google guardian login..."
            );

            await fb.signInWithPopup(
                fb.auth,
                fb.provider
            );

            console.log(
                "NP-OS Firebase: Google login successful."
            );

        }catch(error){

            console.error(
                "NP-OS Firebase login error:",
                error
            );

            fb.loading = false;

            if(
                error?.code ===
                "auth/popup-blocked"
            ){

                fb.error =
                    "Google popup was blocked. Allow popups for 127.0.0.1 and try again.";

            }else if(
                error?.code ===
                "auth/unauthorized-domain"
            ){

                fb.error =
                    "127.0.0.1 is not authorized in Firebase Authentication.";

            }else if(
                error?.code ===
                "auth/popup-closed-by-user"
            ){

                fb.error =
                    "Google login window was closed.";

            }else{

                fb.error =
                    "Firebase login failed: " +
                    (
                        error?.code ||
                        error?.message ||
                        "unknown error"
                    );
            }

            window.NPOSFirebase.error =
                fb.error;

            renderFirebasePanel();
        }
    }

    async function cloudLogout(){

        try{

            if(fb.unsubscribeData){

                fb.unsubscribeData();
                fb.unsubscribeData = null;
            }

            await fb.signOut(
                fb.auth
            );

            /*
              Return to local same-origin data after logout.
              This does not write anything to NEET OS.
            */
            try{

                sync();

            }catch(e){

                console.warn(
                    "NP-OS local fallback sync failed:",
                    e
                );
            }

            fb.error = null;

            renderFirebasePanel();

            console.log(
                "NP-OS Firebase: Signed out."
            );

        }catch(error){

            console.error(
                "NP-OS Firebase logout error:",
                error
            );

            fb.error =
                "Firebase logout failed.";

            renderFirebasePanel();
        }
    }

    async function initFirebase(){

        try{

            const firebaseApp =
                await import(
                    "https://www.gstatic.com/firebasejs/" +
                    FIREBASE_VERSION +
                    "/firebase-app.js"
                );

            const firebaseAuth =
                await import(
                    "https://www.gstatic.com/firebasejs/" +
                    FIREBASE_VERSION +
                    "/firebase-auth.js"
                );

            const firebaseDatabase =
                await import(
                    "https://www.gstatic.com/firebasejs/" +
                    FIREBASE_VERSION +
                    "/firebase-database.js"
                );

            const app =
                firebaseApp.initializeApp(
                    FIREBASE_CONFIG,
                    "NP-OS"
                );

            const auth =
                firebaseAuth.getAuth(
                    app
                );

            const db =
                firebaseDatabase.getDatabase(
                    app,
                    FIREBASE_CONFIG.databaseURL
                );

            fb.auth =
                auth;

            fb.db =
                db;

            fb.provider =
                new firebaseAuth.GoogleAuthProvider();

            fb.signInWithPopup =
                firebaseAuth.signInWithPopup;

            fb.signOut =
                firebaseAuth.signOut;

            fb.ref =
                firebaseDatabase.ref;

            fb.onValue =
                firebaseDatabase.onValue;

            fb.ready =
                true;

            window.NPOSFirebase.ready =
                true;

            renderFirebasePanel();

            firebaseAuth.onAuthStateChanged(
                auth,

                user => {

                    fb.user =
                        user;

                    fb.loading =
                        false;

                    fb.error =
                        null;

                    window.NPOSFirebase.signedIn =
                        !!user;

                    window.NPOSFirebase.user =
                        user || null;

                    window.NPOSFirebase.error =
                        null;

                    if(user){

                        console.log(
                            "NP-OS Firebase: Signed in as",
                            user.email ||
                            user.uid
                        );

                        startCloudListener(
                            user
                        );

                    }else{

                        if(
                            fb.unsubscribeData
                        ){

                            fb.unsubscribeData();
                            fb.unsubscribeData =
                                null;
                        }

                        if(!S.current){

                            S.source =
                                "Waiting for Firebase connection";
                        }

                        updateAll();
                    }

                    renderFirebasePanel();
                    syncPage();
                }
            );

            console.log(
                "NP-OS: Firebase Cloud integration ready."
            );

        }catch(error){

            console.error(
                "NP-OS Firebase initialization failed:",
                error
            );

            fb.ready =
                false;

            fb.loading =
                false;

            fb.error =
                "Firebase initialization failed: " +
                (
                    error?.message ||
                    "unknown error"
                );

            window.NPOSFirebase.error =
                fb.error;

            renderFirebasePanel();
        }
    }

    /*
       Safe read-only debug controls.
       NO Firebase write method is exposed.
    */

    window.NPOSFirebase.login =
        cloudLogin;

    window.NPOSFirebase.logout =
        cloudLogout;

    window.NPOSFirebase.status =
        () => ({
            ready:
                fb.ready,

            signedIn:
                !!fb.user,

            email:
                fb.user?.email ||
                null,

            uid:
                fb.user?.uid ||
                null,

            lastSync:
                fb.lastCloudSync,

            source:
                S.source,

            error:
                fb.error
        });

    /*
       Sync page may not exist immediately
       while NP-OS is booting.
    */

    let tries = 0;

    const panelTimer =
        setInterval(
            () => {

                tries++;

                if(
                    document.getElementById(
                        "syncPage"
                    )
                ){

                    firebasePanel();
                    renderFirebasePanel();
                }

                if(
                    document.getElementById(
                        "syncPage"
                    ) ||
                    tries >= 20
                ){

                    clearInterval(
                        panelTimer
                    );
                }

            },
            250
        );

    /*
       Firebase initialization is completely
       independent from NP-OS PIN/core logic.
    */

    initFirebase();

})();
/* =========================================================
   NP-OS FIREBASE / LOCAL SYNC CONFLICT FIX
   Firebase is the source while cloud-connected.
========================================================= */

(function NPOSCloudSyncConflictFix(){

    const originalSync = window.sync;

    if(typeof originalSync !== "function"){
        console.warn(
            "NP-OS Cloud Sync Fix: original sync() not found."
        );
        return;
    }

    /*
       While Firebase is connected, do NOT allow
       the old same-origin localStorage sync to overwrite
       the Firebase snapshot.
    */
    window.sync = function(){

        if(
            window.NPOSFirebase &&
            window.NPOSFirebase.signedIn
        ){
            return;
        }

        return originalSync.apply(
            this,
            arguments
        );
    };

    /*
       Stop the already-running 3-second local sync loop
       as soon as Firebase becomes connected.
    */
    setInterval(function(){

        if(
            window.NPOSFirebase &&
            window.NPOSFirebase.signedIn
        ){

            if(
                typeof syncLoop !== "undefined" &&
                syncLoop
            ){

                clearInterval(syncLoop);
                syncLoop = null;

                console.log(
                    "NP-OS: Local sync paused — Firebase is now the data source."
                );
            }
        }

    }, 250);

    console.log(
        "NP-OS: Firebase/local sync conflict FIX loaded."
    );

})();
/* =========================================================
   NP-OS DYNAMIC GUARDIAN ACCESS
   ---------------------------------------------------------
   Guardian UID → Firebase guardianAccess
   → Student UID → users/studentUID/neetOS

   Read-only.
   NP-OS NEVER writes to Firebase.
   Future guardians can be added from Firebase Database
   without changing this code.
========================================================= */

(function NPOSDynamicGuardianAccess() {

    const DB_URL =
        "https://np-os-b0eed-default-rtdb.firebaseio.com";

    let lastGuardianUID = null;
    let lastStudentUID = null;
    let pollTimer = null;

    async function getToken(user) {
        try {
            return await user.getIdToken();
        } catch (error) {
            console.error(
                "NP-OS Guardian: Could not get Firebase token.",
                error
            );
            return null;
        }
    }

    async function readFirebase(path, token) {

        const url =
            DB_URL +
            "/" +
            path +
            ".json?auth=" +
            encodeURIComponent(token);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                "Firebase read failed: HTTP " +
                response.status
            );
        }

        return await response.json();
    }

    async function loadGuardianData(user) {

        if (!user) {
            return;
        }

        try {

            const token = await getToken(user);

            if (!token) {
                return;
            }

            const guardianUID = user.uid;

            /*
               Step 1:
               Find which student this guardian is allowed to see.
            */

            const accessMap =
                await readFirebase(
                    "guardianAccess/" + guardianUID,
                    token
                );

            if (
                !accessMap ||
                typeof accessMap !== "object"
            ) {

                console.warn(
                    "NP-OS Guardian: No student access assigned."
                );

                return;
            }

            const studentUID =
                Object.keys(accessMap).find(
                    uid => accessMap[uid] === true
                );

            if (!studentUID) {

                console.warn(
                    "NP-OS Guardian: No valid student UID found."
                );

                return;
            }

            /*
               Step 2:
               Read the student's NEET OS snapshot.
            */

            const snapshot =
                await readFirebase(
                    "users/" +
                    studentUID +
                    "/neetOS",
                    token
                );

            if (!snapshot) {

                console.warn(
                    "NP-OS Guardian: NEET OS cloud data not found."
                );

                return;
            }

            /*
               Step 3:
               Apply student data to NP-OS.
            */

            if (
                typeof normCurrent === "function"
            ) {
                S.current =
                    normCurrent(snapshot.studyData);
            }

            if (
                typeof normHistory === "function"
            ) {
                S.history =
                    normHistory(snapshot.history);
            }

            if (
                typeof normSyllabus === "function"
            ) {
                S.syllabus =
                    normSyllabus(snapshot.syllabus);
            }

            S.settings =
                snapshot.settings ?? null;

            if (snapshot.syncedAt) {

                const date =
                    new Date(snapshot.syncedAt);

                if (
                    !Number.isNaN(
                        date.getTime()
                    )
                ) {

                    S.lastSynced = date;

                    localStorage.setItem(
                        "NPOS_LAST_SYNC",
                        date.toISOString()
                    );
                }
            }

            S.source =
                "Firebase Cloud • Read-only Guardian";

            lastGuardianUID =
                guardianUID;

            lastStudentUID =
                studentUID;

            updateAll();
            syncPage();

            console.log(
                "NP-OS Guardian: Student data loaded.",
                {
                    guardianUID:
                        guardianUID,
                    studentUID:
                        studentUID,
                    syncedAt:
                        snapshot.syncedAt || null
                }
            );

        } catch (error) {

            console.error(
                "NP-OS Guardian Access Error:",
                error
            );

            if (typeof syncPage === "function") {
                syncPage();
            }
        }
    }

    async function checkGuardian() {

        try {

            const firebaseUser =
                window.NPOSFirebase?.user;

            if (!firebaseUser) {
                return;
            }

            await loadGuardianData(
                firebaseUser
            );

        } catch (error) {

            console.error(
                "NP-OS Guardian polling error:",
                error
            );
        }
    }

    /*
       Firebase login state may change without
       NP-OS core exposing its listener.

       Therefore we check periodically.
    */

    pollTimer =
        setInterval(
            checkGuardian,
            5000
        );

    /*
       First check.
    */

    setTimeout(
        checkGuardian,
        1500
    );

    /*
       Public read-only status.
    */

    window.NPOSGuardian = {

        status: () => ({
            guardianUID:
                lastGuardianUID,

            studentUID:
                lastStudentUID,

            connected:
                !!window.NPOSFirebase?.user,

            source:
                S.source,

            lastSynced:
                S.lastSynced
        })

    };

    console.log(
        "NP-OS: Dynamic Guardian Access ready."
    );

})();
