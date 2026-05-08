import { boot } from 'quasar/wrappers'
import { db, storage } from 'src/firebase/config'

export default boot(({ app }) => {
  app.config.globalProperties.$db = db
})