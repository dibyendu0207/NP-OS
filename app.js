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

/* =========================================================
   NP-OS — LIVE CIRCULAR PROGRESS RING FIX
   Visual only. Does not modify Firebase, sync, storage,
   task logic or progress calculation.
   ========================================================= */

(function NPOSCircularProgressFix() {

    function updateCircularRing() {

        try {

            const ring =
                document.querySelector(".progress-ring");

            if (!ring) {
                return;
            }

            const p =
                Math.max(
                    0,
                    Math.min(
                        100,
                        Number(progress()) || 0
                    )
                );

            ring.style.background =
                `conic-gradient(
                    from -90deg,
                    #4da3ff 0%,
                    #4da3ff ${p}%,
                    rgba(255,255,255,0.10) ${p}%,
                    rgba(255,255,255,0.10) 100%
                )`;

        } catch (error) {

            console.warn(
                "NP-OS: Circular progress visual update failed.",
                error
            );

        }

    }


    /* Initial paint */
    updateCircularRing();


    /* Keep ring synchronized with the live dashboard */
    setInterval(
        updateCircularRing,
        1000
    );


    console.log(
        "NP-OS: Circular progress ring FIX loaded."
    );

})();
/* =========================================================
   NP-OS — LIVE STUDY DETAIL + TEST ANALYSIS FIX
   Version 3.0.0
   ---------------------------------------------------------
   SAFE ADDON
   • No MutationObserver
   • No Firebase write
   • No direct Firebase fetch
   • Uses NP-OS loaded cloud data
   • Self Study exact Activity / Subject / Chapter
   • Daily Repair exact Activity / Subject / Chapter
   • Live Test
   • Test Analysis
   ========================================================= */

(function NPOS_FINAL_LIVE_TEST_FIX(){

    "use strict";

    const VERSION = "3.0.0";
    const REFRESH = 2000;

    let timer = null;


    /* =====================================================
       HELPERS
       ===================================================== */

    function $(id){
        return document.getElementById(id);
    }


    function esc(value){

        const div =
            document.createElement("div");

        div.textContent =
            String(value ?? "");

        return div.innerHTML;
    }


    function num(value){

        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : 0;
    }


    function arr(value){

        return Array.isArray(value)
            ? value
            : [];
    }


    function obj(value){

        return (
            value &&
            typeof value === "object"
        )
            ? value
            : {};
    }


    function duration(seconds){

        seconds =
            Math.max(
                0,
                Math.floor(num(seconds))
            );

        const h =
            Math.floor(seconds / 3600);

        const m =
            Math.floor(
                (seconds % 3600) / 60
            );

        const s =
            seconds % 60;


        return (
            String(h).padStart(2,"0") +
            ":" +
            String(m).padStart(2,"0") +
            ":" +
            String(s).padStart(2,"0")
        );
    }


    function dateText(value){

        if(!value){
            return "—";
        }

        const d =
            new Date(
                Number(value)
            );

        if(
            Number.isNaN(
                d.getTime()
            )
        ){
            return "—";
        }

        return d.toLocaleString(
            "en-IN"
        );
    }


    /* =====================================================
       CURRENT STUDENT DATA

       NP-OS already loads the student's Firebase
       snapshot into cur().

       We use that directly.
       ===================================================== */

    function studentData(){

        try{

            if(
                typeof cur ===
                "function"
            ){

                return cur();
            }

        }catch(error){

            console.warn(
                "NP-OS: cur() error",
                error
            );
        }

        return null;
    }


    /* =====================================================
       TEST RECORDS
       ===================================================== */

    function testRecords(){

        const d =
            studentData();

        if(!d){
            return [];
        }


        if(
            Array.isArray(
                d.testRecords
            )
        ){

            return d.testRecords;
        }


        if(
            d.tests &&
            Array.isArray(
                d.tests.testRecords
            )
        ){

            return d.tests.testRecords;
        }


        return [];
    }


    /* =====================================================
       ACTIVE TEST
       ===================================================== */

    function activeTest(){

        const d =
            studentData();

        if(!d){
            return null;
        }


        if(
            d.activeTest &&
            typeof d.activeTest ===
                "object"
        ){

            return d.activeTest;
        }


        if(
            d.tests &&
            d.tests.activeTest
        ){

            return d.tests.activeTest;
        }


        return null;
    }


    /* =====================================================
       LIVE STUDY
       ===================================================== */

    function liveStudy(){

        const d =
            studentData();

        if(!d){
            return null;
        }


        const index =
            Number.isInteger(
                d.activeTask
            )
                ? d.activeTask
                : null;


        if(
            index === null
        ){

            return null;
        }


        let task = null;

        try{

            if(
                typeof TASKS !==
                    "undefined"
            ){

                task =
                    TASKS[index];
            }

        }catch(_){}


        const meta =
            obj(
                d.taskMeta?.[index]
            );


        /*
           IMPORTANT:

           Self Study / Daily Repair addon stores:

           addonActivity
           addonSubject
           addonChapter

           inside taskMeta.
        */

        const activity =
            meta.addonActivity ||
            "Study";


        const subject =
            meta.addonSubject ||
            task?.subject ||
            "—";


        const chapter =
            meta.addonChapter ||
            meta.chapter ||
            "Chapter not specified";


        const taskName =
            task?.name ||
            "Study Session";


        /*
           Existing saved study time
        */

        let elapsed =
            num(
                d.studySeconds?.[index]
            );


        /*
           Current running session time
        */

        if(
            d.activeStartTime
        ){

            elapsed +=
                Math.max(
                    0,
                    Math.floor(
                        (
                            Date.now() -
                            num(
                                d.activeStartTime
                            )
                        ) / 1000
                    )
                );
        }


        return {

            index,

            taskName,

            activity,

            subject,

            chapter,

            elapsed,

            meta
        };
    }


    /* =====================================================
       UPDATE EXISTING LIVE CARD
       ===================================================== */

    function updateMainLive(){

        const d =
            studentData();

        if(!d){
            return;
        }


        /* ================================================
           1. LIVE TEST
           ================================================ */

        const test =
            activeTest();


        if(test){

            if(
                $("liveStatusTitle")
            ){

                $("liveStatusTitle")
                    .textContent =
                    "Test Running";
            }


            if(
                $("liveTaskName")
            ){

                $("liveTaskName")
                    .textContent =
                    "📝 Test";
            }


            if(
                $("liveSubject")
            ){

                $("liveSubject")
                    .textContent =
                    test.authority ||
                    "Self Test";
            }


            if(
                $("liveTimer")
            ){

                const remaining =
                    Math.max(
                        0,
                        num(test.endAt) -
                        Date.now()
                    );


                $("liveTimer")
                    .textContent =
                    duration(
                        Math.ceil(
                            remaining / 1000
                        )
                    );
            }


            if(
                $("liveChapter")
            ){

                const topics =
                    arr(
                        test.subjects
                    )
                    .map(
                        x =>
                            `${x.subject || ""} — ${x.chapter || ""}`
                    )
                    .join(" | ");


                $("liveChapter")
                    .textContent =
                    topics ||
                    "Test in progress";
            }


            $("liveStatusDot")
                ?.classList
                .add("active");


            return;
        }


        /* ================================================
           2. LIVE STUDY / SELF STUDY / DAILY REPAIR
           ================================================ */

        const study =
            liveStudy();


        if(study){

            if(
                $("liveStatusTitle")
            ){

                $("liveStatusTitle")
                    .textContent =
                    "Studying Now";
            }


            if(
                $("liveTaskName")
            ){

                $("liveTaskName")
                    .textContent =
                    `${study.taskName} — ${study.activity}`;
            }


            if(
                $("liveSubject")
            ){

                $("liveSubject")
                    .textContent =
                    study.subject;
            }


            if(
                $("liveTimer")
            ){

                $("liveTimer")
                    .textContent =
                    duration(
                        study.elapsed
                    );
            }


            if(
                $("liveChapter")
            ){

                $("liveChapter")
                    .textContent =
                    study.chapter;
            }


            $("liveStatusDot")
                ?.classList
                .add("active");


            return;
        }


        /* ================================================
           3. NO ACTIVE SESSION
           ================================================ */

        let scheduled =
            -1;


        try{

            if(
                typeof TASKS !==
                    "undefined" &&
                typeof nowIn ===
                    "function"
            ){

                scheduled =
                    TASKS
                        .slice(0,8)
                        .findIndex(
                            nowIn
                        );
            }

        }catch(_){}


        if(
            scheduled >= 0 &&
            typeof TASKS !==
                "undefined"
        ){

            const t =
                TASKS[scheduled];


            if(
                $("liveStatusTitle")
            ){

                $("liveStatusTitle")
                    .textContent =
                    "Scheduled";
            }


            if(
                $("liveTaskName")
            ){

                $("liveTaskName")
                    .textContent =
                    t.name;
            }


            if(
                $("liveSubject")
            ){

                $("liveSubject")
                    .textContent =
                    t.subject ||
                    "—";
            }


            if(
                $("liveTimer")
            ){

                $("liveTimer")
                    .textContent =
                    `${t.start} – ${t.end}`;
            }


            if(
                $("liveChapter")
            ){

                $("liveChapter")
                    .textContent =
                    "Waiting for study start";
            }


            $("liveStatusDot")
                ?.classList
                .remove("active");


            return;
        }


        /* ================================================
           4. NOTHING
           ================================================ */

        if(
            $("liveStatusTitle")
        ){

            $("liveStatusTitle")
                .textContent =
                "Not Studying";
        }


        if(
            $("liveTaskName")
        ){

            $("liveTaskName")
                .textContent =
                "No active task";
        }


        if(
            $("liveSubject")
        ){

            $("liveSubject")
                .textContent =
                "—";
        }


        if(
            $("liveTimer")
        ){

            $("liveTimer")
                .textContent =
                "00:00:00";
        }


        if(
            $("liveChapter")
        ){

            $("liveChapter")
                .textContent =
                "—";
        }


        $("liveStatusDot")
            ?.classList
            .remove("active");
    }


    /* =====================================================
       EXTRA LIVE DETAIL
       ===================================================== */

    function ensureLiveDetail(){

        let box =
            $("nposLiveDetailFinal");


        if(box){
            return box;
        }


        const anchor =
            $("liveChapter") ||
            $("liveTaskName");


        if(!anchor){
            return null;
        }


        box =
            document.createElement(
                "div"
            );


        box.id =
            "nposLiveDetailFinal";


        box.style.cssText = `
            margin-top:12px;
            padding:13px 15px;
            border-radius:14px;
            background:rgba(255,255,255,.05);
            border:1px solid rgba(255,255,255,.09);
            font-size:13px;
            line-height:1.7;
        `;


        box.innerHTML = `
            <div style="
                font-size:11px;
                opacity:.55;
                font-weight:800;
                margin-bottom:4px;
            ">
                LIVE STUDY DETAILS
            </div>

            <div id="nposLiveDetailContent">
                Waiting...
            </div>
        `;


        anchor.parentElement
            ?.appendChild(box);


        return box;
    }


    function updateLiveDetail(){

        const box =
            ensureLiveDetail();


        if(!box){
            return;
        }


        const content =
            $("nposLiveDetailContent");


        if(!content){
            return;
        }


        const test =
            activeTest();


        if(test){

            const topics =
                arr(
                    test.subjects
                )
                .map(
                    x =>
                        `${x.subject || ""} — ${x.chapter || ""} (${x.questions || 0} Q)`
                )
                .join(" | ");


            const remaining =
                Math.max(
                    0,
                    num(test.endAt) -
                    Date.now()
                );


            content.innerHTML = `

                <div>
                    <b>Mode:</b>
                    Test
                </div>

                <div>
                    <b>Authority:</b>
                    ${esc(
                        test.authority ||
                        "Self Test"
                    )}
                </div>

                <div>
                    <b>Topics:</b>
                    ${esc(
                        topics ||
                        "—"
                    )}
                </div>

                <div>
                    <b>Questions:</b>
                    ${num(
                        test.totalQuestions
                    )}
                </div>

                <div>
                    <b>Full Marks:</b>
                    ${num(
                        test.fullMarks
                    )}
                </div>

                <div>
                    <b>Time Left:</b>
                    ${duration(
                        Math.ceil(
                            remaining /
                            1000
                        )
                    )}
                </div>
            `;

            return;
        }


        const study =
            liveStudy();


        if(study){

            content.innerHTML = `

                <div>
                    <b>Activity:</b>
                    ${esc(
                        study.activity
                    )}
                </div>

                <div>
                    <b>Subject:</b>
                    ${esc(
                        study.subject
                    )}
                </div>

                <div>
                    <b>Chapter:</b>
                    ${esc(
                        study.chapter
                    )}
                </div>

                <div>
                    <b>Study Time:</b>
                    ${duration(
                        study.elapsed
                    )}
                </div>
            `;

            return;
        }


        content.innerHTML = `
            <span style="opacity:.55">
                No active study session.
            </span>
        `;
    }


    /* =====================================================
       TEST ANALYSIS
       ===================================================== */

    function percentage(test){

        if(
            test.percentage !==
                null &&
            test.percentage !==
                undefined
        ){

            const p =
                Number(
                    test.percentage
                );

            if(
                Number.isFinite(p)
            ){

                return p;
            }
        }


        const score =
            Number(
                test.score
            );


        const marks =
            Number(
                test.fullMarks
            );


        if(
            Number.isFinite(score) &&
            Number.isFinite(marks) &&
            marks > 0
        ){

            return (
                score /
                marks *
                100
            );
        }


        return null;
    }


    function scored(test){

        return (
            test.score !==
                null &&
            test.score !==
                undefined &&
            Number.isFinite(
                Number(
                    test.score
                )
            )
        );
    }


    function renderTestAnalysis(){

        const statsPage =
            $("statsPage");


        if(!statsPage){
            return;
        }


        let box =
            $("nposTestAnalysisFinal");


        if(!box){

            box =
                document.createElement(
                    "div"
                );


            box.id =
                "nposTestAnalysisFinal";


            box.style.cssText = `
                margin-top:20px;
                padding:18px;
                border-radius:18px;
                background:rgba(255,255,255,.035);
                border:1px solid rgba(255,255,255,.09);
                box-sizing:border-box;
            `;


            statsPage.appendChild(
                box
            );
        }


        const records =
            testRecords();


        const active =
            activeTest();


        let totalQuestions = 0;
        let correct = 0;
        let incorrect = 0;
        let skipped = 0;
        let totalScore = 0;
        let totalMarks = 0;
        let scoredCount = 0;
        let percentageTotal = 0;


        records.forEach(
            test => {

                if(
                    !scored(test)
                ){
                    return;
                }


                scoredCount++;


                totalQuestions +=
                    num(
                        test.totalQuestions
                    );


                correct +=
                    num(
                        test.correct
                    );


                incorrect +=
                    num(
                        test.incorrect
                    );


                skipped +=
                    num(
                        test.skipped
                    );


                totalScore +=
                    num(
                        test.score
                    );


                totalMarks +=
                    num(
                        test.fullMarks
                    );


                const p =
                    percentage(
                        test
                    );


                if(p !== null){

                    percentageTotal +=
                        p;
                }
            }
        );


        const avg =
            scoredCount
                ? percentageTotal /
                  scoredCount
                : 0;


        const accuracyBase =
            correct +
            incorrect;


        const accuracy =
            accuracyBase
                ? correct /
                  accuracyBase *
                  100
                : 0;


        /*
           SUBJECT ANALYSIS
        */

        const subjectMap =
            new Map();


        records.forEach(
            test => {

                arr(
                    test.subjects
                )
                .forEach(
                    item => {

                        const subject =
                            String(
                                item.subject ||
                                "Unknown"
                            );


                        if(
                            !subjectMap.has(
                                subject
                            )
                        ){

                            subjectMap.set(
                                subject,
                                {
                                    tests:0,
                                    questions:0
                                }
                            );
                        }


                        const row =
                            subjectMap.get(
                                subject
                            );


                        row.tests++;


                        row.questions +=
                            num(
                                item.questions
                            );
                    }
                );
            }
        );


        const subjectHTML =
            Array.from(
                subjectMap.entries()
            )
            .map(
                ([name,row]) => `

                    <div style="
                        padding:9px 0;
                        border-bottom:
                            1px solid
                            rgba(255,255,255,.07);
                    ">

                        <b>
                            ${esc(name)}
                        </b>

                        <div style="
                            opacity:.65;
                            font-size:12px;
                            margin-top:2px;
                        ">
                            ${row.tests}
                            test entries •
                            ${row.questions}
                            questions
                        </div>

                    </div>
                `
            )
            .join("");


        /*
           AUTHORITY ANALYSIS
        */

        const authorityMap =
            new Map();


        records.forEach(
            test => {

                const authority =
                    String(
                        test.authority ||
                        "Unknown"
                    );


                if(
                    !authorityMap.has(
                        authority
                    )
                ){

                    authorityMap.set(
                        authority,
                        {
                            tests:0,
                            scored:0,
                            percent:0
                        }
                    );
                }


                const row =
                    authorityMap.get(
                        authority
                    );


                row.tests++;


                if(
                    scored(test)
                ){

                    row.scored++;


                    const p =
                        percentage(
                            test
                        );


                    if(p !== null){

                        row.percent +=
                            p;
                    }
                }
            }
        );


        const authorityHTML =
            Array.from(
                authorityMap.entries()
            )
            .map(
                ([name,row]) => `

                    <div style="
                        padding:9px 0;
                        border-bottom:
                            1px solid
                            rgba(255,255,255,.07);
                    ">

                        <b>
                            ${esc(name)}
                        </b>

                        <div style="
                            opacity:.65;
                            font-size:12px;
                            margin-top:2px;
                        ">
                            ${row.tests}
                            tests •
                            ${
                                row.scored
                                    ? Math.round(
                                        row.percent /
                                        row.scored
                                    )
                                    : 0
                            }%
                            average
                        </div>

                    </div>
                `
            )
            .join("");


        /*
           RECENT TESTS
        */

        const recent =
            records
                .slice()
                .sort(
                    (a,b) =>
                        num(
                            b.completedAt ||
                            b.startedAt
                        ) -
                        num(
                            a.completedAt ||
                            a.startedAt
                        )
                )
                .slice(
                    0,
                    10
                );


        const recentHTML =
            recent.length
                ? recent
                    .map(
                        test => {

                            const p =
                                percentage(
                                    test
                                );


                            const topics =
                                arr(
                                    test.subjects
                                )
                                .map(
                                    x =>
                                        `${x.subject || ""} — ${x.chapter || ""}`
                                )
                                .join(
                                    " | "
                                );


                            return `

                                <div style="
                                    padding:12px 0;
                                    border-bottom:
                                        1px solid
                                        rgba(255,255,255,.08);
                                ">

                                    <b>
                                        ${esc(
                                            test.authority ||
                                            "Test"
                                        )}
                                    </b>

                                    <div style="
                                        font-size:12px;
                                        opacity:.65;
                                        margin-top:4px;
                                    ">
                                        ${esc(
                                            topics ||
                                            "No topic data"
                                        )}
                                    </div>

                                    <div style="
                                        margin-top:5px;
                                    ">
                                        ${num(
                                            test.totalQuestions
                                        )}
                                        Q •
                                        ${num(
                                            test.fullMarks
                                        )}
                                        Marks
                                    </div>

                                    <div style="
                                        margin-top:4px;
                                        font-weight:800;
                                    ">
                                        ${
                                            scored(test)
                                                ? `${num(test.score)} / ${num(test.fullMarks)} ${p !== null ? `(${Math.round(p)}%)` : ""}`
                                                : "⏳ Score Pending"
                                        }
                                    </div>

                                    <div style="
                                        font-size:11px;
                                        opacity:.5;
                                        margin-top:3px;
                                    ">
                                        ${dateText(
                                            test.completedAt ||
                                            test.startedAt
                                        )}
                                    </div>

                                </div>
                            `;
                        }
                    )
                    .join("")
                : `
                    <div style="
                        opacity:.6;
                        padding:8px 0;
                    ">
                        No test records yet.
                    </div>
                `;


        const activeHTML =
            active
                ? `

                    <div style="
                        padding:14px;
                        margin-bottom:16px;
                        border-radius:14px;
                        background:rgba(40,140,255,.08);
                        border:1px solid rgba(80,170,255,.22);
                    ">

                        <div style="
                            font-weight:900;
                            margin-bottom:7px;
                        ">
                            🔴 TEST RUNNING
                        </div>

                        <div style="
                            font-size:13px;
                            line-height:1.7;
                        ">

                            <b>Authority:</b>
                            ${esc(
                                active.authority ||
                                "Self Test"
                            )}

                            <br>

                            <b>Questions:</b>
                            ${num(
                                active.totalQuestions
                            )}

                            <br>

                            <b>Full Marks:</b>
                            ${num(
                                active.fullMarks
                            )}

                        </div>

                    </div>
                `
                : "";


        box.innerHTML = `

            <div style="
                font-size:21px;
                font-weight:900;
                margin-bottom:4px;
            ">
                📝 Test Analysis
            </div>

            <div style="
                font-size:12px;
                opacity:.55;
                margin-bottom:16px;
            ">
                Live student test performance
            </div>


            ${activeHTML}


            <div style="
                display:grid;
                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(
                            125px,
                            1fr
                        )
                    );
                gap:9px;
                margin-bottom:20px;
            ">

                ${stat(
                    "Total Tests",
                    records.length
                )}

                ${stat(
                    "Scored",
                    scoredCount
                )}

                ${stat(
                    "Questions",
                    totalQuestions
                )}

                ${stat(
                    "Correct",
                    correct
                )}

                ${stat(
                    "Incorrect",
                    incorrect
                )}

                ${stat(
                    "Skipped",
                    skipped
                )}

                ${stat(
                    "Average",
                    scoredCount
                        ? Math.round(avg) + "%"
                        : "—"
                )}

                ${stat(
                    "Accuracy",
                    accuracyBase
                        ? Math.round(
                            accuracy
                        ) + "%"
                        : "—"
                )}

                ${stat(
                    "Total Score",
                    scoredCount
                        ? `${totalScore}/${totalMarks}`
                        : "—"
                )}

            </div>


            <div style="
                display:grid;
                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(
                            250px,
                            1fr
                        )
                    );
                gap:20px;
            ">

                <div>

                    <div style="
                        font-weight:900;
                        margin-bottom:6px;
                    ">
                        📚 Subject Analysis
                    </div>

                    ${
                        subjectHTML ||
                        `<span style="opacity:.55">
                            No subject data
                        </span>`
                    }

                </div>


                <div>

                    <div style="
                        font-weight:900;
                        margin-bottom:6px;
                    ">
                        🏷️ Test Authority
                    </div>

                    ${
                        authorityHTML ||
                        `<span style="opacity:.55">
                            No authority data
                        </span>`
                    }

                </div>

            </div>


            <div style="
                margin-top:20px;
            ">

                <div style="
                    font-weight:900;
                    margin-bottom:6px;
                ">
                    🕘 Recent Test History
                </div>

                ${recentHTML}

            </div>


            <div style="
                margin-top:12px;
                font-size:10px;
                opacity:.4;
            ">
                Read-only • Auto refreshed
            </div>
        `;
    }


    function stat(
        label,
        value
    ){

        return `

            <div style="
                padding:11px;
                border-radius:12px;
                background:
                    rgba(255,255,255,.045);
                border:
                    1px solid
                    rgba(255,255,255,.07);
            ">

                <div style="
                    font-size:10px;
                    opacity:.55;
                    margin-bottom:4px;
                ">
                    ${esc(label)}
                </div>

                <div style="
                    font-size:17px;
                    font-weight:900;
                ">
                    ${esc(value)}
                </div>

            </div>
        `;
    }


    /* =====================================================
       MAIN REFRESH

       ONLY interval.
       NO MutationObserver.
       ===================================================== */

    function refresh(){

        try{

            updateMainLive();

            updateLiveDetail();

            renderTestAnalysis();

        }catch(error){

            console.warn(
                "NP-OS Final Addon refresh error:",
                error
            );
        }
    }


    /* =====================================================
       START
       ===================================================== */

    function start(){

        refresh();


        clearInterval(
            timer
        );


        timer =
            setInterval(
                refresh,
                REFRESH
            );


        console.log(
            "NP-OS FINAL LIVE + TEST FIX v" +
            VERSION +
            " loaded."
        );
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.NPOSFinalAddon = {

        version:
            VERSION,

        refresh,

        liveStudy,

        activeTest,

        testRecords
    };


    if(
        document.readyState ===
        "loading"
    ){

        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once:true
            }
        );

    }else{

        start();
    }

})();
/* =========================================================
   NPOS — LIVE CHAPTER FINAL OVERRIDE
   Extra addon only — DOES NOT DELETE / MODIFY old addons
   Fixes Chapter blink between old + new live renderers
   ========================================================= */

(function NPOSLiveChapterFinalOverride(){

    let observer = null;
    let lastChapter = "";

    function getFinalChapter(){

        try{

            if(typeof cur !== "function") return null;

            const d = cur();

            if(!d) return null;

            const activeIndex =
                Number.isInteger(d.activeTask)
                    ? d.activeTask
                    : null;

            if(
                activeIndex === null ||
                !TASKS ||
                !TASKS[activeIndex]
            ){
                return null;
            }

            const meta =
                d.taskMeta?.[activeIndex] || {};

            /*
             * Self Study addon-এর actual chapter
             * সর্বপ্রথম নেওয়া হবে।
             */

            return (
                meta.addonChapter ||
                meta.chapter ||
                null
            );

        }catch(error){

            return null;

        }

    }


    function forceChapter(){

        const el =
            document.getElementById("liveChapter");

        if(!el) return;

        const chapter = getFinalChapter();

        if(!chapter) return;

        /*
         * Same value হলে DOM touch করব না।
         */

        if(
            el.textContent === chapter &&
            lastChapter === chapter
        ){
            return;
        }

        lastChapter = chapter;

        if(el.textContent !== chapter){
            el.textContent = chapter;
        }

    }


    function install(){

        const el =
            document.getElementById("liveChapter");

        if(!el){

            setTimeout(install, 500);
            return;

        }


        /*
         * Initial correction
         */

        forceChapter();


        /*
         * IMPORTANT:
         * শুধু liveChapter observe করছি।
         * পুরো body observe করছি না।
         *
         * তাই loading / infinite loop হবে না।
         */

        if(observer){
            observer.disconnect();
        }

        observer = new MutationObserver(function(){

            const chapter = getFinalChapter();

            if(!chapter) return;

            /*
             * Old NP-OS renderer যদি
             * "Chapter not specified" বা অন্য কিছু বসায়,
             * সঙ্গে সঙ্গে actual chapter restore হবে।
             */

            if(el.textContent !== chapter){

                el.textContent = chapter;

            }

            lastChapter = chapter;

        });


        observer.observe(el, {
            childList: true,
            characterData: true,
            subtree: true
        });


        console.log(
            "NPOS: Live Chapter Final Override active."
        );

    }


    /*
     * DOM ready হলে install
     */

    if(document.readyState === "loading"){

        document.addEventListener(
            "DOMContentLoaded",
            install,
            { once:true }
        );

    }else{

        setTimeout(install, 300);

    }


    /*
     * Extra safety:
     * প্রতি 1 sec শুধু check করবে।
     * DOM rebuild করবে না।
     */

    setInterval(function(){

        forceChapter();

    }, 1000);


    window.NPOSLiveChapterFinalOverride = {
        version: "1.0.0",
        refresh: forceChapter
    };

})();
/* =========================================================
   NPOS — LIVE STUDY FINAL LOCK
   Extra addon only
   Does NOT delete or modify existing addons
   Fixes Self Study / Subject / Chapter blinking
   ========================================================= */

(function NPOSLiveStudyFinalLock(){

    let observer = null;

    function getLiveData(){

        try{

            if(typeof cur !== "function") return null;

            const d = cur();

            if(!d) return null;

            const index =
                Number.isInteger(d.activeTask)
                    ? d.activeTask
                    : null;

            if(
                index === null ||
                !TASKS ||
                !TASKS[index]
            ){
                return null;
            }

            const task = TASKS[index];

            const meta =
                d.taskMeta?.[index] || {};

            /*
             * Self Study addon data
             */

            const activity =
                meta.addonActivity ||
                null;

            const subject =
                meta.addonSubject ||
                task.subject ||
                "Mixed";

            const chapter =
                meta.addonChapter ||
                meta.chapter ||
                "Chapter not specified";

            let taskName =
                task.name || "Studying";

            /*
             * Self Study হলে activity সহ title
             */

            if(
                taskName === "Self Study" &&
                activity
            ){
                taskName =
                    "Self Study — " + activity;
            }

            return {
                taskName,
                subject,
                chapter
            };

        }catch(error){

            console.warn(
                "NPOS Live Study Final Lock:",
                error
            );

            return null;
        }
    }


    function forceLive(){

        const data = getLiveData();

        if(!data) return;


        const title =
            document.getElementById("liveTaskName");

        const subject =
            document.getElementById("liveSubject");

        const chapter =
            document.getElementById("liveChapter");


        /*
         * IMPORTANT:
         * Only change when necessary.
         * This prevents unnecessary DOM repaint.
         */

        if(
            title &&
            title.textContent !== data.taskName
        ){
            title.textContent = data.taskName;
        }


        if(
            subject &&
            subject.textContent !== data.subject
        ){
            subject.textContent = data.subject;
        }


        if(
            chapter &&
            chapter.textContent !== data.chapter
        ){
            chapter.textContent = data.chapter;
        }

    }


    function install(){

        const title =
            document.getElementById("liveTaskName");

        const subject =
            document.getElementById("liveSubject");

        const chapter =
            document.getElementById("liveChapter");


        if(
            !title ||
            !subject ||
            !chapter
        ){
            setTimeout(install, 500);
            return;
        }


        /*
         * First correction
         */

        forceLive();


        /*
         * Observe ONLY these 3 elements.
         *
         * NOT document.body
         * NOT the whole page
         *
         * So this cannot create the previous
         * loading / infinite MutationObserver problem.
         */

        if(observer){
            observer.disconnect();
        }


        observer = new MutationObserver(function(){

            forceLive();

        });


        observer.observe(title, {
            childList: true,
            characterData: true,
            subtree: true
        });


        observer.observe(subject, {
            childList: true,
            characterData: true,
            subtree: true
        });


        observer.observe(chapter, {
            childList: true,
            characterData: true,
            subtree: true
        });


        console.log(
            "NPOS: Live Study Final Lock active."
        );

    }


    /*
     * Install after NP-OS + previous addons
     * have finished loading.
     */

    if(document.readyState === "loading"){

        document.addEventListener(
            "DOMContentLoaded",
            function(){
                setTimeout(install, 500);
            },
            { once:true }
        );

    }else{

        setTimeout(install, 500);

    }


    /*
     * Safety refresh.
     * Only checks values; does not rebuild UI.
     */

    setInterval(function(){

        forceLive();

    }, 1000);


    window.NPOSLiveStudyFinalLock = {
        version: "1.0.0",
        refresh: forceLive
    };

})();
/* =========================================================
   NP-OS — STUDENT SELF ACCESS
   ---------------------------------------------------------
   Student can access their own NEET OS data.
   Guardian access remains unchanged.
   Extra addon only.
   NO Firebase write.
   ========================================================= */

(function NPOSStudentSelfAccess(){

    const DB_URL =
        "https://np-os-b0eed-default-rtdb.firebaseio.com";

    let lastStudentUID = null;


    async function getToken(user){

        try{
            return await user.getIdToken();
        }catch(error){

            console.error(
                "NP-OS Student Access: Token error",
                error
            );

            return null;
        }
    }


    async function loadOwnData(user){

        if(!user) return;

        try{

            const token =
                await getToken(user);

            if(!token) return;


            const studentUID =
                user.uid;


            /*
             * Student reads ONLY their own
             * users/{uid}/neetOS
             */

            const url =
                DB_URL +
                "/users/" +
                encodeURIComponent(studentUID) +
                "/neetOS.json?auth=" +
                encodeURIComponent(token);


            const response =
                await fetch(url);


            if(!response.ok){

                console.warn(
                    "NP-OS Student Access: Own data read failed.",
                    response.status
                );

                return;
            }


            const snapshot =
                await response.json();


            if(!snapshot){

                console.warn(
                    "NP-OS Student Access: Own NEET OS data not found."
                );

                return;
            }


            /*
             * Apply exactly like Firebase cloud data.
             */

            if(
                typeof normCurrent === "function"
            ){
                S.current =
                    normCurrent(
                        snapshot.studyData
                    );
            }


            if(
                typeof normHistory === "function"
            ){
                S.history =
                    normHistory(
                        snapshot.history
                    );
            }


            if(
                typeof normSyllabus === "function"
            ){
                S.syllabus =
                    normSyllabus(
                        snapshot.syllabus
                    );
            }


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

                    localStorage.setItem(
                        "NPOS_LAST_SYNC",
                        date.toISOString()
                    );
                }
            }


            /*
             * Mark source as Student Self Access.
             */

            S.source =
                "Firebase Cloud • Student Self Access";


            lastStudentUID =
                studentUID;


            updateAll();
            syncPage();


            console.log(
                "NP-OS Student: Own data loaded.",
                {
                    studentUID:
                        studentUID,
                    syncedAt:
                        snapshot.syncedAt || null
                }
            );


        }catch(error){

            console.error(
                "NP-OS Student Self Access Error:",
                error
            );

        }

    }


    function checkStudent(){

        const user =
            window.NPOSFirebase?.user;

        if(!user) return;


        /*
         * Every logged-in user can try their own
         * UID. Firebase Security Rules will decide
         * whether that read is permitted.
         */

        loadOwnData(user);

    }


    /*
     * First load
     */

    setTimeout(
        checkStudent,
        2000
    );


    /*
     * Keep student data refreshed.
     * Guardian system remains untouched.
     */

    setInterval(
        checkStudent,
        10000
    );


    window.NPOSStudentAccess = {

        status: () => ({
            studentUID:
                lastStudentUID,

            connected:
                !!window.NPOSFirebase?.user,

            source:
                S.source
        })

    };


    console.log(
        "NP-OS: Student Self Access addon ready."
    );

})();
/* =========================================================
   NP-OS — SIDEBAR / NAVIGATION SCROLL FIX
   Extra addon only
   Does NOT modify existing JS logic
   ========================================================= */

(function NPOSSIDEBARScrollFix(){

    const style = document.createElement("style");

    style.id = "nposSidebarScrollFix";

    style.textContent = `

        /* Main navigation / drawer containers */
        nav,
        aside,
        .sidebar,
        .side-nav,
        .navigation,
        .nav-menu,
        .drawer,
        .menu,
        .app-sidebar {

            max-height: 100vh !important;
            height: 100vh !important;

            overflow-y: auto !important;
            overflow-x: hidden !important;

            box-sizing: border-box !important;

            -webkit-overflow-scrolling: touch !important;

            scrollbar-width: thin;
        }


        /*
         * If the navigation itself is inside
         * a fixed drawer/container.
         */

        nav *,
        aside *,
        .sidebar *,
        .side-nav *,
        .navigation *,
        .nav-menu *,
        .drawer *,
        .menu *,
        .app-sidebar * {

            box-sizing: border-box;
        }


        /*
         * Keep navigation header visible,
         * while menu items can scroll.
         */

        .sidebar,
        .side-nav,
        .navigation,
        .nav-menu,
        .drawer,
        .menu,
        .app-sidebar {

            min-height: 0 !important;
        }


        /*
         * Prevent the page itself from becoming
         * locked when drawer is open.
         */

        body {

            overflow-x: hidden !important;
        }


        /*
         * Make sure menu buttons/items remain reachable.
         */

        nav,
        aside,
        .sidebar,
        .side-nav,
        .navigation,
        .nav-menu,
        .drawer,
        .menu,
        .app-sidebar {

            overscroll-behavior-y: contain !important;
        }

    `;

    document.head.appendChild(style);


    console.log(
        "NP-OS: Sidebar navigation scroll fix loaded."
    );

})();
/* =========================================================
   NP-OS — FINAL GUARDIAN UI + STUDY ANALYTICS
   Version 5.0.0

   SAFE APPEND-ONLY ADDON

   ✓ Red premium UI
   ✓ Self Study details
   ✓ Daily Repair details
   ✓ Actual Test elapsed time
   ✓ Test analysis
   ✓ Physics / Chemistry / Botany / Zoology analytics
   ✓ Session + chapter + question tracking
   ✓ Firebase read-only compatible
   ✓ No Firebase write
   ✓ No data modification
   ✓ No MutationObserver
   ✓ No navigation replacement
   ✓ No core function replacement
   ✓ Responsive desktop / laptop / mobile
========================================================= */

(function NPOS_FINAL_GUARDIAN_UI(){

    "use strict";

    const VERSION = "5.0.0";

    /* -----------------------------------------------------
       Prevent duplicate installation
    ----------------------------------------------------- */

    if(window.__NPOS_FINAL_GUARDIAN_UI_V5){
        try{
            window.__NPOS_FINAL_GUARDIAN_UI_V5.refresh?.();
        }catch(_){}
        return;
    }

    window.__NPOS_FINAL_GUARDIAN_UI_V5 = {
        version: VERSION
    };


    /* =====================================================
       HELPERS
    ===================================================== */

    const $ = id =>
        document.getElementById(id);

    const esc = value =>
        String(value ?? "")
            .replace(
                /[&<>"']/g,
                c => ({
                    "&":"&amp;",
                    "<":"&lt;",
                    ">":"&gt;",
                    '"':"&quot;",
                    "'":"&#39;"
                }[c])
            );

    const num = value => {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    };

    const arr = value =>
        Array.isArray(value) ? value : [];

    function student(){

        try{

            if(
                typeof cur === "function"
            ){
                return cur() || {};
            }

        }catch(error){

            console.warn(
                "NP-OS Final UI: student data error",
                error
            );

        }

        return {};
    }


    /* =====================================================
       DURATION
    ===================================================== */

    function duration(seconds){

        seconds =
            Math.max(
                0,
                Math.floor(num(seconds))
            );

        const h =
            Math.floor(seconds / 3600);

        const m =
            Math.floor(
                (seconds % 3600) / 60
            );

        const s =
            seconds % 60;

        return (
            String(h).padStart(2,"0") +
            ":" +
            String(m).padStart(2,"0") +
            ":" +
            String(s).padStart(2,"0")
        );
    }


    function shortDuration(seconds){

        seconds =
            Math.max(
                0,
                Math.floor(num(seconds))
            );

        const h =
            Math.floor(seconds / 3600);

        const m =
            Math.floor(
                (seconds % 3600) / 60
            );

        if(h){
            return `${h}h ${String(m).padStart(2,"0")}m`;
        }

        return `${m}m`;
    }


    /* =====================================================
       TEST DATA
    ===================================================== */

    function getTests(){

        const d = student();

        if(
            Array.isArray(
                d.testRecords
            )
        ){
            return d.testRecords;
        }

        if(
            d.tests &&
            Array.isArray(
                d.tests.testRecords
            )
        ){
            return d.tests.testRecords;
        }

        return [];
    }


    function getActiveTest(){

        const d = student();

        if(
            d.activeTest &&
            typeof d.activeTest === "object"
        ){
            return d.activeTest;
        }

        if(
            d.tests &&
            d.tests.activeTest
        ){
            return d.tests.activeTest;
        }

        return null;
    }


    /* =====================================================
       ACTUAL TEST TIME

       IMPORTANT:
       Uses startedAt → completedAt.
       Does NOT use totalTime / allotted duration.
    ===================================================== */

    function testElapsed(test){

        if(!test){
            return 0;
        }

        const start =
            num(test.startedAt);

        const end =
            num(
                test.completedAt ||
                Date.now()
            );

        if(
            start > 0 &&
            end >= start
        ){
            return Math.floor(
                (end - start) / 1000
            );
        }

        return 0;
    }


    function totalTestTime(){

        return getTests()
            .reduce(
                (sum,test) =>
                    sum + testElapsed(test),
                0
            );
    }


    function activeTestElapsed(){

        const test =
            getActiveTest();

        if(!test){
            return 0;
        }

        const start =
            num(test.startedAt);

        if(!start){
            return 0;
        }

        return Math.max(
            0,
            Math.floor(
                (Date.now() - start) / 1000
            )
        );
    }


    /* =====================================================
       TEST SCORE
    ===================================================== */

    function testPercentage(test){

        if(
            test?.percentage !== null &&
            test?.percentage !== undefined
        ){

            const p =
                num(test.percentage);

            if(
                Number.isFinite(p)
            ){
                return p;
            }
        }

        const score =
            num(test?.score);

        const marks =
            num(test?.fullMarks);

        if(marks > 0){
            return (
                score /
                marks *
                100
            );
        }

        return null;
    }


    function isScored(test){

        return (
            test?.score !== null &&
            test?.score !== undefined &&
            Number.isFinite(
                Number(test.score)
            )
        );
    }


    /* =====================================================
       STUDY SESSION DATA
    ===================================================== */

    function getStudySessions(){

        const d = student();

        let sessions = [];

        /*
         * Unified analytics from NEET OS
         */

        if(
            Array.isArray(
                d.unifiedStudySessions
            )
        ){
            sessions =
                sessions.concat(
                    d.unifiedStudySessions
                );
        }


        /*
         * Self Study / Daily Repair
         */

        if(
            Array.isArray(
                d.addonSessions
            )
        ){
            sessions =
                sessions.concat(
                    d.addonSessions
                );
        }


        return sessions;
    }


    /* =====================================================
       BIOLOGY CLASSIFICATION
    ===================================================== */

    function biologyGroup(chapter){

        const c =
            String(chapter || "")
                .trim();

        if(!c){
            return "Botany";
        }

        const botany =
            arr(
                S?.syllabus?.Botany
            );

        const zoology =
            arr(
                S?.syllabus?.Zoology
            );

        if(
            botany.includes(c)
        ){
            return "Botany";
        }

        if(
            zoology.includes(c)
        ){
            return "Zoology";
        }


        /*
         * Fallback for saved NEET OS
         * data which may already contain
         * Botany / Zoology.
         */

        if(
            /zoology/i.test(
                String(chapter)
            )
        ){
            return "Zoology";
        }

        return "Botany";
    }


    function normalizeSubject(
        subject,
        chapter
    ){

        const s =
            String(subject || "")
                .trim();

        if(
            /^physics$/i.test(s)
        ){
            return "Physics";
        }

        if(
            /^chemistry$/i.test(s)
        ){
            return "Chemistry";
        }

        if(
            /^botany$/i.test(s)
        ){
            return "Botany";
        }

        if(
            /^zoology$/i.test(s)
        ){
            return "Zoology";
        }

        if(
            /^biology$/i.test(s)
        ){
            return biologyGroup(chapter);
        }

        return null;
    }


    /* =====================================================
       TODAY STUDY DAY
    ===================================================== */

    function todayStudyKey(){

        try{

            if(
                typeof studyKey ===
                "function"
            ){
                return studyKey();
            }

        }catch(_){}

        const d =
            new Date();

        if(
            d.getHours() < 3
        ){
            d.setDate(
                d.getDate() - 1
            );
        }

        return (
            d.getFullYear() +
            "-" +
            String(
                d.getMonth()+1
            ).padStart(2,"0") +
            "-" +
            String(
                d.getDate()
            ).padStart(2,"0")
        );
    }


    function todaySessions(){

        const today =
            todayStudyKey();

        return getStudySessions()
            .filter(
                s =>
                    !s.date ||
                    s.date === today
            );
    }


    /* =====================================================
       SESSION AGGREGATION
    ===================================================== */

    function buildAnalytics(){

        const result = {

            Physics:{
                time:0,
                questions:0,
                sessions:0,
                chapters:new Map()
            },

            Chemistry:{
                time:0,
                questions:0,
                sessions:0,
                chapters:new Map()
            },

            Botany:{
                time:0,
                questions:0,
                sessions:0,
                chapters:new Map()
            },

            Zoology:{
                time:0,
                questions:0,
                sessions:0,
                chapters:new Map()
            }

        };


        todaySessions()
            .forEach(
                session => {

                    const chapter =
                        session.chapter ||
                        session.addonChapter ||
                        "Chapter not specified";

                    const subject =
                        normalizeSubject(
                            session.subject ||
                            session.addonSubject,
                            chapter
                        );

                    if(
                        !subject ||
                        !result[subject]
                    ){
                        return;
                    }


                    let seconds =
                        num(
                            session.seconds ||
                            session.studySeconds ||
                            session.duration
                        );


                    /*
                     * If session has exact
                     * start/end but no seconds.
                     */

                    if(
                        seconds <= 0 &&
                        num(session.startedAt) &&
                        num(session.stoppedAt)
                    ){

                        seconds =
                            Math.max(
                                0,
                                Math.floor(
                                    (
                                        num(session.stoppedAt) -
                                        num(session.startedAt)
                                    ) / 1000
                                )
                            );
                    }


                    const questions =
                        num(
                            session.questions ||
                            session.questionCount
                        );


                    result[subject].time +=
                        seconds;

                    result[subject].questions +=
                        questions;

                    result[subject].sessions++;


                    const key =
                        chapter;


                    if(
                        !result[subject]
                            .chapters
                            .has(key)
                    ){

                        result[subject]
                            .chapters
                            .set(
                                key,
                                {
                                    time:0,
                                    questions:0,
                                    sessions:0
                                }
                            );

                    }


                    const row =
                        result[subject]
                            .chapters
                            .get(key);

                    row.time += seconds;

                    row.questions +=
                        questions;

                    row.sessions++;

                }
            );


        return result;
    }


    /* =====================================================
       LIVE SESSION
    ===================================================== */

    function liveStudyData(){

        const d =
            student();

        const index =
            Number.isInteger(
                d.activeTask
            )
                ? d.activeTask
                : null;

        if(
            index === null ||
            !TASKS?.[index]
        ){
            return null;
        }

        const task =
            TASKS[index];

        const meta =
            d.taskMeta?.[index] || {};


        const activity =
            meta.addonActivity ||
            (
                task.type === "repair"
                    ? "Daily Repair"
                    : task.type === "self-study"
                        ? "Self Study"
                        : "Scheduled Study"
            );


        const subject =
            meta.addonSubject ||
            task.subject ||
            "—";


        const chapter =
            meta.addonChapter ||
            meta.chapter ||
            "Chapter not specified";


        let elapsed =
            num(
                d.studySeconds?.[index]
            );


        if(
            d.activeStartTime
        ){

            elapsed +=
                Math.max(
                    0,
                    Math.floor(
                        (
                            Date.now() -
                            num(
                                d.activeStartTime
                            )
                        ) / 1000
                    )
                );

        }


        return {
            taskName:
                task.name ||
                "Study Session",

            activity,

            subject,

            chapter,

            elapsed
        };
    }


    /* =====================================================
       LIVE CARD VISUAL
    ===================================================== */

    function liveState(){

        const activeTest =
            getActiveTest();

        const study =
            liveStudyData();


        if(activeTest){

            const remaining =
                Math.max(
                    0,
                    num(activeTest.endAt) -
                    Date.now()
                );


            return {

                type:"test",

                title:"TEST RUNNING",

                name:
                    activeTest.authority ||
                    "Self Test",

                subject:
                    activeTest.authority ||
                    "Test",

                chapter:
                    arr(activeTest.subjects)
                        .map(
                            x =>
                                `${x.subject || ""} — ${x.chapter || ""}`
                        )
                        .join(" | ") ||
                    "Test in progress",

                timer:
                    duration(
                        Math.ceil(
                            remaining / 1000
                        )
                    )

            };
        }


        if(study){

            return {

                type:"study",

                title:"STUDYING NOW",

                name:
                    study.taskName,

                activity:
                    study.activity,

                subject:
                    study.subject,

                chapter:
                    study.chapter,

                timer:
                    duration(
                        study.elapsed
                    )

            };
        }


        return null;
    }


    /* =====================================================
       LIVE HERO
    ===================================================== */

    function ensureLiveHero(){

        let box =
            $("nposFinalLiveHero");

        if(box){
            return box;
        }


        const liveCard =
            $("liveTaskName")
                ?.closest(
                    ".card"
                );


        const anchor =
            liveCard ||
            $("liveTaskName")
                ?.parentElement;


        if(!anchor){
            return null;
        }


        box =
            document.createElement(
                "section"
            );

        box.id =
            "nposFinalLiveHero";

        box.className =
            "npos-final-live-hero";


        box.innerHTML = `

            <div class="npos-live-top">

                <div>

                    <div
                        class="npos-live-kicker"
                    >
                        LIVE STUDENT ACTIVITY
                    </div>

                    <div
                        id="nposLiveHeroTitle"
                        class="npos-live-title"
                    >
                        Checking...
                    </div>

                    <div
                        id="nposLiveHeroActivity"
                        class="npos-live-activity"
                    >
                        —
                    </div>

                </div>


                <div
                    id="nposLiveHeroDot"
                    class="npos-live-dot"
                ></div>

            </div>


            <div class="npos-live-grid">

                <div class="npos-live-item">

                    <span>SUBJECT</span>

                    <strong
                        id="nposLiveHeroSubject"
                    >
                        —
                    </strong>

                </div>


                <div class="npos-live-item">

                    <span>CHAPTER</span>

                    <strong
                        id="nposLiveHeroChapter"
                    >
                        —
                    </strong>

                </div>


                <div class="npos-live-item">

                    <span>ELAPSED / TIME LEFT</span>

                    <strong
                        id="nposLiveHeroTimer"
                    >
                        00:00:00
                    </strong>

                </div>

            </div>

        `;


        anchor.parentNode?.insertBefore(
            box,
            anchor
        );


        return box;
    }


    function updateLiveHero(){

        const box =
            ensureLiveHero();

        if(!box){
            return;
        }


        const state =
            liveState();


        const title =
            $("nposLiveHeroTitle");

        const activity =
            $("nposLiveHeroActivity");

        const subject =
            $("nposLiveHeroSubject");

        const chapter =
            $("nposLiveHeroChapter");

        const timer =
            $("nposLiveHeroTimer");

        const dot =
            $("nposLiveHeroDot");


        if(!state){

            if(title)
                title.textContent =
                    "No active session";

            if(activity)
                activity.textContent =
                    "Student is currently not studying";

            if(subject)
                subject.textContent =
                    "—";

            if(chapter)
                chapter.textContent =
                    "—";

            if(timer)
                timer.textContent =
                    "00:00:00";

            dot?.classList.remove(
                "active"
            );

            return;
        }


        if(title){

            title.textContent =
                state.type === "test"
                    ? "Test Running"
                    : state.name;

        }


        if(activity){

            activity.textContent =
                state.type === "test"
                    ? "📝 " + state.name
                    : state.activity;

        }


        if(subject)
            subject.textContent =
                state.subject;


        if(chapter)
            chapter.textContent =
                state.chapter;


        if(timer)
            timer.textContent =
                state.timer;


        dot?.classList.add(
            "active"
        );
    }


    /* =====================================================
       PREMIUM ANALYTICS PANEL
    ===================================================== */

    function ensureAnalyticsPanel(){

        const statsPage =
            $("statsPage");

        if(!statsPage){
            return null;
        }


        let panel =
            $("nposFinalGuardianAnalytics");

        if(panel){
            return panel;
        }


        panel =
            document.createElement(
                "section"
            );

        panel.id =
            "nposFinalGuardianAnalytics";

        panel.className =
            "npos-final-analytics";


        /*
         * Insert near top of Stats.
         */

        statsPage.insertBefore(
            panel,
            statsPage.firstElementChild
        );


        return panel;
    }


    function renderAnalytics(){

        const panel =
            ensureAnalyticsPanel();

        if(!panel){
            return;
        }


        const data =
            buildAnalytics();


        const totalStudy =
            Object.values(data)
                .reduce(
                    (a,x) =>
                        a + x.time,
                    0
                );


        const totalQuestions =
            Object.values(data)
                .reduce(
                    (a,x) =>
                        a + x.questions,
                    0
                );


        const tests =
            getTests();


        const scored =
            tests.filter(
                isScored
            ).length;


        const testTime =
            totalTestTime();


        const activeTest =
            getActiveTest();


        const totalLearningTime =
            totalStudy +
            testTime +
            activeTestElapsed();


        panel.innerHTML = `

            <div class="npos-analytics-head">

                <div>

                    <div class="npos-analytics-kicker">
                        NEET PROGRESS OS
                    </div>

                    <h2>
                        Guardian Analytics
                    </h2>

                    <p>
                        Live study, chapter and test performance
                    </p>

                </div>


                <div class="npos-live-badge">
                    ● LIVE
                </div>

            </div>


            <div class="npos-overview-grid">

                <div class="npos-overview-card">

                    <span>
                        STUDY TIME
                    </span>

                    <strong>
                        ${shortDuration(totalStudy)}
                    </strong>

                </div>


                <div class="npos-overview-card">

                    <span>
                        TEST TIME
                    </span>

                    <strong>
                        ${shortDuration(
                            testTime +
                            activeTestElapsed()
                        )}
                    </strong>

                </div>


                <div class="npos-overview-card">

                    <span>
                        TOTAL LEARNING
                    </span>

                    <strong>
                        ${shortDuration(
                            totalLearningTime
                        )}
                    </strong>

                </div>


                <div class="npos-overview-card">

                    <span>
                        TESTS
                    </span>

                    <strong>
                        ${tests.length}
                    </strong>

                </div>


                <div class="npos-overview-card">

                    <span>
                        TESTS SCORED
                    </span>

                    <strong>
                        ${scored}
                    </strong>

                </div>


                <div class="npos-overview-card">

                    <span>
                        STUDY QUESTIONS
                    </span>

                    <strong>
                        ${totalQuestions}
                    </strong>

                </div>

            </div>


            <div class="npos-section-heading">

                <div>
                    Subject-wise Study
                </div>

                <small>
                    Today's recorded sessions
                </small>

            </div>


            <div class="npos-subject-grid">

                ${renderSubject(
                    "Physics",
                    data.Physics
                )}

                ${renderSubject(
                    "Chemistry",
                    data.Chemistry
                )}

                ${renderSubject(
                    "Botany",
                    data.Botany
                )}

                ${renderSubject(
                    "Zoology",
                    data.Zoology
                )}

            </div>


            <div class="npos-section-heading">

                <div>
                    Test Performance
                </div>

                <small>
                    Actual test duration + score
                </small>

            </div>


            ${renderTestSummary(
                tests
            )}


            <div class="npos-section-heading">

                <div>
                    Recent Study Sessions
                </div>

                <small>
                    Activity • Subject • Chapter • Time
                </small>

            </div>


            ${renderRecentSessions()}

        `;

    }


    /* =====================================================
       SUBJECT CARD
    ===================================================== */

    function renderSubject(
        name,
        item
    ){

        const chapters =
            Array.from(
                item.chapters.entries()
            )
            .sort(
                (a,b) =>
                    b[1].time -
                    a[1].time
            )
            .slice(
                0,
                5
            );


        const percent =
            totalSubjectPercent(
                item.time,
                buildAnalytics()
            );


        return `

            <article
                class="npos-subject-card"
            >

                <div class="npos-subject-top">

                    <div>

                        <div class="npos-subject-name">
                            ${esc(name)}
                        </div>

                        <div class="npos-subject-meta">
                            ${item.sessions} sessions
                        </div>

                    </div>

                    <div class="npos-subject-time">
                        ${shortDuration(item.time)}
                    </div>

                </div>


                <div class="npos-progress-track">

                    <div
                        class="npos-progress-fill"
                        style="width:${percent}%"
                    ></div>

                </div>


                <div class="npos-subject-stats">

                    <span>
                        ⏱ ${shortDuration(item.time)}
                    </span>

                    <span>
                        ❓ ${item.questions} Q
                    </span>

                </div>


                <div class="npos-chapter-list">

                    ${
                        chapters.length
                            ? chapters
                                .map(
                                    ([chapter,row]) => `

                                        <div
                                            class="npos-chapter-row"
                                        >

                                            <div>

                                                <strong>
                                                    ${esc(chapter)}
                                                </strong>

                                                <small>
                                                    ${row.questions} questions
                                                </small>

                                            </div>

                                            <b>
                                                ${shortDuration(row.time)}
                                            </b>

                                        </div>

                                    `
                                )
                                .join("")
                            :
                            `
                                <div class="npos-empty">
                                    No recorded session yet
                                </div>
                            `
                    }

                </div>

            </article>

        `;
    }


    function totalSubjectPercent(
        value,
        data
    ){

        const total =
            Object.values(data)
                .reduce(
                    (a,x) =>
                        a + x.time,
                    0
                );

        if(!total){
            return 0;
        }

        return Math.min(
            100,
            Math.round(
                value /
                total *
                100
            )
        );
    }


    /* =====================================================
       TEST SUMMARY
    ===================================================== */

    function renderTestSummary(
        tests
    ){

        const active =
            getActiveTest();


        const sorted =
            tests
                .slice()
                .sort(
                    (a,b) =>
                        num(
                            b.completedAt ||
                            b.startedAt
                        ) -
                        num(
                            a.completedAt ||
                            a.startedAt
                        )
                )
                .slice(
                    0,
                    5
                );


        let html = "";


        if(active){

            const remaining =
                Math.max(
                    0,
                    num(active.endAt) -
                    Date.now()
                );


            html += `

                <div class="npos-active-test">

                    <div>

                        <strong>
                            🔴 TEST RUNNING
                        </strong>

                        <span>
                            ${esc(
                                active.authority ||
                                "Self Test"
                            )}
                        </span>

                    </div>


                    <div>

                        <b>
                            ${duration(
                                Math.ceil(
                                    remaining /
                                    1000
                                )
                            )}
                        </b>

                        <small>
                            time left
                        </small>

                    </div>

                </div>

            `;
        }


        if(!sorted.length){

            html += `

                <div class="npos-empty-box">
                    No test records yet.
                </div>

            `;

            return html;
        }


        html += `

            <div class="npos-test-list">

                ${sorted
                    .map(
                        test => {

                            const p =
                                testPercentage(
                                    test
                                );


                            const topics =
                                arr(
                                    test.subjects
                                )
                                .map(
                                    x =>
                                        `${x.subject || ""} — ${x.chapter || ""}`
                                )
                                .join(
                                    " • "
                                );


                            return `

                                <div
                                    class="npos-test-row"
                                >

                                    <div
                                        class="npos-test-main"
                                    >

                                        <strong>
                                            ${esc(
                                                test.authority ||
                                                "Test"
                                            )}
                                        </strong>

                                        <span>
                                            ${esc(
                                                topics ||
                                                "No topic data"
                                            )}
                                        </span>

                                    </div>


                                    <div
                                        class="npos-test-middle"
                                    >

                                        <b>
                                            ${num(
                                                test.totalQuestions
                                            )} Q
                                        </b>

                                        <span>
                                            ${num(
                                                test.fullMarks
                                            )} Marks
                                        </span>

                                    </div>


                                    <div
                                        class="npos-test-time"
                                    >

                                        <b>
                                            ${duration(
                                                testElapsed(
                                                    test
                                                )
                                            )}
                                        </b>

                                        <span>
                                            actual time
                                        </span>

                                    </div>


                                    <div
                                        class="npos-test-score"
                                    >

                                        ${
                                            isScored(test)
                                                ?
                                                `
                                                    <b>
                                                        ${num(test.score)}
                                                        /
                                                        ${num(test.fullMarks)}
                                                    </b>

                                                    <span>
                                                        ${
                                                            p !== null
                                                                ? Math.round(p) + "%"
                                                                : "—"
                                                        }
                                                    </span>
                                                `
                                                :
                                                `
                                                    <b>
                                                        —
                                                    </b>

                                                    <span>
                                                        Pending
                                                    </span>
                                                `
                                        }

                                    </div>

                                </div>

                            `;

                        }
                    )
                    .join("")
                }

            </div>

        `;


        return html;
    }


    /* =====================================================
       RECENT SESSIONS
    ===================================================== */

    function renderRecentSessions(){

        const sessions =
            todaySessions()
                .slice()
                .sort(
                    (a,b) =>
                        num(
                            b.stoppedAt ||
                            b.startedAt
                        ) -
                        num(
                            a.stoppedAt ||
                            a.startedAt
                        )
                )
                .slice(
                    0,
                    10
                );


        if(!sessions.length){

            return `
                <div class="npos-empty-box">
                    No study session recorded yet.
                </div>
            `;
        }


        return `

            <div class="npos-session-list">

                ${sessions
                    .map(
                        session => {

                            const chapter =
                                session.chapter ||
                                session.addonChapter ||
                                "Chapter not specified";


                            const subject =
                                normalizeSubject(
                                    session.subject ||
                                    session.addonSubject,
                                    chapter
                                ) ||
                                session.subject ||
                                "—";


                            let seconds =
                                num(
                                    session.seconds ||
                                    session.studySeconds ||
                                    session.duration
                                );


                            if(
                                !seconds &&
                                num(session.startedAt) &&
                                num(session.stoppedAt)
                            ){

                                seconds =
                                    Math.floor(
                                        (
                                            num(session.stoppedAt) -
                                            num(session.startedAt)
                                        ) / 1000
                                    );

                            }


                            return `

                                <div
                                    class="npos-session-row"
                                >

                                    <div
                                        class="npos-session-icon"
                                    >
                                        ●
                                    </div>


                                    <div
                                        class="npos-session-content"
                                    >

                                        <strong>
                                            ${esc(
                                                session.activity ||
                                                session.taskName ||
                                                "Study Session"
                                            )}
                                        </strong>

                                        <span>
                                            ${esc(subject)}
                                            •
                                            ${esc(chapter)}
                                        </span>

                                    </div>


                                    <div
                                        class="npos-session-right"
                                    >

                                        <b>
                                            ${shortDuration(
                                                seconds
                                            )}
                                        </b>

                                        <span>
                                            ${num(
                                                session.questions ||
                                                session.questionCount
                                            )} Q
                                        </span>

                                    </div>

                                </div>

                            `;

                        }
                    )
                    .join("")
                }

            </div>

        `;
    }


    /* =====================================================
       UI CSS
    ===================================================== */

    function installCSS(){

        if(
            $("nposFinalGuardianCSS")
        ){
            return;
        }


        const style =
            document.createElement(
                "style"
            );

        style.id =
            "nposFinalGuardianCSS";


        style.textContent = `

            :root{

                --npos-red:#ef233c;
                --npos-red-dark:#b7091f;
                --npos-red-soft:#ff4d5f;

                --npos-bg:
                    rgba(255,255,255,.035);

                --npos-border:
                    rgba(255,255,255,.09);

                --npos-text:
                    rgba(255,255,255,.94);

                --npos-muted:
                    rgba(255,255,255,.58);

            }


            /* =============================================
               GLOBAL SMOOTHNESS
            ============================================= */

            html{
                scroll-behavior:smooth;
            }


            body{
                overflow-x:hidden !important;
            }


            button,
            .primary-btn,
            .secondary-btn,
            [data-page],
            .chapter-filter{

                -webkit-tap-highlight-color:
                    transparent;

                transition:
                    transform .18s ease,
                    background .18s ease,
                    border-color .18s ease,
                    box-shadow .18s ease,
                    color .18s ease;

            }


            button:active,
            .primary-btn:active,
            .secondary-btn:active{

                transform:
                    translateY(1px)
                    scale(.985);

            }


            /* =============================================
               BUTTON SYSTEM
            ============================================= */

            .primary-btn{

                background:
                    linear-gradient(
                        135deg,
                        var(--npos-red),
                        var(--npos-red-dark)
                    ) !important;

                border:
                    1px solid
                    rgba(255,255,255,.12)
                    !important;

                color:#fff !important;

                border-radius:
                    11px !important;

                min-height:
                    42px !important;

                padding:
                    9px 16px !important;

                font-weight:
                    800 !important;

                box-shadow:
                    0 7px 20px
                    rgba(239,35,60,.18);

            }


            .primary-btn:hover{

                box-shadow:
                    0 10px 28px
                    rgba(239,35,60,.30);

                transform:
                    translateY(-1px);

            }


            .secondary-btn{

                background:
                    rgba(255,255,255,.055)
                    !important;

                border:
                    1px solid
                    rgba(255,255,255,.11)
                    !important;

                color:
                    rgba(255,255,255,.9)
                    !important;

                border-radius:
                    11px !important;

                min-height:
                    42px !important;

                padding:
                    9px 16px !important;

                font-weight:
                    750 !important;

            }


            .secondary-btn:hover{

                border-color:
                    rgba(239,35,60,.55)
                    !important;

                background:
                    rgba(239,35,60,.10)
                    !important;

            }


            /* =============================================
               NAVIGATION
            ============================================= */

            [data-page]{

                border-radius:
                    11px;

            }


            [data-page].active{

                background:
                    linear-gradient(
                        135deg,
                        rgba(239,35,60,.22),
                        rgba(183,9,31,.12)
                    ) !important;

                color:
                    #fff !important;

                box-shadow:
                    inset 3px 0 0
                    var(--npos-red);

            }


            .chapter-filter{

                border-radius:
                    10px !important;

                cursor:pointer;

            }


            .chapter-filter.active{

                background:
                    var(--npos-red)
                    !important;

                color:#fff !important;

                border-color:
                    var(--npos-red)
                    !important;

            }


            /* =============================================
               LIVE HERO
            ============================================= */

            .npos-final-live-hero{

                margin:
                    0 0 20px;

                padding:
                    20px;

                border-radius:
                    20px;

                border:
                    1px solid
                    rgba(239,35,60,.28);

                background:
                    linear-gradient(
                        135deg,
                        rgba(239,35,60,.14),
                        rgba(255,255,255,.035)
                    );

                box-shadow:
                    0 18px 50px
                    rgba(0,0,0,.18);

                position:relative;

                overflow:hidden;

            }


            .npos-final-live-hero::before{

                content:"";

                position:absolute;

                width:180px;
                height:180px;

                right:-70px;
                top:-90px;

                border-radius:50%;

                background:
                    rgba(239,35,60,.12);

                filter:
                    blur(5px);

            }


            .npos-live-top{

                display:flex;

                align-items:flex-start;

                justify-content:space-between;

                gap:15px;

            }


            .npos-live-kicker{

                font-size:10px;

                letter-spacing:
                    .14em;

                font-weight:900;

                color:
                    var(--npos-red-soft);

                margin-bottom:5px;

            }


            .npos-live-title{

                font-size:
                    clamp(19px,2.3vw,28px);

                font-weight:950;

                line-height:1.15;

            }


            .npos-live-activity{

                margin-top:5px;

                color:
                    var(--npos-muted);

                font-size:13px;

            }


            .npos-live-dot{

                width:12px;
                height:12px;

                border-radius:50%;

                background:
                    rgba(255,255,255,.18);

                flex:0 0 auto;

                margin-top:5px;

            }


            .npos-live-dot.active{

                background:
                    var(--npos-red);

                box-shadow:
                    0 0 0 5px
                    rgba(239,35,60,.12),
                    0 0 24px
                    rgba(239,35,60,.55);

                animation:
                    nposPulse 1.8s
                    infinite;

            }


            @keyframes nposPulse{

                0%,100%{
                    opacity:1;
                }

                50%{
                    opacity:.55;
                }

            }


            .npos-live-grid{

                display:grid;

                grid-template-columns:
                    repeat(3,1fr);

                gap:10px;

                margin-top:18px;

            }


            .npos-live-item{

                min-width:0;

                padding:
                    12px;

                border-radius:
                    13px;

                background:
                    rgba(0,0,0,.12);

                border:
                    1px solid
                    rgba(255,255,255,.07);

            }


            .npos-live-item span{

                display:block;

                font-size:9px;

                font-weight:900;

                letter-spacing:.08em;

                color:
                    var(--npos-muted);

                margin-bottom:5px;

            }


            .npos-live-item strong{

                display:block;

                font-size:13px;

                overflow:hidden;

                text-overflow:ellipsis;

                white-space:nowrap;

            }


            /* =============================================
               ANALYTICS
            ============================================= */

            .npos-final-analytics{

                margin:
                    0 0 22px;

                padding:
                    20px;

                border-radius:
                    21px;

                border:
                    1px solid
                    rgba(239,35,60,.20);

                background:
                    linear-gradient(
                        145deg,
                        rgba(239,35,60,.07),
                        rgba(255,255,255,.025)
                    );

                box-shadow:
                    0 16px 45px
                    rgba(0,0,0,.14);

                box-sizing:border-box;

            }


            .npos-analytics-head{

                display:flex;

                align-items:flex-start;

                justify-content:space-between;

                gap:15px;

                margin-bottom:18px;

            }


            .npos-analytics-kicker{

                color:
                    var(--npos-red-soft);

                font-size:9px;

                font-weight:950;

                letter-spacing:
                    .16em;

                margin-bottom:5px;

            }


            .npos-analytics-head h2{

                margin:0;

                font-size:
                    clamp(21px,2.4vw,29px);

                font-weight:950;

            }


            .npos-analytics-head p{

                margin:
                    5px 0 0;

                color:
                    var(--npos-muted);

                font-size:12px;

            }


            .npos-live-badge{

                white-space:nowrap;

                color:
                    #fff;

                background:
                    rgba(239,35,60,.15);

                border:
                    1px solid
                    rgba(239,35,60,.35);

                padding:
                    7px 10px;

                border-radius:
                    999px;

                font-size:9px;

                font-weight:950;

            }


            .npos-overview-grid{

                display:grid;

                grid-template-columns:
                    repeat(6,1fr);

                gap:9px;

            }


            .npos-overview-card{

                min-width:0;

                padding:
                    12px;

                border-radius:
                    13px;

                background:
                    rgba(255,255,255,.035);

                border:
                    1px solid
                    rgba(255,255,255,.07);

            }


            .npos-overview-card span{

                display:block;

                font-size:8px;

                font-weight:900;

                color:
                    var(--npos-muted);

                letter-spacing:.05em;

                margin-bottom:5px;

            }


            .npos-overview-card strong{

                display:block;

                font-size:
                    clamp(15px,1.5vw,19px);

                font-weight:950;

                color:#fff;

                white-space:nowrap;

                overflow:hidden;

                text-overflow:ellipsis;

            }


            .npos-section-heading{

                margin:
                    24px 0 11px;

                display:flex;

                align-items:flex-end;

                justify-content:space-between;

                gap:10px;

            }


            .npos-section-heading div{

                font-size:14px;

                font-weight:950;

            }


            .npos-section-heading small{

                font-size:10px;

                color:
                    var(--npos-muted);

            }


            /* =============================================
               SUBJECT CARDS
            ============================================= */

            .npos-subject-grid{

                display:grid;

                grid-template-columns:
                    repeat(4,1fr);

                gap:10px;

            }


            .npos-subject-card{

                min-width:0;

                padding:
                    14px;

                border-radius:
                    16px;

                background:
                    rgba(255,255,255,.035);

                border:
                    1px solid
                    rgba(255,255,255,.075);

                transition:
                    transform .2s ease,
                    border-color .2s ease,
                    background .2s ease;

            }


            .npos-subject-card:hover{

                transform:
                    translateY(-2px);

                border-color:
                    rgba(239,35,60,.30);

                background:
                    rgba(239,35,60,.045);

            }


            .npos-subject-top{

                display:flex;

                justify-content:space-between;

                gap:10px;

                align-items:flex-start;

            }


            .npos-subject-name{

                font-size:14px;

                font-weight:950;

            }


            .npos-subject-meta{

                margin-top:3px;

                color:
                    var(--npos-muted);

                font-size:10px;

            }


            .npos-subject-time{

                color:
                    var(--npos-red-soft);

                font-size:13px;

                font-weight:950;

                white-space:nowrap;

            }


            .npos-progress-track{

                height:5px;

                border-radius:
                    99px;

                background:
                    rgba(255,255,255,.07);

                overflow:hidden;

                margin:
                    12px 0 9px;

            }


            .npos-progress-fill{

                height:100%;

                border-radius:
                    inherit;

                background:
                    linear-gradient(
                        90deg,
                        var(--npos-red-dark),
                        var(--npos-red-soft)
                    );

                box-shadow:
                    0 0 12px
                    rgba(239,35,60,.30);

            }


            .npos-subject-stats{

                display:flex;

                justify-content:space-between;

                gap:5px;

                color:
                    var(--npos-muted);

                font-size:9px;

                margin-bottom:9px;

            }


            .npos-chapter-list{

                border-top:
                    1px solid
                    rgba(255,255,255,.055);

            }


            .npos-chapter-row{

                display:flex;

                justify-content:space-between;

                gap:8px;

                padding:
                    8px 0;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.045);

            }


            .npos-chapter-row:last-child{

                border-bottom:0;

            }


            .npos-chapter-row strong{

                display:block;

                font-size:10px;

                line-height:1.35;

            }


            .npos-chapter-row small{

                display:block;

                margin-top:2px;

                font-size:8px;

                color:
                    var(--npos-muted);

            }


            .npos-chapter-row b{

                color:
                    rgba(255,255,255,.72);

                font-size:9px;

                white-space:nowrap;

            }


            /* =============================================
               TEST
            ============================================= */

            .npos-active-test{

                display:flex;

                justify-content:space-between;

                align-items:center;

                gap:15px;

                padding:
                    13px 15px;

                margin-bottom:10px;

                border-radius:
                    14px;

                background:
                    rgba(239,35,60,.10);

                border:
                    1px solid
                    rgba(239,35,60,.28);

            }


            .npos-active-test strong{

                display:block;

                color:
                    var(--npos-red-soft);

                font-size:12px;

            }


            .npos-active-test span{

                display:block;

                margin-top:3px;

                font-size:10px;

                color:
                    var(--npos-muted);

            }


            .npos-active-test b{

                display:block;

                text-align:right;

                font-size:18px;

            }


            .npos-active-test small{

                display:block;

                color:
                    var(--npos-muted);

                font-size:8px;

                text-align:right;

            }


            .npos-test-list{

                border:
                    1px solid
                    rgba(255,255,255,.06);

                border-radius:
                    14px;

                overflow:hidden;

            }


            .npos-test-row{

                display:grid;

                grid-template-columns:
                    minmax(0,2.5fr)
                    90px
                    105px
                    90px;

                gap:12px;

                align-items:center;

                padding:
                    12px 14px;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.055);

            }


            .npos-test-row:last-child{

                border-bottom:0;

            }


            .npos-test-main{

                min-width:0;

            }


            .npos-test-main strong{

                display:block;

                font-size:11px;

            }


            .npos-test-main span{

                display:block;

                margin-top:3px;

                color:
                    var(--npos-muted);

                font-size:9px;

                white-space:nowrap;

                overflow:hidden;

                text-overflow:ellipsis;

            }


            .npos-test-middle b,
            .npos-test-time b,
            .npos-test-score b{

                display:block;

                font-size:11px;

            }


            .npos-test-middle span,
            .npos-test-time span,
            .npos-test-score span{

                display:block;

                margin-top:2px;

                color:
                    var(--npos-muted);

                font-size:8px;

            }


            .npos-test-score b{

                color:
                    var(--npos-red-soft);

            }


            /* =============================================
               SESSION LIST
            ============================================= */

            .npos-session-list{

                border:
                    1px solid
                    rgba(255,255,255,.06);

                border-radius:
                    14px;

                overflow:hidden;

            }


            .npos-session-row{

                display:flex;

                align-items:center;

                gap:10px;

                padding:
                    11px 13px;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.05);

            }


            .npos-session-row:last-child{

                border-bottom:0;

            }


            .npos-session-icon{

                width:8px;
                height:8px;

                border-radius:50%;

                background:
                    var(--npos-red);

                box-shadow:
                    0 0 10px
                    rgba(239,35,60,.40);

                flex:0 0 auto;

            }


            .npos-session-content{

                min-width:0;

                flex:1;

            }


            .npos-session-content strong{

                display:block;

                font-size:11px;

            }


            .npos-session-content span{

                display:block;

                margin-top:2px;

                color:
                    var(--npos-muted);

                font-size:9px;

                white-space:nowrap;

                overflow:hidden;

                text-overflow:ellipsis;

            }


            .npos-session-right{

                text-align:right;

                flex:0 0 auto;

            }


            .npos-session-right b{

                display:block;

                font-size:10px;

            }


            .npos-session-right span{

                display:block;

                color:
                    var(--npos-muted);

                font-size:8px;

                margin-top:2px;

            }


            .npos-empty,
            .npos-empty-box{

                color:
                    var(--npos-muted);

                font-size:10px;

                padding:
                    12px 0;

            }


            .npos-empty-box{

                padding:
                    15px;

                border:
                    1px solid
                    rgba(255,255,255,.06);

                border-radius:
                    14px;

            }


            /* =============================================
               EXISTING CARDS
            ============================================= */

            .card{

                border-radius:
                    16px;

            }


            .section-title{

                gap:12px;

            }


            /* =============================================
               RESPONSIVE
            ============================================= */

            @media(max-width:1200px){

                .npos-overview-grid{

                    grid-template-columns:
                        repeat(3,1fr);

                }

                .npos-subject-grid{

                    grid-template-columns:
                        repeat(2,1fr);

                }

            }


            @media(max-width:760px){

                .npos-live-grid{

                    grid-template-columns:
                        1fr;

                }


                .npos-overview-grid{

                    grid-template-columns:
                        repeat(2,1fr);

                }


                .npos-subject-grid{

                    grid-template-columns:
                        1fr;

                }


                .npos-test-row{

                    grid-template-columns:
                        1fr 1fr;

                }


                .npos-test-main{

                    grid-column:
                        1 / -1;

                }


                .npos-analytics-head{

                    align-items:
                        flex-start;

                }

            }


            @media(max-width:480px){

                .npos-final-analytics,
                .npos-final-live-hero{

                    padding:
                        15px;

                    border-radius:
                        16px;

                }


                .npos-overview-grid{

                    grid-template-columns:
                        1fr 1fr;

                }


                .npos-overview-card{

                    padding:
                        10px;

                }


                .npos-section-heading{

                    align-items:
                        flex-start;

                    flex-direction:
                        column;

                    gap:3px;

                }


                .npos-test-row{

                    grid-template-columns:
                        1fr;

                }


                .npos-test-middle,
                .npos-test-time,
                .npos-test-score{

                    display:flex;

                    justify-content:
                        space-between;

                    align-items:center;

                    gap:10px;

                }


                .npos-test-middle span,
                .npos-test-time span,
                .npos-test-score span{

                    margin-top:0;

                }

            }

        `;


        document.head.appendChild(
            style
        );
    }


    /* =====================================================
       EXISTING UI POLISH
    ===================================================== */

    function polishExistingUI(){

        const ids = [

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


        ids.forEach(
            id => {

                const page =
                    $(id);

                if(!page){
                    return;
                }

                page.style.boxSizing =
                    "border-box";

            }
        );


        /*
         * Make menu close automatically
         * after navigation without touching
         * original navigation function.
         */

        document
            .querySelectorAll(
                "[data-page]"
            )
            .forEach(
                button => {

                    if(
                        button.dataset
                            .nposFinalBound
                    ){
                        return;
                    }

                    button.dataset
                        .nposFinalBound =
                        "1";


                    button.addEventListener(
                        "click",
                        () => {

                            setTimeout(
                                () => {

                                    const menu =
                                        $("sideMenu");

                                    if(
                                        menu
                                    ){
                                        menu.classList
                                            .remove(
                                                "open"
                                            );
                                    }

                                },
                                80
                            );

                        },
                        {
                            passive:true
                        }
                    );

                }
            );

    }


    /* =====================================================
       REFRESH
    ===================================================== */

    function refresh(){

        try{

            installCSS();

            polishExistingUI();

            updateLiveHero();

            renderAnalytics();

        }catch(error){

            console.warn(
                "NP-OS Final Guardian UI refresh error:",
                error
            );

        }

    }


    /* =====================================================
       START
    ===================================================== */

    let timer = null;


    function start(){

        clearInterval(
            timer
        );


        refresh();


        /*
         * 2 sec is enough.
         * Existing NP-OS already runs
         * its own 1 sec update loop.
         */

        timer =
            setInterval(
                refresh,
                2000
            );


        console.log(
            "✅ NP-OS Final Guardian UI v" +
            VERSION +
            " loaded."
        );

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.NPOSFinalGuardianUI = {

        version:
            VERSION,

        refresh,

        getTests,

        getActiveTest,

        totalTestTime,

        activeTestElapsed,

        buildAnalytics,

        liveState

    };


    if(
        document.readyState ===
        "loading"
    ){

        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once:true
            }
        );

    }else{

        setTimeout(
            start,
            250
        );

    }


})();
/* NEET OS — Scroll Stabilizer Safe Patch */
(function(){
    "use strict";

    const oldScrollTo = window.scrollTo;

    window.scrollTo = function(x, y){
        // User নিজে scroll করলে stabilizer-এর forced jump আটকাবে
        if (
            window.NEETOSScrollStabilizer &&
            !window.__NEETOS_ALLOW_FORCED_SCROLL
        ) {
            return;
        }

        return oldScrollTo.apply(window, arguments);
    };

    // Normal browser/user scrolling completely allowed
    window.addEventListener("wheel", function(){
        window.__NEETOS_ALLOW_FORCED_SCROLL = false;
    }, {passive:true});

    window.addEventListener("touchmove", function(){
        window.__NEETOS_ALLOW_FORCED_SCROLL = false;
    }, {passive:true});

    window.addEventListener("keydown", function(e){
        if (
            ["ArrowUp","ArrowDown","PageUp","PageDown",
             "Home","End"," ","Spacebar"].includes(e.key)
        ){
            window.__NEETOS_ALLOW_FORCED_SCROLL = false;
        }
    });

    console.log("✅ NEET OS — Scroll Safe Patch active.");
})();
/* =========================================================
   NP-OS — FINAL MOBILE PREMIUM UI
   Version: 6.0.0
   UI ONLY / SAFE / APPEND ONLY
========================================================= */

(function NPOS_FINAL_MOBILE_PREMIUM_UI(){

    "use strict";

    if (window.__NPOS_FINAL_MOBILE_PREMIUM_UI_V6) return;

    window.__NPOS_FINAL_MOBILE_PREMIUM_UI_V6 = true;

    const VERSION = "6.0.0";

    /* ---------------------------------------------------------
       1. PREMIUM RED THEME
    --------------------------------------------------------- */

    function injectCSS(){

        if(document.getElementById("nposFinalPremiumUIStyle")) return;

        const style = document.createElement("style");
        style.id = "nposFinalPremiumUIStyle";

        style.textContent = `

        /* ================================
           ROOT THEME
        ================================= */

        :root{
            --np-red:#e5092f;
            --np-red2:#ff3152;
            --np-red3:#b80024;
            --np-red-soft:rgba(229,9,47,.12);
            --np-red-border:rgba(229,9,47,.28);

            --np-bg:#06080d;
            --np-bg2:#0a0d14;

            --np-card:#10131b;
            --np-card2:#151923;

            --np-text:#f7f8fb;
            --np-muted:#9ca5b5;
            --np-muted2:#697386;

            --np-border:rgba(255,255,255,.075);

            --np-shadow:
                0 12px 35px rgba(0,0,0,.30);

            --np-radius:18px;
        }


        /* ================================
           GLOBAL
        ================================= */

        html{
            scroll-behavior:smooth;
        }

        body{
            background:
                radial-gradient(
                    circle at 50% -10%,
                    rgba(229,9,47,.13),
                    transparent 35%
                ),
                linear-gradient(
                    180deg,
                    var(--np-bg),
                    var(--np-bg2)
                ) !important;

            color:var(--np-text) !important;
        }

        #app{
            background:transparent !important;
        }

        #mainApp{
            max-width:100%;
            padding-bottom:70px !important;
        }

        #pageContainer{
            width:100%;
            max-width:720px;
            margin:0 auto;
            padding:16px 14px 80px;
        }


        /* ================================
           HEADER
        ================================= */

        .top-header{
            position:sticky !important;
            top:0;
            z-index:200;

            height:62px;

            padding:
                10px 14px !important;

            background:
                rgba(6,8,13,.88) !important;

            border-bottom:
                1px solid rgba(229,9,47,.14) !important;

            backdrop-filter:blur(20px);
            -webkit-backdrop-filter:blur(20px);

            box-shadow:
                0 5px 25px rgba(0,0,0,.22);
        }

        .header-left{
            gap:11px !important;
        }

        .menu-button{
            width:42px;
            height:42px;

            display:flex !important;
            align-items:center;
            justify-content:center;

            border-radius:13px;

            background:
                rgba(229,9,47,.10) !important;

            border:
                1px solid rgba(229,9,47,.22);

            color:#fff;

            font-size:21px;

            transition:
                transform .18s ease,
                background .18s ease;
        }

        .menu-button:active{
            transform:scale(.94);
        }

        .app-title{
            font-size:19px !important;
            font-weight:900 !important;
            letter-spacing:-.5px;
        }

        .app-subtitle{
            color:#7f899b !important;
            font-size:10px !important;
        }

        .connection-indicator{
            color:var(--np-red2) !important;
        }

        .guardian-avatar{
            width:38px !important;
            height:38px !important;

            display:flex;
            align-items:center;
            justify-content:center;

            border-radius:50%;

            background:
                linear-gradient(
                    145deg,
                    var(--np-red),
                    var(--np-red3)
                ) !important;

            color:#fff !important;

            font-weight:900;

            box-shadow:
                0 0 0 4px rgba(229,9,47,.08);
        }


        /* ================================
           PAGE
        ================================= */

        .page{
            width:100%;
        }

        .page-heading{
            display:flex;
            align-items:flex-start;
            justify-content:space-between;

            gap:12px;

            margin-bottom:15px !important;
        }

        .page-heading h1{
            font-size:28px !important;
            line-height:1.1;
            letter-spacing:-.9px;
        }

        .eyebrow{
            color:var(--np-red2) !important;
            font-size:10px !important;
            font-weight:850;
            letter-spacing:1px;
            text-transform:uppercase;
        }


        /* ================================
           CARDS
        ================================= */

        .card,
        .summary-card,
        .subject-card,
        .subject-detail-card,
        .sync-card,
        .report-summary-card,
        .chart-card,
        .settings-card,
        .creator-card,
        .repair-card{

            background:
                linear-gradient(
                    145deg,
                    rgba(20,23,32,.97),
                    rgba(11,13,19,.98)
                ) !important;

            border:
                1px solid var(--np-border) !important;

            border-radius:
                var(--np-radius) !important;

            box-shadow:
                var(--np-shadow) !important;

            position:relative;
        }

        .card::after,
        .summary-card::after,
        .subject-card::after{

            content:"";

            position:absolute;

            left:0;
            top:0;

            width:100%;
            height:1px;

            background:
                linear-gradient(
                    90deg,
                    transparent,
                    rgba(229,9,47,.35),
                    transparent
                );

            pointer-events:none;
        }


        /* ================================
           LIVE STATUS
        ================================= */

        #liveStatusCard{

            border:
                1px solid rgba(229,9,47,.24) !important;

            background:
                radial-gradient(
                    circle at 100% 0%,
                    rgba(229,9,47,.13),
                    transparent 38%
                ),
                linear-gradient(
                    145deg,
                    #17151b,
                    #0d1016
                ) !important;

            overflow:hidden;
        }

        #liveStatusCard::before{

            content:"";

            position:absolute;

            left:0;
            top:0;
            bottom:0;

            width:4px;

            background:
                linear-gradient(
                    180deg,
                    var(--np-red2),
                    var(--np-red3)
                );

            border-radius:10px;
        }

        #liveStatusTitle{
            font-size:18px !important;
            font-weight:850 !important;
        }

        #liveTaskName{
            font-size:21px !important;
            font-weight:900 !important;
            letter-spacing:-.4px;
        }

        #liveSubject{
            color:#d0d5df !important;
            margin-top:4px;
        }

        #liveChapter{
            color:var(--np-muted) !important;
            margin-top:3px;
        }

        #liveTimer{
            color:#fff !important;

            font-size:
                clamp(28px,8vw,38px) !important;

            font-weight:900 !important;

            letter-spacing:
                1px;
        }

        #liveStatusDot.active{
            background:var(--np-red2) !important;

            box-shadow:
                0 0 0 5px rgba(229,9,47,.12),
                0 0 18px rgba(229,9,47,.35) !important;
        }


        /* ================================
           PROGRESS
        ================================= */

        .progress-card{
            padding:18px !important;
        }

        .progress-ring{

            background:
                conic-gradient(
                    var(--np-red) 0deg,
                    var(--np-red2) 45%,
                    rgba(255,255,255,.07) 45%,
                    rgba(255,255,255,.07) 360deg
                ) !important;

            box-shadow:
                0 0 35px rgba(229,9,47,.08);
        }

        .progress-line-fill,
        .large-progress-fill,
        .mini-progress-fill,
        .subject-progress-fill{

            background:
                linear-gradient(
                    90deg,
                    var(--np-red3),
                    var(--np-red2)
                ) !important;
        }


        /* ================================
           SUMMARY
        ================================= */

        .summary-grid{

            display:grid !important;

            grid-template-columns:
                repeat(2,minmax(0,1fr)) !important;

            gap:10px !important;
        }

        .summary-card{

            min-width:0;

            padding:
                15px !important;

            margin:0 !important;

            transition:
                transform .18s ease,
                border-color .18s ease;
        }

        .summary-card:active{
            transform:scale(.985);
        }

        .summary-icon{
            font-size:19px !important;
        }

        .summary-label{
            color:var(--np-muted) !important;
            font-size:10px !important;
        }

        .summary-card strong{
            font-size:20px !important;
            font-weight:900 !important;
        }


        /* ================================
           SUBJECT CARDS
        ================================= */

        .subject-grid{

            display:grid !important;

            grid-template-columns:
                repeat(2,minmax(0,1fr)) !important;

            gap:10px !important;
        }

        .subject-card{

            padding:15px !important;

            margin:0 !important;

            min-width:0;

            transition:
                transform .18s ease,
                border-color .18s ease;
        }

        .subject-card:active{
            transform:scale(.985);
        }

        .subject-top{
            display:flex;
            align-items:center;
            gap:8px;
        }

        .subject-icon{
            width:31px;
            height:31px;

            display:flex;
            align-items:center;
            justify-content:center;

            border-radius:10px;

            background:
                rgba(229,9,47,.10);

            border:
                1px solid rgba(229,9,47,.16);
        }

        .subject-stat strong{
            font-size:19px !important;
        }

        .subject-stat span,
        .subject-footer span{
            color:var(--np-muted) !important;
            font-size:10px !important;
        }

        .subject-footer strong{
            font-size:14px !important;
        }


        /* ================================
           SECTION HEADINGS
        ================================= */

        .section-heading{

            display:flex;

            align-items:center;

            justify-content:space-between;

            gap:10px;

            margin:
                20px 2px 10px !important;
        }

        .section-heading h2{
            font-size:17px !important;
            font-weight:850 !important;
            letter-spacing:-.3px;
        }

        .text-button{

            border:0 !important;

            background:
                rgba(229,9,47,.09) !important;

            color:
                var(--np-red2) !important;

            border-radius:
                999px !important;

            padding:
                7px 11px !important;

            font-size:11px !important;

            font-weight:800 !important;
        }


        /* ================================
           ALL BUTTONS
        ================================= */

        button{

            -webkit-tap-highlight-color:
                transparent;

            touch-action:
                manipulation;
        }

        .primary-button,
        button.primary,
        #refreshSyncButton{

            min-height:44px !important;

            border:0 !important;

            border-radius:13px !important;

            background:
                linear-gradient(
                    135deg,
                    var(--np-red),
                    var(--np-red2)
                ) !important;

            color:#fff !important;

            font-weight:850 !important;

            box-shadow:
                0 7px 20px rgba(229,9,47,.20);

            transition:
                transform .16s ease,
                filter .16s ease,
                box-shadow .16s ease;
        }

        .primary-button:active,
        button.primary:active,
        #refreshSyncButton:active{
            transform:scale(.97);
            box-shadow:
                0 4px 12px rgba(229,9,47,.16);
        }

        .secondary-button,
        button.secondary{

            min-height:42px !important;

            border:
                1px solid rgba(255,255,255,.10) !important;

            background:
                rgba(255,255,255,.045) !important;

            color:#fff !important;

            border-radius:12px !important;
        }


        /* ================================
           SIDEBAR
        ================================= */

        #sideMenu{

            width:
                min(310px,86vw) !important;

            background:
                linear-gradient(
                    180deg,
                    #151017,
                    #080a0f
                ) !important;

            border-right:
                1px solid rgba(229,9,47,.18) !important;

            box-shadow:
                20px 0 60px rgba(0,0,0,.55) !important;

            padding:
                16px 13px !important;

            overflow-y:auto !important;

            overscroll-behavior:
                contain;
        }

        .side-menu-header{

            min-height:48px;

            display:flex !important;

            align-items:center;

            justify-content:space-between;

            margin-bottom:10px;
        }

        .side-menu-header strong{

            color:#fff;

            font-size:18px;
            font-weight:900;
        }

        #closeMenuButton{

            width:40px;
            height:40px;

            display:flex;
            align-items:center;
            justify-content:center;

            border:1px solid rgba(255,255,255,.08);

            border-radius:12px;

            background:
                rgba(255,255,255,.045);

            color:#fff;

            font-size:24px;
        }

        .nav-menu-item,
        #sideMenu [data-page]{

            min-height:46px !important;

            width:100% !important;

            display:flex !important;

            align-items:center !important;

            gap:12px !important;

            padding:
                11px 13px !important;

            margin-bottom:5px !important;

            border:
                1px solid transparent !important;

            border-radius:13px !important;

            background:
                transparent !important;

            color:#9ca5b5 !important;

            font-size:13px !important;

            font-weight:650 !important;

            text-align:left !important;
        }

        .nav-menu-item.active,
        .nav-menu-item:hover,
        #sideMenu [data-page].active{

            background:
                linear-gradient(
                    90deg,
                    rgba(229,9,47,.16),
                    rgba(229,9,47,.055)
                ) !important;

            border-color:
                rgba(229,9,47,.18) !important;

            color:#fff !important;
        }

        .nav-menu-item.active::before{

            content:"";

            width:3px;
            height:22px;

            position:absolute;

            left:13px;

            background:
                var(--np-red2);

            border-radius:999px;
        }

        .side-menu-footer{

            margin-top:16px;

            padding-top:12px;

            border-top:
                1px solid rgba(255,255,255,.07);
        }

        .logout-button{

            width:100% !important;

            min-height:44px;

            border:
                1px solid rgba(229,9,47,.18) !important;

            border-radius:12px !important;

            background:
                rgba(229,9,47,.06) !important;

            color:#ff6a82 !important;

            font-weight:800;
        }


        /* ================================
           FILTERS / CHAPTERS
        ================================= */

        .chapter-filter{

            border:
                1px solid rgba(255,255,255,.09) !important;

            background:
                rgba(255,255,255,.04) !important;

            color:#aeb6c5 !important;

            border-radius:999px !important;

            padding:
                8px 12px !important;
        }

        .chapter-filter.active{

            background:
                rgba(229,9,47,.12) !important;

            border-color:
                rgba(229,9,47,.28) !important;

            color:
                var(--np-red2) !important;
        }


        /* ================================
           REPORT ROWS
        ================================= */

        .task-report-row,
        .daily-breakdown-row,
        .subject-report-row,
        .chapter-row,
        .stat-row-page,
        .feature-row{

            padding:
                13px 0 !important;

            border-bottom:
                1px solid rgba(255,255,255,.055) !important;
        }


        /* ================================
           STATS
        ================================= */

        .stats-grid{

            display:grid !important;

            grid-template-columns:
                repeat(2,minmax(0,1fr)) !important;

            gap:10px !important;
        }

        .stat-box{

            padding:15px !important;

            background:
                rgba(255,255,255,.035) !important;

            border:
                1px solid rgba(255,255,255,.07) !important;

            border-radius:15px !important;
        }

        .stat-box strong{

            color:#fff !important;

            font-size:20px !important;

            font-weight:900 !important;
        }


        /* ================================
           INPUTS / MODALS
        ================================= */

        input,
        select,
        textarea{

            border-radius:12px !important;

            border:
                1px solid rgba(255,255,255,.10) !important;

            background:
                #11151d !important;

            color:#fff !important;

            outline:none;
        }

        input:focus,
        select:focus,
        textarea:focus{

            border-color:
                rgba(229,9,47,.45) !important;

            box-shadow:
                0 0 0 3px rgba(229,9,47,.08) !important;
        }

        .modal-overlay{

            background:
                rgba(0,0,0,.72) !important;

            backdrop-filter:
                blur(9px);
        }

        .modal-card{

            width:
                min(94vw,500px) !important;

            max-height:
                88vh;

            overflow-y:auto;

            border:
                1px solid rgba(229,9,47,.17) !important;

            border-radius:20px !important;

            background:
                linear-gradient(
                    145deg,
                    #17151c,
                    #0c0f15
                ) !important;

            box-shadow:
                0 25px 80px rgba(0,0,0,.55) !important;
        }


        /* ================================
           TOAST
        ================================= */

        #toast{

            border:
                1px solid rgba(229,9,47,.22) !important;

            background:
                rgba(18,12,17,.96) !important;

            color:#fff !important;

            border-radius:13px !important;

            box-shadow:
                0 12px 35px rgba(0,0,0,.35);
        }


        /* ================================
           SCROLL SAFETY
        ================================= */

        html,
        body{

            overflow-x:hidden !important;

            overscroll-behavior-x:none;
        }

        #pageContainer,
        #mainApp{

            overflow-x:clip;
        }


        /* ================================
           MOBILE 360–430
        ================================= */

        @media(max-width:700px){

            #pageContainer{
                padding:
                    14px 11px 70px !important;
            }

            .card{
                padding:16px !important;
            }

            .page-heading h1{
                font-size:27px !important;
            }

            .progress-card{
                padding:16px !important;
            }

            .progress-overview{
                gap:14px !important;
            }

            .progress-ring{
                width:135px !important;
                height:135px !important;
            }

            .subject-card{
                padding:14px !important;
            }

            .section-heading{
                margin-top:18px !important;
            }

            canvas{
                max-width:100%;
            }
        }


        /* ================================
           VERY SMALL PHONE
        ================================= */

        @media(max-width:380px){

            #pageContainer{
                padding-left:9px !important;
                padding-right:9px !important;
            }

            .top-header{
                padding-left:10px !important;
                padding-right:10px !important;
            }

            .menu-button{
                width:39px;
                height:39px;
            }

            .guardian-avatar{
                width:35px !important;
                height:35px !important;
            }

            .app-title{
                font-size:17px !important;
            }

            .app-subtitle{
                font-size:9px !important;
            }

            .summary-card,
            .subject-card{
                padding:12px !important;
            }

            .summary-card strong{
                font-size:17px !important;
            }

            .subject-stat strong{
                font-size:17px !important;
            }

            #liveTimer{
                font-size:27px !important;
            }
        }


        /* ================================
           DESKTOP
        ================================= */

        @media(min-width:701px){

            #pageContainer{
                max-width:900px;
                padding:
                    24px 20px 90px;
            }

            .subject-grid{
                grid-template-columns:
                    repeat(3,minmax(0,1fr)) !important;
            }

            .summary-grid{
                grid-template-columns:
                    repeat(4,minmax(0,1fr)) !important;
            }
        }


        /* ================================
           REDUCED MOTION
        ================================= */

        @media(prefers-reduced-motion:reduce){

            *,
            *::before,
            *::after{

                animation-duration:.01ms !important;
                transition-duration:.01ms !important;
            }

            html{
                scroll-behavior:auto !important;
            }
        }

        `;

        document.head.appendChild(style);
    }


    /* ---------------------------------------------------------
       2. SAFE BUTTON POLISH
    --------------------------------------------------------- */

    function polishButtons(){

        document
            .querySelectorAll(
                "#sideMenu button, " +
                ".primary-button, " +
                ".secondary-button, " +
                ".text-button, " +
                ".chapter-filter"
            )
            .forEach(btn=>{

                if(!btn.dataset.nposPremiumBound){

                    btn.dataset.nposPremiumBound="1";

                    btn.addEventListener(
                        "touchstart",
                        ()=>{
                            btn.style.webkitTapHighlightColor =
                                "transparent";
                        },
                        {passive:true}
                    );
                }

            });
    }


    /* ---------------------------------------------------------
       3. PREVENT HORIZONTAL OVERFLOW ONLY
    --------------------------------------------------------- */

    function fixOverflow(){

        const page =
            document.getElementById("pageContainer");

        if(page){

            page.style.maxWidth =
                window.innerWidth <= 700
                    ? "100%"
                    : "";

            page.style.overflowX =
                "clip";
        }
    }


    /* ---------------------------------------------------------
       4. KEEP CURRENT PAGE VISIBLE
          WITHOUT TOUCHING NAVIGATION LOGIC
    --------------------------------------------------------- */

    function refresh(){

        try{

            injectCSS();
            polishButtons();
            fixOverflow();

        }catch(err){

            console.warn(
                "NP-OS Premium UI:",
                err
            );
        }
    }


    /* ---------------------------------------------------------
       5. INITIALIZE
    --------------------------------------------------------- */

    function init(){

        refresh();

        setTimeout(refresh,500);
        setTimeout(refresh,1500);
        setTimeout(refresh,3000);

        window.addEventListener(
            "resize",
            fixOverflow,
            {passive:true}
        );

        console.log(
            "✅ NP-OS — Mobile Premium UI v" +
            VERSION +
            " loaded."
        );
    }


    if(document.readyState === "loading"){

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {once:true}
        );

    }else{

        init();
    }


    /* ---------------------------------------------------------
       PUBLIC API
    --------------------------------------------------------- */

    window.NPOSFinalPremiumUI = {

        version:VERSION,

        refresh:refresh

    };

})();
/* =========================================================
   NP-OS — FINAL LIVE + CIRCULAR PROGRESS FIX
   Version: 7.0.0

   FIXES:
   1. Remove duplicate OLD Live Status card
   2. Keep NEW Premium Live Student Activity
   3. Fix circular progress to EXACT real percentage
   4. 13% = exactly 13% ring fill
   5. Live ring updates automatically
   6. No Firebase changes
   7. No storage changes
   8. No task logic changes
   9. No scrollTo / scroll locking
========================================================= */

(function NPOS_FINAL_LIVE_AND_PROGRESS_FIX(){

    "use strict";

    if(window.__NPOS_FINAL_LIVE_AND_PROGRESS_FIX_V7) return;

    window.__NPOS_FINAL_LIVE_AND_PROGRESS_FIX_V7 = true;


    /* =====================================================
       1. FINAL CSS
    ===================================================== */

    const style = document.createElement("style");

    style.id = "nposFinalLiveProgressFixStyle";

    style.textContent = `

        /* =================================================
           REMOVE OLD DUPLICATE LIVE STATUS
           Keep the new premium live activity card.
        ================================================= */

        #liveStatusCard{
            display:none !important;
        }


        /* =================================================
           REAL CIRCULAR PROGRESS RING
        ================================================= */

        .progress-ring{

            position:relative !important;

            background:
                conic-gradient(
                    from -90deg,
                    var(--np-red, #e5092f) 0%,
                    var(--np-red, #e5092f) var(--np-progress, 0%),
                    rgba(255,255,255,.075) var(--np-progress, 0%),
                    rgba(255,255,255,.075) 100%
                ) !important;

            border-radius:50% !important;

            transition:
                background .35s ease !important;

        }


        /* =================================================
           INNER CIRCLE
           Keeps the ring clean / premium.
        ================================================= */

        .progress-ring::before{

            content:"";

            position:absolute;

            inset:9px;

            border-radius:50%;

            background:
                #111927;

            z-index:0;

        }


        /* Keep percentage text above ring */

        .progress-ring > *{

            position:relative;

            z-index:1;

        }


        /* =================================================
           MOBILE RING
        ================================================= */

        @media(max-width:700px){

            .progress-ring{

                width:140px !important;
                height:140px !important;

            }

            .progress-ring::before{
                inset:8px;
            }

        }


        @media(max-width:380px){

            .progress-ring{

                width:125px !important;
                height:125px !important;

            }

            .progress-ring::before{
                inset:7px;
            }

        }

    `;

    document.head.appendChild(style);


    /* =====================================================
       2. EXACT PROGRESS VALUE
    ===================================================== */

    function getRealProgress(){

        try{

            if(typeof progress === "function"){

                const value = Number(progress());

                if(Number.isFinite(value)){

                    return Math.max(
                        0,
                        Math.min(100, value)
                    );

                }

            }

        }catch(error){

            console.warn(
                "NP-OS progress read failed:",
                error
            );

        }

        return 0;
    }


    /* =====================================================
       3. UPDATE RING
    ===================================================== */

    function updateFinalProgressRing(){

        try{

            const rings =
                document.querySelectorAll(
                    ".progress-ring"
                );

            if(!rings.length) return;


            const p =
                getRealProgress();


            rings.forEach(ring=>{

                /* CSS variable controls exact fill */

                ring.style.setProperty(
                    "--np-progress",
                    `${p}%`
                );


                /* Direct background fallback
                   so no older CSS can override it */

                ring.style.background =
                    `conic-gradient(
                        from -90deg,
                        #e5092f 0%,
                        #e5092f ${p}%,
                        rgba(255,255,255,.075) ${p}%,
                        rgba(255,255,255,.075) 100%
                    )`;

            });


            /* Make every visible progress percentage
               agree with the same real value */

            const percentageIds = [

                "todayProgressPercent",
                "progressRingValue"

            ];

            percentageIds.forEach(id=>{

                const el =
                    document.getElementById(id);

                if(el){

                    el.textContent =
                        `${p}%`;

                }

            });

        }catch(error){

            console.warn(
                "NP-OS final circular progress update failed:",
                error
            );

        }

    }


    /* =====================================================
       4. INITIAL UPDATE
    ===================================================== */

    function init(){

        updateFinalProgressRing();

        /*
           Small delayed refreshes because home()
           may render the ring after page initialization.
        */

        setTimeout(
            updateFinalProgressRing,
            300
        );

        setTimeout(
            updateFinalProgressRing,
            1000
        );

        setTimeout(
            updateFinalProgressRing,
            2000
        );

    }


    /* =====================================================
       5. LIVE UPDATE LOOP
    ===================================================== */

    let lastProgress = -1;

    function liveLoop(){

        try{

            const p =
                getRealProgress();

            /*
               Only touch DOM when percentage changes.
               This avoids unnecessary repainting.
            */

            if(p !== lastProgress){

                lastProgress = p;

                updateFinalProgressRing();

            }

        }catch(error){

            console.warn(
                "NP-OS live progress loop:",
                error
            );

        }

    }


    /* =====================================================
       6. START
    ===================================================== */

    if(
        document.readyState ===
        "loading"
    ){

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {once:true}
        );

    }else{

        init();

    }


    /*
       Existing NP-OS already refreshes every second,
       but this makes the ring independently reliable.
    */

    setInterval(
        liveLoop,
        1000
    );


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.NPOSFinalLiveProgressFix = {

        version:"7.0.0",

        refresh:updateFinalProgressRing,

        getProgress:getRealProgress

    };


    console.log(
        "✅ NP-OS Final Live + Circular Progress Fix v7.0.0 loaded."
    );

})();
/* =========================================================
   NP-OS — FINAL LIVE + EXACT PROGRESS RING
   Version 9.0.0

   FINAL FIX
   ---------------------------------------------------------
   • Removes duplicate OLD Live Status
   • Keeps Premium Live Student Activity
   • Fixes 45% hard-coded progress ring
   • Uses REAL progress() value
   • 13% = exactly 13%
   • 50% = exactly 50%
   • 100% = exactly 100%
   • Mobile friendly
   • No Firebase writes
   • No storage changes
   • No task logic changes
   • No scroll manipulation
========================================================= */

(function NPOS_FINAL_LIVE_PROGRESS_V9(){

    "use strict";

    if(window.__NPOS_FINAL_LIVE_PROGRESS_V9) return;

    window.__NPOS_FINAL_LIVE_PROGRESS_V9 = true;


    /* =====================================================
       1. FINAL CSS OVERRIDE
    ===================================================== */

    const style =
        document.createElement("style");

    style.id =
        "nposFinalLiveProgressV9Style";

    style.textContent = `

        /* =================================================
           REMOVE OLD DUPLICATE LIVE STATUS
        ================================================= */

        #liveStatusCard{
            display:none !important;
        }


        /* =================================================
           EXACT CIRCULAR PROGRESS
           
           IMPORTANT:
           Original CSS has 45% hard-coded.
           This rule overrides it.
        ================================================= */

        .progress-ring{

            width:155px !important;
            height:155px !important;

            display:flex !important;

            align-items:center !important;
            justify-content:center !important;

            position:relative !important;

            border-radius:50% !important;

            /*
               JS writes the real percentage into
               --npos-progress.
            */

            background:
                conic-gradient(
                    from -90deg,
                    #e5092f 0%,
                    #e5092f var(--npos-progress, 0%),
                    rgba(255,255,255,.08)
                        var(--npos-progress, 0%),
                    rgba(255,255,255,.08)
                        100%
                ) !important;

        }


        /* =================================================
           INNER CIRCLE

           Original ::before uses var(--card).
           Force a neutral dark center.
        ================================================= */

        .progress-ring::before{

            content:"" !important;

            position:absolute !important;

            inset:10px !important;

            width:auto !important;
            height:auto !important;

            border-radius:50% !important;

            background:
                #111927 !important;

            z-index:0 !important;

        }


        /* =================================================
           INNER CONTENT
        ================================================= */

        .progress-ring-inner{

            position:relative !important;

            z-index:2 !important;

            text-align:center !important;

        }


        .progress-ring-inner strong{

            display:block !important;

            font-size:34px !important;

            font-weight:900 !important;

            color:#fff !important;

        }


        .progress-ring-inner span{

            display:block !important;

            color:#9ca9bd !important;

        }


        /* =================================================
           MOBILE
        ================================================= */

        @media(max-width:700px){

            .progress-ring{

                width:140px !important;
                height:140px !important;

            }

            .progress-ring::before{

                inset:9px !important;

            }

        }


        @media(max-width:380px){

            .progress-ring{

                width:125px !important;
                height:125px !important;

            }

            .progress-ring::before{

                inset:8px !important;

            }

        }

    `;

    document.head.appendChild(style);


    /* =====================================================
       2. GET REAL PROGRESS
    ===================================================== */

    function getProgress(){

        try{

            if(
                typeof progress ===
                "function"
            ){

                let p =
                    Number(
                        progress()
                    );

                if(
                    Number.isFinite(p)
                ){

                    return Math.max(
                        0,
                        Math.min(
                            100,
                            p
                        )
                    );

                }

            }

        }catch(error){

            console.warn(
                "NP-OS: progress() read failed",
                error
            );

        }

        return 0;

    }


    /* =====================================================
       3. UPDATE RING
    ===================================================== */

    function updateRing(){

        try{

            const ring =
                document.querySelector(
                    ".progress-ring"
                );

            if(!ring){

                return;

            }


            const p =
                getProgress();


            /*
               Set CSS variable.
            */

            ring.style.setProperty(
                "--npos-progress",
                `${p}%`
            );


            /*
               ALSO set inline background.

               This is intentional:
               it wins over the original CSS
               which contains hard-coded 45%.
            */

            ring.style.setProperty(
                "background",
                `conic-gradient(
                    from -90deg,
                    #e5092f 0%,
                    #e5092f ${p}%,
                    rgba(255,255,255,.08) ${p}%,
                    rgba(255,255,255,.08) 100%
                )`,
                "important"
            );


            /*
               Keep percentage text synced.
            */

            const topPercent =
                document.getElementById(
                    "todayProgressPercent"
                );

            if(topPercent){

                topPercent.textContent =
                    `${p}%`;

            }


            const ringPercent =
                document.getElementById(
                    "progressRingValue"
                );

            if(ringPercent){

                ringPercent.textContent =
                    `${p}%`;

            }

        }catch(error){

            console.warn(
                "NP-OS: Final ring update failed",
                error
            );

        }

    }


    /* =====================================================
       4. INITIAL PAINT
    ===================================================== */

    function init(){

        updateRing();


        /*
           Home() runs during app boot.
           These delayed refreshes make sure the
           ring gets painted AFTER home().
        */

        setTimeout(
            updateRing,
            100
        );

        setTimeout(
            updateRing,
            500
        );

        setTimeout(
            updateRing,
            1000
        );

        setTimeout(
            updateRing,
            2000
        );

    }


    /* =====================================================
       5. LIVE UPDATE
    ===================================================== */

    let last =
        null;


    setInterval(

        function(){

            const p =
                getProgress();


            /*
               Only repaint when percentage
               actually changes.
            */

            if(
                p !== last
            ){

                last = p;

                updateRing();

            }

        },

        1000

    );


    /* =====================================================
       6. START
    ===================================================== */

    if(
        document.readyState ===
        "loading"
    ){

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {once:true}
        );

    }else{

        init();

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.NPOSFinalLiveProgressV9 = {

        version:"9.0.0",

        refresh:updateRing,

        getProgress:getProgress

    };


    console.log(
        "✅ NP-OS Final Live + Exact Progress v9.0.0 loaded."
    );

})();
/* =========================================================
   NP-OS — FINAL ERROR + LIVE + PROGRESS STABILITY PATCH
   Version 10.0.0

   Fixes:
   • Firebase syllabus missing-array error
   • subjectPage() .length crash
   • Keeps V9 Live Status fix
   • Keeps V9 exact Circular Progress
   • No Firebase write
   • No storage modification
   • No scroll manipulation
========================================================= */

(function NPOS_FINAL_STABILITY_V10(){

    "use strict";

    if(window.__NPOS_FINAL_STABILITY_V10) return;

    window.__NPOS_FINAL_STABILITY_V10 = true;


    /* =====================================================
       1. SAFE SYLLABUS NORMALIZER
    ===================================================== */

    function safeArray(value, fallback){

        return Array.isArray(value)
            ? value
            : (
                Array.isArray(fallback)
                    ? fallback
                    : []
            );

    }


    function repairSyllabus(){

        try{

            if(
                typeof S === "undefined"
            ){

                return;

            }


            /*
               If cloud syllabus itself is invalid,
               use the existing fallback.
            */

            if(
                !S.syllabus ||
                typeof S.syllabus !== "object"
            ){

                if(
                    typeof FALLBACK_SYLLABUS !==
                    "undefined"
                ){

                    S.syllabus =
                        FALLBACK_SYLLABUS;

                }else{

                    S.syllabus = {};

                }

            }


            const fallback =
                typeof FALLBACK_SYLLABUS !==
                "undefined"
                    ? FALLBACK_SYLLABUS
                    : {};


            /*
               Guarantee every array used by
               subjectPage() actually exists.
            */

            S.syllabus.Physics =
                safeArray(
                    S.syllabus.Physics,
                    fallback.Physics
                );


            S.syllabus["Physical Chemistry"] =
                safeArray(
                    S.syllabus["Physical Chemistry"],
                    fallback["Physical Chemistry"]
                );


            S.syllabus["Inorganic Chemistry"] =
                safeArray(
                    S.syllabus["Inorganic Chemistry"],
                    fallback["Inorganic Chemistry"]
                );


            S.syllabus["Organic Chemistry"] =
                safeArray(
                    S.syllabus["Organic Chemistry"],
                    fallback["Organic Chemistry"]
                );


            S.syllabus.Botany =
                safeArray(
                    S.syllabus.Botany,
                    fallback.Botany
                );


            S.syllabus.Zoology =
                safeArray(
                    S.syllabus.Zoology,
                    fallback.Zoology
                );


        }catch(error){

            console.warn(
                "NP-OS: Syllabus safety repair failed.",
                error
            );

        }

    }


    /* =====================================================
       2. PROTECT subjectPage()

       Repair syllabus BEFORE the original function runs.
    ===================================================== */

    if(
        typeof window.subjectPage ===
        "function"
    ){

        const originalSubjectPage =
            window.subjectPage;


        window.subjectPage =
            function(){

                repairSyllabus();

                try{

                    return originalSubjectPage.apply(
                        this,
                        arguments
                    );

                }catch(error){

                    /*
                       Last safety net.

                       If Firebase sends malformed syllabus,
                       don't let the whole dashboard crash.
                    */

                    console.warn(
                        "NP-OS: Subject page rendering was safely skipped due to malformed syllabus.",
                        error
                    );

                    return;

                }

            };

    }


    /* =====================================================
       3. RUN ONCE IMMEDIATELY
    ===================================================== */

    repairSyllabus();


    /* =====================================================
       4. KEEP SYLLABUS SAFE AFTER FIREBASE REFRESH
    ===================================================== */

    setInterval(

        function(){

            repairSyllabus();

        },

        1000

    );


    /* =====================================================
       5. RE-APPLY EXACT PROGRESS RING

       V9 remains responsible for the main UI.
       This is only an additional safety refresh.
    ===================================================== */

    function refreshRing(){

        try{

            const ring =
                document.querySelector(
                    ".progress-ring"
                );

            if(!ring){

                return;

            }


            const p =
                typeof progress ===
                "function"
                    ? Math.max(
                        0,
                        Math.min(
                            100,
                            Number(progress()) || 0
                        )
                    )
                    : 0;


            ring.style.setProperty(
                "--npos-progress",
                `${p}%`
            );


            ring.style.setProperty(
                "background",
                `conic-gradient(
                    from -90deg,
                    #e5092f 0%,
                    #e5092f ${p}%,
                    rgba(255,255,255,.08) ${p}%,
                    rgba(255,255,255,.08) 100%
                )`,
                "important"
            );


            const value =
                document.getElementById(
                    "progressRingValue"
                );

            if(value){

                value.textContent =
                    `${p}%`;

            }


            const top =
                document.getElementById(
                    "todayProgressPercent"
                );

            if(top){

                top.textContent =
                    `${p}%`;

            }


        }catch(error){

            console.warn(
                "NP-OS: Final progress ring refresh failed.",
                error
            );

        }

    }


    refreshRing();


    setInterval(
        refreshRing,
        1000
    );


    console.log(
        "✅ NP-OS Final Stability V10 loaded — syllabus error + exact progress protected."
    );

})();
