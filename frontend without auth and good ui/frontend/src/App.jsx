import Header from "./components/Header/Header.jsx"
import Main from "./components/Main/Main.jsx"
import { UserSettingsProvider } from "./context/UserSettingsContext.jsx"

function App() {
  return (
    <UserSettingsProvider>
      <div id="app-root" className="flex flex-col h-screen overflow-hidden">
        <Header />
        <Main />
      </div>
    </UserSettingsProvider>
  )
}

export default App
