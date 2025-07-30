import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Routes, Route } from "react-router-dom";
import App from "./components/App";
import Login from "./pages/login";
import Register from "./pages/register";

export function render(url) {
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<App />} />
        </Routes>
      </StaticRouter>
    </StrictMode>,
  );
  return { html };
}
