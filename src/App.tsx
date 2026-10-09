import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ChildHome from './features/child/ChildHome.tsx'
import ParentArea from './features/parent/ParentArea.tsx'
import ProfilePicker from './features/profiles/ProfilePicker.tsx'
import { AppStoreContext, type AppStore } from './store/appStore.ts'

/** Routes and store wiring. The caller supplies the router so tests can use an in-memory one. */
export default function App({ store }: { store: AppStore }) {
  useEffect(() => {
    void store.getState().load()
  }, [store])

  return (
    <AppStoreContext.Provider value={store}>
      <main>
        <Routes>
          <Route path="/" element={<ProfilePicker />} />
          <Route path="/child/:childId" element={<ChildHome />} />
          <Route path="/parent" element={<ParentArea />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </AppStoreContext.Provider>
  )
}
