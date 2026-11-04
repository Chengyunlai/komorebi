<script setup>
import { computed, ref, reactive, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Leaf, Plus, ArrowUp, Clipboard, Scan, MessageCircle, BookOpen, ListTodo, Settings2, PanelRightClose, Volume2, VolumeX, Check, X, Search, Copy, Download, Pause, Circle, CircleCheck, AlertCircle, LoaderCircle, FolderOpen, Moon, Pencil, Trash2, ChevronDown, Sparkles, Image, Keyboard, ArrowLeft, RotateCcw } from 'lucide-vue-next'
import Character from './Character.vue'
import MusicFireworks from './MusicFireworks.vue'
import ResultText from './ResultText.vue'
import MusicLyrics from './MusicLyrics.vue'
import MusicPanel from './MusicPanel.vue'
import { handleTaskKeydown } from './task-input'

const api = window.komorebi
const isPet = new URLSearchParams(location.search).get('view') === 'pet'
const isMusic = new URLSearchParams(location.search).get('view') === 'music'
const behaviorState=ref({choice:'default',label:'默认律动'})
const petCharacter=ref(null)
const readEffectAnchors=()=>petCharacter.value?.getEffectAnchors()
const audioState=ref({mode:'off',status:'off',signal:null})
const musicState = ref({status:'idle',title:'',artist:'',lines:[],position:0,rate:0,observedAt:Date.now()})
const isChat = new URLSearchParams(location.search).get('view') === 'chat'
const state = ref({projects:[],tasks:[],notes:[],settings:{}}), page = ref(isChat?'home':'settings'), selectedTask = ref(null)
const showReply = ref(false), pocketSide = ref('right')
let inputComposing = false
const llmForm = reactive({ provider:'codex',baseUrl:'https://ark.cn-beijing.volces.com/api/coding/v3',model:'deepseek-v4-flash',key:'' })
const savingLlm = ref(false)
const drafts = reactive({}), pendingDraft = ref(null), toast = ref(''), submitting = ref(false), query = ref(''), backend = ref(null), showProjectMenu = ref(false)
const noteEditor = ref(null), mimoKey = ref(''), voice = ref('mimo_default'), speechBusy = ref(false), petText = ref('')
let toastTimer, messageTimer, dialogReturnFocus, disposers = []
const project = computed(() => state.value.projects.find(p => p.id === state.value.settings.selectedProject) || state.value.projects[0])
const draft = computed(() => {
  const id = project.value?.id || 'none'
  return drafts[id] ||= { instruction:'', context:'',attachment:null,preview:null,source:'' }
})
const tasks = computed(() => state.value.tasks.filter(t => t.project_id === project.value?.id))
const notes = computed(() => state.value.notes.filter(n => n.project_id === project.value?.id && (!query.value || `${n.title} ${n.content}`.toLowerCase().includes(query.value.toLowerCase()))))
const active = computed(() => state.value.tasks.find(t => ['running','queued'].includes(t.status)))
const task = computed(() => tasks.value.find(t => t.id === selectedTask.value) || tasks.value[0])
function textLines(text, columns = 23) {
  return String(text || '').split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil([...line].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 1 : .55), 0) / columns)), 0)
}
const inputHeight = computed(() => Math.min(84, Math.max(42, textLines(draft.value.instruction) * 21)))
const replyHeight = computed(() => Math.min(242, Math.max(120, 94 + textLines(task.value?.result || task.value?.error || '我来看看。') * 22)))
const pocketHeight = computed(() => noteEditor.value ? 390 : Math.min(440, 128 + inputHeight.value - 42 + (showReply.value && task.value ? replyHeight.value : 0) + (draft.value.context || draft.value.attachment ? 80 : 0) + (pendingDraft.value ? 44 : 0) + (toast.value ? 34 : 0)))
const statusName = s => ({running:'进行中',queued:'排队中',completed:'已完成',failed:'未完成',cancelled:'已取消'}[s] || s)
const heading = computed(() => ({home:'把眼前这件事，交给我吧。',tasks:'一起做过的事。',notes:'留下来，下次还找得到。',settings:'按照你的节奏相处。'}[page.value]))
const subtitle = computed(() => ({home:'一段报错、一张截图，或是刚刚冒出来的想法。',tasks:'进展、结果和需要再试一次的地方，都在这里。',notes:'只有你确认保存的结论，才会成为项目知识。',settings:'连接、声音与陪伴方式，由你决定。'}[page.value]))
const greeting = computed(() => {const h=new Date().getHours();return h<11?'早上好':h<18?'下午好':'晚上好'})
function notify(text) {toast.value=String(text).replace(/^Error invoking remote method '[^']+': Error: /,'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.value='',5000)}
async function attempt(fn) {try{return await fn()}catch(e){notify(e.message);return null}}
function loadDraft(incoming) {
  if (!incoming) return
  showReply.value=false
  if (draft.value.context || draft.value.attachment) {pendingDraft.value=incoming; page.value='home';return}
  Object.assign(draft.value,incoming);page.value='home'
}
function acceptDraft() {Object.assign(draft.value,pendingDraft.value);pendingDraft.value=null}
async function paste() {const value=await attempt(()=>api.clipboard());if(value)loadDraft(value)}
async function capture() {const value=await attempt(()=>api.capture());if(value)loadDraft(value)}
async function submit() {
  if (!draft.value.instruction.trim() || submitting.value) return
  submitting.value=true
  const current = {...draft.value}, projectId=project.value.id
  const result=await attempt(()=>api.submit({projectId,...current}))
  if(result?.kind==='behavior'){drafts[projectId]={instruction:'',context:'',attachment:null,preview:null,source:''};notify(result.state.label+' · Laya');showReply.value=false}
  else if(result){showReply.value=true;selectedTask.value=result.id;page.value='tasks';drafts[projectId]={instruction:'',context:'',attachment:null,preview:null,source:''}}
  submitting.value=false
}
function openTask(t){selectedTask.value=t.id;page.value='tasks'}
async function setProject(id) {await attempt(()=>api.selectProject(id));selectedTask.value=null;pendingDraft.value=null;showProjectMenu.value=false;query.value=''}
async function addProject(){showProjectMenu.value=false;await attempt(()=>api.chooseProject())}
function clearAttachment(){Object.assign(draft.value,{context:'',attachment:null,preview:null,source:''})}
function saveResult() {
  if(!task.value || task.value.status!=='completed')return
  noteEditor.value={projectId:project.value.id,taskId:task.value.id,title:task.value.title,content:task.value.result,source:`任务：${task.value.title} · ${new Date(task.value.created_at).toLocaleDateString('zh-CN')}`}
}
async function saveNote(){const result=await attempt(()=>api.saveNote({...noteEditor.value}));if(result){noteEditor.value=null;notify('结论已留在这个项目里。')}}
async function removeNote(note){await attempt(()=>api.deleteNote(note.id,note.project_id));notify('已删除这条结论。')}
function editNote(note){noteEditor.value={id:note.id,projectId:note.project_id,title:note.title,content:note.content,source:note.source}}
async function copy(text){await attempt(()=>api.copy(text));notify('已复制。')}
async function speak(text){speechBusy.value=true;await attempt(()=>api.speak(text));speechBusy.value=false}
async function saveKey(){const ok=await attempt(async()=>{await api.saveMimoKey(mimoKey.value);return true});if(ok){mimoKey.value='';notify('Key 已加密保存在本机。')}}
async function saveLlm(){
  savingLlm.value=true
  const saved=await attempt(()=>api.saveLlmConfig({...llmForm}))
  if(saved){llmForm.key='';backend.value=await api.diagnostics();notify('模型配置已保存。下一条任务使用新配置。')}
  savingLlm.value=false
}
function date(value){return new Date(value).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function showPetMessage(text) {
  clearTimeout(messageTimer)
  petText.value = typeof text === 'string' ? text.trim() : ''
  if (petText.value) messageTimer = setTimeout(() => { petText.value = '' }, 12000)
}
let pointerGesture = null
async function startPetDrag(event) {
  if(event.button !== 0 || pointerGesture) return
  pointerGesture = { id: event.pointerId, target: event.currentTarget, ready: api.beginPetDrag({ x: event.screenX, y: event.screenY }) }
  event.currentTarget.setPointerCapture(event.pointerId)
}
function movePet(event) {
  if(pointerGesture?.id === event.pointerId) api.movePetDrag({ x: event.screenX, y: event.screenY })
}
async function finishPetDrag(event, cancelled = false) {
  const gesture = pointerGesture
  if(!gesture || gesture.id !== event.pointerId) return
  pointerGesture = null
  await gesture.ready
  if(!cancelled) await api.movePetDrag({ x: event.screenX, y: event.screenY })
  const result = await api.endPetDrag()
  if(gesture.target.hasPointerCapture(event.pointerId)) gesture.target.releasePointerCapture(event.pointerId)
  if(!cancelled && !result?.moved) api.showChat()
}
let lastClickThrough
function mouseMove(event){
  if(!isPet||pointerGesture)return
  const within = selector => {
    const r = document.querySelector(selector)?.getBoundingClientRect()
    return r && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom
  }
  const ignore = !['.pet-interaction','.pet-bubble'].some(within)
  if(ignore!==lastClickThrough){lastClickThrough=ignore;api.setClickThrough(ignore)}
}
function keydown(event){
  if(event.key==='Escape'&&isMusic){api.hideMusic();return}
  if(event.key==='Escape'&&isChat&&!noteEditor.value){api.hideChat();return}
  if(event.key==='Escape'){if(noteEditor.value)noteEditor.value=null;else showProjectMenu.value=false}
  if(event.key==='Tab'&&noteEditor.value){
    const nodes=[...document.querySelectorAll('.note-dialog button:not(:disabled),.note-dialog input,.note-dialog textarea,.pocket-note button:not(:disabled),.pocket-note input,.pocket-note textarea')]
    const first=nodes[0],last=nodes.at(-1)
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
}
onMounted(async()=>{
  if(!api){notify('请从桌面应用启动木漏日。');return}
  state.value=await api.snapshot();voice.value=state.value.settings.voice||'mimo_default'
  Object.assign(llmForm,{provider:state.value.settings.llmProvider||'codex',baseUrl:state.value.settings.llmBaseUrl||llmForm.baseUrl,model:state.value.settings.llmModel||llmForm.model})
  disposers.push(api.on('snapshot',value=>state.value=value),api.on('draft',loadDraft),api.on('pet-message',text=>{if(isChat){notify(text);showReply.value=true}if(isPet)showPetMessage(text)}))
  if(!isPet&&!isChat&&!isMusic)backend.value=await api.diagnostics()
  if(isChat)disposers.push(api.on('chat-side',side=>pocketSide.value=side),api.on('chat-open',async options=>{pocketSide.value=options?.tail||'right';showReply.value=Boolean(options?.revealResult||active.value);await nextTick();document.querySelector('.pocket-input')?.focus()}))
  behaviorState.value=await api.behaviorSnapshot()
  disposers.push(api.on('behavior',value=>behaviorState.value=value))
  musicState.value=await api.musicSnapshot()
  audioState.value=await api.musicAudioSnapshot()
  disposers.push(api.on('music-signal',value=>audioState.value={...value,receivedAt:performance.now()}))
  disposers.push(api.on('music',value=>musicState.value=value))
  document.addEventListener('keydown',keydown)
  if(isPet)document.addEventListener('mousemove',mouseMove)
})
watch(pocketHeight,height=>{if(isChat&&api)api.chatLayout(height)},{immediate:true})
watch(noteEditor,async value=>{if(value){dialogReturnFocus=document.activeElement;await nextTick();document.querySelector('.note-dialog input,.pocket-note input')?.focus()}else{await nextTick();dialogReturnFocus?.focus()}})
onBeforeUnmount(()=>{disposers.forEach(fn=>fn());clearTimeout(toastTimer);clearTimeout(messageTimer);document.removeEventListener('keydown',keydown);document.removeEventListener('mousemove',mouseMove);if(pointerGesture)api.endPetDrag()})
</script>

<template>
  <div v-if="isPet" class="pet-only" :class="{'with-music':Boolean(musicState.title)||audioState.mode==='demo'}">
    <MusicFireworks :read-anchors="readEffectAnchors" :audio="audioState" :enabled="state.settings.musicDance ?? true"/>
    <div v-if="petText" class="pet-bubble" role="status" @click="api.showChat(true)"><span class="tiny-dot" :class="{busy:active}" />{{petText}}</div>
    <div class="pet-interaction" title="拖动移动 · 点击对话 · 右键菜单"
      @pointerdown="startPetDrag" @pointermove="movePet" @pointerup="finishPetDrag($event)"
      @pointercancel="finishPetDrag($event,true)" @lostpointercapture="finishPetDrag($event,true)"
      @contextmenu.prevent="api.petMenu()">
      <Character ref="petCharacter" :active="Boolean(active)" :pet="true" :music="musicState" :audio="audioState" :behavior="behaviorState" :dance-enabled="state.settings.musicDance ?? true" :tempo="state.settings.musicTempo||100" />
    </div>
    <MusicLyrics :audio="audioState" :music="musicState" :enabled="state.settings.musicLyrics ?? true"/>
  </div>

  <MusicPanel v-else-if="isMusic" :music="musicState" :audio="audioState" :behavior="behaviorState"/>

  <section v-else-if="isChat" class="pocket-shell" :data-tail="pocketSide" aria-label="木漏日任务气泡">
    <button class="pocket-close" title="收起 · Esc" @click="api.hideChat()"><X :size="13"/></button>
    <div v-if="showReply && task" class="pocket-body">
      <div class="pocket-reply-head"><span class="pocket-question" :title="task.instruction">{{task.instruction}}</span><button title="收起回复" @click="showReply=false"><ChevronDown :size="14"/></button></div>
      <ResultText v-if="task.result" :text="task.result"/><p v-else-if="['running','queued'].includes(task.status)" class="pocket-hint">我来看看，你可以继续忙。</p><p v-if="task.error" class="pocket-error">{{task.error}}</p><p v-if="task.status==='cancelled'" class="pocket-hint">已停止。</p>
    </div>
    <div v-if="showReply && task" class="pocket-actions"><button v-if="['running','queued'].includes(task.status)" @click="attempt(()=>api.cancel(task.id))"><Pause :size="13"/>停止</button><button v-if="task.result" title="复制回复" @click="copy(task.result)"><Copy :size="13"/></button><button v-if="task.status==='completed'" title="留下结论" @click="saveResult"><BookOpen :size="13"/></button></div>
    <div v-if="pendingDraft" class="pocket-incoming">已有补充内容，保留哪一份？<button @click="acceptDraft">使用新内容</button><button @click="pendingDraft=null">保留原内容</button></div>
    <div v-if="toast" role="status" class="pocket-feedback">{{toast}}</div>
    <div v-if="draft.context||draft.attachment" class="pocket-attachment"><div><Clipboard :size="13"/><span>{{draft.source||'补充内容'}}</span><button title="移除补充内容" @click="clearAttachment"><X :size="13"/></button></div><img v-if="draft.preview" :src="draft.preview" alt="准备交办的截图"/><textarea v-if="draft.context" v-model="draft.context" aria-label="补充资料" maxlength="60000"/></div>
    <form class="pocket-composer" @submit.prevent="submit">
      <textarea v-model="draft.instruction" class="pocket-input" @keydown="handleTaskKeydown($event,submit,inputComposing)" @compositionstart="inputComposing=true" @compositionend="inputComposing=false" :style="{height:inputHeight+'px'}" maxlength="12000" aria-label="交给木漏日的任务" placeholder="想聊什么，或需要我帮忙？"/>
      <div class="pocket-tools">
        <span class="pocket-tool-spacer"/>
        <small v-if="active" class="pocket-working"><span class="tiny-dot busy"/>处理中</small><small v-else class="pocket-shortcut">Enter 发送 · Shift+Enter 换行</small>
        <button v-if="active" class="pocket-stop" type="button" title="停止任务" @click="attempt(()=>api.cancel(active.id))"><Pause :size="13"/></button>
        <button v-else class="pocket-send" type="submit" title="发送任务" :disabled="!draft.instruction.trim()||submitting"><LoaderCircle v-if="submitting" :size="15" class="spin"/><ArrowUp v-else :size="15"/></button>
      </div>
    </form>

    <div v-if="noteEditor" class="pocket-note" role="dialog" aria-modal="true" aria-label="确认项目结论"><form @submit.prevent="saveNote"><div><strong>留下这条结论</strong><button type="button" title="取消保存" @click="noteEditor=null"><X :size="16"/></button></div><input v-model="noteEditor.title" aria-label="结论标题" required maxlength="200"/><textarea v-model="noteEditor.content" aria-label="结论内容" required maxlength="120000"/><button class="primary" type="submit">确认保存</button></form></div>
  </section>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-symbol"><Leaf :size="21" stroke-width="1.6" /></div><div><strong>木漏日</strong><span>KOMOREBI</span></div></div>
      <div class="sidebar-label">配置与管理</div>
      <nav aria-label="主导航">

        <button :class="{selected:page==='tasks'}" @click="page='tasks'"><ListTodo :size="18" />一起做的事<span v-if="active" class="nav-count">1</span></button>
        <button :class="{selected:page==='notes'}" @click="page='notes'"><BookOpen :size="18" />项目记忆<span v-if="state.notes.length" class="nav-count">{{state.notes.length}}</span></button>
      </nav>
      <div class="sidebar-note"><span class="note-line"/><p>一点一点，<br/>把灵感变成日常。</p><span class="small-leaf"><Leaf :size="23" stroke-width="1"/></span></div>
      <div class="sidebar-bottom">
        <button class="focus-toggle" :class="{enabled:state.settings.focus}" @click="attempt(()=>api.setting('focus',!state.settings.focus))"><Moon :size="17"/><span>专心一会儿</span><span class="switch" :class="{on:state.settings.focus}"/></button>
        <button class="settings-nav" :class="{selected:page==='settings'}" @click="page='settings'"><Settings2 :size="17"/> 偏好设置</button>
        <div class="local-indicator"><span class="tiny-dot"/> 记忆留在你的电脑里</div>
      </div>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div class="project-selector">
          <button class="project-button" :aria-expanded="showProjectMenu" @click="showProjectMenu=!showProjectMenu"><FolderOpen :size="16"/><span>{{project?.name || '选择项目'}}</span><ChevronDown :size="14"/></button>
          <div v-if="showProjectMenu" class="project-menu">
            <div class="menu-caption">项目记忆独立保存</div>
            <button v-for="p in state.projects" :key="p.id" @click="setProject(p.id)"><span>{{p.name}}</span><Check v-if="p.id===project?.id" :size="15"/></button>
            <button class="menu-add" @click="addProject"><Plus :size="15"/>选择另一个项目文件夹</button>
          </div>
        </div>
        <div class="topbar-right"><span class="connection"><span class="tiny-dot" :class="{offline:!backend?.loggedIn}"/>{{backend?.loggedIn?(backend.provider==='volcengine'?'火山已配置':'Codex 已连接'):backend===null?'正在连接…':'后端待连接'}}</span><button class="icon-button" title="隐藏面板，伙伴继续陪伴" @click="api.hideBoard()"><PanelRightClose :size="18"/></button></div>
      </header>

      <main>
        <div class="page-intro"><div class="eyebrow">{{page==='home'?`${greeting}，今天也一起。`:'KOMOREBI / '+({tasks:'ACTIVITY',notes:'MEMORY',settings:'PREFERENCES'}[page])}}</div><h1>{{heading}}</h1><p>{{subtitle}}</p></div>

        <div v-if="page==='tasks'" class="tasks-layout">
          <div v-if="!tasks.length" class="full-empty"><ListTodo :size="35" stroke-width="1"/><h2>从一件小事开始。</h2><p>你交给我的任务，会连同结果一起保留。</p><button class="primary" @click="api.showChat()">和伙伴说说</button></div>
          <template v-else><aside class="task-list"><button v-for="t in tasks" :key="t.id" :class="{chosen:task?.id===t.id}" @click="selectedTask=t.id"><span class="task-status" :class="t.status">{{statusName(t.status)}}</span><strong>{{t.title}}</strong><small>{{date(t.created_at)}}</small></button></aside><article v-if="task" class="task-detail"><div class="detail-top"><span class="task-status" :class="task.status">{{statusName(task.status)}}</span><span v-if="task.stage!==statusName(task.status)">{{task.stage}}</span><button v-if="task.status==='running'" class="quiet-button" @click="attempt(()=>api.cancel(task.id))"><Pause :size="14"/>停止</button></div><h2>{{task.title}}</h2><p v-if="task.context" class="task-context">{{task.context.slice(0,600)}}{{task.context.length>600?'…':''}}</p><div v-if="task.status==='running'&&!task.result" class="thinking"><span class="thinking-orbit"/><p>我正在看看这个问题。<br/><small>你可以继续做别的事。</small></p></div><ResultText v-if="task.result" :text="task.result"/><div v-if="task.error" class="error-card"><AlertCircle :size="18"/><div><strong>这次还没有完成。</strong><p>{{task.error}}</p></div></div><div v-if="task.status==='cancelled'" class="cancelled-card">已经停下来了，部分结果供你参考。</div><div class="result-actions"><button v-if="task.result" @click="copy(task.result)"><Copy :size="15"/>复制结果</button><button v-if="task.status==='completed'" @click="saveResult"><BookOpen :size="15"/>保存为项目结论</button><button v-if="task.status==='completed'" :disabled="speechBusy" @click="speak('这件事处理好了，结果已经放在面板里。')"><Volume2 :size="15"/>播报</button><button v-if="['failed','cancelled'].includes(task.status)" @click="Object.assign(draft,{instruction:task.instruction,context:task.context,attachment:task.attachment});page='home'"><RotateCcw :size="15"/>重新交办</button></div></article></template>
        </div>

        <section v-if="page==='notes'" class="memory-section"><div class="memory-toolbar"><label class="search-box"><Search :size="17"/><input v-model="query" placeholder="找一条结论，或一个关键词" aria-label="搜索项目记忆"/><button v-if="query" @click="query=''"><X :size="14"/></button></label><button class="quiet-button" @click="noteEditor={projectId:project.id,title:'',content:'',source:'手动保存'}"><Plus :size="16"/>记一条</button><button class="quiet-button" @click="attempt(async()=>{const p=await api.exportNotes(project.id);if(p)notify('已导出 Markdown。')})"><Download :size="16"/>导出</button></div><div v-if="!notes.length" class="full-empty"><BookOpen :size="35" stroke-width="1"/><h2>{{query?'还没有找到这条结论。':'让有用的结论留下来。'}}</h2><p>{{query?'试试更短的关键词，或查看另一个项目。':'任务完成后，点击“保存为项目结论”。你也可以手动记一条。'}}</p></div><div class="note-grid"><article v-for="n in notes" :key="n.id" class="memory-card"><div class="memory-card-top"><span class="confirmed"><Check :size="12"/>你确认的结论</span><span>{{date(n.updated_at)}}</span></div><h2>{{n.title}}</h2><pre>{{n.content}}</pre><div class="memory-source">{{n.source}}</div><div class="note-actions"><button @click="editNote(n)"><Pencil :size="14"/>修改</button><button @click="copy(n.content)"><Copy :size="14"/>复制</button><button class="delete-note" @click="removeNote(n)"><Trash2 :size="14"/>删除</button></div></article></div></section>

        <section v-if="page==='settings'" class="settings-section">
          <div class="settings-group"><h2>桌面气泡</h2><div class="settings-row"><div><strong>点击气泡外自动收起</strong><p>切换到其他窗口或点击桌面时收起气泡，草稿保留，任务继续运行。</p></div><button class="setting-switch" role="switch" aria-label="点击气泡外自动收起" :aria-checked="state.settings.dismissOnBlur ?? true" @click="attempt(()=>api.setting('dismissOnBlur',!(state.settings.dismissOnBlur ?? true)))"><span class="switch" :class="{on:state.settings.dismissOnBlur ?? true}"/></button></div><p class="setting-caption">默认开启。关闭后，可以按 Esc 或点击气泡右上角收起。</p></div>
          <div class="settings-group"><h2>音乐陪伴</h2><div v-for="option in [{key:'musicEnabled',label:'跟随网易云音乐',desc:'使用正在播放的客户端，不需要再次登录。'},{key:'musicDance',label:'人物随播放律动',desc:'身体、头部与手臂分层律动；暂停时平滑收势。'},{key:'musicLyrics',label:'脚下显示同步歌词',desc:'向网易云查询当前歌曲歌词，不把播放记录交给 LLM。'}]" :key="option.key" class="settings-row"><div><strong>{{option.label}}</strong><p>{{option.desc}}</p></div><button class="setting-switch" role="switch" :aria-label="option.label" :aria-checked="state.settings[option.key] ?? true" @click="attempt(()=>api.setting(option.key,!(state.settings[option.key] ?? true)))"><span class="switch" :class="{on:state.settings[option.key] ?? true}"/></button></div><div class="music-settings-actions"><button class="quiet-button" @click="api.showMusic()">打开音乐入口</button><button class="quiet-button" :disabled="musicState.status==='playing'&&!musicState.preview" @click="attempt(()=>api.musicPreview(!musicState.preview))">{{musicState.preview?'结束效果预览':'预览人物与歌词'}}</button><span>{{musicState.preview?'效果预览 · 没有音频':musicState.status==='playing'?'正在跟随网易云':musicState.status==='paused'?'网易云已暂停':'等待网易云播放'}}</span></div><label class="music-tempo">律动节奏<input type="range" min="60" max="160" step="5" :value="state.settings.musicTempo||100" aria-label="律动节奏" @change="attempt(()=>api.setting('musicTempo',Number($event.target.value)))"/><span>舒缓到轻快</span></label><p class="setting-caption">音乐入口可开启网易云真实音频跟拍，首次需要系统授权；默认保留轻柔听歌动作。音频仅在本机分析，不保存或上传。遵循系统减少动态效果。</p></div>
          <div class="settings-group llm-settings"><h2>对话与任务模型</h2><form @submit.prevent="saveLlm"><div class="llm-provider-options"><button type="button" :class="{chosen:llmForm.provider==='codex'}" @click="llmForm.provider='codex'">Codex 默认模型</button><button type="button" :class="{chosen:llmForm.provider==='volcengine'}" @click="llmForm.provider='volcengine'">火山引擎</button></div><template v-if="llmForm.provider==='volcengine'"><label>Base URL<input v-model="llmForm.baseUrl" type="url" required aria-label="火山引擎 Base URL" spellcheck="false"/></label><label>模型名称<input v-model="llmForm.model" required aria-label="火山引擎模型名称" spellcheck="false"/></label><label>API Key <span>{{state.settings.hasLlmKey?'已加密保存，留空沿用':'尚未配置'}}</span><input v-model="llmForm.key" type="password" autocomplete="off" aria-label="火山引擎 API Key" :placeholder="state.settings.hasLlmKey?'留空沿用已保存的 Key':'填写你的火山引擎 API Key'"/></label><p class="setting-caption">使用 Responses 协议，经本机 Codex CLI 执行只读任务。Coding Plan 地址用于编程任务，不会自动切换到按量计费地址。</p></template><div class="llm-settings-footer"><span>{{state.settings.llmProvider==='volcengine'?state.settings.llmModel:'当前使用 Codex 默认模型'}}</span><button class="primary" type="submit" :disabled="savingLlm||Boolean(active)">{{savingLlm?'正在保存':'保存模型配置'}}</button></div></form></div>
          <div class="settings-group"><h2>任务执行与项目</h2><div class="settings-row"><div><strong>Codex CLI</strong><p>{{state.settings.llmProvider==='volcengine'?'负责执行只读任务，模型请求发往火山引擎，无需 ChatGPT 登录。':backend?.loggedIn?'使用本机 Codex 登录与默认模型，执行只读分析。':'请先在终端完成 codex login。'}}</p><code v-if="backend">{{backend.path}}</code></div><button class="quiet-button" @click="attempt(async()=>{await api.chooseBackend();backend=await api.diagnostics()})">选择程序</button></div><div class="settings-row"><div><strong>当前项目</strong><p>{{project?.path}}</p></div><button class="quiet-button" @click="addProject">选择文件夹</button></div></div>
          <div class="settings-group"><h2>想听见我的声音吗</h2><div class="voice-options"><button v-for="option in [{id:'off',title:'安静陪伴',desc:'只显示文字'},{id:'system',title:'系统语音',desc:'本机朗读，无需 Key'},{id:'mimo',title:'小米 MiMo',desc:'自然语音，需要 API Key'}]" :key="option.id" :class="{chosen:state.settings.speech===option.id}" @click="attempt(()=>api.setting('speech',option.id))"><VolumeX v-if="option.id==='off'" :size="20"/><Volume2 v-else :size="20"/><strong>{{option.title}}</strong><span>{{option.desc}}</span><Check v-if="state.settings.speech===option.id" :size="14" class="option-check"/></button></div><div v-if="state.settings.speech==='mimo'" class="mimo-settings"><label>MiMo API Key <span>{{state.settings.hasMimoKey?'已加密保存':'尚未配置'}}</span><div><input v-model="mimoKey" type="password" autocomplete="off" placeholder="粘贴 Key，仅加密保存于本机"/><button class="quiet-button" :disabled="!mimoKey.trim()" @click="saveKey">保存</button></div></label><label>音色 ID<div><input v-model="voice" placeholder="mimo_default"/><button class="quiet-button" @click="attempt(()=>api.setting('voice',voice))">应用</button></div></label><p>使用 mimo-v2.5-tts。官方目前限时免费，实际额度以你的账号为准。</p></div><div class="speech-test"><button class="quiet-button" :disabled="speechBusy||state.settings.speech==='off'" @click="speak('我在这里，陪你把眼前这一件事慢慢做好。')"><LoaderCircle v-if="speechBusy" :size="15" class="spin"/><Volume2 v-else :size="15"/>试着说一句</button><span>专注模式下不自动播报；手动测试仍可播放。</span></div></div>
          <div class="settings-group"><h2>桌面角色</h2><div class="settings-row"><div><strong>VRM 全身伙伴</strong><p>已内置千驮谷筱（pixiv，CC0）；也可导入有使用许可的 .vrm。</p></div><button @click="api.importAvatar().then(result=>result&&notify('角色已导入，桌宠正在重新加载')).catch(e=>notify(e.message))">导入角色</button></div></div><div class="settings-group"><h2>随手就能找到我</h2><div class="shortcut-row"><span>带上剪贴板，在伙伴身边聊聊</span><kbd>⌥ Space</kbd></div><div class="shortcut-row"><span>框选一部分屏幕</span><kbd>⌥ ⇧ S</kbd></div><div class="shortcut-row"><span>显示 / 隐藏桌面伙伴</span><kbd>⌥ ⇧ H</kbd></div><div class="shortcut-row"><span>发送任务 / 输入换行</span><kbd>Enter / Shift+Enter</kbd></div></div><p class="about-line">木漏日 0.2 · 默认角色：千驮谷筱 / pixiv · CC0</p>
        </section>
      </main>
      <footer class="app-footer"><span><Leaf :size="12"/>一点陪伴，一起前进。</span><span>{{project?.name}}<span class="footer-dot">·</span>{{tasks.length}} 件事<span class="footer-dot">·</span>{{state.notes.filter(n=>n.project_id===project?.id).length}} 条结论</span></footer>
    </section>
    <div v-if="toast" role="status" class="toast"><Check :size="16"/>{{toast}}</div>
    <div v-if="noteEditor" class="modal-backdrop" @click.self="noteEditor=null"><form role="dialog" aria-modal="true" aria-labelledby="note-title" class="note-dialog" @submit.prevent="saveNote"><div class="dialog-heading"><div><span class="eyebrow">KEEP SOMETHING GOOD</span><h2 id="note-title">把这条结论留下来。</h2></div><button type="button" title="关闭" @click="noteEditor=null"><X :size="19"/></button></div><p>确认内容准确后保存。它会作为当前项目的参考资料。</p><label>标题<input v-model="noteEditor.title" maxlength="200" required/></label><label>结论<textarea v-model="noteEditor.content" maxlength="120000" required/></label><div class="dialog-footer"><span><FolderOpen :size="14"/>{{project?.name}}</span><button class="primary" type="submit" :disabled="!noteEditor.title.trim()||!noteEditor.content.trim()"><Check :size="16"/>确认保存</button></div></form></div>
  </div>
</template>
