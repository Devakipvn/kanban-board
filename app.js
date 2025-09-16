/* ---------- utilModule ---------- */
const utilModule = (() => {
  function q(selector, el = document) { return el.querySelector(selector); }
  function qa(selector, el = document) { return Array.from(el.querySelectorAll(selector)); }
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('data-')) node.setAttribute(k, v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      node.append(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }
  function uid() { return 't_' + Math.random().toString(36).slice(2,9); }
  return { q, qa, el, uid };
})();

/* ---------- storageModule ---------- */
const storageModule = (() => {
  const KEY = 'kanban_tasks_v1';
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch(e){ console.error('Storage read error', e); return []; }
  }
  function write(tasks) { try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch(e){ console.error(e); } }
  function add(task) { const tasks = read(); tasks.push(task); write(tasks); }
  function update(taskId, changes) { const tasks = read().map(t => t.id===taskId ? {...t,...changes} : t); write(tasks); }
  function remove(taskId) { const tasks = read().filter(t => t.id!==taskId); write(tasks); }
  return { read, write, add, update, remove };
})();

/* ---------- renderModule ---------- */
const renderModule = (() => {
  const { q, el } = utilModule;

  function createCard(task) {
    const card = el('div', { class:'card', draggable:true, 'data-id':task.id });
    const title = el('h3', {}, task.title);
    const desc = el('p', {}, task.description || '');
    const meta = el('div', { class:'meta' });
    const status = el('span', {}, task.status);
    const removeBtn = el('button', { class:'small-btn','aria-label':'delete'}, 'Delete');

    removeBtn.addEventListener('click', e=>{
      e.stopPropagation();
      if(confirm('Delete this task?')){
        document.dispatchEvent(new CustomEvent('kanban:remove',{detail:{id:task.id}}));
      }
    });

    meta.append(status, removeBtn);
    card.append(title, desc, meta);

    // Drag events
    card.addEventListener('dragstart', e=>{
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed='move';
    });
    card.addEventListener('dragend', ()=>{
      card.classList.remove('dragging');
    });

    return card;
  }

  function clearLists(){
    q('#todo-list').innerHTML='';
    q('#inprogress-list').innerHTML='';
    q('#done-list').innerHTML='';
  }

  function renderAll(tasks){
    clearLists();
    tasks.forEach(task => {
      const card = createCard(task);
      const target = q(`#${task.status}-list`) || q('#todo-list');
      target.appendChild(card);
    });
  }

  return { renderAll, createCard };
})();

/* ---------- dragDropModule ---------- */
const dragDropModule = (() => {
  const { q } = utilModule;

  function makeDroppable(columnEl){
    columnEl.addEventListener('dragover', e=>{
      e.preventDefault();
      columnEl.classList.add('drop-hint');
      e.dataTransfer.dropEffect='move';
    });
    columnEl.addEventListener('dragleave', ()=>{ columnEl.classList.remove('drop-hint'); });
    columnEl.addEventListener('drop', e=>{
      e.preventDefault();
      columnEl.classList.remove('drop-hint');
      const id = e.dataTransfer.getData('text/plain');
      if(!id) return;
      const status = columnEl.closest('.column')?.dataset.status || 'todo';
      document.dispatchEvent(new CustomEvent('kanban:dropped',{detail:{id,status}}));
    });
  }

  function init(){
    const columns = document.querySelectorAll('.column .task-list');
    columns.forEach(makeDroppable);
  }

  return { init };
})();

/* ---------- appModule ---------- */
const appModule = (() => {
  const { q, uid } = utilModule;

  function init(){
    bindForm();
    bindEvents();
    dragDropModule.init();
    renderModule.renderAll(storageModule.read());
  }

  function bindForm(){
    const form = q('#task-form');
    form.addEventListener('submit', ev=>{
      ev.preventDefault();
      const title = q('#title').value.trim();
      const description = q('#desc').value.trim();
      const status = q('#status').value;
      if(!title){ alert('Please enter a title'); return; }
      const task = { id:uid(), title, description, status, createdAt:Date.now() };
      storageModule.add(task);
      renderModule.renderAll(storageModule.read());
      form.reset();
      q('#title').focus();
    });
  }

  function bindEvents(){
    document.addEventListener('kanban:dropped', e=>{
      const {id,status} = e.detail;
      storageModule.update(id,{status});
      renderModule.renderAll(storageModule.read());
    });
    document.addEventListener('kanban:remove', e=>{
      const {id} = e.detail;
      storageModule.remove(id);
      renderModule.renderAll(storageModule.read());
    });
  }

  return { init };
})();

window.addEventListener('DOMContentLoaded', ()=>appModule.init());
