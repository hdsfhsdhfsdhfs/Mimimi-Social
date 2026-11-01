"use client";

import { useEffect, useState } from "react";
import AuthPanel from "./auth-panel";
import { getSupabase } from "@/lib/supabase";
import {
  Bell, Compass, Home, MessageCircle, Users, ShoppingBag, Settings,
  Search, Plus, Heart, MessageSquare, Share2, Image as ImageIcon,
  Moon, Sun, Sparkles, ChevronRight, X, PawPrint, Bookmark, Menu
} from "lucide-react";

type DbPost = { id:string; author_id:string; post_type:"simple"|"advanced"; title:string|null; content:string; cover_url:string|null; media_url:string|null; media_type:string|null; audio_url:string|null; background_color:string; background_image_url:string|null; created_at:string; author_name:string; author_handle:string; author_avatar:string|null; author_role:string|null; author_verified:boolean; likes_count:number; comments_count:number; liked_by_me:boolean };

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
  const [plusOpen, setPlusOpen] = useState(false);
  const [socialPosts, setSocialPosts] = useState<DbPost[]>([]);

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
    if (!authenticated) return;
    let active = true;
    async function loadSocialPosts() {
      const supabase = getSupabase();
      const {data:rows} = await supabase.from("social_posts").select("id,author_id,post_type,title,content,cover_url,media_url,media_type,audio_url,background_color,background_image_url,created_at").eq("is_draft",false).order("created_at",{ascending:false}).limit(30);
      if (!active || !rows?.length) { if(active) setSocialPosts([]); return; }
      const [{data:userResult},{data:likeRows},{data:commentRows}] = await Promise.all([supabase.auth.getUser(),supabase.from("social_post_likes").select("post_id,user_id").in("post_id",rows.map((row:any)=>row.id)),supabase.from("social_post_comments").select("post_id").in("post_id",rows.map((row:any)=>row.id))]);
      const me=userResult?.user?.id||"";
      const ids = [...new Set(rows.map((row:any)=>row.author_id))];
      const {data:people} = await supabase.from("profiles").select("auth_user_id,display_name,username,avatar_url,role_label,is_official").in("auth_user_id",ids);
      const byId = new Map((people||[]).map((p:any)=>[p.auth_user_id,p]));
      setSocialPosts(rows.map((row:any)=>{const p:any=byId.get(row.author_id);const likes=(likeRows||[]).filter((x:any)=>x.post_id===row.id);const comments=(commentRows||[]).filter((x:any)=>x.post_id===row.id);return {...row,author_name:p?.display_name||"Pessoa Mimimi",author_handle:p?.username?"@"+p.username:"@membro",author_avatar:p?.avatar_url||null,author_role:p?.role_label||null,author_verified:!!p?.is_official,likes_count:likes.length,comments_count:comments.length,liked_by_me:likes.some((x:any)=>x.user_id===me)};}) as DbPost[]);
    }
    void loadSocialPosts();
    return ()=>{active=false;};
  },[authenticated]);

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

  async function toggleSocialLike(post:DbPost) {
    const supabase=getSupabase();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const wasLiked=post.liked_by_me;
    setSocialPosts(old=>old.map(p=>p.id===post.id?{...p,liked_by_me:!wasLiked,likes_count:Math.max(0,p.likes_count+(wasLiked?-1:1))}:p));
    const result=wasLiked?await supabase.from("social_post_likes").delete().eq("post_id",post.id).eq("user_id",user.id):await supabase.from("social_post_likes").insert({post_id:post.id,user_id:user.id});
    if(result.error){setSocialPosts(old=>old.map(p=>p.id===post.id?{...p,liked_by_me:wasLiked,likes_count:Math.max(0,p.likes_count+(wasLiked?1:-1))}:p));setNotice("Não foi possível atualizar sua curtida. Tente novamente.");}
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
            <button className="avatar avatar-large" aria-label="Abrir meu perfil" onClick={() => { window.location.href = "/perfil"; }}>M</button>
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
            <div className="welcome-copy"><span className="eyebrow"><Sparkles size={14} /> SEU CANTINHO NA INTERNET</span><h1>Um mundo de conexões começa com um <em>oi.</em></h1><p>Faça amizades, compartilhe seus momentos e encontre pessoas que combinam com você.</p><button className="primary-button" onClick={() => setPlusOpen(!plusOpen)}>Compartilhar algo <ChevronRight size={17} /></button></div>
            <div className="bunny-art" aria-hidden="true"><div className="bunny-ear ear-one" /><div className="bunny-ear ear-two" /><div className="bunny-face"><span className="eye eye-one" /><span className="eye eye-two" /><span className="nose" /><span className="cheek cheek-one" /><span className="cheek cheek-two" /></div><span className="sparkle s-one">✦</span><span className="sparkle s-two">✧</span></div>
          </div>

          <div className="section-heading"><div><span className="eyebrow">SEU MUNDO, SUAS PESSOAS</span><h2>Feed para você</h2></div><button className="text-button" onClick={() => setNotice("Você está vendo as publicações mais recentes.")}>Mais recentes</button></div>

          <div className="composer" onClick={() => setPlusOpen(!plusOpen)}><div className="avatar">M</div><button className="composer-prompt">O que está acontecendo por aí?</button><button className="composer-add" aria-label="Criar publicação"><Plus size={20} /></button></div>{plusOpen&&<div className="plus-menu"><button onClick={()=>{window.location.href="/publicar";}}>＋ <span><strong>Postar</strong><small>Criar uma nova publicação</small></span></button><button onClick={()=>{window.location.href="/publicar?rascunhos=1";}}>▤ <span><strong>Rascunhos</strong><small>Continuar ou organizar posts salvos</small></span></button></div>}

          <div className="posts">{posts.map(post => <article className="post-card" key={post.id}><div className="post-head"><div className={"avatar avatar-" + post.color}>{post.initials}</div><div className="post-user"><strong>{post.name}</strong><span>{post.handle} · {post.time}</span></div><button className="tiny-icon" aria-label="Salvar publicação" onClick={() => setSaved(current => current.includes(post.id) ? current.filter(id => id !== post.id) : [...current, post.id])}><Bookmark size={18} fill={saved.includes(post.id) ? "currentColor" : "none"} /></button></div><p className="post-text">{post.text}</p><div className="post-actions"><button className={liked.includes(post.id) ? "action liked" : "action"} onClick={() => toggleLike(post.id)}><Heart size={18} fill={liked.includes(post.id) ? "currentColor" : "none"} /> {post.likes + (liked.includes(post.id) ? 1 : 0)}</button><button className="action" onClick={() => setNotice("Os comentários estarão disponíveis em breve.")}><MessageSquare size={18} /> {post.comments}</button><button className="action" onClick={() => setNotice("Compartilhamento estará disponível em breve.")}><Share2 size={18} /> Compartilhar</button></div></article>)}{socialPosts.map(post=><article className="post-card social-post-card" key={post.id} style={{backgroundColor:post.background_color,backgroundImage:post.background_image_url?'linear-gradient(#0002,#0002),url('+post.background_image_url+')':undefined,backgroundSize:"cover",backgroundPosition:"center"}}><div className="post-head"><button className="social-post-author-avatar" aria-label={"Abrir perfil de "+post.author_name} onClick={()=>{window.location.href="/perfil?id="+encodeURIComponent(post.author_id);}}><div className="avatar">{post.author_avatar?<img src={post.author_avatar} alt=""/>:post.author_name.charAt(0)}</div></button><button className="post-user social-post-author" onClick={()=>{window.location.href="/perfil?u="+encodeURIComponent(post.author_handle.replace(/^@/,""));}}><strong>{post.author_name}</strong><span>{post.author_handle} · {new Date(post.created_at).toLocaleString("pt-BR")}</span><span className="social-post-author-badges">{post.author_role&&<b className="social-role-badge">{post.author_role}</b>}{post.author_verified&&<b className="social-verified-badge" title="Conta verificada">✓ Verificado</b>}</span></button></div><div className="social-post-open-area" role="button" tabIndex={0} onClick={()=>{window.location.href="/post/"+post.id;}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();window.location.href="/post/"+post.id;}}}>{post.cover_url&&<img className="social-post-cover" src={post.cover_url} alt="Capa da publicação"/>}{post.title&&<h3 className="social-post-title">{post.title}</h3>}<p className="post-text">{post.content}</p>{post.media_url&&(post.media_type?.startsWith("video/")?<video className="social-post-media" src={post.media_url} controls onClick={e=>e.stopPropagation()}/>:<img className="social-post-media" src={post.media_url} alt="Mídia da publicação"/>)}{post.audio_url&&<audio className="social-post-audio" src={post.audio_url} controls onClick={e=>e.stopPropagation()}/>}<span className="social-post-read-more">Abrir publicação completa <ChevronRight size={15}/></span></div><div className="post-actions"><button className={post.liked_by_me?"action liked":"action"} onClick={()=>void toggleSocialLike(post)}><Heart size={18} fill={post.liked_by_me?"currentColor":"none"}/> {post.likes_count} Curtidas</button><button className="action" onClick={()=>{window.location.href="/post/"+post.id;}}><MessageSquare size={18}/> {post.comments_count} Comentários</button><button className="action" onClick={()=>setNotice("Compartilhamento estará disponível em breve.")}><Share2 size={18}/> Compartilhar</button></div></article>)}</div>
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
