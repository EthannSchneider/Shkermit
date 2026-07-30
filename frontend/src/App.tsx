import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Header from "./components/header";
import Footer from "./components/footer";
import Picture from "./pages/Picture";
import Games from "./pages/Games";
import ShkermitClicker from "./pages/games/clicker";

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pictures" element={<Picture />} />
        <Route path="/games">
          <Route index element={<Games />} />
          <Route path="clicker" element={<ShkermitClicker />} />
        </Route>
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
