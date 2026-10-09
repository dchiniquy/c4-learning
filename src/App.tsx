import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ContentSourceProvider } from './content/GradeContent.tsx'
import type { ContentSource } from './content/source.ts'
import ChildHome from './features/child/ChildHome.tsx'
import LessonPage from './features/child/LessonPage.tsx'
import ParentArea, { ParentGate } from './features/parent/ParentArea.tsx'
import ProgressReport from './features/parent/ProgressReport.tsx'
import ProfilePicker from './features/profiles/ProfilePicker.tsx'
import { AppStoreContext, type AppStore } from './store/appStore.ts'

/** Routes and store wiring. The caller supplies the router so tests can use an in-memory one. */
export default function App({ store, content }: { store: AppStore; content: ContentSource }) {
  useEffect(() => {
    void store.getState().load()
  }, [store])

  return (
    <AppStoreContext.Provider value={store}>
      <ContentSourceProvider value={content}>
        <main>
          <Routes>
            <Route path="/" element={<ProfilePicker />} />
            <Route path="/child/:childId" element={<ChildHome />} />
            <Route path="/child/:childId/lesson/:lessonId" element={<LessonPage />} />
            <Route path="/parent" element={<ParentArea />} />
            <Route path="/parent/progress/:childId" element={<ParentGate><ProgressReport /></ParentGate>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </ContentSourceProvider>
    </AppStoreContext.Provider>
  )
}
