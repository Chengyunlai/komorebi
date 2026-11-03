const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');

class Store {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,path TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),
        title TEXT NOT NULL,instruction TEXT NOT NULL,context TEXT NOT NULL,attachment TEXT,
        status TEXT NOT NULL,stage TEXT NOT NULL,result TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),
        task_id TEXT REFERENCES tasks(id),title TEXT NOT NULL,content TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
    this.db.prepare("UPDATE tasks SET status='failed',stage='上次执行已中断',error='应用在任务完成前退出，请重新提交。' WHERE status IN ('queued','running')").run();
  }
  close() { this.db.close(); }
  setting(key, fallback = null) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key);
    return row ? JSON.parse(row.value) : fallback;
  }
  setSetting(key, value) {
    this.db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));
  }
  addProject(name, path) {
    const existing = this.db.prepare('SELECT * FROM projects WHERE path=?').get(path);
    if (existing) return existing;
    const project = { id: randomUUID(), name: name.trim() || '未命名项目', path };
    this.db.prepare('INSERT INTO projects VALUES (?,?,?)').run(project.id, project.name, project.path);
    return project;
  }
  project(id) {
    const project = this.db.prepare('SELECT * FROM projects WHERE id=?').get(id);
    if (!project) throw new Error('请选择一个有效项目。');
    return project;
  }
  createTask(input) {
    this.project(input.projectId);
    const instruction = String(input.instruction || '').trim();
    const context = String(input.context || '').trim();
    if (!instruction) throw new Error('写一句你想交给我的事吧。');
    if (instruction.length > 12000 || context.length > 60000) throw new Error('内容太长，请缩小到当前问题。');
    const task = { id: randomUUID(), project_id: input.projectId,
      title: instruction.slice(0, 56), instruction, context, attachment: input.attachment || null,
      status: 'queued', stage: '准备交办', result: '', error: '', created_at: new Date().toISOString() };
    this.db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(...Object.values(task));
    return task;
  }
  task(id) {
    const task = this.db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
    if (!task) throw new Error('这条任务不存在。');
    return task;
  }
  updateTask(id, patch) {
    const allowed = ['status', 'stage', 'result', 'error'];
    const keys = Object.keys(patch);
    if (!keys.length || keys.some(key => !allowed.includes(key))) throw new Error('无效的任务更新。');
    this.db.prepare(`UPDATE tasks SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).run(...keys.map(k => patch[k]), id);
    return this.task(id);
  }
  saveNote(input) {
    this.project(input.projectId);
    const content = String(input.content || '').trim();
    const title = String(input.title || '').trim();
    if (!content || !title) throw new Error('结论需要标题和正文。');
    if (content.length > 120000 || title.length > 200) throw new Error('结论过长，请精简后保存。');
    if (input.taskId) {
      const task = this.task(input.taskId);
      if (task.project_id !== input.projectId) throw new Error('任务和结论必须属于同一个项目。');
      if (task.status !== 'completed') throw new Error('任务完成后才能保存为结论。');
    }
    const now = new Date().toISOString();
    if (input.id) {
      const old = this.db.prepare('SELECT * FROM notes WHERE id=? AND project_id=?').get(input.id, input.projectId);
      if (!old) throw new Error('这条结论不属于当前项目。');
      this.db.prepare('UPDATE notes SET title=?,content=?,updated_at=? WHERE id=?').run(title, content, now, input.id);
      return { ...old, title, content, updated_at: now };
    }
    const note = { id: randomUUID(), project_id: input.projectId, task_id: input.taskId || null,
      title, content, source: input.source || '手动保存', created_at: now, updated_at: now };
    this.db.prepare('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?)').run(...Object.values(note));
    return note;
  }
  notes(projectId, query = '') {
    this.project(projectId);
    const escaped = String(query).replace(/[\\%_]/g, '\\$&');
    return this.db.prepare("SELECT * FROM notes WHERE project_id=? AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\') ORDER BY updated_at DESC")
      .all(projectId, `%${escaped}%`, `%${escaped}%`);
  }
  deleteNote(id, projectId) {
    this.db.prepare('DELETE FROM notes WHERE id=? AND project_id=?').run(id, projectId);
  }
  snapshot() {
    return { projects: this.db.prepare('SELECT * FROM projects ORDER BY rowid').all(),
      tasks: this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 100').all(),
      notes: this.db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all(),
      settings: { selectedProject: this.setting('selectedProject'), focus: this.setting('focus', false), dismissOnBlur: this.setting('dismissOnBlur', true),
        musicEnabled:this.setting('musicEnabled',true),musicLyrics:this.setting('musicLyrics',true),musicDance:this.setting('musicDance',true),musicTempo:this.setting('musicTempo',100),
        speech: this.setting('speech', 'off'), voice: this.setting('voice', 'mimo_default'),
        llmProvider: this.setting('llmProvider', 'codex'), llmBaseUrl: this.setting('llmBaseUrl', 'https://ark.cn-beijing.volces.com/api/coding/v3'), llmModel: this.setting('llmModel', 'deepseek-v4-flash'), hasLlmKey: Boolean(this.setting('llmKey')),
        hasMimoKey: Boolean(this.setting('mimoKey')), petVisible: this.setting('petVisible', true) } };
  }
}

module.exports = { Store };
