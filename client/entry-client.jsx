import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./pages/App.jsx";
import Login from "./pages/login";
import "./css/base.css";
import Register from "./pages/register";
import EmailLogin from "./pages/email_login";
import Conversation from "./pages/Conversation";
import NotFound from './pages/NotFound.jsx'
import MePage from "./pages/MePage";

const container = document.getElementById("root");

// note, to add new endpoint. you need to edit entry-server.jsx and entry-client.jsx
// if you want the path to be public, go edit server.js at line 39
// const publicPaths = ["/login", "/register", "/newendpoint"];

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<App />} />
        <Route path="/me" element={<MePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/email" element={<EmailLogin />} />
        <Route path="/conversation" element={<Conversation />} />
        <Route path="*" element={<NotFound />} />  {/* catch-all 404 */}
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
