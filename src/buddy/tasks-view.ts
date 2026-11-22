import {
  TASK_LIMIT,
  TASK_TITLE_LIMIT,
  SNOOZE_MS,
  createTask,
  taskTitle,
  type FocusTask,
} from '../engine/tasks';
import { button, element } from './dom';

export interface TaskControls {
  save(tasks: FocusTask[]): Promise<boolean>;
  start(id: string): boolean;
}

const reminderDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function localDateValue(timestamp: number): string {
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function tasksView(controls: TaskControls, back: () => void) {
  const section = element('div', 'pocket-tasks');
  section.id = 'pocket-tasks';
  section.hidden = true;
  const heading = element('div', 'task-heading');
  const backButton = button('‹ Timer', 'task-button');
  backButton.addEventListener('click', back);
  const title = element('h2', '', 'Tasks');
  const count = element('span', 'task-count');
  heading.append(title, count, backButton);

  const form = element('form', 'task-form');
  const input = element('input', 'task-input');
  input.placeholder = 'Add a task…';
  input.setAttribute('aria-label', 'New task');
  input.maxLength = TASK_TITLE_LIMIT;
  input.required = true;
  const add = button('Add', 'task-button');
  add.type = 'submit';
  form.append(input, add);

  const notice = element('div', 'task-notice');
  const message = element('p');
  message.setAttribute('role', 'status');
  const retry = button('Retry', 'task-button');
  notice.append(message, retry);
  notice.hidden = true;
  retry.hidden = true;

  const reminders = element('div', 'due-reminders');
  reminders.id = 'task-reminders';
  reminders.hidden = true;
  const editor = element('form', 'reminder-editor');
  editor.hidden = true;
  const reminderTitle = element('p', 'reminder-task-title');
  const reminderInput = element('input', 'task-input');
  reminderInput.type = 'datetime-local';
  reminderInput.required = true;
  reminderInput.setAttribute('aria-label', 'Reminder date and time');
  const editorActions = element('div', 'reminder-actions');
  const reminderSave = button('Set reminder', 'task-button');
  reminderSave.type = 'submit';
  const reminderClear = button('Clear', 'task-button');
  const reminderCancel = button('Cancel', 'task-button');
  editorActions.append(reminderSave, reminderClear, reminderCancel);
  editor.append(reminderTitle, reminderInput, editorActions);

  const open = element('ul', 'task-list');
  open.setAttribute('aria-label', 'Open tasks');
  const empty = element('p', 'task-empty', 'No open tasks.');
  const done = element('details', 'task-completed');
  const summary = element('summary');
  const finished = element('ul', 'task-list');
  finished.setAttribute('aria-label', 'Completed tasks');
  done.append(summary, finished);
  section.append(heading, notice, reminders, editor, form, open, empty, done);

  let tasks: FocusTask[] = [];
  let current: string | null = null;
  let canStart = true;
  let readOnly = false;
  let busy = false;
  let failed = false;
  let due: FocusTask[] = [];
  let editing: string | null = null;

  function render() {
    const pending = tasks.filter((task) => !task.done);
    const completed = tasks.filter((task) => task.done);
    count.textContent = `${pending.length} open`;
    open.hidden = pending.length === 0;
    empty.hidden = pending.length !== 0;
    done.hidden = completed.length === 0;
    summary.textContent = `Completed (${completed.length})`;
    input.disabled = readOnly;
    add.disabled =
      busy || readOnly || tasks.length >= TASK_LIMIT || !taskTitle(input.value);
    retry.hidden = !failed || readOnly;
    retry.disabled = busy;
    message.textContent = readOnly
      ? 'Tasks are read-only because the save could not be loaded.'
      : failed
        ? 'Task changes could not be saved.'
        : tasks.length >= TASK_LIMIT
          ? 'Task list full. Remove a completed task to add another.'
          : '';
    notice.hidden = !message.textContent;
    reminders.hidden = due.length === 0;
    editor.hidden = editing === null;
    reminderSave.disabled = busy || readOnly;
    reminderClear.disabled = busy || readOnly;

    const focused = document.activeElement as HTMLElement | null;
    const focusKey = focused?.dataset.taskControl;
    open.replaceChildren(...pending.map(row));
    finished.replaceChildren(...completed.map(row));
    reminders.replaceChildren(...due.map(reminderRow));
    if (focusKey && !focused?.isConnected) {
      const replacement = [
        ...section.querySelectorAll<HTMLElement>('[data-task-control]'),
      ].find(
        (control) =>
          control.dataset.taskControl === focusKey &&
          control.getClientRects().length,
      );
      if (replacement && !replacement.matches(':disabled'))
        replacement.focus({ preventScroll: true });
      else if (!section.hidden && !input.disabled && !busy)
        input.focus({ preventScroll: true });
    }
  }

  function reminderRow(task: FocusTask) {
    const card = element('article', 'task-reminder');
    const text = element('p', 'reminder-task-title', task.title);
    const actions = element('div', 'reminder-actions');
    const snooze = button('Snooze 10m', 'task-button');
    const dismiss = button('Dismiss', 'task-button');
    snooze.disabled = dismiss.disabled = busy || readOnly;
    snooze.setAttribute('aria-label', `Snooze ${task.title} for 10 minutes`);
    dismiss.setAttribute('aria-label', `Dismiss reminder for ${task.title}`);
    snooze.addEventListener(
      'click',
      () => void setReminder(task.id, Date.now() + SNOOZE_MS),
    );
    dismiss.addEventListener('click', () => void setReminder(task.id, null));
    actions.append(snooze, dismiss);
    card.append(
      element('strong', 'reminder-caption', 'Reminder'),
      text,
      actions,
    );
    return card;
  }

  function row(task: FocusTask) {
    const item = element('li', 'task-row');
    item.classList.toggle('is-current', task.id === current);
    item.classList.toggle('is-completed', task.done);
    const label = element('label', 'task-label');
    const check = element('input');
    check.type = 'checkbox';
    check.checked = task.done;
    check.disabled = busy || readOnly;
    check.dataset.taskControl = `done-${task.id}`;
    check.addEventListener('change', () => {
      void save(
        tasks.map((entry) =>
          entry.id === task.id
            ? { ...entry, done: check.checked, remindAt: null }
            : entry,
        ),
      );
    });
    const text = element('span', 'task-copy');
    text.append(element('span', 'task-title', task.title));
    if (task.id === current || task.sessions)
      text.append(
        element(
          'small',
          '',
          task.id === current
            ? 'In focus'
            : `${task.sessions} focus session${task.sessions === 1 ? '' : 's'}`,
        ),
      );
    if (task.remindAt !== null) {
      const time = element('time', '', reminderDate.format(task.remindAt));
      time.dateTime = new Date(task.remindAt).toISOString();
      text.append(time);
    }
    label.append(check, text);
    item.append(label);
    if (task.done) {
      const remove = button('Remove', 'task-button');
      remove.disabled = busy || readOnly || task.id === current;
      remove.dataset.taskControl = `remove-${task.id}`;
      remove.setAttribute('aria-label', `Remove completed task: ${task.title}`);
      remove.addEventListener(
        'click',
        () => void save(tasks.filter((entry) => entry.id !== task.id)),
      );
      item.append(remove);
    } else {
      const focus = button('Focus', 'task-button task-focus-button');
      focus.disabled = !canStart;
      focus.dataset.taskControl = `focus-${task.id}`;
      focus.title = canStart
        ? 'Start a 25-minute focus session'
        : 'A focus session or break is already open';
      focus.setAttribute('aria-label', `Focus on ${task.title}`);
      focus.addEventListener('click', () => {
        if (controls.start(task.id)) back();
      });
      const remind = button(
        task.remindAt === null ? 'Remind' : 'Reminder',
        'task-button',
      );
      remind.disabled = busy || readOnly;
      remind.dataset.taskControl = `reminder-${task.id}`;
      remind.setAttribute('aria-label', `Set reminder for ${task.title}`);
      remind.addEventListener('click', () => {
        editing = task.id;
        reminderTitle.textContent = task.title;
        reminderInput.min = localDateValue(Date.now() + 60_000);
        reminderInput.value =
          task.remindAt !== null && task.remindAt > Date.now()
            ? localDateValue(task.remindAt)
            : localDateValue(Date.now() + 30 * 60_000);
        reminderClear.hidden = task.remindAt === null;
        editor.hidden = false;
        reminderInput.focus();
      });
      const actions = element('div', 'task-row-actions');
      actions.append(focus, remind);
      item.append(actions);
    }
    return item;
  }

  async function save(next: FocusTask[]) {
    if (busy || readOnly) return false;
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset
      .taskControl;
    busy = true;
    try {
      failed = !(await controls.save(next));
    } catch {
      failed = true;
    } finally {
      busy = false;
      render();
      if (
        focusKey &&
        document.activeElement === document.body &&
        !section.hidden
      )
        input.focus({ preventScroll: true });
    }
    return !failed;
  }

  function closeEditor() {
    const button = editing
      ? section.querySelector<HTMLButtonElement>(
          `[data-task-control="reminder-${editing}"]`,
        )
      : null;
    editing = null;
    editor.hidden = true;
    (button ?? input).focus({ preventScroll: true });
  }

  function setReminder(id: string, remindAt: number | null) {
    closeEditor();
    return save(
      tasks.map((task) => (task.id === id ? { ...task, remindAt } : task)),
    );
  }

  async function addFromText(text: string) {
    if (readOnly) throw new Error('Tasks are read-only.');
    if (tasks.length >= TASK_LIMIT)
      throw new Error('Task list full. Remove a completed task first.');
    if (busy) throw new Error('Ember is still saving a task. Try again.');
    const task = createTask(text);
    if (!task.title) throw new Error('Add some text for the task.');
    return save([...tasks, task]);
  }

  reminderInput.addEventListener('input', () =>
    reminderInput.setCustomValidity(''),
  );
  reminderCancel.addEventListener('click', closeEditor);
  reminderClear.addEventListener('click', () => {
    if (editing) void setReminder(editing, null);
  });
  editor.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!editing) return;
    const at = new Date(reminderInput.value).getTime();
    if (!Number.isFinite(at) || at <= Date.now()) {
      reminderInput.setCustomValidity('Choose a future time.');
      reminderInput.reportValidity();
      return;
    }
    void setReminder(editing, at);
  });
  input.addEventListener('input', () => {
    add.disabled =
      busy || readOnly || tasks.length >= TASK_LIMIT || !taskTitle(input.value);
  });
  retry.addEventListener('click', () => void save(tasks));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = taskTitle(input.value);
    if (!title || busy || readOnly || tasks.length >= TASK_LIMIT) return;
    input.value = '';
    void addFromText(title).catch((error) => {
      message.textContent = String(error);
      notice.hidden = false;
    });
    input.focus();
  });

  render();
  return {
    section,
    addFromText,
    focus: (showDue = false) => {
      if (showDue && !reminders.hidden) {
        reminders.querySelector('button')?.focus({ preventScroll: true });
      } else {
        (input.disabled ? backButton : input).focus();
      }
    },
    update(
      next: FocusTask[],
      active: string | null,
      ready: boolean,
      locked: boolean,
      dueNow: FocusTask[],
    ) {
      if (
        tasks === next &&
        current === active &&
        canStart === ready &&
        readOnly === locked &&
        due.length === dueNow.length &&
        due.every((task, index) => task === dueNow[index])
      )
        return;
      tasks = next;
      current = active;
      canStart = ready;
      readOnly = locked;
      due = dueNow;
      render();
    },
  };
}
