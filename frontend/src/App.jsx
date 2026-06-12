import { UserProvider } from "./context/UserContext.jsx";
import Header from "./components/Header/Header.jsx";
import Main from "./components/Main/Main.jsx";

function App() {
  return (
    <UserProvider>
      <div id="app-root" className="flex flex-col h-screen overflow-hidden">
        <Header />
        <Main />
      </div>
    </UserProvider>
  );
}

export default App;
