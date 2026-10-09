import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ContentContext } from './content/context.ts'
import type { ContentBundle } from './content/schema.ts'
import ChildHome from './features/child/ChildHome.tsx'
import LessonPage from './features/child/LessonPage.tsx'
import ParentArea from './features/parent/ParentArea.tsx'
import ProfilePicker from './features/profiles/ProfilePicker.tsx'
import { AppStoreContext, type AppStore } from './store/appStore.ts'

/** Routes and store wiring. The caller supplies the router so tests can use an in-memory one. */
export default function App({ store, content }: { store: AppStore; content: ContentBundle }) {
  useEffect(() => {
    void store.getState().load()
  }, [store])

  return (
    <AppStoreContext.Provider value={store}>
      <ContentContext.Provider value={content}>
        <main>
          <Routes>
            <Route path="/" element={<ProfilePicker />} />
            <Route path="/child/:childId" element={<ChildHome />} />
            <Route path="/child/:childId/lesson/:lessonId" element={<LessonPage />} />
            <Route path="/parent" element={<ParentArea />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </ContentContext.Provider>
    </AppStoreContext.Provider>
  )
}
