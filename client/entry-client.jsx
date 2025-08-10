import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./components/App";
import Login from "./pages/login";
import "./base.css";
import Register from "./pages/register";

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
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
