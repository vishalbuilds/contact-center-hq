import Header from "./components/Header/Header.jsx"
import Main from "./components/Main/Main.jsx"


// main function to call header and main components
function App() {
  return (
    <div id="app-root" className="flex flex-col h-screen overflow-hidden">
      <Header />
      <Main />
    </div >
  )
}

export default App
