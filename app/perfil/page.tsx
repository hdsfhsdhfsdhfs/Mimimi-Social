"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { ArrowLeft, Bell, Camera, Check, Edit3, MessageCircle, MoreHorizontal, Save, Users, Eye } from "lucide-react";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string;
  avatar_url: string | null;
  created_at: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("Publicações");

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      const { data, error } = await supabase.from("profiles").select("id, username, display_name, bio, avatar_url, created_at").eq("id", user.id).maybeSingle();
      if (!active) return;
      if (error) {
        setMessage("Não foi possível carregar seu perfil. Tente novamente.");
      } else {
        const current = data || {
          id: user.id,
          username: null,
          display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || "Meu perfil",
          bio: "",
          avatar_url: null,
          created_at: user.created_at
        };
        setProfile(current as Profile);
        setDisplayName(current.display_name || "");
        setUsername(current.username || "");
        setBio(current.bio || "");
      }
      setLoading(false);
    }
    loadProfile();
    return () => { active = false; };
  }, [router]);

  async function saveProfile() {
    if (!profile) return;
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
    if (!cleanName) {
      setMessage("Escolha um nome para exibir no seu perfil.");
      return;
    }
    if (cleanUsername && !/^[a-z0-9._]{3,20}$/.test(cleanUsername)) {
      setMessage("O @usuário deve ter de 3 a 20 caracteres: letras, números, ponto ou underline.");
      return;
    }
    setSaving(true);
    setMessage("");
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/");
      return;
    }
    const values = {
      id: user.id,
      display_name: cleanName,
      username: cleanUsername || null,
      bio: bio.trim().slice(0, 160),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from("profiles").upsert(values).select("id, username, display_name, bio, avatar_url, created_at").single();
    if (error) {
      setMessage(error.code === "23505" ? "Esse @usuário já está sendo usado. Escolha outro." : "Não foi possível salvar agora. Confira sua conexão e tente novamente.");
    } else {
      setProfile({ ...profile, ...values });
      setEditing(false);
      setMessage("Seu cantinho foi atualizado! 💗");
    }
    setSaving(false);
  }

  if (loading) return <main className="profile-loading">Preparando seu cantinho... 💗</main>;

  const name = profile?.display_name || "Meu perfil";
  const handle = profile?.username ? "@" + profile.username : "@defina_seu_usuario";
  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }) : "recentemente";
  const initial = name.trim().charAt(0).toUpperCase() || "M";

  return (
    <main className="profile-page">
      <header className="profile-topbar">
        <button className="profile-back" onClick={() => router.push("/")} aria-label="Voltar ao início"><ArrowLeft size={20} /></button>
        <strong>Mimimi</strong>
        <button className="profile-back" aria-label="Mais opções" onClick={() => setMessage("Mais opções estarão disponíveis em breve.")}><MoreHorizontal size={21} /></button>
      </header>

      <section className="profile-cover">
        <div className="profile-cover-glow" />
        <div className="profile-hero">
          <div className="profile-avatar-wrap">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="Foto do perfil" /> : <span>{initial}</span>}
            <i />
          </div>
          <div className="profile-identity">
            <h1>{name}</h1>
            <p>{handle}</p>
            <span className="profile-joined">Membro desde {joined}</span>
          </div>
          <p className="profile-bio">{profile?.bio || "Este cantinho está esperando por uma descrição especial. ♡"}</p>
          <button className="profile-edit-button" onClick={() => { setEditing(!editing); setMessage(""); }}>
            <Edit3 size={16} /> {editing ? "Fechar edição" : "Editar perfil"}
          </button>
        </div>
        <div className="profile-stats">
          <div><strong>—</strong><span><Users size={14} /> Seguidores</span></div>
          <div><strong>—</strong><span><Users size={14} /> Seguindo</span></div>
          <div><strong>—</strong><span><Eye size={14} /> Visitas</span></div>
        </div>
      </section>

      {editing && <section className="profile-edit-card">
        <div className="profile-edit-heading"><strong>Seu cantinho, suas escolhas</strong><span>Personalize suas informações</span></div>
        <label>Nome de exibição<input value={displayName} maxLength={40} onChange={event => setDisplayName(event.target.value)} placeholder="Como quer ser chamado?" /></label>
        <label>@Nome de usuário<input value={username} maxLength={20} onChange={event => setUsername(event.target.value.replace(/^@/, ""))} placeholder="seuusuario" /></label>
        <label>Biografia<textarea value={bio} maxLength={160} onChange={event => setBio(event.target.value)} placeholder="Conte um pouquinho sobre você..." /></label>
        <div className="profile-edit-footer"><small>{bio.length}/160</small><button onClick={saveProfile} disabled={saving}><Save size={16} /> {saving ? "Salvando..." : "Salvar alterações"}</button></div>
      </section>}

      {message && <p className="profile-feedback" role="status">{message}</p>}

      <div className="profile-tabs">
        {["Publicações", "Mural", "Sobre mim"].map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <section className="profile-tab-content">
        {tab === "Publicações" && <div className="profile-empty"><span>✧</span><strong>Suas histórias começam aqui</strong><p>Quando você publicar algo, suas publicações aparecerão neste espaço.</p></div>}
        {tab === "Mural" && <div className="profile-empty"><MessageCircle size={27} /><strong>Seu mural está chegando!</strong><p>Em breve, seus amigos poderão deixar mensagens neste cantinho.</p></div>}
        {tab === "Sobre mim" && <div className="profile-about"><h2>Sobre mim</h2><p>{profile?.bio || "Ainda não adicionou uma biografia."}</p><span>Membro do Mimimi desde {joined}</span></div>}
      </section>
      <footer className="profile-footer">Feito com carinho ♡ Mimimi</footer>
    </main>
  );
}
