import { defineStore } from 'pinia'
import api from '../api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null') as any,
  }),
  getters: {
    role: (s) => s.user?.role || '',
    isLogged: (s) => !!s.user,
  },
  actions: {
    async login(username: string, password: string) {
      const res: any = await api.post('/auth/login', { username, password })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      this.user = res.user
    },
    logout() {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      this.user = null
    },
  },
})
