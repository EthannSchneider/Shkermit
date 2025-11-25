import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Header from "./components/header";
import Footer from "./components/footer";
import Picture from "./pages/Picture";

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pictures" element={<Picture />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
