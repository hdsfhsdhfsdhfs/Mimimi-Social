"use client";

import { useEffect, useState } from "react";
import AuthPanel from "./auth-panel";
import { getSupabase } from "@/lib/supabase";
import {
  Bell, Compass, Home, MessageCircle, Users, ShoppingBag, Settings,
  Search, Plus, Heart, MessageSquare, Share2, Image as ImageIcon,
  Moon, Sun, Sparkles, ChevronRight, X, PawPrint, Bookmark, Menu
} from "lucide-react";

type Post = {
  id: number;
  name: string;
  handle: string;
  time: string;
  text: string;
  likes: number;
  comments: number;
  color: string;
  initials: string;
};

const initialPosts: Post[] = [
  { id: 1, name: "Luna", handle: "@luninha", time: "há 12 min", text: "Oi, gente! 💗 Estou procurando pessoas para conversar sobre jogos, música e coisinhas fofas. Quem também ama fazer novas amizades?", likes: 28, comments: 7, color: "pink", initials: "L" },
  { id: 2, name: "Theo", handle: "@theozin", time: "há 38 min", text: "Uma lembrança para hoje: você não precisa ter tudo resolvido agora. Vá no seu ritmo. 🌷", likes: 46, comments: 12, color: "orange", initials: "T" },
  { id: 3, name: "Mimi", handle: "@mimiverse", time: "há 1 h", text: "Qual comunidade vocês gostariam de ver por aqui? Games, desenhos, música ou leitura? ✨", likes: 19, comments: 5, color: "purple", initials: "M" }
];

const navItems = [
  { label: "Início", icon: Home },
  { label: "Explorar", icon: Compass },
  { label: "Comunidades", icon: Users },
  { label: "Conversas", icon: MessageCircle },
  { label: "Loja", icon: ShoppingBag }
];

export default function HomePage() {
  const [sessionReady, setSessionReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState("Início");
  const [liked, setLiked] = useState<number[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [posts, setPosts] = useState(initialPosts);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [devOpen, setDevOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setAuthenticated(!!data.session);
        setSessionReady(true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
      setSessionReady(true);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("mimimi-theme");
    if (stored === "dark") setDark(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("mimimi-theme", dark ? "dark" : "light");
  }, [dark]);

  function publish() {
    if (!draft.trim()) return;
    setPosts([{ id: Date.now(), name: "Você", handle: "@seuperfil", time: "agora", text: draft.trim(), likes: 0, comments: 0, color: "pink", initials: "V" }, ...posts]);
    setDraft("");
    setComposerOpen(false);
    setNotice("Publicação adicionada nesta demonstração!");
  }

  function toggleLike(id: number) {
    setLiked(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  function comingSoon(label: string) {
    setActive(label);
    if (label !== "Início") setNotice(label + " estará disponível nas próximas etapas 💗");
  }

  if (!sessionReady) return <main className="auth-page"><div className="auth-loading">Preparando seu cantinho... 💗</div></main>;
  if (!authenticated) return <AuthPanel />;

  return (
    <main className={dark ? "app dark" : "app"}>
      <header className="topbar">
        <button className="icon-button mobile-only" aria-label="Abrir menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={21} /></button>
        <a className="brand" href="#" onClick={() => setActive("Início")}><span className="brand-mark"><img src="/mimimi-icon.webp" alt="" /></span><span>Mimimi</span></a>
        <div className="search-wrap"><Search size={18} /><input aria-label="Pesquisar" placeholder="Pesquisar pessoas, posts e comunidades..." /></div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Atividades" onClick={() => setNotice("Você está em dia com suas atividades!")}><Bell size={20} /><i /></button>
          <button className="icon-button" aria-label="Alternar tema" onClick={() => setDark(!dark)}>{dark ? <Sun size={20} /> : <Moon size={20} />}</button>
          <button className="profile-mini" aria-label="Abrir perfil" onClick={() => { window.location.href = "/perfil"; }}>M</button>
        </div>
      </header>

      <div className="layout">
        <aside className={mobileMenu ? "sidebar show" : "sidebar"}>
          <div className="side-profile">
            <div className="avatar avatar-large">M</div>
            <div><strong>Meu cantinho</strong><span>@seuperfil</span></div>
            <button className="tiny-icon" aria-label="Configurações" onClick={() => setNotice("Configurações em desenvolvimento.")}><Settings size={17} /></button>
          </div>
          <nav className="nav-list">
            {navItems.map(({ label, icon: Icon }) => <button key={label} className={active === label ? "nav-item selected" : "nav-item"} onClick={() => { comingSoon(label); setMobileMenu(false); }}><Icon size={19} /><span>{label}</span>{label === "Conversas" && <small>2</small>}</button>)}
          </nav>
          <button className="create-community" onClick={() => setNotice("A criação de comunidades chega em breve.")}><Plus size={18} /> Criar comunidade</button>
          <div className="sidebar-bottom"><span>Feito com carinho</span><span>♡ Mimimi 2026</span></div>
        </aside>

        <section className="feed">
          <div className="welcome-card">
            <div className="welcome-copy"><span className="eyebrow"><Sparkles size={14} /> SEU CANTINHO NA INTERNET</span><h1>Um mundo de conexões começa com um <em>oi.</em></h1><p>Faça amizades, compartilhe seus momentos e encontre pessoas que combinam com você.</p><button className="primary-button" onClick={() => setComposerOpen(true)}>Compartilhar algo <ChevronRight size={17} /></button></div>
            <div className="bunny-art" aria-hidden="true"><div className="bunny-ear ear-one" /><div className="bunny-ear ear-two" /><div className="bunny-face"><span className="eye eye-one" /><span className="eye eye-two" /><span className="nose" /><span className="cheek cheek-one" /><span className="cheek cheek-two" /></div><span className="sparkle s-one">✦</span><span className="sparkle s-two">✧</span></div>
          </div>

          <div className="section-heading"><div><span className="eyebrow">SEU MUNDO, SUAS PESSOAS</span><h2>Feed para você</h2></div><button className="text-button" onClick={() => setNotice("Você está vendo as publicações mais recentes.")}>Mais recentes</button></div>

          <div className="composer" onClick={() => setComposerOpen(true)}><div className="avatar">M</div><button className="composer-prompt">O que está acontecendo por aí?</button><button className="composer-add" aria-label="Criar publicação"><Plus size={20} /></button></div>

          <div className="posts">{posts.map(post => <article className="post-card" key={post.id}><div className="post-head"><div className={"avatar avatar-" + post.color}>{post.initials}</div><div className="post-user"><strong>{post.name}</strong><span>{post.handle} · {post.time}</span></div><button className="tiny-icon" aria-label="Salvar publicação" onClick={() => setSaved(current => current.includes(post.id) ? current.filter(id => id !== post.id) : [...current, post.id])}><Bookmark size={18} fill={saved.includes(post.id) ? "currentColor" : "none"} /></button></div><p className="post-text">{post.text}</p><div className="post-actions"><button className={liked.includes(post.id) ? "action liked" : "action"} onClick={() => toggleLike(post.id)}><Heart size={18} fill={liked.includes(post.id) ? "currentColor" : "none"} /> {post.likes + (liked.includes(post.id) ? 1 : 0)}</button><button className="action" onClick={() => setNotice("Os comentários estarão disponíveis em breve.")}><MessageSquare size={18} /> {post.comments}</button><button className="action" onClick={() => setNotice("Compartilhamento estará disponível em breve.")}><Share2 size={18} /> Compartilhar</button></div></article>)}</div>
        </section>

        <aside className="rightbar">
          <div className="dev-card"><div className="dev-top"><span className="dev-spark">✦</span><strong>Construindo o Mimimi</strong></div><p>Um espaço feito para aproximar pessoas e celebrar pequenas conexões.</p><button className="dev-badge" onClick={() => setDevOpen(!devOpen)}>BunnyDev <Sparkles size={13} /></button>{devOpen && <div className="dev-message">Esse usuário é um desenvolvedor oficial do aplicativo.</div>}</div>
          <div className="suggest-card"><div className="card-title"><strong>Para descobrir</strong><button className="text-button" onClick={() => comingSoon("Explorar")}>Ver tudo</button></div><div className="suggestion"><div className="suggest-icon pink-bg"><PawPrint size={18} /></div><div><strong>Clube dos fofinhos</strong><span>Arte · amizade · diversão</span></div><button onClick={() => setNotice("Comunidades estarão disponíveis em breve.")}>+</button></div><div className="suggestion"><div className="suggest-icon orange-bg"><Sparkles size={18} /></div><div><strong>Universo gamer</strong><span>Jogos · dicas · companhia</span></div><button onClick={() => setNotice("Comunidades estarão disponíveis em breve.")}>+</button></div></div>
          <div className="mini-note"><Heart size={15} fill="currentColor" /> Um lugar para ser você.</div>
        </aside>
      </div>

      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={15} /></button></div>}

      {composerOpen && <div className="modal-backdrop" onClick={() => setComposerOpen(false)}><div className="composer-modal" onClick={event => event.stopPropagation()}><div className="modal-head"><strong>Criar publicação</strong><button className="tiny-icon" onClick={() => setComposerOpen(false)} aria-label="Fechar"><X size={19} /></button></div><textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="Compartilhe um pouquinho do seu mundo..." autoFocus /><div className="modal-foot"><span><ImageIcon size={17} /> Fotos em breve</span><button className="primary-button" disabled={!draft.trim()} onClick={publish}>Publicar</button></div></div></div>}

      <footer className="mobile-nav">{navItems.slice(0, 5).map(({ label, icon: Icon }) => <button key={label} className={active === label ? "mobile-nav-item active" : "mobile-nav-item"} onClick={() => comingSoon(label)}><Icon size={20} /><span>{label}</span></button>)}</footer>
    </main>
  );
}
