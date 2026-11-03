// Enter confirms a task only after text composition has finished.
export function handleTaskKeydown(event, submit, composing = false) {
  if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.isComposing || composing || event.keyCode === 229) return
  event.preventDefault()
  event.stopPropagation()
  if (!event.repeat) submit()
}
