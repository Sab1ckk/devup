import { useEffect, useState, lazy, Suspense } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Routes,
  Route,
  Link,
} from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SharedDialogs from "./components/SharedDialogs";
import { UIProvider } from "./components/UI";
import { AuthProvider } from "./features/AuthContext";
import AuthDialog from "./features/AuthDialog";
import Home from "./pages/Home";
import Services from "./pages/Services";
import Portfolio from "./pages/Portfolio";
import Reviews from "./pages/Reviews";
import Chat from "./pages/Chat";
import Order from "./pages/Order";
import Cabinet from "./pages/Cabinet";
import useSiteEffects from "./hooks/useSiteEffects";
import { api } from "./lib/api";
import { AdminProvider, AdminBar } from "./features/AdminContext";
const AdminApp = lazy(() => import("./features/admin/AdminApp"));
function Layout() {
  const [content, setContent] = useState({});
  useSiteEffects();
  useEffect(() => {
    let live = true;
    api("/site-content")
      .then((r) => {
        if (live) setContent(r);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <>
      <AdminBar />
      <a className="skip-link" href="#content">
        К содержимому
      </a>
      <div className="shell">
        <Header />
        <main className="main" id="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/index.html" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/order" element={<Order />} />
            <Route path="/cabinet" element={<Cabinet />} />
            <Route
              path="*"
              element={
                <section className="pagehd">
                  <h1>Страница не найдена</h1>
                  <Link className="btn" to="/">
                    На главную
                  </Link>
                </section>
              }
            />
          </Routes>
          <Footer />
        </main>
      </div>
      <SharedDialogs content={content} />
      <AuthDialog />
    </>
  );
}
function Entry() {
  return (
    <Routes>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<p role="status">Загружаем админку…</p>}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route path="*" element={<Layout />} />
    </Routes>
  );
}
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <UIProvider>
        <AuthProvider>
          <AdminProvider>
            <Entry />
          </AdminProvider>
        </AuthProvider>
      </UIProvider>
    ),
  },
]);
export default function App() {
  return <RouterProvider router={router} />;
}
