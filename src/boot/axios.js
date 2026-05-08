import { boot } from 'quasar/wrappers'
import axios from 'axios'

const api = axios.create({
  baseURL: '/backend',
  headers: {
    Accept: 'application/json'
  }
})

export { api }

export default boot(({ app }) => {
  app.config.globalProperties.$api = api
})