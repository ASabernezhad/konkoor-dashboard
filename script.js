(function(){
  'use strict';

  const LESSONS = [
    { id:'hendese',  name:'هندسه',         total:671  },
    { id:'amar',     name:'آمار و احتمال', total:1010 },
    { id:'fizik',    name:'فیزیک',         total:1397 },
    { id:'shimi',    name:'شیمی',          total:1864 },
    { id:'hesaban',  name:'حسابان',        total:2211 },
  ];
  const GRAND_TOTAL = LESSONS.reduce(function(s,l){ return s + l.total; }, 0);
  const END_JY = 1405, END_JM = 12, END_JD = 29;
  const STORAGE_KEY = 'konkoor_dashboard_v6';

  const ACHIEVEMENTS = [
    { id: 'first', name: '🎯 اولین قدم', desc: 'اولین تستت رو ثبت کردی', check: function(s){ return s.logs.length >= 1; } },
    { id: 'ten', name: '📚 ده‌تایی', desc: '۱۰ گزارش ثبت شد', check: function(s){ return s.logs.length >= 10; } },
    { id: 'streak7', name: '🔥 یک هفته', desc: '۷ روز پشت‌سرهم', check: function(){ return calcCurrentStreak() >= 7; } },
    { id: 'streak30', name: '💎 یک ماه', desc: '۳۰ روز پشت‌سرهم', check: function(){ return calcCurrentStreak() >= 30; } },
    { id: 'grand1000', name: '👑 هزار تست', desc: '۱۰۰۰ تست زدی', check: function(){ return totalDone() >= 1000; } },
    { id: 'master', name: '🎓 استاد', desc: 'همه‌ی درس‌ها بالای ۵۰٪', check: function(){
      var d = donePerLesson();
      return LESSONS.every(function(l){ return d[l.id] >= l.total/2; });
    }},
  ];

  let currentCalJY = 1403;
  let currentCalJM = 1;
  let selectedDate = '';

  /* ====== تبدیل تاریخ ====== */
  function jToG(jy, jm, jd){
    var gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    var days = (365*jy) + (Math.floor(jy/33)*8) + Math.floor(((jy%33)+3)/4) + 78 + jd
             + ((jm < 7) ? (jm-1)*31 : ((jm-7)*30)+186);
    gy += 400*Math.floor(days/146097); days %= 146097;
    if(days > 36524){
      gy += 100*Math.floor(--days/36524); days %= 36524;
      if(days >= 365) days++;
    }
    gy += 4*Math.floor(days/1461); days %= 1461;
    if(days > 365){ gy += Math.floor((days-1)/365); days = (days-1)%365; }
    var gd = days + 1;
    var sal_a = [0,31,((gy%4===0 && gy%100!==0) || gy%400===0) ? 29:28,31,30,31,30,31,31,30,31,30,31];
    var gm;
    for(gm=1; gm<=12; gm++){
      if(gd <= sal_a[gm]) break;
      gd -= sal_a[gm];
    }
    return new Date(gy, gm-1, gd);
  }

  function gToJ(gy, gm, gd) {
    var g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
    var jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    var gy2 = (gm > 2) ? (gy + 1) : gy;
    var days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100))
             + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * (Math.floor(days / 12053));
    days %= 12053;
    jy += 4 * (Math.floor(days / 1461));
    days %= 1461;
    jy += Math.floor((days - 1) / 365);
    if (days > 365) days = (days - 1) % 365;
    var jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy: jy, jm: jm, jd: jd };
  }

  function getEndDate(){ return jToG(END_JY, END_JM, END_JD); }
  function pad(n){ return n < 10 ? '0'+n : ''+n; }
  function toDateStr(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function todayStr(){ return toDateStr(new Date()); }
  function daysBetween(from, to){
    var a = new Date(from); a.setHours(0,0,0,0);
    var b = new Date(to);   b.setHours(0,0,0,0);
    return Math.round((b - a) / 86400000);
  }
  function faDigits(str){ return String(str).replace(/[0-9]/g, function(d){ return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
  function fmtFa(n, dec){
    dec = dec || 0;
    if(typeof n !== 'number' || !isFinite(n)) n = 0;
    try{ return n.toLocaleString('fa-IR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
    catch(e){ return faDigits(n.toFixed(dec)); }
  }
  function pctExact(done, total){ return total ? (done/total)*100 : 0; }
  function pctLabel(done, total){ return fmtFa(pctExact(done,total), 2) + '٪'; }

  function getJalaliDayOfWeek(jy, jm, jd) {
    var gDate = jToG(jy, jm, jd);
    return (gDate.getDay() + 1) % 7;
  }

  /* ====== STATE ====== */
  var state = { logs: [] };
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(raw) state = JSON.parse(raw);
    if(!state || !Array.isArray(state.logs)) state = { logs: [] };
  }catch(e){ state = { logs: [] }; }

  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
  }

  /* ====== محاسبات ====== */
  function donePerLesson(){
    var map = {};
    LESSONS.forEach(function(l){ map[l.id] = 0; });
    state.logs.forEach(function(lg){
      if(map[lg.lessonId] !== undefined) map[lg.lessonId] += (Number(lg.done) || 0);
    });
    return map;
  }
  function remainingPerLesson(){
    var done = donePerLesson();
    var map = {};
    LESSONS.forEach(function(l){ map[l.id] = Math.max(0, l.total - done[l.id]); });
    return map;
  }
  function totalRemaining(){
    var r = remainingPerLesson();
    return LESSONS.reduce(function(s,l){ return s + r[l.id]; }, 0);
  }
  function totalDone(){ return GRAND_TOTAL - totalRemaining(); }
  function remainingDays(){
    var from = new Date(); from.setHours(0,0,0,0);
    var end = getEndDate(); end.setHours(0,0,0,0);
    return Math.max(0, daysBetween(from, end));
  }
  function perLessonDailyTarget(){
    var rem = remainingPerLesson();
    var days = Math.max(1, remainingDays());
    var map = {};
    LESSONS.forEach(function(l){ map[l.id] = Math.ceil(rem[l.id] / days); });
    return map;
  }
  function todayDoneByLesson(){
    var t = todayStr(), map = {};
    LESSONS.forEach(function(l){ map[l.id] = 0; });
    state.logs.filter(function(lg){ return lg.date === t; }).forEach(function(lg){
      map[lg.lessonId] = (map[lg.lessonId] || 0) + (Number(lg.done) || 0);
    });
    return map;
  }
  function statusPerLesson(){
    var targets = perLessonDailyTarget();
    var today = todayDoneByLesson();
    var map = {};
    LESSONS.forEach(function(l){
      var done = today[l.id], target = targets[l.id];
      map[l.id] = { target: target, done: done, diff: done - target };
    });
    return map;
  }

  /* ====== استریک ====== */
  function activeSet(){ return new Set(state.logs.map(function(lg){ return lg.date; })); }
  function calcCurrentStreak(){
    var set = activeSet();
    var cur = new Date(); cur.setHours(0,0,0,0);
    if(!set.has(toDateStr(cur))) cur.setDate(cur.getDate() - 1);
    var n = 0;
    while(set.has(toDateStr(cur))){ n++; cur.setDate(cur.getDate() - 1); }
    return n;
  }

  /* ====== دستاوردها ====== */
  function checkAchievements() {
    var unlocked = JSON.parse(localStorage.getItem('achievements') || '[]');
    ACHIEVEMENTS.forEach(function(a) {
      if (unlocked.indexOf(a.id) === -1 && a.check(state)) {
        unlocked.push(a.id);
        setTimeout(function(){ toast('🏆 دستاورد: ' + a.name, 'linear-gradient(135deg,#eab308,#f59e0b)'); }, 500);
      }
    });
    localStorage.setItem('achievements', JSON.stringify(unlocked));
    return unlocked;
  }

  /* ====== رندر ====== */
  function renderCountdown(){
    var d = remainingDays();
    document.getElementById('cd-days').textContent = fmtFa(d);
    document.getElementById('cd-info').textContent = '📅 ' + fmtFa(d) + ' روز باقی‌مانده تا پایان مسیر';
  }

  function renderStats(){
    var rem = totalRemaining();
    var d = remainingDays();
    var daily = d > 0 ? Math.ceil(rem/d) : rem;
    var doneTotal = totalDone();

    document.getElementById('stats').innerHTML =
      '<div class="stat"><div class="label">کل باقی‌مانده</div><div class="value blue">' + fmtFa(rem) + '</div></div>' +
      '<div class="stat"><div class="label">روز باقی‌مانده</div><div class="value">' + fmtFa(d) + '</div></div>' +
      '<div class="stat"><div class="label">هدف روزانه کل</div><div class="value yellow">' + fmtFa(daily) + '</div></div>' +
      '<div class="stat"><div class="label">پیشرفت دقیق</div><div class="value green">' + pctLabel(doneTotal, GRAND_TOTAL) + '</div></div>';
  }

  function renderChart(){
    var canvas = document.getElementById('progressChart');
    if(!canvas || typeof Chart === 'undefined') return;
    var done = donePerLesson();
    var labels = LESSONS.map(function(l){ return l.name; });
    var dataDone = LESSONS.map(function(l){ return done[l.id]; });
    var dataRem = LESSONS.map(function(l){ return Math.max(0, l.total - done[l.id]); });

    if(window._chart) window._chart.destroy();
    window._chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'انجام‌شده', data: dataDone, backgroundColor: 'rgba(139,92,246,.75)', borderRadius: 8 },
          { label: 'باقی‌مانده', data: dataRem, backgroundColor: 'rgba(148,163,184,.35)', borderRadius: 8 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--txt') || '#fff', font: { family: 'Vazirmatn' } } }
        },
        scales: {
          x: { stacked: true, ticks: { color: '#94a3b8', font: { family: 'Vazirmatn' } } },
          y: { stacked: true, ticks: { color: '#94a3b8', font: { family: 'Vazirmatn' } } }
        }
      }
    });
  }

  function renderCards(){
    var rem = remainingPerLesson();
    var done = donePerLesson();
    var status = statusPerLesson();

    document.getElementById('cards').innerHTML = LESSONS.map(function(l){
      var pct = pctExact(done[l.id], l.total);
      var s = status[l.id];
      var cls = 'b', txt = 'روی برنامه';
      if(s.diff > 0){ cls='g'; txt='+' + fmtFa(s.diff) + ' جلو'; }
      else if(s.diff < 0){ cls='r'; txt=fmtFa(s.diff) + ' عقب'; }

      return '<div class="card">' +
        '<div class="name">' + l.name + '</div>' +
        '<div class="rem">' + fmtFa(rem[l.id]) + ' باقی از ' + fmtFa(l.total) + '</div>' +
        '<div class="bar"><div class="bar-fill" style="width:' + Math.min(100, pct).toFixed(2) + '%"></div></div>' +
        '<div class="pct-tiny">' + pctLabel(done[l.id], l.total) + ' پیشرفت</div>' +
        '<div class="row"><span class="k">هدف امروز</span><span>' + fmtFa(s.target) + '</span></div>' +
        '<div class="row"><span class="k">امروز زدی</span><span>' + fmtFa(s.done) + '</span></div>' +
        '<div class="row"><span class="k">وضعیت</span><span class="pill ' + cls + '">' + txt + '</span></div>' +
      '</div>';
    }).join('');
  }

  function renderForm(){
    var sel = document.getElementById('f-lesson');
    if(sel && sel.options.length === 0){
      sel.innerHTML = LESSONS.map(function(l){
        return '<option value="' + l.id + '">' + l.name + '</option>';
      }).join('');
    }
    var dateInput = document.getElementById('f-date');
    if(dateInput && !dateInput.value){
      dateInput.value = todayStr();
      selectedDate = todayStr();
    }
  }

  function renderAchievements(){
    var unlocked = JSON.parse(localStorage.getItem('achievements') || '[]');
    document.getElementById('achievements').innerHTML = ACHIEVEMENTS.map(function(a){
      var isUnlocked = unlocked.indexOf(a.id) !== -1;
      return '<div class="achievement ' + (isUnlocked ? 'unlocked' : '') + '">' +
        '<div class="icon">' + (isUnlocked ? a.name.split(' ')[0] : '🔒') + '</div>' +
        '<div class="title">' + a.name.replace(/^[^\s]+\s/, '') + '</div>' +
        '<div class="desc">' + a.desc + '</div>' +
      '</div>';
    }).join('');
  }

  function renderLogs(){
    var el = document.getElementById('logs');
    if(!el) return;
    if(state.logs.length === 0){
      el.innerHTML = '<div style="color:#94a3b8; font-size:13px; text-align:center; padding:24px;">هنوز چیزی ثبت نکردی.</div>';
      return;
    }
    var sorted = state.logs.slice().sort(function(a,b){
      return (b.date || '').localeCompare(a.date || '') || (b.id - a.id);
    });
    el.innerHTML = sorted.map(function(lg){
      var l = LESSONS.find(function(x){ return x.id === lg.lessonId; });
      var name = l ? l.name : lg.lessonId;
      return '<div class="log-item">' +
        '<div style="flex:1;">' +
          '<div><b>' + name + '</b> — ' + fmtFa(Number(lg.done) || 0) + ' تست</div>' +
          '<div class="meta">📅 ' + faDigits(lg.date) + '</div>' +
        '</div>' +
        '<button class="del" data-id="' + (Number(lg.id) || 0) + '">🗑️</button>' +
      '</div>';
    }).join('');

    el.querySelectorAll('.del').forEach(function(btn){
      btn.addEventListener('click', function(){
        deleteLog(Number(btn.getAttribute('data-id')));
      });
    });
  }

  /* ====== تقویم ====== */
  function renderCalendar() {
    var el = document.getElementById('cal-title');
    var grid = document.getElementById('cal-grid');
    var logSet = activeSet();

    var monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

    el.textContent = monthNames[currentCalJM - 1] + ' ' + fmtFa(currentCalJY);
    grid.innerHTML = '';

    var firstDayOfWeek = getJalaliDayOfWeek(currentCalJY, currentCalJM, 1);

    var daysInMonth = 31;
    if (currentCalJM >= 7 && currentCalJM <= 11) daysInMonth = 30;
    if (currentCalJM === 12) {
      var testG = jToG(currentCalJY, 12, 30);
      var backJ = gToJ(testG.getFullYear(), testG.getMonth() + 1, testG.getDate());
      daysInMonth = (backJ.jm === 12 && backJ.jd === 30) ? 30 : 29;
    }

    for (var i = 0; i < firstDayOfWeek; i++) {
      var empty = document.createElement('div');
      empty.className = 'cal-day empty';
      grid.appendChild(empty);
    }

    for (var d = 1; d <= daysInMonth; d++) {
      (function(dayNum){
        var dayEl = document.createElement('div');
        dayEl.className = 'cal-day';
        dayEl.textContent = fmtFa(dayNum);

        var gDate = jToG(currentCalJY, currentCalJM, dayNum);
        var dateStr = toDateStr(gDate);

        if (dateStr === todayStr()) dayEl.classList.add('today');
        if (logSet.has(dateStr)) dayEl.classList.add('has-log');
        if (dateStr === selectedDate) dayEl.classList.add('selected');

        dayEl.addEventListener('click', function() {
          selectedDate = dateStr;
          document.getElementById('f-date').value = dateStr;
          renderCalendar();
        });

        grid.appendChild(dayEl);
      })(d);
    }
  }

  /* ====== اکشن‌ها ====== */
  function renderAll(){
    try{ renderCountdown(); } catch(e){ console.warn(e); }
    try{ renderStats(); } catch(e){ console.warn(e); }
    try{ renderChart(); } catch(e){ console.warn(e); }
    try{ renderCalendar(); } catch(e){ console.warn(e); }
    try{ renderCards(); } catch(e){ console.warn(e); }
    try{ renderForm(); } catch(e){ console.warn(e); }
    try{ renderAchievements(); } catch(e){ console.warn(e); }
    try{ renderLogs(); } catch(e){ console.warn(e); }

    try{
      document.getElementById('todayLabel').textContent =
        new Date().toLocaleDateString('fa-IR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    }catch(e){
      document.getElementById('todayLabel').textContent = faDigits(todayStr());
    }
    document.getElementById('streakBig').textContent = fmtFa(calcCurrentStreak());
    checkAchievements();
  }

  function toast(msg, color){
    var t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg;
    t.style.background = color || 'linear-gradient(135deg,#22c55e,#16a34a)';
    t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 1800);
  }

  function addLog(){
    var sel = document.getElementById('f-lesson');
    var inp = document.getElementById('f-done');
    if(!sel || !inp) return;

    var lessonId = sel.value;
    var done = parseInt(inp.value, 10);

    if(!lessonId || !isFinite(done) || done <= 0){
      toast('تعداد تست باید بیشتر از صفر باشه', 'linear-gradient(135deg,#ef4444,#b91c1c)');
      return;
    }

    state.logs.push({
      id: Date.now() + Math.floor(Math.random()*1000),
      date: selectedDate || todayStr(),
      lessonId: lessonId,
      done: done
    });
    saveState();
    inp.value = '';
    renderAll();
    toast('✅ ثبت شد');
  }

  function deleteLog(id){
    if(!confirm('این گزارش حذف بشه؟')) return;
    state.logs = state.logs.filter(function(lg){ return Number(lg.id) !== Number(id); });
    saveState();
    renderAll();
    toast('🗑️ حذف شد', 'linear-gradient(135deg,#ef4444,#b91c1c)');
  }

  function exportCSV() {
    if(state.logs.length === 0) {
      toast('تست‌ها خالی است', 'linear-gradient(135deg,#ef4444,#b91c1c)');
      return;
    }
    var csv = '\uFEFF';
    csv += 'ردیف,تاریخ,درس,تعداد تست\n';
    var sorted = state.logs.slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    sorted.forEach(function(lg, index) {
      var l = LESSONS.find(function(x){ return x.id === lg.lessonId; });
      var name = l ? l.name : lg.lessonId;
      csv += (index + 1) + ',' + lg.date + ',' + name + ',' + lg.done + '\n';
    });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'tests_backup_' + todayStr() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('📥 فایل دانلود شد');
  }

  function importCSV(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var lines = e.target.result.split('\n').slice(1).filter(Boolean);
      var count = 0;
      lines.forEach(function(line) {
        var parts = line.split(',');
        if (parts.length >= 4) {
          var lesson = LESSONS.find(function(l){ return l.name === parts[2].trim(); });
          if (lesson) {
            state.logs.push({
              id: Date.now() + count,
              date: parts[1].trim(),
              lessonId: lesson.id,
              done: parseInt(parts[3]) || 0
            });
            count++;
          }
        }
      });
      saveState(); renderAll();
      toast('✅ ' + faDigits(count) + ' ردیف وارد شد');
    };
    reader.readAsText(file);
  }

  /* ====== تم ====== */
  function initTheme() {
    var saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.classList.toggle('light', saved === 'light');
    var btn = document.getElementById('theme-toggle');
    btn.textContent = saved === 'light' ? '☀️' : '🌙';
    btn.addEventListener('click', function() {
      var isLight = document.documentElement.classList.toggle('light');
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
      btn.textContent = isLight ? '☀️' : '🌙';
      renderChart();
    });
  }

  /* ====== Init ====== */
  function init(){
    var now = new Date();
    var nowJ = gToJ(now.getFullYear(), now.getMonth() + 1, now.getDate());
    currentCalJY = nowJ.jy;
    currentCalJM = nowJ.jm;
    selectedDate = todayStr();

    document.getElementById('btn-add').addEventListener('click', addLog);
    document.getElementById('btn-export').addEventListener('click', exportCSV);

    var importInput = document.getElementById('f-import');
    if (importInput) {
      importInput.addEventListener('change', function(e){
        if (e.target.files[0]) importCSV(e.target.files[0]);
      });
    }

    document.getElementById('cal-prev').addEventListener('click', function() {
      currentCalJM--;
      if (currentCalJM < 1) { currentCalJM = 12; currentCalJY--; }
      renderCalendar();
    });

    document.getElementById('cal-next').addEventListener('click', function() {
      currentCalJM++;
      if (currentCalJM > 12) { currentCalJM = 1; currentCalJY++; }
      renderCalendar();
    });

    var inp = document.getElementById('f-done');
    if(inp) inp.addEventListener('keydown', function(e){
      if(e.key === 'Enter') addLog();
    });

    initTheme();
    renderAll();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();