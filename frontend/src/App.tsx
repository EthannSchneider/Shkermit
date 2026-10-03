import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Header from "./components/header";
import Footer from "./components/footer";
import Picture from "./pages/Picture";
import Games from "./pages/Games";
import ShkermitClicker from "./pages/games/clicker";
import SnakeGame from "./pages/games/snake";
import TetrisGame from "./pages/games/tetris";

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
          <Route path="snake" element={<SnakeGame />} />
          <Route path="tetris" element={<TetrisGame />} />
        </Route>
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
