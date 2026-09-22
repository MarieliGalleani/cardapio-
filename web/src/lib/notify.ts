import { reactive } from 'vue'

// Aviso rápido (snackbar) usado por todo o painel
export const toast = reactive({ show: false, text: '', color: 'success' })

export function notify(text: string, color: 'success' | 'error' | 'warning' = 'success') {
  Object.assign(toast, { show: true, text, color })
}

export function notifyError(e: unknown) {
  notify(e instanceof Error ? e.message : 'Algo deu errado', 'error')
}
